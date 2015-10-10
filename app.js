require("console-stamp")(console, {pattern: "yyyy-mm-dd HH:MM:ss", label: false})

var _ = require('underscore');


var jsonfile = require('jsonfile')
var privateFile = jsonfile.readFileSync('config/private.json');

var mongoose = require('mongoose');
require('./schema/beatmap.js')();
require('./schema/user.js')();
require('./schema/userScore.js')();
require('./schema/userRecent.js')();
var util = require('util');


var nconf = require('nconf');
nconf.argv()
var t = nconf.get('T');


var dbConnect = function () {
    mongoose.connect(privateFile.mongodbPath, function (err) {
        if (err) {
            if (err.message == 'connect ECONNREFUSED 127.0.0.1:27017') {
                setTimeout(dbConnect, 5000);
            }
            else throw err;
        }
        else {
            if (undefined !== t) {
                function createWorker(workerType) {
                    var config = _.extend(jsonfile.readFileSync('config/' + workerType + '.json'), privateFile)
                    console.log('[%s] starting worker', workerType)


                    var crawler = null;
                    switch (workerType) {
                        case 'specificBeatmapsCrawler':
                            var specificCrawler = require('./osuApi/specificBeatmapsCrawler');
                            crawler = specificCrawler.get(config);
                            break;
                        case 'userCrawler':
                            var UserCrawler = require('./osuApi/userCrawler');
                            crawler = new UserCrawler(config)
                            break;
                        case 'scoreCrawler':
                            var ScoresCrawler = require('./osuApi/scoreCrawler');
                            crawler = new ScoresCrawler(config);
                            break;
                        case 'crawler':
                           // var Crawler = require('./osuApi/osuWebsiteInformationParser');
                            //crawler = new Crawler(config)
                            break;
                        case 'graveyardCrawler':
                        case 'pendingCrawler':
                        case 'rankedCrawler':
                            var websiteCrawler = require('./osuApi/osuWebsiteCrawler')
                            crawler = websiteCrawler.get(config);
                            break;
                        case 'downloader2015':
                        case 'downloaderOlder':
                            var apiCrawlerFactory = require('./osuApi/osuAPICrawler');
                            crawler = apiCrawlerFactory.get(config);
                            break;
                    }
                    crawler.start();
                }

                createWorker(t);
            }
        }
    });
}
dbConnect();