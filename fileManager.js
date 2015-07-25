//fs.writeFile('file' + i + '.osu', zip.readAsText(zipEntries[i]), function (err) {   var a = 2; });
// date todo:
//"2014-10-15",
//"2014-09-15",
try {
    var mongoose = require('mongoose');

    var Beatmap = mongoose.model("Beatmap");

    var Q = require('q');
    var moment = require('moment');
    var fs = require('fs');
    var util = require('util');
    var _ = require('underscore');
    require('colors');

    var nconf = require('nconf');
    nconf.argv();
    var configFilePath = nconf.get('config')

    if (undefined === configFilePath || null === configFilePath || '' === configFilePath) {
        configFilePath = 'config/config.json';
    }


    nconf.file(configFilePath);
    var request = require('request');
    var tough = require('tough-cookie');
    var Cookie = tough.Cookie;

    var http = require('http-debug').http;

    function FileManager() {
        var that = this;
        that.login = nconf.get('login');
        that.password = nconf.get('password');
        that.timeoutToTransferFiles = nconf.get('timeoutToTransferFiles');
        that.maxTransfer = nconf.get('maxTransfer');
        that.forceRedownload = nconf.get('forceRedownload');
        that.basePath = nconf.get('stuffPath');

        that.basePathTemp = that.basePath + nconf.get('tempFolder');
        console.log(that.basePathTemp);
        try {
            fs.mkdirSync(that.basePathTemp);
        }
        catch (e) {
            if (e.code == 'EEXIST') {
                var files = fs.readdirSync(that.basePathTemp)
                _.each(files, function (f) {
                    fs.unlinkSync(that.basePathTemp + '/' + f);
                });
            }
            else {
                throw e;
            }
        }


        that.currentTransferCount = 0;
        that.transferPile = [];
        that.isConnectedDefer = Q.defer();
        that.isConnected = that.isConnectedDefer.promise;
        that.activeFileSizeCheck = nconf.get('activeFileSizeCheck')

        that.deferredId = 0;
        that.pileOfCurrentCalls = [];


        that.isConnectedDefer.resolve(true);


        this.fileTypes = {
            //osz: {
            //    host: 'bloodcat.com',
            //    suffix: '.osz',
            //    path: function (id) {
            //        return '/osu/s/' + id;
            //    }
            //},
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
    }

    FileManager.prototype.doHttpCall = function (nextCall) {
        var d = Q.defer();
        var that = this;
        that.deferredId++;
        var traceOfDef = {
            id: that.deferredId,
            def: d
        };
        that.pileOfCurrentCalls.push(traceOfDef)

        Q.when(d.promise).timeout(100000, 'timeout').then(function () {
        }, function (err) {
            if (err.message == 'timeout') {
                console.error('Take too much time to resolve %s. Go elsewhere', nextCall.options.hostname + nextCall.options.path)
            }
            else {
                console.error(err);
            }
        }).finally(function () {
            that.pileOfCurrentCalls = _.reject(that.pileOfCurrentCalls, function (cd) {
                return cd.id !== traceOfDef.id;
            });
        })
        console.log('%s'.bgBlue.white, nextCall.options.hostname + nextCall.options.path)
        try {
            if (nextCall.options.url) {
                request.post(
                    'https://osu.ppy.sh/forum/ucp.php?mode=login',
                    {form: {redirect: '/', sid: '', username: that.login, password: that.password, login: 'login'}},
                    function (error, response, body) {
                        if (!error && (response.statusCode == 200 || response.statusCode === 302)) {
                            var j = request.jar();
                             _.each(response.headers['set-cookie'], function (c) {
                                var parsedCookie = Cookie.parse(c);
                                j.setCookie(util.format("%s=%s", parsedCookie.key, parsedCookie.value), 'https://osu.ppy.sh');
                            });
                            request({url: nextCall.options.url, jar: j})
                                .on('response', function(res) {
                                    res.on('error', function (e) {
                                        nextCall.callbackError(e, d);
                                    });
                                    if (res.statusCode === 200) {
                                        nextCall.callback(res, d);
                                    }
                                    else {
                                        nextCall.callbackError(res.statusCode, d);
                                    }
                                })
                        }
                    }
                );
            }
            else {
                http.get(nextCall.options, function (res) {
                    res.on('error', function (e) {
                        nextCall.callbackError(e, d);
                    });
                    if (res.statusCode === 200) {
                        nextCall.callback(res, d);
                    }
                    else {
                        nextCall.callbackError(res.statusCode, d);
                    }
                }, function (err) {
                    nextCall.callbackError(err, d);
                });
            }
        }
        catch (e) {
            nextCall.callbackError(e, d);
        }
        return d.promise;
    }


    FileManager.prototype.doNextCall = function () {
        var that = this;
        try {
            if (that.transferPile.length > 0) {
                for (var i = 0; i < that.maxTransfer; i++) {
                    if (that.currentTransferCount < that.maxTransfer && that.transferPile.length > 0) {
                        var nextCall = that.transferPile[0];
                        that.currentTransferCount++;
                        that.transferPile.shift();
                        Q.when(that.doHttpCall(nextCall)).then(function () {
                            that.currentTransferCount--;
                        }).fail(function () {
                            that.currentTransferCount--
                        });
                    }
                }
            }
            setTimeout(function () {
                that.doNextCall()
            }, that.timeoutToTransferFiles);
        }
        catch (e) {
            console.error(e);
        }
    };
    FileManager.prototype.queueNewCall = function (requestOptions, success, fail) {
        var that = this;
        that.transferPile.push({
            options: requestOptions,
            callback: success,
            callbackError: fail
        })
    }
    FileManager.prototype.getNormalizedDifficulty = function (difficultyRating) {
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
    FileManager.prototype.buildFileName = function (beatmap) {
        return util.format('%s - %s (%s) [%s].osu', beatmap.artist, beatmap.title, beatmap.creator, beatmap.version);
    };
    FileManager.prototype.releaseDefers = function () {
        var that = this;
        console.log('REALEASING THE DEFERS ! (%s)'.bgRed.bold.black, that.pileOfCurrentCalls.length)
        _.each(that.pileOfCurrentCalls, function (cd) {
            cd.def.resolve(true);
        });
    }

    var fileManager = new FileManager();
    fileManager.doNextCall();
    //console.log('start to look at transfer pile'.red)
    function OsuFile(type, id, lastUpdate) {
        var that = this;
        this.id = id;
        this.host = fileManager.fileTypes[type].host;
        this.path = fileManager.fileTypes[type].path(id);
        this.filePath = fileManager.basePath + id + '/' + id + fileManager.fileTypes[type].suffix;
        this.tempFilePath = fileManager.basePath + 'temp/' + id + fileManager.fileTypes[type].suffix;
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
        if(type === 'osz'){
            this.httpOptions.url = 'https://osu.ppy.sh/d/' + id;
        }

        this.toDownload = nconf.get('forceRedownload');
        this.hasBeenSuccessfullyDownloaded = false;
        this.downloadedMessage = '';
        this._isDownloaded = Q.defer();
        this.isDownloaded = this._isDownloaded.promise;
        this.resolveIsDownloaded = function (httpCall, result, message) {
            if (result === false) {
                console.log(message.bgRed.white);
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
        this.downloadReason = '';
        this.callbackToWrite = function (res, releaseHttp) {
            try {
                //  console.log('%s is going to be be written'.bgCyan.white, that.filePath);
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
                                if (statOfTempFile === 0) {
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
                                // console.log('%s has been written'.bgCyan.white, that.filePath)
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
            that.resolveIsDownloaded(releaseHttp, false, util.format('Something went wrong with request for file %s: %s', that.filePath, error));
        }
        this.callbackToCheckSize = function (res, releaseHttp) {
            var serverSize = parseInt(res.headers['content-length'], 10);
            if (that.size !== serverSize) {
                that.toDownload = true;
                that.downloadReason = 'Server file size is different from local file size.'
            }
            that._isChecked.resolve(true);
            // we read the chunk to avoid ban!
            var buffer = new Buffer();
            res.on('data', function (chunk) {
                buffer.write(chunk)
            })
            res.on('end', function () {
                //  console.log('read conmplete')
                releaseHttp.resolve();
            })
            res.on('error', function () {
                // console.log('read conmplete')
                releaseHttp.resolve();
            })
            res.on('close', function () {
                // console.log('read conmplete')
                releaseHttp.resolve();
            })

        }
        this.callbackToCheckSizeError = function (error) {
            //console.error(error);
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
            if (this.toDownload === false && fileManager.activeFileSizeCheck === true) {
                fileManager.queueNewCall(this.httpOptions, this.callbackToCheckSize, this.callbackToCheckSizeError);
            }
            else {
                that._isChecked.resolve(true)
            }
        }
        else {
            that.downloadReason = 'configuration file said so.'
            that._isChecked.resolve(true)
        }
        Q.when(this.isChecked).then(function () {
            if (that.toDownload === true) {
                // console.log('File %s ', that.filePath, that.downloadReason);
            }
        })
    }


    function OsuFiles(beatmapSetId, lastUpdate) {
        this.baseDir = fileManager.basePath + beatmapSetId;
        this.osz = new OsuFile('osz', beatmapSetId, lastUpdate);
        this.largeImage = new OsuFile('largeImage', beatmapSetId, lastUpdate);
        this.image = new OsuFile('image', beatmapSetId, lastUpdate);
        this.mp3 = new OsuFile('mp3', beatmapSetId, lastUpdate);
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

    function OsuThing(firstBeatmap, othersBeatmaps) {
        this.id = firstBeatmap.beatmapset_id;
        this.beatmaps = _.map(othersBeatmaps, function (b) {
            var webBeatmap = new Beatmap(b);
            webBeatmap.difficulty = fileManager.getNormalizedDifficulty(webBeatmap.difficultyrating);
            webBeatmap.xFileName = fileManager.buildFileName(webBeatmap);
            return webBeatmap;
        })
        this.files = new OsuFiles(this.id, firstBeatmap.last_update);
        this.toUpdate = false;

    }

    OsuThing.prototype.upsertInDatabase = function () {
        var isUpserted = Q.defer();
        var that = this;
        var dArray = [];
        _.each(that.beatmaps, function (beatmap) {
            var beatmapPromise = Q.defer();
            dArray.push(beatmapPromise.promise);
            var simpleB = beatmap.toJSON();
            delete simpleB._id;
            Beatmap.findOneAndUpdate({'beatmap_id': beatmap.beatmap_id}, simpleB, {upsert: true}, function (err, doc) {
                if (err) {
                    console.log(err);
                }
                else {
                    console.log('beatmapset %s / map %s updated in database'.bgMagenta.white, beatmap.beatmapset_id, beatmap.beatmap_id)
                }
                beatmapPromise.resolve(true);
            });
        })

        Q.allSettled(dArray).then(function () {
            isUpserted.resolve(true);
        }).fail(function () {
            isUpserted.resolve(false);
        })
    }
    OsuThing.prototype.queueDownload = function () {
        var that = this;
        var d = Q.defer();
        var filesToDownload = _.where(that.files.list, {toDownload: true});
        _.each(filesToDownload, function (f) {
            fileManager.queueNewCall(f.httpOptions, f.callbackToWrite, f.callbackToWriteError)
        });
        Q.allSettled(_.map(filesToDownload, function (f) {
            return f.isDownloaded;
        })).then(function () {
            d.resolve(true);
        }).fail(function () {
            d.resolve(false);
        });
        return d.promise;
    }
    OsuThing.prototype.update = function (isUpdated) {
        var that = this;

        Q.when(that.queueDownload()).then(function () {
            Q.when(that.upsertInDatabase()).then(function () {
                isUpdated.resolve(true);
            }).fail(function () {
                isUpdated.resolve(false);
            })
        }).fail(function () {
            isUpdated.resolve(false);
        });
    }
    OsuThing.prototype.mustBeUpdated = function () {
        var that = this;
        // console.log('[%s] check if its must be updated'.red, this.id)
        var d = Q.defer()
        var databaseVerifications = [];

        _.each(that.beatmaps, function (jsonBeatmap) {
            var dBeatmap = Q.defer();
            databaseVerifications.push(dBeatmap.promise);
            Beatmap.findOne({'beatmap_id': jsonBeatmap.beatmap_id}, function (err, databaseBeatmap) {
                var toUpdate = (null === databaseBeatmap
                || moment(databaseBeatmap.last_update).isBefore(moment(jsonBeatmap.last_update))
                || moment(databaseBeatmap.approved_date).isBefore(moment(jsonBeatmap.approved_date))
                || databaseBeatmap.approved !== jsonBeatmap.approved);
                dBeatmap.resolve(toUpdate);
            });
        });

        // checks for beatmapset
        var dBeatmapSet = Q.defer();
        databaseVerifications.push(dBeatmapSet.promise);
        Beatmap.findOne({beatmapset_id: that.beatmaps[0].beatmapset_id}, function (err, databaseBeatmapSet) {
            var toUpdate = (null === databaseBeatmapSet || (moment(databaseBeatmapSet.last_update).isAfter(moment(that.beatmaps[0].last_update))));
            dBeatmapSet.resolve(toUpdate);
        });

        var directoryIsOk = that.files.tryMakeDirSync(that.id);
        var fileVerifications = [];
        fileVerifications.push(that.files.mp3.isChecked)
        fileVerifications.push(that.files.largeImage.isChecked)
        fileVerifications.push(that.files.image.isChecked)
        fileVerifications.push(that.files.osz.isChecked)

        Q.allSettled(databaseVerifications).then(function (values) {
            var databaseIsOk = !(_.where(values, {value: true}).length > 0);
            Q.allSettled(fileVerifications).then(function () {
                var filesAreOk = !(_.where(that.files, {toDownload: true}).length > 0);
                that.toUpdate = (false === databaseIsOk || false === filesAreOk || false === directoryIsOk);
                if (that.toUpdate === true) {
                    console.log('[%s] toUpdate: %s, files ok: %s, directory ok: %s, database ok: %s'.red, that.id, that.toUpdate, filesAreOk, directoryIsOk, databaseIsOk)
                }
                d.resolve(true);
            }).fail(function () {
                d.resolve(true);
            })
        }).fail(function () {
            d.resolve(false);
        });


        return d.promise;
    };
    OsuThing.prototype.doMaintance = function () {
        var that = this;

        //console.log('[%s] start maintenance'.red, that.id);
        var d = Q.defer();
        Q.when(that.mustBeUpdated()).then(function () {
            if (that.toUpdate === true) {
                that.update(d);
            }
            else {
                d.resolve(false);
            }
        }).fail(function () {
            d.resolve(false);
        });
        return d.promise;
    }


    function OsuThings(json) {
        var that = this;
        var _allIsDone = Q.defer();
        that.allIsDone = _allIsDone.promise;
        if (json.length === 0) {
            _allIsDone.resolve(true);
        }
        else {
            var allMaintenanceIsDone = [];
            var maintenanceDoneCount = 0;
            var treatedBeatmapSetId = []
            console.log('0% done'.bgGreen.bold.white);
            _.each(json, function (x) {
                if (undefined === _.find(treatedBeatmapSetId, function (y) {
                        return y === x.beatmapset_id;
                    })) {
                    treatedBeatmapSetId.push(x.beatmapset_id);
                    var osuThing = new OsuThing(x, _.where(json, {'beatmapset_id': x.beatmapset_id}))
                    var maintenanceDone = osuThing.doMaintance()
                    Q.when(maintenanceDone).then(function (value) {
                        maintenanceDoneCount++;
                        if (value !== false || maintenanceDoneCount === treatedBeatmapSetId.length) {
                            var percentage = parseInt(maintenanceDoneCount * 100 / treatedBeatmapSetId.length, 10);
                            console.log('%s% done'.bgGreen.bold.white, percentage);
                        }
                    }).fail(function (value) {
                        maintenanceDoneCount++;
                        if (value !== false || maintenanceDoneCount === treatedBeatmapSetId.length) {
                            var percentage = parseInt(maintenanceDoneCount * 100 / treatedBeatmapSetId.length, 10);
                            console.log('%s% done'.bgGreen.bold.white, percentage);
                        }
                    })
                    allMaintenanceIsDone.push(maintenanceDone);
                }
            });
            Q.allSettled(allMaintenanceIsDone).then(function () {
                _allIsDone.resolve(true);
            });
        }
    }


    module.exports = {
        writeBeatmaps: function (beatmaps) {
            return new OsuThings(beatmaps).allIsDone;
        }
    };


    process.on('uncaughtException', function (e) {
        console.log(e);
        if (e.code === 'ECONNRESET') {
            fileManager.releaseDefers();
        }
    });

}
catch (e) {
    console.error(e);
}
