/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');

var request = require('request');
var util = require('util')

var colors = require('colors')

var analyzer = require('./analyzer.js');

function OsuApiCrawler(config) {
    var that = this;
    that.analyzer = analyzer.get(config);
    that.config = config;
    that.osuAPIUrl = 'https://osu.ppy.sh';
    that.urls = {
        getBeatmap: '/api/get_beatmaps'
    };
    that.apiKey = config.apiKey;
    that.revert = config.revert;
    that.startDate = config.dateInf ? moment(config.dateInf) : moment('2007-01-01');
    that.endDate = config.dateSup ? moment(config.dateSup) : moment();
    that.currentDate = that.revert ? that.endDate : that.startDate
    that.dates = [];
    var doContinue = true;
    while (true === doContinue) {
        that.dates.push(that.currentDate.format('YYYY-MM-DD'));
        if (true === that.revert) {
            that.currentDate = that.currentDate.subtract(1, 'M');
            doContinue = that.currentDate.isAfter(that.startDate);
        }
        else {
            that.currentDate = that.currentDate.add(1, 'M');
            doContinue = that.currentDate.isBefore(that.endDate);
        }
    }
    if (true === that.revert) {
        that.dates.push(that.startDate.format('YYYY-MM-DD'));
    }
    else {
        that.dates.push(that.endDate.format('YYYY-MM-DD'));
    }

    that.currentIndex = 0;
}


OsuApiCrawler.prototype.getBeatmaps = function(since) {
    var that = this;
    var d = Q.defer();
    var promise = d.promise;
    var url = util.format('%s%s?k=%s', that.osuAPIUrl, that.urls.getBeatmap, that.apiKey);
    url += util.format('&since=%s', since)
    console.log(url.bgBlue.white)
    request(url, function (error, response, body) {
        if (error) {
            console.error(error);
        } else {
            d.resolve(body);
        }
    });
    return promise;
}

OsuApiCrawler.prototype.nextDate = function () {
    var that = this;
    if(that.currentIndex < that.dates.length - 1){
        that.currentIndex++;
    }
    else{
        if(that.config.dateSup === null){
            // we take current date in case we passed a day
            that.dates.shift();
            that.dates.unshift(moment().format('YYYY-MM-DD'));
        }

        that.currentIndex = 0;
    }
}
OsuApiCrawler.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(that.getBeatmaps(that.dates[that.currentIndex])).then(function (sr) {
        var srJSON = JSON.parse(sr);
        var hasDoneWriting = that.analyzer.start(srJSON);
        Q.when(hasDoneWriting).then(function () {
            console.log('this batch is done'.green.bold)
            console.log('==============================================================================='.green.bold)
            that.nextDate();
           setTimeout(function(){
                that.getAndWriteBeatmaps();
            },  that.config.timeoutForOsuAPI);
        });
    });
};

OsuApiCrawler.prototype.start = function(){
    this.getAndWriteBeatmaps();
}


module.exports = {
    get: function (config) {
        return new OsuApiCrawler(config);
    }
}