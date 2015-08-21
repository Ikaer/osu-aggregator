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
var analyze = require('./analyse');

var queueManager = require('./queueManager');
function wLog(msg){
    process.send({msgFromWorker: msg})
}



function Analyzer(config) {
    var that = this;
    that.config = config;
    that.allIsDone = Q.defer();
    that.queue = queueManager.getQueue(config);
}
Analyzer.prototype.start = function (json) {
    var that = this;
    that.allIsDone = Q.defer();
    if (json.length === 0) {
        that.allIsDone.resolve(true);
    }
    else {
        var allMaintenanceIsDone = [];
        var maintenanceDoneCount = 0;
        var lastPercentage = 0;
        var treatedBeatmapSetId = []
        wLog('0% done'.bgGreen.bold.white);
        _.each(json, function (x) {
            x.playCount = x.playcount;
            x.playSuccess= x.passcount;
            x.maxCombo= x.max_combo;
            x.favouritedCount= x.favourite_count;
            delete x.playcount;
            delete x.passcount;
            delete x.max_combo;
            delete x.favourite_count;

            if (undefined === _.find(treatedBeatmapSetId, function (y) {
                    return y === x.beatmapset_id;
                })) {
                treatedBeatmapSetId.push(x.beatmapset_id);
                var osuThing = analyze.get( that.queue, that.config.stuffPath,that.config.tempFolder, that.config.forceRedownload, x, _.where(json, {'beatmapset_id': x.beatmapset_id}))
                var maintenanceDone = osuThing.doMaintance()
                Q.when(maintenanceDone).finally(function () {
                    maintenanceDoneCount++;
                    var percentage = parseInt(maintenanceDoneCount * 100 / treatedBeatmapSetId.length, 10);
                    if (percentage === 100 || percentage - lastPercentage >= 10) {
                        lastPercentage = percentage;
                        wLog(util.format('%s % done'.bgGreen.bold.white, percentage));
                    }
                });
                allMaintenanceIsDone.push(maintenanceDone);
            }
        });
        Q.allSettled(allMaintenanceIsDone).then(function () {
            that.allIsDone.resolve(true);
        });
    }
    return this.allIsDone.promise;
}

module.exports = {
    get: function (config) {
        return new Analyzer(config);
    }
}




