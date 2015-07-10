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
    getNormalizedDifficulty: function (difficultyRating) {


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
    },
    tryGetFile: function (beatmap) {

        var urlToDownload = 'http://bloodcat.com/osu/s/' + beatmapSet_Ids
    },
    udpateBeatmap: function (webBeatmap) {

        webBeatmap.difficulty = getNormalizedDifficulty(webBeatmap.difficultyrating);
        webBeatmap.xFetchDate = moment();

        //var file = fs.createWriteStream(pathOfWorking + 'osudownload_1.osz')
        var beatmapFile;
        var urlToDownload = 'http://bloodcat.com/osu/s/' + webBeatmap.beatmapset_id;
        var httpGet = http.get(urlToDownload, function (response) {

            response.pipe(beatmapFile);
            webBeatmap.xFile = beatmapFile;
            Beatmap.findOneAndUpdate({beatmap_id: webBeatmap.beatmap_id}, webBeatmap, {upsert: true}, function (err, updatedBMap) {

            });
        });

    },
    writeBeatmaps: function (sr) {
        var that = this;
        var isDone = Q.defer();
        var srJSON = JSON.parse(sr);

        console.log(srJSON.length + ' beatmaps are been retrieved.');

        Q.when(isConnected).then(function () {

            for (var i = 0; i < srJSON.length; i++) {

                var webBeatmap = new Beatmap(srJSON[i]);
                var beatmapId = webBeatmap.beatmap_id;


                var webLastUpdate = moment(webBeatmap.last_update);

                var databaseBeatmap = Beatmap.findOne({'beatmap_id': beatmapId}, function (err, databaseBeatmap) {
                    if (null === bmap || moment(databaseBeatmap.last_update).isAfter(webLastUpdate)) {
                        udpateBeatmap(webBeatmap);
                    }
                });


            }
            isDone.resolve(null);
        });
        return isDone.promise;
    }
};
