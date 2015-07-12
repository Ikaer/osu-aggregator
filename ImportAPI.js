/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var osuAPI = require('./osuAPI')
var osuDB = require('./osuDB');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');

function ImportAPI(initialDate, configFile, endDate, revert) {
    this.config = configFile;
    this.revert = revert;
    this.startDate = moment(initialDate);
    this.currentDate = this.revert ? moment() : moment(initialDate);

    this.endDate = null;
    if (undefined !== endDate && null !== endDate) {
        this.endDate = moment(endDate);
    }
}
ImportAPI.prototype.nextDate = function () {
    var that = this;
    if (true === that.revert) {
        var mLessOneMonth = that.currentDate.subtract(1, 'M')
        if (mLessOneMonth.isAfter(that.startDate)) {
            that.currentDate = mLessOneMonth;
        }
        else {
            console.log('all is done, process will exit now')
            process.exit()
        }
    }
    else {
        var mAndOneMonth = that.currentDate.add(1, 'M');
        if (mAndOneMonth.isBefore(moment()) && (null === that.endDate || mAndOneMonth.isBefore(that.endDate))) {
            that.currentDate = mAndOneMonth;
        }
        else {
            console.log('all is done, process will exit now')
            process.exit()
        }
    }
}
ImportAPI.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(osuAPI.getBeatmaps(that.currentDate.format('YYYY-MM-DD'), that.config)).then(function (sr) {
       var hasDoneWriting = osuDB.writeBeatmaps(sr);
       // var tmpHasDoneWriting = Q.defer();
       //var hasDoneWriting = tmpHasDoneWriting.promise;
       // tmpHasDoneWriting.resolve();
        Q.when(hasDoneWriting).then(function () {
            that.nextDate();
            setTimeout(function () {
                that.getAndWriteBeatmaps();
            }, 10000);
        });
    });
};

module.exports = {
    config: null,
    start: function (initialDate, configFile, endDate, revert) {
        var importApi = new ImportAPI(initialDate, configFile, endDate, revert);
        importApi.getAndWriteBeatmaps();
    }
}