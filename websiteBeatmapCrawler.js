/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var fileManager = require('./fileManager');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');
var nconf = require('nconf');
nconf.argv();
var configFilePath = nconf.get('config')

if (undefined === configFilePath || null === configFilePath || '' === configFilePath) {
    configFilePath = 'config/config.json';
}
var cheerio = require('cheerio');
var cheerioAdv = require('cheerio-advanced-selectors')

cheerio = cheerioAdv.wrap(cheerio)
nconf.file(configFilePath);

var request = require('request');
var util = require('util')

var colors = require('colors')
var https = require('https')
var _ = require('underscore');

function SiteQueue(siteName) {
    var that = this;
    this.name = siteName;
    this.queue = [];
    setInterval(function () {
        if (that.queue.length > 0) {
            var job = that.queue[0];
            job();
            that.queue.shift();
        }
    }, 1000)
}
SiteQueue.prototype.addJob = function (fnOfJob) {
    var that = this;
    var d = Q.defer();
    that.queue.push(fnOfJob);
}


function WebsiteBeatmapCrawler(source) {
    var that = this;
    that.typeOfSource = source;
    that.osuAPIUrl = 'https://osu.ppy.sh'
    var rParam = 0;
    switch (source) {
        case 'help_pending':
            rParam = 2;
            break;
        case 'graveyard':
            rParam = 5;
            break;
        default:
            console.error('unknow source')
    }
    that.urls = []
    for (var i = 1; i <= 125; i++) {
        that.urls.push(util.format('https://osu.ppy.sh/p/beatmaplist?l=1&r=%s&q=&g=0&la=0&s=4&o=1&m=-1&page=%s',rParam, i));
    }
    that.apiKey = nconf.get('apiKey');
    that.currentIndex = 0;
    that.queue = new SiteQueue('osu-api');
}


WebsiteBeatmapCrawler.prototype.parsePage = function (url) {
    var that = this;
    var d = Q.defer();
    var promise = d.promise;
    console.log(url.bgBlue.white)
    https.get(url, function (res) {
        var beatmapsFromAPI = [];
        res.on('error', function (e) {
            console.error(e);
        })
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('close', function (e) {
            console.log('connection closed.');
        })
        res.on('end', function () {
            try {
                var $ = cheerio.load(body);
                var beatmapDivs = $('.beatmapListing').children('.beatmap');
                if (beatmapDivs.length > 0) {

                    var dOfBeatmaps = [];
                    for (var i = 0; i < beatmapDivs.length; i++) {
                        (function (bd) {
                            var dOfBeatmap = Q.defer();
                            dOfBeatmaps.push(dOfBeatmap.promise);
                            that.queue.addJob(function () {
                                var beatmapSetId = $(bd).attr('id');
                                var beatmapSetsApiUrl = util.format('https://osu.ppy.sh/api/get_beatmaps?s=%s&k=%s', beatmapSetId, that.apiKey)
                                request(beatmapSetsApiUrl, function (error, response, body) {
                                    if (error) {
                                        console.error(error);
                                    } else {
                                        try {
                                            var beatmaps = JSON.parse(body);
                                            beatmapsFromAPI = beatmapsFromAPI.concat(beatmaps);
                                            dOfBeatmap.resolve();
                                        }
                                        catch (e) {
                                            console.error(e);
                                        }
                                    }
                                });
                            })
                        }(beatmapDivs[i]))
                    }

                    Q.all(dOfBeatmaps).then(function () {
                        d.resolve(beatmapsFromAPI);
                    })
                }
            }
            catch (e) {
                console.error(e)
            }
        });
    });
    return promise;
}

WebsiteBeatmapCrawler.prototype.nextUrl = function () {
    var that = this;
    if (that.currentIndex < that.urls.length - 1) {
        that.currentIndex++;
    }
    else {
        that.currentIndex = 0;
    }
}


WebsiteBeatmapCrawler.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(that.parsePage(that.urls[that.currentIndex])).then(function (beatmapsFromAPI) {
        var hasDoneWriting = fileManager.writeBeatmaps(beatmapsFromAPI);
        Q.when(hasDoneWriting).then(function () {
            console.log('this batch is done'.green.bold)
            console.log('==============================================================================='.green.bold)
            that.nextUrl();
            setTimeout(function () {
                that.getAndWriteBeatmaps();
            }, nconf.get('timeoutForOsuAPI'));
        });
    });
};

module.exports = {
    config: null,
    start: function (typeOfSource) {
        console.log(typeOfSource)
        var websiteBeatmapCrawler = new WebsiteBeatmapCrawler(typeOfSource);
        websiteBeatmapCrawler.getAndWriteBeatmaps();
    }
}