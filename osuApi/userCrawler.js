/**
 * Created by Xavier on 03/08/2015.
 */
/*
 Partie aggregator
 R�cup�rer la liste des utilisateurs en base.
 Crawler les url suivantes:
 - /api/get_user_best (https://github.com/peppy/osu-api/wiki#apiget_user_best)
 - /api/get_user_recent (https://github.com/peppy/osu-api/wiki#apiget_user_recent)
 et stocker en base

 Partie website
 V1
 - mettre une option sur les cards pour indiquer qu'on les poss�de d�j� (une ou plusieurs beatmaps)
 - changer couleur de fond d'une card possed�
 - mettre une option pour automatiquement flagger comme possed� celle que l'on vient de telecharger

 V2
 - mettre une liste "Telechargement r�cents"

 */
process.on('uncaughtException', function(err){
    var e = err;
})

var mongoose = require('mongoose')
var User = mongoose.model("User");
var UserScore = mongoose.model("UserScore");
var UserRecent = mongoose.model("UserRecent");
var async = require('async');
var _ = require('underscore');
var request = require('request');
var util = require('util');
var events = require('events');
var colors = require('colors');
function UserCrawler(httpQueue, config, user) {

    var urlBest = util.format('https://osu.ppy.sh/api/get_user_best?k=%s&u=%s&limit=50', config.apiKey, user.user_id);
    var urlRecent = util.format('https://osu.ppy.sh/api/get_user_recent?k=%s&u=%s&limit=50', config.apiKey, user.user_id);
    var taskBest = {
        url: urlBest,
        user: user,
        type: 'best'
    }
    var taskRecent = {
        url: urlRecent,
        user: user,
        type: 'recent'
    }
    httpQueue.push(taskBest);
    httpQueue.push(taskRecent);
}


function UsersCrawler(config) {
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
                if (json.length > 0) {
                    _.each(json, function (j) {
                        var beatmap_id = parseInt(j.beatmap_id, 10);
                        var score = parseInt(j.score, 10);
                        var indexFound = -1;
                        if(task.type === 'best'){
                             indexFound = _.findIndex(task.user.scores, function (s) {
                                return s.beatmap_id === beatmap_id;
                            })

                            if(indexFound > -1 && score > task.user.scores[indexFound].score){
                                task.user.scores.splice(indexFound, 1);
                                task.user.scores.push(j);
                            }

                            if (indexFound === -1) {
                                task.user.scores.push(j);
                            }
                        }
                        else{
                             indexFound = _.findIndex(task.user.recents, function (s) {
                                return s.beatmap_id === beatmap_id;
                            })
                            if(indexFound > -1 && score > task.user.recents[indexFound].score){
                                task.user.recents.splice(indexFound, 1);
                                task.user.recents.push(j);
                            }
                            if (indexFound === -1) {
                                task.user.recents.push(j);
                            }
                        }

                    })
                }
                if(task.type === 'best'){
                    task.user.lastScoresFetch = new Date();
                }
                else{
                    task.user.lastRecentsFetch = new Date();
                }

                task.user.save(function (err) {
                    callback();
                });
            }
        });
    }, 1)
    this.httpQueue.drain= function(){
        that.httpQueue.kill();
        process.send({msgFromWorker: 'JOB_DONE'})
        process.exit(0);
        return false;
    }
}
UsersCrawler.prototype.start = function () {
    var that = this;
    this.crawlers = [];

    User.find({}, function (err, users) {
        var hasCrawlers = false;
        _.each(users, function (u) {
            if (u.user_id) {
                hasCrawlers = true;
                u.scores = _.reject(u.scores, function(x, i){
                    return x.user_id !== u.user_id;
                })
                u.recents = _.reject(u.recents, function(x, i){
                    return x.user_id !== u.user_id;
                })
                u.save();

                that.crawlers.push(new UserCrawler(that.httpQueue, that.config, u))
            }
        })
        if(hasCrawlers == false){
            process.send({msgFromWorker: 'JOB_DONE'})
            process.exit(0);
        }
    })
}

UsersCrawler.prototype.__proto__ = events.EventEmitter.prototype;


module.exports = UsersCrawler;