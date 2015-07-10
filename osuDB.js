/**
 * Created by Xavier on 29/06/2015.
 */
// import the global schema, this can be done in any file that needs the model
require('./schema/beatmap.js')();
var mongoose = require('mongoose');
// grab the person model object
var Beatmap = mongoose.model("Beatmap");

// connect to a server to do a quick write / read example
var Q = require('q');
var isConnected = Q.defer();
var moment = require('moment');

mongoose.connect('mongodb://127.0.0.1:27017/OSU', function (err) {
    if (err) throw err;
    isConnected.resolve();
});
module.exports = {
    lastDate: null,
    lastBeatmapId: null,
    writeBeatmaps: function (sr) {
        var that = this;
        var dLastDate = Q.defer();
        var srJSON = JSON.parse(sr);
        Q.when(isConnected).then(function () {
            var momentum = function(date){
                return moment(date).format('YYYY-MM-DD');
            }
            console.log(srJSON.length + ' beatmaps are been retrieved.');
            var maxLastDateFound = null;
            var lastBeatmapIdFound = null;
            for (var i = 0; i < srJSON.length; i++) {

/*
                Below 1.5: Easy
                Below 2.25: Normal
                Below 3.75: Hard
                Below 5.25: Insane
                Above 5.25: Expert

  */
                var difficulty = 0;
                var difficultyRating = srJSON[i].difficultyrating;
                if(difficultyRating<1.5){
                    difficulty = 1;
                }
                else if(difficultyRating<2.25){
                    difficulty = 2;
                }
                else if(difficultyRating<3.75){
                    difficulty = 3;
                }
                else if(difficultyRating<5.25){
                    difficulty = 4;
                }
                else{
                    difficulty = 5;
                }
                srJSON[i].difficulty = difficulty;
                Beatmap.findOneAndUpdate({beatmap_id: srJSON[i].beatmap_id}, srJSON[i], {upsert: true}, function (err, b) {

                });
                var b = new Beatmap(srJSON[i]);
                if (momentum(b.approved_date) > maxLastDateFound || null === maxLastDateFound) {
                    maxLastDateFound = momentum(b.approved_date);
                }
                if (b.beatmap_id > lastBeatmapIdFound || null === lastBeatmapIdFound) {
                    lastBeatmapIdFound = b.beatmap_id;
                }
            }
            if (that.lastDate === maxLastDateFound && that.lastBeatmapId === lastBeatmapIdFound) {
                console.log('stop the process');
                dLastDate.resolve(null);
            }
            else {
                that.lastDate = maxLastDateFound;
                that.lastBeatmapId = lastBeatmapIdFound;
                console.log('continue the process. Last approved_date was ' + that.lastDate + ', last beatmap_id was ' + that.lastBeatmapId);
                dLastDate.resolve(that.lastDate);

            }
        });
        return dLastDate.promise;
    }
}
