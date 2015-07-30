var util = require('util')

module.exports = {
    getNormalizedDifficulty: function (difficultyRating) {
        /*
         Below 1.5: Easy
         Below 2.25: Normal
         Below 3.75: Hard
         Below 5.25: Insane
         Above 5.25: Expert

         */
        var normalizedDifficulty = 0;
        if (difficultyRating < 1.5) {
            normalizedDifficulty = 1;
        }
        else if (difficultyRating < 2.25) {
            normalizedDifficulty = 2;
        }
        else if (difficultyRating < 3.75) {
            normalizedDifficulty = 3;
        }
        else if (difficultyRating < 5.25) {
            normalizedDifficulty = 4;
        }
        else {
            normalizedDifficulty = 5;
        }
        return normalizedDifficulty;
    },
    buildFileName: function (beatmap) {
        return util.format('%s - %s (%s) [%s].osu', beatmap.artist, beatmap.title, beatmap.creator, beatmap.version);
    }
};