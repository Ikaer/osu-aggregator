// http://thatextramile.be/blog/2012/01/stop-storing-passwords-already/

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var UserScore = require('./userScore');
var UserRecent = require('./userRecent');
var userSchema = new Schema({
    name: String,
    user_id : Number,
    lastScoresFetch: Date,
    lastRecentsFetch: Date,
    scores:[UserScore.schema],
    recents:[UserRecent.schema],
    beatmaps : [Number]
});

mongoose.model('User', userSchema);
module.exports = mongoose.model('User');