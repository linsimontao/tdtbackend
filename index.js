const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fetch = require('node-fetch');
const turf = require('@turf/turf');
const dataPath = 'tokyo';
const courseTokyo = require('./' + dataPath + '/Course.json');
const ptList100 = courseTokyo.features.map(pt => pt.geometry.coordinates);
const ls100 = turf.lineString(ptList100);

// define turn-back line and start index from ls100
const t2 = require('./' + dataPath + '/T2.json');
const t2Length = turf.length(t2, { units: 'kilometers' });
const t2EntryPointIndex = (dataPath == 'tokyo') ? 342 : 3997;
const beforeT2 = turf.length(turf.lineString(ls100.geometry.coordinates.slice(0, t2EntryPointIndex + 1)));

// define s3 buckets
const lastPlayerPositionBucket = 'dev-last-player-position';
const finalPlayerPositionBucket = 'dev.realtimemap.jp';
const lastPlayerPositionFile = 'last-position.json';
const finalPlayerPositionFile = 'players-locations.json';

var prePlayerPositionMap = null;
var curPlayerPositionMap = new Map();

const tbc = require('./lib/turnback').tbc

let playersRaw = null;

// local test
//playersRaw = require('./players-location.json');

const main = async (evt) => {
    const response = await fetchPlayers();
    if (response.status === 200) {
        const json = await response.json();
        console.log('get data from pss', json);
        if (json.result_code == '0') {
            playersRaw = json.result_detail;
            if (playersRaw.length > 0) {

                //get previous players on T2
                try {
                    ret = await download(lastPlayerPositionBucket, lastPlayerPositionFile);
                    const json = JSON.parse(ret.Body);
                    prePlayerPositionMap = new Map(Object.entries(json));
                } catch (err) {
                    console.log(err);
                }

                const processed = processPlayers(playersRaw);
                try {
                    await upload(Object.fromEntries(curPlayerPositionMap), lastPlayerPositionBucket, lastPlayerPositionFile);
                } catch (err) {
                    console.log(err);
                }

                return await upload(processed, finalPlayerPositionBucket, finalPlayerPositionFile);
            }
        }
        return response;
    }
    return response;
}

const upload = async (json, bucket, filename) => {
    const params = {
        ACL: 'public-read',
        Body: JSON.stringify(json),
        ContentType: 'text/html',
        Bucket: bucket,
        Key: filename
    }

    return new Promise((resolve, reject) => {
        s3.putObject(params, (err, results) => {
            if (err)
                reject(err);
            else
                resolve(results);
        })
    })
}

const download = async (bucket, filename) => {
    const params = {
        Bucket: bucket,
        Key: filename,
    };

    return new Promise((resolve, reject) => {
        return s3.getObject(params, (err, results) => {
            if (err)
                reject(err);
            else {
                resolve(results);
            }
        })
    })
}

const fetchPlayers = async () => {
    const load_url = "https://tdt2021.cycling.pssol.jp/api/mapbox/get_players_location";
    const headers = { 'API_TOKEN': 'CywNKSJSA22YJH7664EPUfrKmL9LFKEZye_w_e3QAXC5G8fSSThp9yF9RHYKjnc95XChwdi4n7PNz8iE55FsipkZJ9DRmYA8i293' };
    const response = await fetch(load_url, { headers: headers });
    return response;
}

const fetchLastPositions = async () => {

}

const processPlayers = (playersRaw) => {
    const players = playersRaw.map(player => {
        const pt = turf.point([player.latlong.y, player.latlong.x]);
        const away = turf.pointToLineDistance(pt, ls100)

        return {
            "type": "Feature",
            "properties": {
                ...player,
                away: away
            },
            "geometry": {
                "coordinates": [
                    player.latlong.y,
                    player.latlong.x
                ],
                "type": "Point"
            }
        }
    })

    // players who are away from course >= 2km will be filtered out
    filtered = players.filter(player => player.properties.away < 2)

    // players who are away from course >= 1000m will not be corrected
    corrected = filtered.map(player => {
        if (player.properties.away < 1) {
            const diff = turf.nearestPointOnLine(ls100, player.geometry.coordinates);
            console.log(diff);

            //Add new players if on T2
            const diffT2 = turf.nearestPointOnLine(t2, player.geometry.coordinates);
            if (diffT2.properties.dist === 0) {
                const jsonRet = {
                    "type": "Feature",
                    "properties": {
                        ...player.properties,
                        distance: beforeT2 + diffT2.properties.location
                    },
                    "geometry": player.geometry
                };
                curPlayerPositionMap.set(player.properties.player_id, jsonRet);
                return jsonRet;
            } else {
                return {
                    "type": "Feature",
                    "properties": {
                        ...player.properties,
                        distance: diff.properties.location
                    },
                    "geometry": player.geometry
                };
            }
        }
        return player;
    })

    // turn-back line correction
    corrected = tbc(corrected, prePlayerPositionMap, t2, beforeT2, t2Length)

    const nowString = Date().toLocaleString();
    const nowTS = Date.now();
    const final = corrected.map(player => {
        if (player.properties.away < 1) {
            const player_ts = Date.parse(player.properties.latlong_update_date + '+09:00')
            let diffSec = (nowTS - player_ts) / 1000;
            if (diffSec < 0) {
                diffSec = 0;
            }
            const speed = player.properties.speed;

            // predict distance from last update to now, unit km
            const diffDist = (speed * diffSec) / 1000;
            // predict distance from start, unit 
            const predictDistance = player.properties.distance + diffDist
            return {
                "type": "Feature",
                "properties": {
                    ...player.properties,
                    speed: speed,
                    distance: predictDistance,
                    process_datetime: nowString,
                    process_datetimestamp: nowTS,
                    //no animation if player last update time > 3 hours ago
                    animation: diffDist > 3600 * 3 ? 0 : 1
                },
                "geometry": player.geometry
            }
        }
        //no update if player away from course > 1km
        return {
            "type": "Feature",
            "properties": {
                ...player.properties,
                //no animation
                animation: 0
            },
            "geometry": player.geometry
        };
    })

    return final;
}

exports.handler = main;