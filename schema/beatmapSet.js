/**
 * Created by Xavier on 29/06/2015.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// create an export function to encapsulate the model creation
module.exports = function () {
    // define schema
    var BeatmapSetSchema = new Schema({
        "artist": String,
        "beatmapset_id": Number,
        "title": String,
        "last_update": Date,
        "xLastCrawl": Date,
        "playCount": Number,
        "favouritedCount": Number,
        "tags":[String],
        "negativeUserRating":Number
    });
    mongoose.model('BeatmapSet', BeatmapSetSchema);
};

