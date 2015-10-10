var jszip = require('jszip')
var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");

var Q = require('q');
var moment = require('moment');
var fs = require('fs');
var util = require('util');
var _ = require('underscore');
require('colors');
var S = require('string');

var request = require('request');
var tough = require('tough-cookie');
var Cookie = tough.Cookie;

var http = require('http-debug').http;

function DownloadQueueManager(config) {
    var that = this;
    that.login = config.login;
    that.password = config.password;
    that.timeoutToTransferFiles = config.timeoutToTransferFiles;
    that.maxTransfer = config.maxTransfer;
    that.forceRedownload = config.forceRedownload;
    that.basePath = config.stuffPath;
    that.apiKey = config.apiKey;
    that.basePathTemp = that.basePath + config.tempFolder;
    // console.log(that.basePathTemp);
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
    that.activeFileSizeCheck = config.activeFileSizeCheck;

    that.deferredId = 0;
    that.pileOfCurrentCalls = [];
    that.isConnectedDefer.resolve(true);
    that.timeoutHealthy = null;
    that.monitoredIds = [];
}

//url: 'https://osu.ppy.sh/api/get_scores?k='+that.apiKey+'&b=737331&mods=0',
DownloadQueueManager.prototype.doHttpCall = function (nextCall) {
    var d = Q.defer();
    var that = this;
    if (nextCall.options.url) {
        if (that.monitoredIds.indexOf(nextCall.options.id) >= 0) {
            console.log('downloading again beatmapset ' + nextCall.options.id)
        }
        else {
            console.log('downloading beatmapset' + nextCall.options.id)
        }
    }
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
        else if (err == '503 Service Temporarily Unavailable') {
            console.log('login service responds 503 for beatmapset ' + nextCall.options.id);
            that.monitoredIds.push(nextCall.options.id);
            that.transferPile.unshift(nextCall);
        }
        else {
            console.error(err);
        }
    }).finally(function () {
        that.pileOfCurrentCalls = _.reject(that.pileOfCurrentCalls, function (cd) {
            return cd.id !== traceOfDef.id;
        });
    })
    //console.log('%s'.bgBlue.white, nextCall.options.hostname + nextCall.options.path)
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
                            .on('response', function (res) {
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
                    else {
                        if (S(body).contains('503 Service Temporarily Unavailable')) {
                            d.reject('503 Service Temporarily Unavailable')
                        }
                        else {
                            d.reject(nextCall.options.id + ': Unknow reason')
                        }
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

DownloadQueueManager.prototype.doNextCall = function () {
    var that = this;
    try {
        if (that.transferPile.length > 0) {
            for (var i = 0; i < that.maxTransfer; i++) {
                if (that.currentTransferCount < that.maxTransfer && that.transferPile.length > 0) {
                    clearTimeout(that.timeoutHealthy);
                    var nextCall = that.transferPile[0];
                    that.currentTransferCount++;
                    that.transferPile.shift();
                    that.timeoutHealthy = setTimeout(function () {
                        console.error('process safety has been triggered, process will now exit')
                        process.exit(0)
                    }, 1000 * 60 * 2); // 2minutes
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
DownloadQueueManager.prototype.queueNewCall = function (requestOptions, success, fail) {
    var that = this;
    that.transferPile.push({
        options: requestOptions,
        callback: success,
        callbackError: fail
    })
}

DownloadQueueManager.prototype.releaseDefers = function () {
    var that = this;
    console.log('REALEASING THE DEFERS ! (%s)'.bgRed.bold.black, that.pileOfCurrentCalls.length)
    _.each(that.pileOfCurrentCalls, function (cd) {
        cd.def.resolve(true);
    });
}


module.exports = {
    getQueue: function (config) {
        var queue = new DownloadQueueManager(config);
        queue.doNextCall();
        return queue;
    }
}