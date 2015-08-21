/**
 * Created by Xavier on 03/08/2015.
 */
/*
 Partie aggregator
 R?cup?rer la liste des utilisateurs en base.
 Crawler les url suivantes:
 - /api/get_user_best (https://github.com/peppy/osu-api/wiki#apiget_user_best)
 - /api/get_user_recent (https://github.com/peppy/osu-api/wiki#apiget_user_recent)
 et stocker en base

 Partie website
 V1
 - mettre une option sur les cards pour indiquer qu'on les poss?de d?j? (une ou plusieurs beatmaps)
 - changer couleur de fond d'une card possed?
 - mettre une option pour automatiquement flagger comme possed? celle que l'on vient de telecharger

 V2
 - mettre une liste "Telechargement r?cents"

 */
process.on('uncaughtException', function (err) {
    var e = err;
})

var mongoose = require('mongoose')
var Beatmap = mongoose.model("Beatmap");
var UserScore = mongoose.model("UserScore");
var UserRecent = mongoose.model("UserRecent");
var async = require('async');
var _ = require('underscore');
var request = require('request');
var util = require('util');
var events = require('events');
var colors = require('colors');
function ScoreCrawler(httpQueue, config, beatmap) {

    var urlScore = util.format('https://osu.ppy.sh/api/get_scores?k=%s&b=%s', config.apiKey, beatmap.beatmap_id);
    var taskScore = {
        url: urlScore,
        beatmap: beatmap
    }
    httpQueue.push(taskScore);
}


function ScoresCrawler(config) {
    // get users
    events.EventEmitter.call(this);
    var that = this;
    this.config = config;
    this.httpQueue = async.queue(function (task, callback) {
        that.emit('haveDoneSomeWork')
        request(task.url, function (err, response, data) {
            if (err) {
                callback();
            }
            else {
                var json = JSON.parse(data);
                task.beatmap.scores = [];
                var maxPP = 0;
                if (json.length > 0) {
                    _.each(json, function (j) {
                        var pp = 0;
                        try {
                            pp = parseInt(j.pp, 10);
                        }
                        catch (e) {

                        }
                        if (pp > maxPP) {
                            maxPP = pp;
                        }
                        task.beatmap.scores.push(j);
                    })
                }
                task.beatmap.xLastScoreDate = new Date();
                task.beatmap.maxPP = maxPP;
                task.beatmap.save(function (err, doc) {
                    setTimeout(function () {
                        callback();
                    }, 1000)
                });
            }
        });
    }, 1)
    this.httpQueue.drain = function () {
        that.httpQueue.kill();
        process.send({msgFromWorker: 'JOB_DONE'})
        process.exit(0);
        return false;
    }
}
ScoresCrawler.prototype.start = function () {
    var that = this;
    this.crawlers = [];
    var query = Beatmap.find({approved: {$in: [1, 2]}});
    query.sort({
        maxPP:1,
        xLastScoreDate:1
    })
    query.exec(function (err, beatmaps) {
        _.each(beatmaps, function (u) {
            that.crawlers.push(new ScoreCrawler(that.httpQueue, that.config, u));
        })
    })
}

ScoresCrawler.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = ScoresCrawler;