/**
 * Created by Xavier on 29/06/2015.
 */

var request = require('request');
var Q = require('q')
var util = require('util')
module.exports = {
    osuAPIUrl: 'https://osu.ppy.sh',
    url: {
        getBeatmap: '/api/get_beatmaps'
    },
    getBeatmaps: function (since, config) {
        var d = Q.defer();
        var promise = d.promise;
        var url = util.format('%s%s?k=%s', this.osuAPIUrl, this.url.getBeatmap, config.apiKey);
        url += util.format('&since=%s', since)
       // url += '&s=37705';

       console.log('calling opu api to get beatmaps since ' + since)
        request(url, function (error, response, body) {
            d.resolve(body);
        });
        return promise;
    }
};


/*
 /api/get_beatmaps
 k - api key (required).
 since - return all beatmaps ranked since this date. Must be a MySQL date.
 s - specify a beatmapset_id to return metadata from.
 b - specify a beatmap_id to return metadata from.
 u - specify a user_id or a username to return metadata from.
 type - specify if u is a user_id or a username. Use string for usernames or id for user_ids. Optional, default behaviour is automatic recognition (may be problematic for usernames made up of digits only).
 m - mode (0 = osu!, 1 = Taiko, 2 = CtB, 3 = osu!mania). Optional, maps of all modes are returned by default.
 a - specify whether converted beatmaps are included (0 = not included, 1 = included). Only has an effect if m is chosen and not 0. Converted maps show their converted difficulty rating. Optional, default is 0.
 limit - amount of results. Optional, default and maximum are 500.



 /api/get_user
 k - api key (required).
 u - specify a user_id or a username to return metadata from (required).
 m - mode (0 = osu!, 1 = Taiko, 2 = CtB, 3 = osu!mania). Optional, default value is 0.
 type - specify if u is a user_id or a username. Use string for usernames or id for user_ids. Optional, default behaviour is automatic recognition (may be problematic for usernames made up of digits only).
 event_days - Max number of days between now and last event date. Range of 1-31. Optional, default value is 1.


 /api/get_scores
 k - api key (required).
 b - specify a beatmap_id to return score information from (required).
 u - specify a user_id or a username to return score information for.
 m - mode (0 = osu!, 1 = Taiko, 2 = CtB, 3 = osu!mania). Optional, default value is 0.
 type - specify if u is a user_id or a username. Use string for usernames or id for user_ids. Optional, default behaviour is automatic recognition (may be problematic for usernames made up of digits only).

 /api/get_user_best
 k - api key (required).
 u - specify a user_id or a username to return best scores from (required).
 m - mode (0 = osu!, 1 = Taiko, 2 = CtB, 3 = osu!mania). Optional, default value is 0.
 limit - amount of results (range between 1 and 50 - defaults to 10).
 type - specify if u is a user_id or a username. Use string for usernames or id for user_ids. Optional, default behavior is automatic recognition (may be problematic for usernames made up of digits only).

 /api/get_user_recent
 k - api key (required).
 u - specify a user_id or a username to return recent plays from (required).
 m - mode (0 = osu!, 1 = Taiko, 2 = CtB, 3 = osu!mania). Optional, default value is 0.
 limit - amount of results (range between 1 and 50 - defaults to 10).
 type - specify if u is a user_id or a username. Use string for usernames or id for user_ids. Optional, default behavior is automatic recognition (may be problematic for usernames made up of digits only).


 /api/get_match
 k - api key (required).
 mp - match id to get information from (required).

 Mods
 enum Mods
 {
 None           = 0,
 NoFail         = 1,
 Easy           = 2,
 //NoVideo      = 4,
 Hidden         = 8,
 HardRock       = 16,
 SuddenDeath    = 32,
 DoubleTime     = 64,
 Relax          = 128,
 HalfTime       = 256,
 Nightcore      = 512, // Only set along with DoubleTime. i.e: NC only gives 576
 Flashlight     = 1024,
 Autoplay       = 2048,
 SpunOut        = 4096,
 Relax2         = 8192,  // Autopilot?
 Perfect        = 16384,
 Key4           = 32768,
 Key5           = 65536,
 Key6           = 131072,
 Key7           = 262144,
 Key8           = 524288,
 keyMod         = Key4 | Key5 | Key6 | Key7 | Key8,
 FadeIn         = 1048576,
 Random         = 2097152,
 LastMod        = 4194304,
 FreeModAllowed = NoFail | Easy | Hidden | HardRock | SuddenDeath | Flashlight | FadeIn | Relax | Relax2 | SpunOut | keyMod,
 Key9           = 16777216,
 Key10          = 33554432,
 Key1           = 67108864,
 Key3           = 134217728,
 Key2           = 268435456
 }
 */