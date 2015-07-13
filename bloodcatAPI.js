/**
 * Created by Xavier on 13/07/2015.
 */

require('./schema/beatmapSet.js')();

var mongoose = require('mongoose');


var BeatmapSet = mongoose.model("BeatmapSet");
var http = require('http');

var Q = require('q');
var moment = require('moment');
var fs = require('fs');
var util = require('util');
var Guid = require('Guid');
var _ = require('underscore');

var nconf = require('nconf');
nconf.file({file: 'config.json'});


var Bloodcat = function () {
    var that = this;
    that.currentMax = 0;
}

Bloodcat.prototype.getMax = function () {
    var that = this;
    var d = Q.defer();
    var maxBloodCatBeatmapSetId = nconf.get('maxBloodcatBeatmapSetId');
    if (undefined === maxBloodCatBeatmapSetId || null === maxBloodCatBeatmapSetId)
        BeatmapSet.findOne().where({beatmapset_id: 1}).sort({beatmapset_id: -1}).exec(function (err, doc) {
            nconf.file('maxBloodcatBeatmapSetId', doc.beatmapset_id);
            that.currentMax = doc.beatmapset_id;
        })
    return d.promise;
}

Bloodcat.prototype.chain = function () {
    var max =  nconf.get('maxBloodcatBeatmapSetId');
    BeatmapSet.findOne({beatmapset_id: 1})

}
var bloodcat = new Bloodcat();


module.exports = {
    getFiles: function () {

    }
}