var jszip = require('jszip')
var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");

var Q = require('q');
var moment = require('moment');
var fs = require('fs');
var util = require('util');
var _ = require('underscore');
require('colors');


var request = require('request');
var tough = require('tough-cookie');
var Cookie = tough.Cookie;

var http = require('http-debug').http;

var mapTools = require('./mapTools')
var osuFiles = require('./osuFiles');
function wLog(msg){
    process.send({msgFromWorker: msg})
}

function Analyze(queue, libraryPath, tempFolder, forceRedownload, firstBeatmap, othersBeatmaps) {
    var that = this;
    this.id = firstBeatmap.beatmapset_id;
    this.queue = queue;
    this.beatmaps = _.map(othersBeatmaps, function (b) {
        var webBeatmap = new Beatmap(b);
        webBeatmap.difficulty = mapTools.getNormalizedDifficulty(webBeatmap.difficultyrating);
        webBeatmap.xFileName = mapTools.buildFileName(webBeatmap);
        return webBeatmap;
    })
    this.files = osuFiles.get(libraryPath, libraryPath + tempFolder, forceRedownload, this.id, firstBeatmap.last_update);
    this.toUpdate = false;
}

Analyze.prototype.updateFileInfoInDatabase = function () {
    var isUpserted = Q.defer();
    var that = this;
    var dArray = [];
    _.each(that.beatmaps, function (beatmap) {

        var beatmapPromise = Q.defer();
        dArray.push(beatmapPromise.promise);
        var simpleB = {};
        simpleB.mp3_403 = that.files.mp3.get403 ? new Date() : null;
        simpleB.image_403 = that.files.image.get403 ? new Date() : null;
        simpleB.largeImage_403 = that.files.largeImage.get403 ? new Date() : null;
        simpleB.osz_403 = that.files.osz.get403 ? new Date() : null;
        Beatmap.findOneAndUpdate({'beatmap_id': beatmap.beatmap_id}, simpleB, {upsert: false}, function (err, doc) {
            if (err) {
                console.log(err);
            }
            else {
                //console.log('beatmapset %s / map %s updated in database'.bgMagenta.white, beatmap.beatmapset_id, beatmap.beatmap_id)
            }
            beatmapPromise.resolve(true);
        });
    })

    Q.allSettled(dArray).then(function () {
        isUpserted.resolve(true);
    }).fail(function () {
        isUpserted.resolve(false);
    })
    return isUpserted.promise;
}
Analyze.prototype.queueDownload = function () {
    var that = this;
    var d = Q.defer();
    var filesToDownload = _.where(that.files.list, {toDownload: true});
    _.each(filesToDownload, function (f) {
        that.queue.queueNewCall(f.httpOptions, f.callbackToWrite, f.callbackToWriteError)
    });
    var downloadsOk = _.map(filesToDownload, function (f) {
        return f.isDownloaded;
    });
    //_.each(that.beatmaps, function (beatmap) {
    //    var scoreToGet = Q.defer();
    //    downloadsOk.push(scoreToGet.promise)
    //    that.queue.queueNewCall({
    //        isScoreUrl: true,
    //        beatmapId: beatmap.beatmap_id
    //    }, function(score){
    //        scoreToGet.resolve();
    //    }, function(err){
    //        scoreToGet.resolve();
    //    })
    //});


    Q.allSettled(downloadsOk).finally(function () {
        d.resolve();
    })
    return d.promise;
}
Analyze.prototype.update = function (isUpdated) {
    var that = this;

    Q.when(that.queueDownload()).finally(function () {
        Q.when(that.updateFileInfoInDatabase()).finally(function () {
            isUpdated.resolve();
        })
    });
}
Analyze.prototype.updateDatabase = function () {
    var that = this;
    var isUpserted = Q.defer();
    var dArray = [];
    _.each(that.beatmaps, function (beatmap) {
        var beatmapPromise = Q.defer();
        dArray.push(beatmapPromise.promise);
        var simpleB = beatmap.toJSON();
        delete simpleB._id;
        Beatmap.findOneAndUpdate({'beatmap_id': beatmap.beatmap_id}, simpleB, {upsert: true}, function (err, doc) {
            if (err) {
                console.log(err);
            }
            beatmapPromise.resolve(true);
        });
    });
    Q.allSettled(dArray).then(function () {
        isUpserted.resolve(true);
    }).fail(function () {
        isUpserted.resolve(false);
    })
    return isUpserted.promise;
}

Analyze.prototype.filesMustBeUpdated = function () {
    var that = this;
    var d = Q.defer()
    var databaseVerifications = [];
    var foundFirstBeatmap = null;
    _.each(that.beatmaps, function (jsonBeatmap) {
        var dBeatmap = Q.defer();
        databaseVerifications.push(dBeatmap.promise);
        Beatmap.findOne({'beatmap_id': jsonBeatmap.beatmap_id}, function (err, databaseBeatmap) {
            var toUpdate = (null === databaseBeatmap
            || moment(databaseBeatmap.last_update).isBefore(moment(jsonBeatmap.last_update))
            || moment(databaseBeatmap.approved_date).isBefore(moment(jsonBeatmap.approved_date))
            || databaseBeatmap.approved !== jsonBeatmap.approved);

            if (databaseBeatmap !== null) {
                that.files.mp3.get403 = (databaseBeatmap.mp3_403 !== undefined && databaseBeatmap.mp3_403 !== null);
                that.files.image.get403 = (databaseBeatmap.image_403 !== undefined && databaseBeatmap.image_403 !== null);
                that.files.largeImage.get403 = (databaseBeatmap.largeImage_403 !== undefined && databaseBeatmap.largeImage_403 !== null);
                that.files.osz.get403 = (databaseBeatmap.mp3_403 !== undefined && databaseBeatmap.mp3_403 !== null);
            }

            dBeatmap.resolve(toUpdate);
        });
    });

    var directoryIsOk = that.files.tryMakeDirSync(that.id);
    var fileVerifications = [];
    fileVerifications.push(that.files.mp3.isChecked)
    fileVerifications.push(that.files.largeImage.isChecked)
    fileVerifications.push(that.files.image.isChecked)
    fileVerifications.push(that.files.osz.isChecked)
    Q.allSettled(databaseVerifications).then(function (values) {
        var databaseIsOk = !(_.where(values, {value: true}).length > 0);
        Q.allSettled(fileVerifications).then(function () {
            var filesToDownload = _.filter(that.files.list, function (f) {
                return f.toDownload === true && f.get403 === false;
            })
            var filesAreOk = filesToDownload.length === 0;


            that.toUpdate = (false === databaseIsOk || false === filesAreOk || false === directoryIsOk);
            if (that.toUpdate === true) {
                //wLog('[%s] toUpdate: %s, files ok: %s, directory ok: %s, database ok: %s'.red, that.id, that.toUpdate, filesAreOk, directoryIsOk, databaseIsOk)
            }
            d.resolve(true);
        }).fail(function () {
            d.resolve(true);
        })
    }).fail(function () {
        d.resolve(false);
    });


    return d.promise;
};
Analyze.prototype.doMaintance = function () {
    var that = this;

    var d = Q.defer();
    var fileUpdateDefer = Q.defer();
    Q.when(that.filesMustBeUpdated()).then(function () {
        if (that.toUpdate === true) {
            that.update(fileUpdateDefer);
        }
        else {
            fileUpdateDefer.resolve();
        }
        // we update database no matter what we've done with files to update play count and score.
        Q.allSettled([that.updateDatabase(), fileUpdateDefer.promise]).then(function () {
            d.resolve();
        })
    })
    return d.promise;
}

module.exports = {
    get: function (queue, libraryPath, tempFolder, forceRedownload, firstBeatmap, othersBeatmaps) {
        return new Analyze(queue, libraryPath, tempFolder, forceRedownload, firstBeatmap, othersBeatmaps);
    }
}
