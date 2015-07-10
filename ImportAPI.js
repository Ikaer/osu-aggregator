/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var osuAPI = require('./osuAPI')
var osuDB = require('./osuDB');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');
/*test*/
module.exports = {
    start: function (initialDate) {
        console.log('starting to fetch beatmaps at ' + initialDate);
        this.getAndWriteBeatmaps(initialDate);
    },
    getAndWriteBeatmaps: function (since) {
        var that = this;
        Q.when(osuAPI.getBeatmaps(since)).then(function (sr) {
            var dLastDate = osuDB.writeBeatmaps(sr);
            var m = moment(since);
           var mAndOneMonth = m.add(1, 'M');
            if(mAndOneMonth.isBefore(moment())){
            var newDate = m.format('YYYY-MM-DD');

            Q.when(dLastDate).then(function (lastDate) {
                if (null !== lastDate) {
                    setTimeout(function () {
                        that.getAndWriteBeatmaps(newDate);
                    }, 10000);
                }
            })
            }
        })
    }
}