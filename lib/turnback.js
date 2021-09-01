const turf = require('@turf/turf');

const tbc = (corrected, prePlayerPositionMap, t2, beforeT2, t2Length) => {
    let output = corrected 
    if (prePlayerPositionMap && prePlayerPositionMap.size > 0) {
        output = corrected.map(player => {
            let returnNear = false

            // ignore players who are away from turn-back line
            if (turf.pointToLineDistance(player.geometry.coordinates, t2) > 0.001) {
                console.log('away from t2 course with distance: ' + turf.pointToLineDistance(player.geometry.coordinates, t2))
                return player;
            }
            // ignore players whos's last point is not recorded
            if (!prePlayerPositionMap.has(player.properties.player_id)) {
                console.log('not found: ' + player.properties.player_id)
                returnNear = true
            }
            lastPosition = prePlayerPositionMap.get(player.properties.player_id);
            // console.log('lastPosition', lastPosition)

            // players'location, who are on the turn-back line
            offsetLocation = turf.nearestPointOnLine(t2, player.geometry.coordinates);
            console.log('offsetLocation', offsetLocation);

            // p4
            if (offsetLocation.properties.location >= t2Length / 2) {
                returnNear = true
            }

            nearLocation = beforeT2 + offsetLocation.properties.location;
            farLocation = beforeT2 + (t2Length - offsetLocation.properties.location);
            console.log(nearLocation, farLocation, lastPosition.properties.distance, offsetLocation.properties.location);
            // see https://docs.google.com/drawings/d/e/2PACX-1vQNEMbJTivqtWgfX8hm6hqAARZR-p53FpZ5Ud5Wktc17_AAMgJ8HCB5M8JdX9HPA5dtbAI9JMzTkLFC/pub?w=960&h=720
            // p5
            if (Math.abs(nearLocation - lastPosition.properties.distance) < 0.05)
                return player;

            if (nearLocation > lastPosition.properties.distance || returnNear) {
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
            }else if (farLocation >= lastPosition.properties.distance) {
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
    return output
}

module.exports = {tbc}