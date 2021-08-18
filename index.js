const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fetch = require('node-fetch');
//const course100 = require('./Course100.json');
const turf = require('@turf/turf');
const dataPath = 'tokyo';
const courseTokyo = require('./' + dataPath + '/Course.json');
//const ptList100 = course100.features.map(pt => pt.geometry.coordinates);
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

// local test
const playersRaw = require('./players-location.json');

const main = async (evt) => {
    // const response = await fetchPlayers();
    // if (response.status === 200) {
    //     const json = await response.json();
    //     console.log('get data from pss', json);
    //     if (json.result_code == '0') {

    // get playersRaw from s3 dev-last-player-position/players-location.json
    // let playersRaw = null;
    // let ret = null;
    // try {
    //     ret = await download(lastPlayerPositionBucket, 'players-location.json');
    //     playersRaw = JSON.parse(ret.Body);
    //     console.log('players', players);
    // } catch (err) {
    //     console.log(err);
    // }

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

    //       return upload(processed);
    //     }
    //     return response;
    // }
    // return response;
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
    const load_url = "https://cycling-st.demo.cycling.pssol.jp/api/mapbox/get_players_location"
    const headers = { 'API_TOKEN': 'CywNKSJSA22YJH7664EPUfrKmL9LFKEZye_w_e3QAXC5G8fSSThp9yF9RHYKjnc95XChwdi4n7PNz8iE55FsipkZJ9DRmYA8i293' }
    const response = await fetch(load_url, { headers: headers });
    return response;
}

const fetchLastPositions = async () => {

}

const processPlayers = (playersRaw) => {
    const players = playersRaw.result_detail.map(player => {
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
    if (prePlayerPositionMap && prePlayerPositionMap.size > 0) {
        corrected = corrected.map(player => {
            // ignore players who are away from turn-back line
            if (turf.pointToLineDistance(player.geometry.coordinates, t2) > 0) {
                return player;
            }
            // ignore players whos's last point is not recorded
            if (!prePlayerPositionMap.has(player.properties.player_id)) {
                return player;
            }
            lastPosition = prePlayerPositionMap.get(player.properties.player_id);

            // players'location, who are on the turn-back line
            offsetLocation = turf.nearestPointOnLine(t2, player.geometry.coordinates);
            console.log('offsetLocation', offsetLocation);

            nearLocation = beforeT2 + offsetLocation.properties.location;
            farLocation = beforeT2 + (t2Length - offsetLocation.properties.location);
            console.log(nearLocation, farLocation, lastPosition.properties.distance);
            // see https://docs.google.com/drawings/d/e/2PACX-1vQNEMbJTivqtWgfX8hm6hqAARZR-p53FpZ5Ud5Wktc17_AAMgJ8HCB5M8JdX9HPA5dtbAI9JMzTkLFC/pub?w=960&h=720
            if (nearLocation > lastPosition.properties.distance) {
                console.log('nearLocation:', nearLocation);
                // p3-a
                return {
                    "type": "Feature",
                    "properties": {
                        ...player.properties,
                        distance: nearLocation
                    },
                    "geometry": player.geometry
                }
            }

            if (farLocation >= lastPosition.properties.distance) {
                console.log('farLocation:', farLocation);
                // p3-b
                return {
                    "type": "Feature",
                    "properties": {
                        ...player.properties,
                        distance: farLocation
                    },
                    "geometry": player.geometry
                }
            }

            // p3-c, should be ignored
            return player;
        })
    }
    // use this timestamp to correct location w/ Dummy data
    // will be removed after real data received
    const serverTime = new Date('2021-08-16 15:21:00+09:00');

    const nowString = Date().toLocaleString();
    const nowTS = Date.now();
    const final = corrected.map(player => {
        if (player.properties.away < 1) {
            const player_ts = Date.parse(player.properties.latlong_update_date + '+09:00')
            let diffSec = (serverTime.getTime() - player_ts) / 1000;
            if (diffSec < 0) {
                diffSec = 0;
            }
            // for dummy data need to provide a random speed(5m/s - 10m/s)
            // will be removed with real data
            const speed = Math.random() * 5 + 5;

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