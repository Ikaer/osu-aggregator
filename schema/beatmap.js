/**
 * Created by Xavier on 29/06/2015.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var UserScore = require('./userScore');
// create an export function to encapsulate the model creation
module.exports = function() {
        // define schema
        var BeatmapSchema = new Schema({
                "approved"         : Number,                   // 3 = qualified, 2 = approved, 1 = ranked, 0 = pending, -1 = WIP, -2 = graveyard
                "approved_date"    : Date, // date ranked, UTC+8 for now
                "last_update"      : Date, // last update date, timezone same as above. May be after approved_date if map was unranked and reranked.
                "difficulty"       : Number, // transformation of difficultyrating into a difficulty level (1=easy, 2= normal, 3=hard, 4=insane, 5=expert)
                "artist"           : String,
                "beatmap_id"       : Number,              // beatmap_id is per difficulty
                "beatmapset_id"    : Number,               // beatmapset_id groups difficulties into a set
                "bpm"              : Number,
                "creator"          : String,
                "difficultyrating" : Number,             // The amount of stars the map would have ingame and on the website
                "diff_size"        : Number,                   // Circle size value (CS)
                "diff_overall"     : Number,                   // Overall difficulty (OD)
                "diff_approach"    : Number,                   // Approach Rate (AR)
                "diff_drain"       : Number,                   // Healthdrain (HP)
                "hit_length"       : Number,                 // seconds from first note to last note not including breaks
                "source"           : String,
                "title"            : String,      // song name
                "total_length"     : Number,                 // seconds from first note to last note including breaks
                "version"          : String,            // difficulty name
                "mode": Number,
                "playCount": Number,
                "playSuccess": Number,
                "maxCombo":Number,
                "favouritedCount": Number,

                // frow score crawler
                scores:[UserScore.schema],
                maxPP:Number,
                // from website
                "genre":String,
                "language":String,
                "negativeUserRating":Number,
                "positiveUserRating":Number,
                "tags":[String],
                "submitted_date":Date,

                // create by my system
                "xFileName": String,
                "xLastCrawl": Date,
                "xLastScoreDate": Date,
                "mp3_403":Date,
                "largeImage_403":Date,
                "image_403":Date,
                "osz_403":Date,
                "downloadIsNoLongerAvailable":Boolean
        });
        mongoose.model('Beatmap', BeatmapSchema);
};

