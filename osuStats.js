var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");
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
var nconf = require('nconf');
nconf.file({file: 'config.json'});
function OsuStats() {
    var that = this;
    this.timeout = nconf.get('updateStatsTimeout');
    this.currentBeatmapId = 10000000000;
    this.baseUrl = 'https://osu.ppy.sh/';
    this.useCrawlDate = nconf.get('useCrawlDate');

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
                        var text = parseInt(S($(td).text()).replaceAll(',', '').trim().toString(), 10);
                        if (i === 0) {
                            update.negativeUserRating = text
                        }
                        else {
                            update.positiveUserRating = text;
                        }
                    })
                    var htmlOfPlays = S(tr4Tds.eq(5).html());

                    update.playSuccess = parseInt(htmlOfPlays.between('</b> (', ' of ').s, 10);
                    update.playCount = parseInt(htmlOfPlays.between(' of ', ' plays)').s, 10);


                    var tr5Tds = $trs.eq(5).children('td');
                    var htmlOfdates = S(tr5Tds.eq(1).html().split('<')[0]).trim().s;


                    var m = moment(htmlOfdates, 'MMM D, YYYY');
                    update.submitted_date = m.toDate();

                    var tr6Tds = $trs.eq(6).children('td');
                    var favourited = S(tr6Tds.eq(0).html()).between('<b>Favourited ', ' times</b>').replaceAll(',', '').trim().s;
                    update.favouritedCount = parseInt(favourited, 10)

                    Beatmap.update({'beatmap_id': beatmapId}, update, {multi: false}, function (err, doc) {
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
    this.start = function () {
        that.crawlSpecific();
    }
}
var osuStats = new OsuStats();
module.exports = {
    start: function () {
        osuStats.start();
    }
};