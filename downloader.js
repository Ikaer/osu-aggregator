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
var configFilePath =nconf.get('config')

if(undefined === configFilePath || null === configFilePath || '' === configFilePath){
    configFilePath = 'config/config.json';
}

nconf.file(configFilePath);

var request = require('request');
var util = require('util')

var colors = require('colors')

function Downloader() {
    var that = this;

    that.osuAPIUrl = 'https://osu.ppy.sh';
    that.urls = {
        getBeatmap: '/api/get_beatmaps'
    };
    that.apiKey = nconf.get('apiKey');
    that.revert = nconf.get('revert');
    that.startDate = nconf.get('dateInf') ? moment(nconf.get('dateInf')) : moment('2007-01-01');
    that.endDate = nconf.get('dateSup') ? moment(nconf.get('dateSup')) : moment();
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


Downloader.prototype.getBeatmaps = function(since) {
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

Downloader.prototype.nextDate = function () {
    var that = this;
    if(that.currentIndex < that.dates.length - 1){
        that.currentIndex++;
    }
    else{
        if(nconf.get('dateSup') === null){
            // we take current date in case we passed a day
            that.dates.shift();
            that.dates.unshift(moment().format('YYYY-MM-DD'));
        }

        that.currentIndex = 0;
    }
}
Downloader.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(that.getBeatmaps(that.dates[that.currentIndex])).then(function (sr) {
        var srJSON = JSON.parse(sr);
        var hasDoneWriting = fileManager.writeBeatmaps(srJSON);
        Q.when(hasDoneWriting).then(function () {
            console.log('this batch is done'.green.bold)
            console.log('==============================================================================='.green.bold)
            that.nextDate();
           setTimeout(function(){
                that.getAndWriteBeatmaps();
            },  nconf.get('timeoutForOsuAPI'));
        });
    });
};

module.exports = {
    config: null,
    start: function () {
        var downloader = new Downloader();
        downloader.getAndWriteBeatmaps();
    }
}