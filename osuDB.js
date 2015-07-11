//fs.writeFile('file' + i + '.osu', zip.readAsText(zipEntries[i]), function (err) {   var a = 2; });


require('./schema/beatmap.js')();
require('./schema/beatmapSet.js')();
//var JSZip = require('node-zip');
var mongoose = require('mongoose');
// grab the person model object
var Beatmap = mongoose.model("Beatmap");
var BeatmapSet = mongoose.model("BeatmapSet");
var http = require('http');
// connect to a server to do a quick write / read example
var Q = require('q');
var isConnected = Q.defer();
var moment = require('moment');
var fs = require('fs');
var AdmZip = require('adm-zip');
var util = require('util');
var Guid = require('Guid');
var S = require('string');
var _ = require('underscore');

function OsuTools() {
    var that = this;
    that.bloodCatPile = [];
    that.isConnectedDefer =  Q.defer();
    that.isConnected = that.isConnectedDefer.promise;
    that.treatmentId = Guid.create();
    mongoose.connect('mongodb://127.0.0.1:27017/OSU', function (err) {
        if (err) throw err;
        that.isConnectedDefer.resolve();
    });
}
OsuTools.prototype.doNextCall = function () {
    var that = this;
    var nextCallHasbeenDone = false;
    if (that.bloodCatPile.length > 0) {
        var nextCall = that.bloodCatPile[0];
        that.bloodCatPile.shift();
        nextCallHasbeenDone = true;
        that.doCallToBloodcat(nextCall.id, nextCall.isDownloaded);
    }
    if (false === nextCallHasbeenDone) {
        setTimeout(function () {
            that.doNextCall()
        }, 5000);
    }
};
OsuTools.prototype.doCallToBloodcat = function (id, isDownloaded) {
    var that = this;
    http.get({
            hostname: "bloodcat.com",
            port: 80,
            path: '/osu/s/' + id,
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, sdch",
                "Accept-Language": "fr-FR,fr;q=0.8,en-US;q=0.6,en;q=0.4",
                "Connection": "keep-alive",
                "Host": "bloodcat.com"
            }
        }
        , function (res) {
            var data = [], dataLen = 0;
            res.on('data', function (chunk) {
                data.push(chunk);
                dataLen += chunk.length;
            })
                .on('end', function () {
                    var buf = new Buffer(dataLen);
                    for (var i = 0, len = data.length, pos = 0; i < len; i++) {
                        data[i].copy(buf, pos);
                        pos += data[i].length;
                    }
                    var zip = new AdmZip(buf);
                    var zipEntries = zip.getEntries();
                    isDownloaded.resolve(zipEntries);
                    setTimeout(function(){
                        that.doNextCall();
                    }, 5000);
                });
        });
};
OsuTools.prototype.addCallToBloodCat = function (beatmapSetId, d) {
    var that = this;
    that.bloodCatPile.push({id: beatmapSetId, isDownloaded: d});
};
OsuTools.prototype.getNormalizedDifficulty = function (difficultyRating) {
    /*
     Below 1.5: Easy
     Below 2.25: Normal
     Below 3.75: Hard
     Below 5.25: Insane
     Above 5.25: Expert

     */
    var normalizedDifficulty = 0;
    if (difficultyRating < 1.5) {
        normalizedDifficulty = 1;
    }
    else if (difficultyRating < 2.25) {
        normalizedDifficulty = 2;
    }
    else if (difficultyRating < 3.75) {
        normalizedDifficulty = 3;
    }
    else if (difficultyRating < 5.25) {
        normalizedDifficulty = 4;
    }
    else {
        normalizedDifficulty = 5;
    }
    return normalizedDifficulty;
};
OsuTools.prototype.getFilesFromBloodcat = function (beatmapSetId) {
    var that = this;
    var d = Q.defer();
    that.addCallToBloodCat(beatmapSetId, d);
    return d.promise;
};
OsuTools.prototype.buildFileName = function (beatmap) {
    return util.format('%s - %s (%s) [%s].osu', beatmap.artist, beatmap.title, beatmap.creator, beatmap.version);
};

OsuTools.prototype.checkIfBeatmapMustBeUpdated = function (webBeatmap, beatmapsToUpdate) {
    var d = Q.defer();
    var beatmapId = webBeatmap.beatmap_id;
    var webLastUpdate = moment(webBeatmap.last_update);
    Beatmap.findOne({'beatmap_id': beatmapId}, function (err, databaseBeatmap) {
        if (null === databaseBeatmap || moment(databaseBeatmap.last_update).isAfter(webLastUpdate)) {

            webBeatmap.difficulty = osuTools.getNormalizedDifficulty(webBeatmap.difficultyrating);
            webBeatmap.xFetchDate = moment();
            webBeatmap.xFileName = osuTools.buildFileName(webBeatmap);
            beatmapsToUpdate.push(webBeatmap);
        }
        d.resolve();
    });
    return d.promise;
};
OsuTools.prototype.checkIfBeatmapSetMustBeUpdated = function (webBeatmapSet, beatmapSetsToUpdate) {
    var that = this;
    var d = Q.defer();
    var filter = {beatmapset_id: webBeatmapSet.beatmapset_id};
    var webLastUpdate = moment(webBeatmapSet.last_update);
    var isAlreadyInUpdates = _.where(beatmapSetsToUpdate, filter).length > 0;
    if (false === isAlreadyInUpdates) {
        BeatmapSet.findOne(filter, function (err, databaseBeatmapSet) {
            if (null === databaseBeatmapSet || (moment(webBeatmapSet.last_update).isAfter(webLastUpdate) && databaseBeatmapSet.treatmentId !== that.treatmentId)) {

                webBeatmapSet.xFetchDate = moment();
                webBeatmapSet.TreatmentId = that.treatmentId;

                beatmapSetsToUpdate.push(webBeatmapSet);

            }
            d.resolve();
        });
    }
    else {
        d.resolve();
    }
    return d.promise;
};

OsuTools.prototype.upsertBeatmapSetAndBeatmaps = function (thing, isUpdated) {
    var dArray = [];
    var beatmapSetPromise = Q.defer();
    dArray.push(beatmapSetPromise.promise);
    BeatmapSet.findOneAndUpdate({'beatmapset_id': thing.beatmapSet.beatmapset_id}, thing.beatmapSet, {upsert: true}, function () {
        beatmapSetPromise.resolve();
    });
    _.each(thing.beatmaps, function (beatmap) {
        var beatmapPromise = Q.defer();
        dArray.push(beatmapPromise.promise);
        Beatmap.findOneAndUpdate({'beatmap_id': beatmap.beatmap_id}, beatmap, {upsert: true}, function () {
            beatmapPromise.resolve();
        });
    })

    Q.allSettled(dArray).then(function () {
        isUpdated.resolve();
    })
}
OsuTools.prototype.chainUpdateBeatmapSetAndBeatmaps = function (thing, isUpdated) {
    var that = this;


    Q.when(osuTools.getFilesFromBloodcat(thing.beatmapSet.beatmapset_id)).then(function (zipEntries) {
        for (var i = 0; i < zipEntries.length; i++) {
            var entryTitle = zipEntries[i].entryName;
            if (false === S(entryTitle).endsWith('.osu')) {
                thing.beatmapSet.xFiles.push({
                        name: entryTitle,
                        data: zipEntries[i].getData()
                    }
                );
            }
            else {
                var beatmapForThisFile = _.where(thing.beatmaps, {xFileName: entryTitle});
                if (beatmapForThisFile.length > 0) {
                    beatmapForThisFile[0].xFile = {
                        name: entryTitle,
                        data: zipEntries[i].getData()
                    };
                }
                else{
                    console.log('cannot found beatmap for file ' + entryTitle);
                }
            }
        }
        that.upsertBeatmapSetAndBeatmaps(thing, isUpdated);
        console.log('beatmapset ' + webBeatmapSet.beatmapset_id + ' has been updated');
    });
}

OsuTools.prototype.chainUpdate = function (thingsToUpdate, currentIndex, allIsUpdated) {
    var that = this;
    var thing = thingsToUpdate[currentIndex];
    var isUpdated = allIsUpdated[currentIndex];

    this.chainUpdateBeatmapSetAndBeatmaps(thing, isUpdated)
    if (currentIndex < thingsToUpdate.length - 1) {
        Q.when(isUpdated, function () {
            setTimeout(function () {
                that.chainUpdate(thingsToUpdate, currentIndex + 1, allIsUpdated);
            }, 1000)
        });
    }

};
OsuTools.prototype.startUpdate = function (thingsToUpdate, allIsDone) {
    var allIsUpdated = [];
    var allPromise =[];
    for (var i = 0; i < thingsToUpdate.length; i++) {
        var dOne =Q.defer()
        allIsUpdated.push(dOne);
        allPromise.push(dOne.promise);
    }
    if (thingsToUpdate.length > 0) {
        this.chainUpdate(thingsToUpdate, 0, allIsUpdated);
        Q.allSettled(allPromise).then(function () {
            console.log('this batch is done')
            allIsDone.resolve();
        });
    }
    else {
        allIsDone.resolve();
    }

    return allIsDone.promise;
};

var osuTools = new OsuTools();
osuTools.doNextCall();

module.exports = {
    writeBeatmaps: function (sr) {
        var allIsDone = Q.defer();
        var srJSON = JSON.parse(sr);
        console.log('start to check and write the ' + srJSON.length + ' beatmaps');
        Q.when(osuTools.isConnected).then(function () {
            var beatmapToUpdates = [];
            var beatmapSetToUpdates = [];
            var allIsChecked = [];
            var testedBeatmapSet = [];
            for (var i = 0; i < srJSON.length; i++) {
                var webBeatmap = new Beatmap(srJSON[i]);
                allIsChecked.push(osuTools.checkIfBeatmapMustBeUpdated(webBeatmap, beatmapToUpdates));

                if (undefined === _.find(testedBeatmapSet, function(x){
                        return x === webBeatmap.beatmapset_id;
                    })) {
                    testedBeatmapSet.push(webBeatmap.beatmapset_id);
                    var webBeatmapSet = new BeatmapSet(srJSON[i]);
                    allIsChecked.push(osuTools.checkIfBeatmapSetMustBeUpdated(webBeatmapSet, beatmapSetToUpdates));
                }
            }
            Q.allSettled(allIsChecked).then(function () {
                var beatmapsetsAndBeatmaps = [];
                _.each(beatmapSetToUpdates, function (beatmapsSet) {
                    var concat = {
                        beatmapSet: beatmapsSet,
                        beatmaps: _.where(beatmapToUpdates, {beatmapset_id: beatmapsSet.beatmapset_id})
                    }
                    beatmapsetsAndBeatmaps.push(concat)
                });
                console.log(beatmapSetToUpdates.length + ' beatmapsets and ' + beatmapToUpdates.length + ' beatmaps will be updated')
                osuTools.startUpdate(beatmapsetsAndBeatmaps, allIsDone);
            });
        });
        return allIsDone.promise;
    }
};


// add local file
//zip.addLocalFile("/home/me/some_picture.png");
//// get everything as a buffer
//var willSendthis = zip.toBuffer();
// or write everything to disk

//fs.writeFile('test/' + xF.name, xF.data, function (err) {
//    if (err) throw err;
//    console.log('It\'s saved!');
//});