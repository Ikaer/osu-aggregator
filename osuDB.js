/**
 * Created by Xavier on 29/06/2015.
 */
// import the global schema, this can be done in any file that needs the model
require('./schema/beatmap.js')();
var mongoose = require('mongoose');
// grab the person model object
var Beatmap = mongoose.model("Beatmap");
var http = require('http');
// connect to a server to do a quick write / read example
var Q = require('q');
var isConnected = Q.defer();
var moment = require('moment');
var fs = require('fs');
var AdmZip = require('adm-zip');

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
    udpateBeatmap: function (updates, currentIndex, oneBeatmapIsDone) {
        var that = this;

        var webBeatmap = updates[currentIndex];
        var d = Q.defer();

        webBeatmap.difficulty = this.getNormalizedDifficulty(webBeatmap.difficultyrating);
        webBeatmap.xFetchDate = moment();

        process.on('uncaughtException', function (err) {
            console.log(err);
        });

        function getFrombloodcat(wb) {
            var beatmapTitle = wb.title + '.osu';
            http.get({
                    hostname: "bloodcat.com",
                    port: 80,
                    path: '/osu/s/' + webBeatmap.beatmapset_id,
                    headers: {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "Accept-Encoding": "gzip, deflate, sdch",
                        "Accept-Language": "fr-FR,fr;q=0.8,en-US;q=0.6,en;q=0.4",
                        "Connection": "keep-alive",
                        "Host": "bloodcat.com"
                    }
                }
                , function (res) {
                    var data = [], dataLen = 0;
                    res.on('data', function (chunk) {
                        data.push(chunk);
                        dataLen += chunk.length;
                    }).on('end', function () {
                        var buf = new Buffer(dataLen);
                        for (var i = 0, len = data.length, pos = 0; i < len; i++) {
                            data[i].copy(buf, pos);
                            pos += data[i].length;
                        }
                        var zip = new AdmZip(buf);
                        var zipEntries = zip.getEntries();
                        for (var i = 0; i < zipEntries.length; i++) {
                            var entryTitle = zipEntries[i].entryName;
                            console.log(entryTitle + ' vs ' + beatmapTitle);
                            if (entryTitle === beatmapTitle) {
                                fs.writeFile('file' + i + '.osu', zip.readAsText(zipEntries[i]), function (err) {
                                    var a = 2;
                                });
                            }
                            //console.log(zip.readAsText(zipEntries[i]));
                        }
                    });
                });
        }

        getFrombloodcat(webBeatmap);
        //    var testXFile = fs.createWriteStream('test.osz');
        //response.pipe(unzip.Extract({path: pathOfWorking + 'osudownload_1'}));
        //response.on('end', function () {
        //    webBeatmap.xFile = xFile;
        //    var file = fs.createWriteStream('osudownload_1.osz')
        //    xFile.pipe(webBeatmap.xFile)
        //    //Beatmap.findOneAndUpdate({beatmap_id: webBeatmap.beatmap_id}, webBeatmap, {upsert: true}, function (err, updatedBMap) {
        //    //    d.resolve();
        //    //    var writer = fs.writeFile('test.osu', updatedBMap.xFile);
        //    //    if (currentIndex + 1 <= updates.length) {
        //    //        console.log('waiting for 500 ms to get next call');
        //    //        setTimeout(function () {
        //    //            that.udpateBeatmap(updates, currentIndex + 1, oneBeatmapIsDone);
        //    //        }, 500);
        //    //    }
        //    //});
        //})
        oneBeatmapIsDone.push(d.promise);
    },
    tryToGetBeatmapInDatabase: function (webBeatmap, updates) {
        var d = Q.defer();
        var beatmapId = webBeatmap.beatmap_id;
        var webLastUpdate = moment(webBeatmap.last_update);
        Beatmap.findOne({'beatmap_id': beatmapId}, function (err, databaseBeatmap) {
            if (null === databaseBeatmap || moment(databaseBeatmap.last_update).isAfter(webLastUpdate)) {
                console.log(beatmapId + ' need to be updated')
                updates.push(webBeatmap);
            }
            else {
                console.log(databaseBeatmap.beatmap_id + ' already ok');
            }
            d.resolve();
        });
        return d.promise;
    }
    ,
    writeBeatmaps: function (sr) {
        var that = this;
        var allIsDone = Q.defer();
        var oneBeatmapIsDone = [];
        var srJSON = JSON.parse(sr);

        console.log(srJSON.length + ' beatmaps are been retrieved.');

        Q.when(isConnected).then(function () {
            var updates = [];
            var deferreds = [];
            for (var i = 0; i < srJSON.length; i++) {
                var webBeatmap = new Beatmap(srJSON[i]);
                deferreds.push(that.tryToGetBeatmapInDatabase(webBeatmap, updates));
            }
            Q.allSettled(deferreds).then(function (results) {
                that.udpateBeatmap(updates, 0, oneBeatmapIsDone);
            })
        });
        Q.allSettled(oneBeatmapIsDone).then(function (results) {
            allIsDone.resolve();
        });
        return allIsDone.promise;
    }
}
;
