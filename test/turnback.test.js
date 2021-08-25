const test = require('tape') // assign the tape library to the variable "test"
const turf = require('@turf/turf')

const tbc = require('../lib/turnback').tbc
const dataPath = 'tokyo'

const courseTokyo = require('../' + dataPath + '/Course.json')
const ptList100 = courseTokyo.features.map((pt) => pt.geometry.coordinates)
const ls100 = turf.lineString(ptList100)

const t2 = require('../' + dataPath + '/T2.json')
const t2Length = turf.length(t2, { units: 'kilometers' })
const t2EntryPointIndex = dataPath == 'tokyo' ? 342 : 3997
const beforeT2 = turf.length(
    turf.lineString(ls100.geometry.coordinates.slice(0, t2EntryPointIndex + 1)),
)

const realLog = require('./label_output3_player2.json')
const fs = require('fs')

// generating test context
// expectedPattern = p1 | p2 | p3-a | p3-b
const generateTest = (expectedPattern) => {
    let t2StartIdx = 343
    let t2MidIdx = 394
    let t2EndIdx = 453

    let pIdx = 0
    let lpIdx = 0

    if (expectedPattern == 'p1') {
        pIdx = Math.floor(
            Math.random() * (t2MidIdx - t2StartIdx + 1) + t2StartIdx,
        )
        lpIdx = Math.floor(Math.random() * (t2StartIdx - 300) + 300)
    }

    if (expectedPattern == 'p2') {
        pIdx = Math.floor(Math.random() * (475 - t2EndIdx) + t2EndIdx + 1)
        lpIdx = Math.floor(Math.random() * (t2EndIdx - t2MidIdx) + t2MidIdx)
    }

    if (expectedPattern == 'p3-a') {
        pIdx = Math.floor(
            Math.random() * (t2MidIdx - t2StartIdx + 1) + t2StartIdx,
        )
        lpIdx = Math.floor(Math.random() * (pIdx - t2StartIdx + 1) + t2StartIdx)
    }

    if (expectedPattern == 'p3-b') {
        pIdx = Math.floor(Math.random() * (t2EndIdx - t2MidIdx) + t2MidIdx)
        lpIdx = Math.floor(Math.random() * (t2MidIdx - t2StartIdx) + t2StartIdx)
    }

    let lpPoint = turf.point(ls100.geometry.coordinates[lpIdx])
    let lpLocation = turf.nearestPointOnLine(
        ls100,
        lpPoint.geometry.coordinates,
    ).properties.location
    // console.log(turf.nearestPointOnLine(ls100, lpPoint.geometry.coordinates))

    propTemp = {
        player_id: 'mbx_maru',
    }
    p = {
        properties: {
            ...propTemp,
            point_identifier: 'current',
        },
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: ls100.geometry.coordinates[pIdx],
        },
    }
    lp = {
        properties: {
            ...propTemp,
            point_identifier: 'last',
            //location: lpLocation,
            distance: lpLocation,
        },
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: ls100.geometry.coordinates[lpIdx],
        },
    }

    console.log(
        '>>> pidx: ' +
            pIdx +
            ', lpidx: ' +
            lpIdx +
            ', lplocation: ' +
            lpLocation +
            ', pattern: ' +
            expectedPattern,
    )
    return { p: p, lp: lp }
}

/* 
test('advanced auto tests', function (t) {
    const availabePatterns = ['p1', 'p2', 'p3-a', 'p3-b']

    for (let i = 0; i < 10; i++) {
        let pattern = availabePatterns[Math.floor(Math.random() * 4)]
        console.log(
            '(' +
                i +
                ')------------------------------------------------------------------------------',
        )

        context = generateTest(pattern)
        lpMap = new Map()
        lpMap.set('mbx_maru', context.lp)
        const actual = tbc([context.p], lpMap, t2, beforeT2, t2Length)

        console.log(actual)
        t.equal(1, actual.length, 'should length of response match first')
        if (pattern == 'p3-a') {
            t.true(
                t2Length / 2 - (actual[0].properties.distance - beforeT2) >
                    0.05,
                'should be near',
            )
        }
        if (pattern == 'p3-b') {
            t.true(
                actual[0].properties.distance - beforeT2 - t2Length / 2 > -0.05,
                'should be far',
            )
        }
    }
    t.end()
})
*/

const generateRealTest = (idx) => {
    currentP = realLog[idx]
    lastP = realLog[idx - 1]

    // inject player_id
    currentP.properties['player_id'] = 'mapbox'
    lastP.properties['player_id'] = 'mapbox'

    // console.log(currentP)
    // console.log(lastP)

    return { p: currentP, lp: lastP }
}

test('load real tests', function (t) {
    context = generateRealTest(19)
    lpMap = new Map()
    lpMap.set('mapbox', context.lp)
    console.log(context)
    const actual = tbc([context.p], lpMap, t2, beforeT2, t2Length)
    console.log(actual)

    t.end()
})

test('line chunk test', function (t) {
    var line = turf.lineString([
        [139.737028, 35.656307],
        [139.738223, 35.663208],
        [139.746436, 35.67813],
    ])

    var chunk = turf.lineChunk(line, 0.1, { units: 'kilometers' })
    var final = []
    chunk.features.map((e) => {
        // console.log(e.geometry.coordinates)
        e.geometry.coordinates.map((ee) => {
            final.push(ee)
        })
    })

    // console.log(final)
    t.end()
})

test('cut course test', function (t) {
    var chunk = turf.lineChunk(ls100, 0.005, { units: 'kilometers' })
    var final = []
    chunk.features.map((e) => {
        e.geometry.coordinates.map((ee) => {
            final.push(ee)
        })
    })
    var output = turf.lineString(final)
    // console.log(output)
    var jsonContent = JSON.stringify(output)

    fs.writeFile('CourseTokyo_updated.json', jsonContent, 'utf8', function (err) {
        if (err) {
            console.log('An error occured while writing JSON Object to File.')
            return console.log(err)
        }

        console.log('JSON file has been saved.')
    })

    t.end()
})
