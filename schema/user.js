// http://thatextramile.be/blog/2012/01/stop-storing-passwords-already/

var mongoose = require('mongoose'),
    Schema = mongoose.Schema

var userSchema = new Schema({
    name: String,
    user_id : Number
});

mongoose.model('User', userSchema);
module.exports = mongoose.model('User');