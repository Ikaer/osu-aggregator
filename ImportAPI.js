/**
 * Created by Xavier on 29/06/2015.
 */
var Q = require('q');
var osuAPI = require('./osuAPI')
var osuDB = require('./osuDB');
var mongoose = require('mongoose');
var Beatmap = mongoose.model("Beatmap");
var moment = require('moment');

function ImportAPI(initialDate, configFile, endDate) {
    this.config = configFile;
    this.currentDate = moment(initialDate);
    this.endDate = null;
    if (undefined !== endDate && null !== endDate) {
        this.endDate = moment(endDate);
    }
}
ImportAPI.prototype.getAndWriteBeatmaps = function () {
    var that = this;
    Q.when(osuAPI.getBeatmaps(that.currentDate.format('YYYY-MM-DD'), that.config)).then(function (sr) {
        var hasDoneWriting = osuDB.writeBeatmaps(sr);
        Q.when(hasDoneWriting).then(function () {
            var mAndOneMonth = that.currentDate.add(1, 'M');
            if (mAndOneMonth.isBefore(moment()) && (null === that.endDate || mAndOneMonth.isBefore(that.endDate))) {
                that.currentDate = mAndOneMonth;
                setTimeout(function () {
                    that.getAndWriteBeatmaps();
                }, 10000);
            }
            else {
                console.log('all is done, process will exit now')
                process.exit()
            }
        });
    });
};

module.exports = {
    config: null,
    start: function (initialDate, configFile, endDate) {
        var importApi = new ImportAPI(initialDate, configFile, endDate);
        importApi.getAndWriteBeatmaps();
    }
}