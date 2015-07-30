var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");
var User = mongoose.model("User");
var UserScore = mongoose.model("UserScore");

var Q = require('q');
var https = require('https');
var cheerio = require('cheerio');
var cheerioAdv = require('cheerio-advanced-selectors')

cheerio = cheerioAdv.wrap(cheerio)
var moment = require('moment');
moment.locale('en');
var S = require('string');
var _ = require('underscore');
require('colors');
var util = require('util');
var request = require('request')

tryParseInt = function (val) {
    var ret = 0;
    try {
        ret = parseInt(val, 10);
        if(isNaN(ret)){
            ret= 0;
        }
    }
    catch (e) {
        ret= 0;
    }
    return ret;
}

function QueueManager() {
    var that = this;
    that.timeoutToTransferFiles = 2000;
    that.maxTransfer = 1;

    that.currentTransferCount = 0;
    that.transferPile = [];
    that.isConnectedDefer = Q.defer();
    that.isConnected = that.isConnectedDefer.promise;

    that.deferredId = 0;
    that.pileOfCurrentCalls = [];
    that.isConnectedDefer.resolve(true);
}

QueueManager.prototype.doHttpCall = function (nextCall) {
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
            console.error('Take too much time to resolve %s. Go elsewhere', nextCall.url)
        }
        else {
            console.error(err);
        }
    }).finally(function () {
        that.pileOfCurrentCalls = _.reject(that.pileOfCurrentCalls, function (cd) {
            return cd.id !== traceOfDef.id;
        });
    })
    console.log('%s'.bgBlue.white, nextCall.url)
    try {
        request(nextCall.url, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                nextCall.callbackError(error, d);
            }
            else {
                var json = [];
                try {
                    json = JSON.parse(body);
                }
                catch (e) {
                    json = [];
                }
                nextCall.callback(json);
            }
            d.resolve()
        });
    }
    catch (e) {
        nextCall.callbackError(e, d);
    }
    return d.promise;
}
QueueManager.prototype.doNextCall = function () {
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
QueueManager.prototype.queueNewCall = function (url, success, fail) {
    var that = this;
    that.transferPile.push({
        url: url,
        callback: success,
        callbackError: fail
    })
}

var queueManager = new QueueManager();
queueManager.doNextCall();


function Crawler(config) {
    var that = this;
    this.apiKey = config.apiKey;
    this.timeout = config.updateStatsTimeout;
    this.currentBeatmapId = config.crawler_startingId;
    this.baseUrl = 'https://osu.ppy.sh/';
    this.useCrawlDate = config.useCrawlDate;

    this.requestPage = function (query, beatmapId) {
        var d = Q.defer();
        https.get(that.baseUrl + query, function (res) {
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

                    var update = {
                        "xLastCrawl": new Date(),
                        "playCount": 0,
                        "playSuccess": 0,
                        "favouritedCount": 0,
                        "genre": null,
                        "language": null,
                        "negativeUserRating": 0,
                        "positiveUserRating": 0,
                        "tags": [],
                        "submitted_date": null
                    }
                    try {
                        var $trs = $('table#songinfo').children('tr')

                        var tr3Tds = $trs.eq(3).children('td');

                        tr3Tds.eq(3).find('a').each(function (i, link) {
                            var text = S($(link).text()).trim().toString();
                            if (i === 0) {
                                update.genre = text;
                            }
                            else {
                                update.language = text;
                            }
                        })

                        var tr4Tds = $trs.eq(4).children('td');
                        tr4Tds.eq(1).find('a').each(function (i, link) {
                            var text = S($(link).text()).trim().toString();
                            update.tags.push(text);
                        })

                        tr4Tds.eq(3).find('td').each(function (i, td) {
                            var text = tryParseInt(S($(td).text()).replaceAll(',', '').trim().toString(), 10);
                            if (i === 0) {
                                update.negativeUserRating = text
                            }
                            else {
                                update.positiveUserRating = text;
                            }
                        })
                        var htmlOfPlays = S(tr4Tds.eq(5).html());

                        update.playSuccess = tryParseInt(htmlOfPlays.between('</b> (', ' of ').s, 10);
                        update.playCount = tryParseInt(htmlOfPlays.between(' of ', ' plays)').s, 10);


                        var tr5Tds = $trs.eq(5).children('td');
                        var htmlOfdates = S(tr5Tds.eq(1).html().split('<')[0]).trim().s;


                        var m = moment(htmlOfdates, 'MMM D, YYYY');
                        update.submitted_date = m.toDate();

                        var tr6Tds = $trs.eq(6).children('td');
                        var favourited = S(tr6Tds.eq(0).html()).between('<b>Favourited ', ' times</b>').replaceAll(',', '').trim().s;
                        update.favouritedCount = tryParseInt(favourited, 10)
                    }
                    catch (e) {

                    }
                    Beatmap.update({'beatmap_id': beatmapId}, update, {multi: false}, function (err, doc) {
                        User.find({}, function (err, users) {
                            _.each(users, function (u) {
                                if (u.user_id > 0) {
                                    var url = util.format('https://osu.ppy.sh/api/get_scores?k=%s&u=%s&b=%s', that.apiKey, u.user_id, beatmapId);
                                    queueManager.queueNewCall(url, function (json) {
                                        if (json.length > 0) {
                                            UserScore.findOneAndUpdate({
                                                'beatmap_id': beatmapId,
                                                'user_id': u.user_id
                                            }, json[0], {upsert: true}, function (err, doc) {

                                            });
                                        }
                                    }, function () {
                                    });
                                }
                            })
                        })

                        if (err) console.log(err)
                        d.resolve(true);
                    });
                }
                catch (e) {
                    console.error(e);
                    d.resolve(false);
                }
            });
            Q.when(d.promise).then(function (result) {
                console.log(util.format('%s has been crawled. result: %s', beatmapId, (result === true ? 'ok' : 'not ok')).bgYellow.black)
            })


        }).on('error', function (e) {
            console.error(e.message);
        })
    }

    this.crawlSpecific = function () {
        var query = Beatmap.findOne({beatmap_id: {$lt: that.currentBeatmapId}});

        if (that.useCrawlDate) {
            query.sort({'xLastCrawl': 1, 'beatmap_id': -1});
        }
        else {
            query.sort({'beatmap_id': -1});
        }
        query.limit(1);
        query.exec(function (err, beatmap) {
            if (err) return console.error(err);
            if (null !== beatmap) {
                that.currentBeatmapId = beatmap.beatmap_id;
                that.requestPage('b/' + that.currentBeatmapId + '&m=0', that.currentBeatmapId);
            }
            else {
                that.currentBeatmapId = 10000000000;
            }
        });
        setTimeout(function () {
            that.crawlSpecific();
        }, that.timeout)
    }

}
Crawler.prototype.start = function(){
    var that = this;
    that.crawlSpecific();
}

module.exports = Crawler;