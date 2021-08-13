const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fetch = require('node-fetch');

const upload = async () => {
    const params = {
        ACL: 'public-read',
        Body: 'Hello',
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
    const headers = {'API_TOKEN': 'CywNKSJSA22YJH7664EPUfrKmL9LFKEZye_w_e3QAXC5G8fSSThp9yF9RHYKjnc95XChwdi4n7PNz8iE55FsipkZJ9DRmYA8i293'}
    const response = await fetch(load_url, { headers: headers });
    return response; 
}

const main = async (evt) => {
    const response = await fetchPlayers();
    if (response.status === 200) {
        //return upload();
        const json = await response.json();
        console.log('success', json);
        return response;
    }
    console.log(response);
    return response;
}
exports.handler = main;