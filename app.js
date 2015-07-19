require("console-stamp")(console)

var nconf = require('nconf');
 nconf.argv();
var configFilePath =nconf.get('config')

if(undefined === configFilePath || null === configFilePath || '' === configFilePath){
    configFilePath = 'config/config.json';
}

nconf.file(configFilePath);


var mongoose = require('mongoose');
require('./schema/beatmap.js')();
mongoose.connect(nconf.get('mongodbPath'), function (err) {
    if (err) throw err;
    if (nconf.get('startCrawlingServer')) {
        var crawler = require('./crawler');
        crawler.start();
    }
    if (nconf.get('startFileUpdater')) {
        var downloader = require('./downloader');
        downloader.start();
    }
});