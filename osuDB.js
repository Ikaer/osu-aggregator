//fs.writeFile('file' + i + '.osu', zip.readAsText(zipEntries[i]), function (err) {   var a = 2; });


require('./schema/beatmap.js')();
require('./schema/beatmapSet.js')();

var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");
var BeatmapSet = mongoose.model("BeatmapSet");
var http = require('http');

var Q = require('q');
var moment = require('moment');
var fs = require('fs');
var util = require('util');
var Guid = require('Guid');
var _ = require('underscore');


function OsuTools() {
    var that = this;
    that.timeoutToTransferFiles = 500;
    that.maxTransfer = 3;
    that.forceRedownload = false;
    that.currentTransferCount = 0;
    that.transferPile = [];
    that.basePath = 'G:\\osu library\\';
    that.isConnectedDefer = Q.defer();
    that.isConnected = that.isConnectedDefer.promise;
    that.treatmentId = Guid.create();

    mongoose.connect('mongodb://127.0.0.1:27017/OSU', function (err) {
        if (err) throw err;
        that.isConnectedDefer.resolve();
    });
}
OsuTools.prototype.buildFilePath = function (id, endOfFile) {
    var that = this;
    return that.basePath + id + '\\' + id + endOfFile;
}
OsuTools.prototype.getFilesInformation = function (id) {
    var that = this;
    osuTools.tryMakeDirSync(that.basePath + id);
    return [{
        host: 'bloodcat.com',
        path: '/osu/s/' + id,
        filePath: that.buildFilePath(id, '.osz')
    }, {
        host: 'b.ppy.sh',
        path: '/thumb/' + id + 'l.jpg',
        filePath: that.buildFilePath(id, 'l.jpg')
    }, {
        host: 'b.ppy.sh',
        path: '/thumb/' + id + '.jpg',
        filePath: that.buildFilePath(id, '.jpg')
    }, {
        host: 'b.ppy.sh',
        path: '/preview/' + id + '.mp3',
        filePath: that.buildFilePath(id, '.mp3')
    }];
}
OsuTools.prototype.doNextCall = function () {
    var that = this;
    if (that.transferPile.length > 0) {
        for (var i = 0; i < that.maxTransfer; i++) {
            if (that.currentTransferCount < that.maxTransfer && that.transferPile.length > 0) {
                var nextCall = that.transferPile[0];
                that.currentTransferCount++;
                that.transferPile.shift();
                that.doCallToFiles(nextCall.id, nextCall.isDownloaded, nextCall.listOfFiles);
                Q.when(nextCall.isDownloaded.promise).then(function () {
                    that.currentTransferCount--;
                });
            }
        }
    }
    setTimeout(function () {
        that.doNextCall()
    }, that.timeoutToTransferFiles);
};
OsuTools.prototype.downloadFile = function (hostname, path, filePath) {
    var d = Q.defer();
    http.get({
            hostname: hostname,
            port: 80,
            path: path,
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, sdch",
                "Accept-Language": "fr-FR,fr;q=0.8,en-US;q=0.6,en;q=0.4",
                "Connection": "keep-alive",
                "Host": hostname
            }
        }
        , function (res) {
            console.log('downloading ' + filePath);
            var file = fs.createWriteStream(filePath);
            res.on('data', function (chunk) {
                file.write(chunk);
            })
                .on('end', function () {
                    file.end();
                    file.on('finish', function() {
                        d.resolve();
                    });
                })
                .on('error', function(e){
                    console.log(e);
                })

        });
    return d.promise;
}
OsuTools.prototype.tryCheckFile = function (filePath) {
    var ret = true;
    try {
        fs.statSync(filePath);
    } catch (e) {
        if(e.code != 'ENOENT') throw e;
        else ret = false;
    }
    return ret;
}
OsuTools.prototype.tryMakeDirSync = function (path) {
    try {
        fs.mkdirSync(path);
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
    }
};
OsuTools.prototype.checkFiles = function (id) {
    var that = this;
    var files = that.getFilesInformation(id);
    var atLeastOneMissing = false;
    _.each(files, function (f) {
        var fileExists = false === that.forceRedownload && that.tryCheckFile(f.filePath)
        f.exists = fileExists;
        if (false === fileExists) atLeastOneMissing = true;
    });
    if (true === atLeastOneMissing) {
        that.addCallToGetFiles(id, Q.defer(), _.where(files, {exists: false}))
    }
};
OsuTools.prototype.doCallToFiles = function (id, isDownloaded, listOfFiles) {
    var that = this;


    var files = listOfFiles ? listOfFiles : that.getFilesInformation(id);
    var downloadComplete = _.map(files, function (x) {
        return that.downloadFile(x.host, x.path, x.filePath);
    });

    Q.allSettled(downloadComplete).then(function () {
        isDownloaded.resolve();
    })
};
OsuTools.prototype.addCallToGetFiles = function (beatmapSetId, d, listOfFiles) {
    var that = this;
    // when listOfFiles is provided, only those ones will be download, its apart the update of database, mostly to double check.
    that.transferPile.push({id: beatmapSetId, isDownloaded: d, listOfFiles: listOfFiles ? listOfFiles : null});
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
    that.addCallToGetFiles(beatmapSetId, d);
    return d.promise;
};
OsuTools.prototype.buildFileName = function (beatmap) {
    return util.format('%s - %s (%s) [%s].osu', beatmap.artist, beatmap.title, beatmap.creator, beatmap.version);
};

OsuTools.prototype.checkIfBeatmapMustBeUpdated = function (jsonBeatmapSet, beatmapSetToUpdates) {
    var that = this;

    var d = Q.defer();
    var firstBeatmap = jsonBeatmapSet.beatmaps[0];
    var batchD = [];

    // checks for beatmaps
    _.each(jsonBeatmapSet.beatmaps, function (jsonBeatmap) {
        var dBeatmap = Q.defer();
        batchD.push(dBeatmap.promise);

        var beatmapId = jsonBeatmap.beatmap_id;
        var webLastUpdate = moment(jsonBeatmap.last_update);

        Beatmap.findOne({'beatmap_id': beatmapId}, function (err, databaseBeatmap) {
            var toUpdate = (null === databaseBeatmap
            || moment(databaseBeatmap.last_update).isAfter(webLastUpdate));
            dBeatmap.resolve(toUpdate);
        });
    });

    // checks for beatmapset
    var dBeatmapSet = Q.defer();
    batchD.push(dBeatmapSet.promise);
    BeatmapSet.findOne({beatmapset_id: jsonBeatmapSet.beatmapset_id}, function (err, databaseBeatmapSet) {
        var toUpdate = (null === databaseBeatmapSet || (moment(databaseBeatmapSet.last_update).isAfter(moment(firstBeatmap.last_update))));
        dBeatmapSet.resolve(toUpdate);
    });


    Q.allSettled(batchD).then(function (values) {
        var toUpdate = _.where(values, {value: true}).length > 0;
        if (toUpdate) {
            var fetchDate = moment();
            var dbBeatmapSet = new BeatmapSet(firstBeatmap);
            dbBeatmapSet.xFetchDate = fetchDate;

            var thing = {
                beatmapset_id: dbBeatmapSet.beatmapset_id,
                beatmapSet: dbBeatmapSet,
                beatmaps: _.map(jsonBeatmapSet.beatmaps, function (b) {
                    var webBeatmap = new Beatmap(b);
                    webBeatmap.difficulty = osuTools.getNormalizedDifficulty(webBeatmap.difficultyrating);
                    webBeatmap.xFetchDate = fetchDate;
                    webBeatmap.xFileName = osuTools.buildFileName(webBeatmap);
                    return webBeatmap;
                })
            };
            beatmapSetToUpdates.push(thing);
        }
        else {
            // double check for files
            that.checkFiles(firstBeatmap.beatmapset_id);
        }
        d.resolve();
    });
    return d.promise;
};

OsuTools.prototype.upsertBeatmapSetAndBeatmaps = function (thing, isUpdated) {
    var dArray = [];
    var beatmapSetPromise = Q.defer();
    dArray.push(beatmapSetPromise.promise);
    BeatmapSet.findOneAndUpdate({'beatmapset_id': thing.beatmapSet.beatmapset_id}, thing.beatmapSet, {upsert: true}, function () {
        console.log('beatmapset ' + thing.beatmapSet.beatmapset_id + ' updated in database')
        beatmapSetPromise.resolve();
    });
    _.each(thing.beatmaps, function (beatmap) {
        var beatmapPromise = Q.defer();
        dArray.push(beatmapPromise.promise);
        Beatmap.findOneAndUpdate({'beatmap_id': beatmap.beatmap_id}, beatmap, {upsert: true}, function () {
            console.log('beatmapset ' + thing.beatmapSet.beatmapset_id + ' / map ' + beatmap.beatmap_id + ' updated in database')
            beatmapPromise.resolve();
        });
    })

    Q.allSettled(dArray).then(function () {
        isUpdated.resolve();
    })
}
OsuTools.prototype.chainUpdateBeatmapSetAndBeatmaps = function (thing, isUpdated) {
    var that = this;
    Q.when(osuTools.getFilesFromBloodcat(thing.beatmapSet.beatmapset_id)).then(function () {
        that.upsertBeatmapSetAndBeatmaps(thing, isUpdated);
        console.log('beatmapset ' + thing.beatmapSet.beatmapset_id + ' has been updated');
    });
}

OsuTools.prototype.chainUpdate = function (thingsToUpdate, currentIndex, allIsUpdated) {
    var that = this;
    var thing = thingsToUpdate[currentIndex];
    var isUpdated = allIsUpdated[currentIndex];

    this.chainUpdateBeatmapSetAndBeatmaps(thing, isUpdated)
    if (currentIndex < thingsToUpdate.length - 1) {
        Q.when(isUpdated, function () {
            that.chainUpdate(thingsToUpdate, currentIndex + 1, allIsUpdated);
        });
    }

};
OsuTools.prototype.startUpdate = function (thingsToUpdate, allIsDone) {
    var allIsUpdated = [];
    var allPromise = [];
    for (var i = 0; i < thingsToUpdate.length; i++) {
        var dOne = Q.defer()
        allIsUpdated.push(dOne);
        allPromise.push(dOne.promise);
    }
    if (thingsToUpdate.length > 0) {
        this.chainUpdate(thingsToUpdate, 0, allIsUpdated);
        Q.allSettled(allPromise).then(function () {
            console.log('this batch is done')
            console.log('===============================================================================')
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

        var beatmapsetsIdAndBeatmaps = [];
        _.each(srJSON, function (x) {
            if (undefined === _.find(beatmapsetsIdAndBeatmaps, function (beatmapset) {
                    return beatmapset.beatmapset_id === x.beatmapset_id;
                })) {
                var toInsert = {
                    beatmapset_id: x.beatmapset_id,
                    beatmapset_lastupdate: x.last_update,
                    beatmaps: _.where(srJSON, {'beatmapset_id': x.beatmapset_id})
                };
                beatmapsetsIdAndBeatmaps.push(toInsert);
            }
        });


        console.log('start to check and write the ' + srJSON.length + ' beatmaps');
        Q.when(osuTools.isConnected).then(function () {
            var beatmapSetToUpdates = [];
            var allIsChecked = [];
            for (var i = 0; i < beatmapsetsIdAndBeatmaps.length; i++) {
                allIsChecked.push(osuTools.checkIfBeatmapMustBeUpdated(beatmapsetsIdAndBeatmaps[i], beatmapSetToUpdates));
            }
            Q.allSettled(allIsChecked).then(function () {
                console.log(beatmapSetToUpdates.length + ' beatmap sets will be updated')
                beatmapSetToUpdates = _.sortBy( beatmapSetToUpdates, 'beatmapset_id');
                osuTools.startUpdate(beatmapSetToUpdates, allIsDone);
            });
        });
        return allIsDone.promise;
    }
};

