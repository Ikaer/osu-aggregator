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

var fileTypes = {
    osz: {
        host: 'osu.ppy.sh',
        suffix: '.osz',
        path: function (id) {
            return '/d/' + id;
        },
        isOszFile: true
    },
    largeImage: {
        host: 'b.ppy.sh',
        suffix: 'l.jpg',
        path: function (id) {
            return '/thumb/' + id + 'l.jpg';
        }
    },
    image: {
        host: 'b.ppy.sh',
        suffix: '.jpg',
        path: function (id) {
            return '/thumb/' + id + '.jpg';
        }
    },
    mp3: {
        host: 'b.ppy.sh',
        suffix: '.mp3',
        path: function (id) {
            return '/preview/' + id + '.mp3';
        }
    }
}

//console.log('start to look at transfer pile'.red)
function OsuFile(basePath, tempPath, forceRedownload, type, id, lastUpdate) {
    var that = this;
    this.id = id;
    this.type = type;
    this.host = fileTypes[type].host;
    this.path = fileTypes[type].path(id);
    this.filePath = basePath + id + '/' + id + fileTypes[type].suffix;
    this.tempFilePath = tempPath + '/' + id + fileTypes[type].suffix;
    try {
        fs.statSync(this.tempFilePath);
        fs.unlinkSync(this.tempFilePath);
    }
    catch (e) {
        if (e.code != 'ENOENT')
            throw e;
    }

    this.httpOptions = {
        hostname: this.host,
        port: 80,
        path: this.path,
        headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, sdch",
            "Accept-Language": "fr-FR,fr;q=0.8,en-US;q=0.6,en;q=0.4",
            "Connection": "keep-alive",
            "Host": this.host
        }
    }
    if (type === 'osz') {
        this.httpOptions.url = 'https://osu.ppy.sh/d/' + id;
    }
    this.get403 = false;
    this.toDownload = forceRedownload;
    this._isDownloaded = Q.defer();
    this.isDownloaded = this._isDownloaded.promise;
    this.resolveIsDownloaded = function (httpCall, result, message) {
        if (result === false) {
            //console.log(message.bgRed.white);
        }
        that.hasBeenSuccessfullyDownloaded = result;
        that._isDownloaded.resolve(result);
        that.downloadedMessage = message;
        httpCall.resolve();
    }
    this.lastModifiedDate = null;
    this.size = 0;
    this._isChecked = Q.defer();
    this.isChecked = this._isChecked.promise;
    this.callbackToWrite = function (res, releaseHttp) {
        try {
              //console.log('%s is going to be be written'.bgCyan.white, that.filePath);
            try {
                var fileWriter = fs.createWriteStream(that.tempFilePath);
            }
            catch (e) {
                that.resolveIsDownloaded(releaseHttp, false, util.format('Something when wrong with stream creation of %s: %s', that.tempFilePath, e.message));
            }
            res.on('data', function (chunk) {
                try {
                    fileWriter.write(chunk);
                }
                catch (e) {
                    that.resolveIsDownloaded(releaseHttp, false, util.format('Something when wrong while receiving chung and writing %s: %s', that.tempFilePath, e.message));
                }
            }).on('end', function () {
                try {
                    fileWriter.end();
                    setTimeout(function () {
                        var tempFileIsOk = true;
                        try {
                            var statOfTempFile = fs.statSync(that.tempFilePath);
                            statOfTempFile = statOfTempFile["size"];
                            var zipIsOk = true;
                            if (that.type === 'osz') {
                                try {
                                    var data = fs.readFileSync(that.tempFilePath)
                                    var zip = jszip(data)
                                }
                                catch (e) {
                                    zipIsOk = false;
                                }
                            }
                            if (statOfTempFile === 0 || zipIsOk === false) {
                                tempFileIsOk = false;
                                that.resolveIsDownloaded(releaseHttp, false, util.format('After finish writing %s, file size was 0.', that.tempFilePath));
                                fs.unlink(that.tempFilePath);
                            }
                        }
                        catch (e) {
                            that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong while testing %s stat: %s', that.tempFilePath, e.message));
                            tempFileIsOk = false;
                        }
                        if (tempFileIsOk === true) {
                            that.resolveIsDownloaded(releaseHttp, true);
                            var readOfTemp = fs.createReadStream(that.tempFilePath);
                            var writeOfReadFile = fs.createWriteStream(that.filePath);
                            readOfTemp.pipe(writeOfReadFile);
                            readOfTemp.on('end', function () {
                                fs.unlink(that.tempFilePath);
                            });
                          //  console.log('%s has been written'.bgCyan.white, that.filePath)
                        }
                    }, 2000);
                }
                catch (e) {
                    that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong while transfering temp file to %s', that.filePath));
                }

            }).on('error', function (e) {
                that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong while reading response from %s', that.httpOptions.host + that.httpOptions.path));
            })
        }
        catch (e) {
            that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong while with file %s', that.filePath));
        }
    }
    this.callbackToWriteError = function (error, releaseHttp) {
        that.get403 = (error === 403);
        that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong with request for file %s: %s', that.filePath, error));
    }
    if (this.toDownload === false) {
        try {
            var st = fs.statSync(this.filePath);
            this.size = st["size"];
            this.lastModifiedDate = moment(st.mtime);
            if (this.lastModifiedDate.isBefore(lastUpdate)) {
                this.toDownload = true;
                this.downloadReason = 'last modified date of file is before last update of beatmap set.'
            }
            else if (0 === this.size) {
                this.toDownload = true;
                this.downloadReason = 'file size is 0.'
            }
        } catch (e) {
            if (e.code != 'ENOENT')
                throw e;
            else {
                this.toDownload = true;
                this.downloadReason = 'file does not exist.'
            }
        }

        that._isChecked.resolve(true)
    }
    else {
        that.downloadReason = 'configuration file said so.'
        that._isChecked.resolve(true)
    }
    Q.when(this.isChecked).then(function () {
        if (that.toDownload === true) {
            //console.log('File %s ', that.filePath, that.downloadReason);
        }
    })
}

module.exports = {
    get: function (basePath, tempPath, forceRedownload, type, id, lastUpdate) {
        return new OsuFile(basePath, tempPath, forceRedownload, type, id, lastUpdate)
    }
}
