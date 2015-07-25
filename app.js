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

//require('longjohn');
module.exports = app;





var https = require('https');


require("console-stamp")(console)

var nconf = require('nconf');
 nconf.argv();
var configFilePath =nconf.get('config')

if(undefined === configFilePath || null === configFilePath || '' === configFilePath){
    configFilePath = 'config/config.json';
}

nconf.file('config', configFilePath);
nconf.file('private', 'config/private.json');

var mongoose = require('mongoose');
require('./schema/beatmap.js')();
mongoose.connect(nconf.get('mongodbPath'), function (err) {
    if (err) throw err;
    if (nconf.get('startCrawlingServer')) {
        var crawler = require('./crawler');
        crawler.start();
    }
    if (nconf.get('startFileUpdater')) {
        var source = nconf.get('source');
        if(undefined === source){
            source = 'API';
        }
        if(source === 'API'){
            var downloader = require('./apiBeatmapCrawler');
            downloader.start();
        }
        else{
            var websiteDownloader = require('./WebsiteBeatmapCrawler');
            websiteDownloader.start(source);
        }
    }
});

app.listen(nconf.get('port'))