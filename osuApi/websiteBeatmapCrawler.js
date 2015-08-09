/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');

var cheerio = require('cheerio');
var cheerioAdv = require('cheerio-advanced-selectors')

cheerio = cheerioAdv.wrap(cheerio)


var request = require('request');
var util = require('util')

var colors = require('colors')
var https = require('https')
var _ = require('underscore');
var analyzer = require('./analyzer');
var events = require('events');
function wLog(msg){
    process.send({msgFromWorker: msg})
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
SiteQueue.prototype.doJob = function(job){
    var that = this;
    that.current++;
    var d = Q.defer();
    job(d);
    Q.when(d.promise).timeout(30000, 'timeout').then(function(){

    }, function(err){
        wLog('Timeout!')
    }).finally(function(){
        that.current--;
    });
}

SiteQueue.prototype.addJob = function (fnOfJob) {
    var that = this;
    var d = Q.defer();
    that.queue.push(fnOfJob);
}


function WebsiteBeatmapCrawler(config) {
    var that = this;
    events.EventEmitter.call(this);
    that.osuAPIUrl = 'https://osu.ppy.sh'
    that.analyzer = analyzer.get(config)
    that.config = config;
    var rParam = 0;
    switch (config.source) {
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
    for (var i = 1; i <= config.maxPage; i++) {
        that.urls.push(util.format('https://osu.ppy.sh/p/beatmaplist?l=1&r=%s&q=&g=0&la=0&s=4&o=1&m=-1&page=%s',rParam, i));
    }
    that.apiKey = config.apiKey;
    that.currentIndex = 0;
    that.queue = new SiteQueue('osu-api');
}
WebsiteBeatmapCrawler.prototype.parsePage = function (url) {
    var that = this;
    var finalDeferred = Q.defer();
    wLog(url.bgBlue.white)
    https.get(url, function (res) {
        res.on('error', function (e) {
            console.error(e);
        })
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('close', function (e) {
            wLog('connection closed.');
        })
        res.on('end', function () {
            try {
                var $ = cheerio.load(body);
                var beatmapDivs = $('.beatmapListing').children('.beatmap');
                if (beatmapDivs.length > 0) {

                    var dOfBeatmaps = [];
                    for (var i = 0; i < beatmapDivs.length; i++) {
                        (function (bd, i) {
                            var dOfBeatmap = Q.defer();
                            dOfBeatmaps.push(dOfBeatmap.promise);
                            that.queue.addJob(function (d) {
                               // console.log('crawling api ' + i)
                                var beatmapSetId = $(bd).attr('id');
                                var beatmapSetsApiUrl = util.format('https://osu.ppy.sh/api/get_beatmaps?s=%s&k=%s', beatmapSetId, that.apiKey)
                                request(beatmapSetsApiUrl, function (error, response, body) {
                                    if (error) {
                                        console.error(error);
                                        d.resolve();
                                        dOfBeatmap.resolve();
                                    } else {
                                        try {
                                            var beatmaps = JSON.parse(body);
                                            finalDeferred.notify(beatmaps);
                                            dOfBeatmap.resolve();
                                            d.resolve();
                                        }
                                        catch (e) {
                                            console.error(e);
                                            d.resolve();
                                            dOfBeatmap.resolve();
                                        }
                                    }
                                });
                            })
                        }(beatmapDivs[i], i))
                    }

                    Q.all(dOfBeatmaps).finally(function () {
                        finalDeferred.resolve();
                    })
                }
            }
            catch (e) {
                console.error(e)
            }
        });
    });
    return finalDeferred.promise;
}

WebsiteBeatmapCrawler.prototype.nextUrl = function () {
    var that = this;
    if (that.currentIndex < that.urls.length - 1) {
        that.currentIndex++;
    }
    else {
        process.send({msgFromWorker: 'JOB_DONE'})
        process.exit(0);
    }
}


WebsiteBeatmapCrawler.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(that.parsePage(that.urls[that.currentIndex])).then(function (beatmapsFromAPI) {

    }, function(err){

    }, function(beatmapsFromAPI){
        that.analyzer.start(beatmapsFromAPI);
    }).finally(function(){
        that.nextUrl();
        that.emit('haveDoneSomeWork')
        setTimeout(function () {
            that.getAndWriteBeatmaps();
        }, that.config.timeoutForOsuAPI);
    });
};
WebsiteBeatmapCrawler.prototype.start =function(){
    this.getAndWriteBeatmaps();
}

WebsiteBeatmapCrawler.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = {
    get: function (config) {
        return new  WebsiteBeatmapCrawler(config);

    }
}