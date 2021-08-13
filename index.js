const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fetch = require('node-fetch');
const course100 = require('./Course100.json');
const turf = require('@turf/turf');
const ptList100 = course100.features.map(pt => pt.geometry.coordinates);
const ls100 = turf.lineString(ptList100);

// local test code
//const playersRaw = require('./players-location');

const main = async (evt) => {
    const response = await fetchPlayers();
    if (response.status === 200) {
        const json = await response.json();
        console.log('get data from pss', json);
        if (json.result_code == '0') {

            // local test code
            // json = playersRaw;

            const processed = processPlayers(json);
            return upload(processed);
        }
        return response;
    }
    return response;
}

const upload = async (json) => {
    const params = {
        ACL: 'public-read',
        Body: JSON.stringify(json),
        ContentType: 'text/html',
        Bucket: 'dev.realtimemap.jp',
        Key: 'players-locations.json'
    }

    return await new Promise((resolve, reject) => {
        s3.putObject(params, (err, results) => {
            if (err)
                reject(err);
            else
                resolve(results);
        })
    })
}

const fetchPlayers = async () => {
    const load_url = "https://cycling-st.demo.cycling.pssol.jp/api/mapbox/get_players_location"
    const headers = { 'API_TOKEN': 'CywNKSJSA22YJH7664EPUfrKmL9LFKEZye_w_e3QAXC5G8fSSThp9yF9RHYKjnc95XChwdi4n7PNz8iE55FsipkZJ9DRmYA8i293' }
    const response = await fetch(load_url, { headers: headers });
    return response;
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
            diff = turf.nearestPointOnLine(ls100, player.geometry.coordinates)
            return {
                "type": "Feature",
                "properties": {
                    ...player.properties,
                    distance: diff.properties.location
                },
                "geometry": {
                    "coordinates": diff.geometry.coordinates,
                    "type": "Point"
                }
            }
        }
        return player;
    })

    // use this timestamp to correct location w/ Dummy data
    // will be removed after real data received
    const serverTime = new Date('2019-09-15 14:10:00+09:00');

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