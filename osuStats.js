


var mongoose = require('mongoose');

var Beatmap = mongoose.model("Beatmap");
var BeatmapSet = mongoose.model("BeatmapSet");
var Q = require('q');
var https = require('https');
var cheerio = require('cheerio');
var moment = require('moment');
var S = require('string');
var _ = require('underscore');
require('colors');
var util = require('util');
var nconf = require('nconf');
nconf.file({file: 'config.json'});
function OsuStats() {
    var that = this;
    this.currentPage = 1;
    this.timeout =  nconf.get('stuffPath');
    this.currentBeatmapId = 330175 //500000;
    this.baseUrl = 'https://osu.ppy.sh/p/beatmaplist?';
    for (var i = 1; i <= 125; i++) {

    }
    this.requestPage = function (query) {
        https.get(that.baseUrl + query, function (res) {
            res.on('error', function (e) {
                console.error(e);
            })
            res.setEncoding('utf8');
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            });
            res.on('end', function () {
                var $ = cheerio.load(body);
                var beatmaps = $('.beatmap');
                var updatedCount = 0;
                if (beatmaps.length > 0) {
                    var updatesDone = [];
                    beatmaps.each(function (i, beatmap) {
                        var d = Q.defer();
                        updatesDone.push(d.promise);
                        var update = {
                            "xLastCrawl": new Date(),
                            "playCount": 0,
                            "favouritedCount": 0,
                            "tags": [],
                            "negativeUserRating": 0
                        }

                        var $beatmap = $(beatmap);
                        var attrId = $beatmap.attr('id');
                        var beatmapset_id = parseInt(attrId);


                        var smallDetails = $beatmap.find('.small-details').contents();
                        for (var i = 0; i < smallDetails.length; i++) {
                            if ($(smallDetails[i]).hasClass('icon-heart') && (i + 1) < smallDetails.length) {
                                var favoriteStr = S($(smallDetails[i + 1]).text());
                                favoriteStr.replaceAll(',', '');
                                update.favouritedCount = parseInt(favoriteStr);

                            }
                            if ($(smallDetails[i]).hasClass('icon-play') && (i + 1) < smallDetails.length) {
                                var playCountStr = S($(smallDetails[i + 1]).text());
                                playCountStr.replaceAll(',', '');
                                update.playCount = parseInt(playCountStr);
                            }
                        }

                        update.tags = _.map($beatmap.find('.tags a'), function (tag) {
                            var $tag = $(tag);
                            return $tag.text();
                        });

                        update.negativeUserRating = parseFloat($beatmap.find('.negative').css('width'));


                        BeatmapSet.update({'beatmapset_id': beatmapset_id}, update, {muli: true}, function (err, raw) {
                            if (err) console.log(err)
                        });
                        Beatmap.update({'beatmapset_id': beatmapset_id}, update, {multi: true}, function (err, docs) {
                            if (err) console.log(err)
                            else {
                                updatedCount++;
                            }
                            d.resolve();
                        });


                    });
                    Q.allSettled(updatesDone).then(function () {
                        console.log(util.format('%s / %s beatmaps found for %s',  updatedCount, beatmaps.length,query).bgYellow.black)
                    })
                }
            });

        }).on('error', function (e) {
            console.error(e.message);
        })
    }

    this.crawlPage = function () {
        if (that.currentPage <= 125) {
            that.requestPage('page=' + that.currentPage);
            that.currentPage++;
        }
        else {
            that.currentPage = 1;
        }

        setTimeout(function () {
            that.crawlPage();
        }, that.timeout)

    }
    this.crawlSpecific = function () {
        var query = BeatmapSet.findOne({beatmapset_id: {$lt: that.currentBeatmapId}});

        query.sort({'xLastCrawl': 1, 'beatmapset_id': -1});
        query.limit(100);
        query.exec(function (err, beatmapSet) {
            if (err) return console.error(err);
            if (null !== beatmapSet) {
                that.currentBeatmapId = beatmapSet.beatmapset_id;
                that.requestPage('q=' + that.currentBeatmapId);
            }
            else {
                that.currentBeatmapId = 500000;
            }
        });
        setTimeout(function () {
            that.crawlSpecific();
        }, that.timeout)
    }
    this.start = function () {
        that.crawlPage();
        that.crawlSpecific();
    }
}
var osuStats = new OsuStats();
module.exports = {
    start: function () {
        osuStats.start();
    }
};