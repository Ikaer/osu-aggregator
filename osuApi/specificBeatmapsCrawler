var Q = require('q');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');


var request = require('request');
var util = require('util')

var colors = require('colors')
var _ = require('underscore');
var analyzer = require('./analyzer');
function wLog(msg) {
    console.log(msg);
}

function SiteQueue(siteName) {
    var that = this;
    this.name = siteName;
    this.queue = [];
    this.current = 0;
    setInterval(function () {
        if (that.queue.length > 0 && that.current == 0) {
            var job = that.queue[0];
            that.doJob(job);
            that.queue.shift();
        }
    }, 1000)
}
SiteQueue.prototype.doJob = function (job) {
    var that = this;
    that.current++;
    var d = Q.defer();
    job(d);
    Q.when(d.promise).timeout(30000, 'timeout').then(function () {

    }, function (err) {
        wLog('Timeout!')
    }).finally(function () {
        that.current--;
    });
}

SiteQueue.prototype.addJob = function (fnOfJob) {
    var that = this;
    that.queue.push(fnOfJob);
}
function SpecificBeatmapsCrawler(config) {
    var that = this;
    that.analyzer = analyzer.get(config)
    that.config = config;
    that.apiKey = config.apiKey;
    that.ids = config.ids;
    that.queue = new SiteQueue('osu-api');
}
SpecificBeatmapsCrawler.prototype.parseIds = function () {
    var that = this;
    var finalDeferred = Q.defer();
    //wLog(url.bgBlue.white)

    try {
        if (that.ids.length > 0) {

            var dOfBeatmaps = [];
            var beatmaps = [];
            for (var i = 0; i < that.ids.length; i++) {
                (function (id, i, beatmapsArray) {
                    var dOfBeatmap = Q.defer();
                    dOfBeatmaps.push(dOfBeatmap.promise);
                    that.queue.addJob(function (d) {
                        var beatmapSetsApiUrl = util.format('https://osu.ppy.sh/api/get_beatmaps?s=%s&k=%s', id, that.apiKey)
                        request(beatmapSetsApiUrl, function (error, response, body) {
                            if (error) {
                                console.error(error);
                                d.resolve();
                                dOfBeatmap.resolve(true);
                            } else {
                                try {
                                    var beatmaps = JSON.parse(body);
                                    Array.prototype.push.apply(beatmapsArray, beatmaps);
                                    dOfBeatmap.resolve(true);
                                    d.resolve();
                                }
                                catch (e) {
                                    console.error(e);
                                    d.resolve();
                                    dOfBeatmap.resolve(true);
                                }
                            }
                        });
                    })
                }(that.ids[i], i, beatmaps))
            }

            Q.all(dOfBeatmaps).finally(function () {
                finalDeferred.resolve(beatmaps);
            })
        }
    }
    catch (e) {
        console.error(e)
    }
    return finalDeferred.promise;
}
SpecificBeatmapsCrawler.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(that.parseIds()).then(function (beatmapsFromAPI) {
        Q.when(that.analyzer.start(beatmapsFromAPI)).finally(function(){
            setTimeout(function(){
                process.exit(0);
            },5000);
        });
    }, function(){
       process.exit(0);
    });
};
SpecificBeatmapsCrawler.prototype.start =function(){
    this.getAndWriteBeatmaps();
}


module.exports = {
    get: function (config) {
        return new SpecificBeatmapsCrawler(config);
    }
}