process.on('uncaughtException', function (e) {
    console.log(e);
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
mongoose.connect(privateFile.mongodbPath, function (err) {
    if (err) throw err;

    var Crawler = require('./crawlerFactory');
    var crawler = new Crawler(_.extend(jsonfile.readFileSync('config/crawler.json'), privateFile))
    crawler.start();

    var websiteCrawler = require('./osuApi/websiteBeatmapCrawler')

    var graveyardCrawler = websiteCrawler.get(_.extend(jsonfile.readFileSync('config/graveyardCrawler.json'), privateFile))
    graveyardCrawler.start();
    var pendingCrawler = websiteCrawler.get(_.extend(jsonfile.readFileSync('config/pendingCrawler.json'), privateFile))
    pendingCrawler.start();

    var apiCrawlerFactory = require('./osuApi/crawler');

    var crawler2015 = apiCrawlerFactory.get(_.extend(jsonfile.readFileSync('config/downloader2015.json'), privateFile));
    crawler2015.analyze();
    var crawlerOlder = apiCrawlerFactory.get(_.extend(jsonfile.readFileSync('config/downloaderOlder.json'), privateFile))
    crawlerOlder.analyze();
});

app.listen('4583')


//nconf.argv();
//var configFilePath =nconf.get('config')
//nconf.file('config', configFilePath);