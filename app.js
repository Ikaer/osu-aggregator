process.on('uncaughtException', function (e) {
    if (e.message !== 'bind EADDRINUSE') {
        console.log(e);
    }
});


var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
require("console-stamp")(console)

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

if (process.env.NODE_ENV !== 'production') {

}

module.exports = app;
require("console-stamp")(console)


var _ = require('underscore');


var jsonfile = require('jsonfile')
var privateFile = jsonfile.readFileSync('config/private.json');

var mongoose = require('mongoose');
require('./schema/beatmap.js')();
require('./schema/user.js')();
require('./schema/userScore.js')();
require('./schema/userRecent.js')();
var util = require('util');
var workers = [];
var cluster = require('cluster');
if (cluster.isMaster) {

    function createWorker(workerType) {
        var config = _.extend(jsonfile.readFileSync('config/' + workerType + '.json'), privateFile)
        console.log('[%s] starting worker', workerType)

        var worker = cluster.fork({
            typeOfCrawler: workerType
        })
        var workerDef = {
            id: workerType,
            worker: worker,
            config: config,
            pingResponse: null,
            resetWorker: function (timeout) {
                console.log('[%s] next job should start in %s minutes', workerDef.id, timeout / 1000 / 60)
                setTimeout(function () {
                    createWorker(workerType)
                }, timeout)
            }
        };
        workers.push(workerDef);
        worker.on('message', function (msg) {
                if (msg) {
                    console.log('[%s] %s', workerDef.id, msg.msgFromWorker)
                    if (msg.msgFromWorker === 'JOB_DONE') {
                        console.log('[%s] worker has done its work', workerDef.id)

                    }
                }
            }
        )
        ;
        worker.on('disconnected', function () {
            console.log('[%s] worker has comitted suicide %s', workerDef.id)
        })
        worker.on('exit', function (code, signal) {
            console.log('[%s] worker has exit with code %s', workerDef.id, code)
            workerDef.resetWorker(workerDef.config.workerTimeout)
        })
    }
}

mongoose.connect(privateFile.mongodbPath, function (err) {
    if (err) throw err;
    if (cluster.isMaster) {
        setTimeout(function () {
            createWorker('userCrawler')
        }, 1000)
        setTimeout(function () {
        createWorker('crawler')
        }, 1000)
        setTimeout(function () {
            createWorker('graveyardCrawler')
        }, 5000)
        setTimeout(function () {
            createWorker('pendingCrawler')
        }, 10000)
        setTimeout(function () {
        createWorker('downloader2015')
        }, 15000)
        setTimeout(function () {
            createWorker('downloaderOlder')
        }, 20000)
    }
    else {
        var killIfNotHealthy_timeout = null
        var resetKillCountdown = function () {
           // process.send({msgFromWorker: 'I\'ve escaped death for now'.bgRed });
            killIfNotHealthy_timeout = setTimeout(function () {
                process.send({msgFromWorker: util.format('I\'m going to kill mysell because i\'m stuck'.bgRed)})
                process.exit(0);
            }, 1000 * 60 *10)
        }
        var crawler = null;
        var config = _.extend(jsonfile.readFileSync('config/' + process.env.typeOfCrawler + '.json'), privateFile);
        switch (process.env.typeOfCrawler) {
            case 'userCrawler':
                var UserCrawler = require('./osuApi/userCrawler');
                crawler = new UserCrawler(config)
                break;
            case 'crawler':
                var Crawler = require('./crawlerFactory');
                crawler = new Crawler(config)
                break;
            case 'graveyardCrawler':
            case 'pendingCrawler':
                var websiteCrawler = require('./osuApi/websiteBeatmapCrawler')
                crawler = websiteCrawler.get(config);
                break;
            case 'downloader2015':
            case 'downloaderOlder':
                var apiCrawlerFactory = require('./osuApi/crawler');
                crawler = apiCrawlerFactory.get(config);
                break;
        }
        crawler.start();
        crawler.on('haveDoneSomeWork', function () {
            resetKillCountdown();
        })
        resetKillCountdown();
        process.send({msgFromWorker: 'I\'am started'})
        process.on('message', function (msg) {
            console.log(msg);
        })
        process.on('exit', function () {

        })

    }


});
app.listen('4583')