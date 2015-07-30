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
var OsuFile = require('./osuFile')
function OsuFiles(basePath, tempPath, forceRedownload, beatmapSetId, lastUpdate) {
    this.baseDir = basePath + beatmapSetId;
    this.osz = OsuFile.get(basePath, tempPath, forceRedownload, 'osz', beatmapSetId, lastUpdate);
    this.largeImage =  OsuFile.get(basePath, tempPath, forceRedownload, 'largeImage', beatmapSetId, lastUpdate);
    this.image =  OsuFile.get(basePath, tempPath, forceRedownload, 'image', beatmapSetId, lastUpdate);
    this.mp3 =  OsuFile.get(basePath, tempPath, forceRedownload, 'mp3', beatmapSetId, lastUpdate);
    this.list = [
        this.osz,
        this.largeImage,
        this.image,
        this.mp3
    ]

}

OsuFiles.prototype.tryMakeDirSync = function () {
    var isCreated = false;
    try {
        fs.mkdirSync(this.baseDir);
        isCreated = true;
    } catch (e) {
        if (e.code != 'EEXIST') throw e;
        else isCreated = true;
    }
    return isCreated;
};

module.exports = {
    get:function(basePath, tempPath, forceRedownload, beatmapSetId, lastUpdate){
        return new OsuFiles(basePath, tempPath, forceRedownload, beatmapSetId, lastUpdate)
    }
}
