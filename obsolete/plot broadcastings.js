import * as fs from "fs";
import * as d3 from 'd3';
import { createCanvas, loadImage, ImageData } from "canvas"
import { computeBroadcastingsViz } from "./viz_broadcastings.js";

let settings = {}
settings.sdate = "2022-09-22"
settings.edate = "2022-10-04"

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)
let dateOffset = 0
let dateIndex = {}

let year, month, datem, folder, polAffData
let broadcastings = []
while (endDate-date >= 0) {
  year = date.getFullYear()
  month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  folder = `data/${year}/${month}/${datem}`

  console.log("\n# Get data from "+folder)

  let filePath = `${folder}/broadcastings.csv`
  if (fs.existsSync(filePath)) {
    try {
      // Load file as string
      let csvString = fs.readFileSync(filePath, "utf8")
      // Parse string
      let data = d3.csvParse(csvString);
      console.log(`Broadcastings loaded (${data.length} rows)`)
      broadcastings = broadcastings.concat(data.map(d => {
        d.date_offset = dateOffset
        return d
      }))

    } catch (error) {
      console.log(`Broadcastings file for ${year}-${month}-${datem} could not be loaded`, error)
    }
  } else {
    console.log(`Broadcastings not found for ${year}-${month}-${datem}`);
  }

  dateIndex[dateOffset] = date
  date.setDate(date.getDate() + 1)
  dateOffset++
}
const maxDateOffset = dateOffset

console.log(`\nAll broadcastings loaded (${broadcastings.length} rows)`)

// Aggregate broadcastings by resource and group
let resIndex = {}
broadcastings.forEach(b => {
  const groupsIndex = JSON.parse(b.resource_groups)
  let groups = []
  for (let g in groupsIndex) {
    for (let i=0; i<+groupsIndex[g]; i++) {
      groups.push(g)
    }
  }
  const group = groups[Math.floor(Math.random()*groups.length)]
  let resObj = resIndex[b.resource_id] || {id: b.resource_id, type: b.resource_type, days:{}}
  let dayObj = resObj.days[+b.date_offset] || {}
  dayObj[group] = (dayObj[group] || 0) + 1
  resObj.days[b.date_offset] = dayObj
  resIndex[b.resource_id] = resObj
})

// Left-right index for political groups
const lrIndex = getLrIndex()

// Compute average score for each resource, so that we can sort them.
let resources = Object.values(resIndex)
resources.forEach(res => {
  let total = 0
  let sum = 0
  Object.values(res.days).forEach(groupsObj => {
    for (let g in groupsObj) {
      let count = groupsObj[g]
      total += count * lrIndex[g]
      sum += count
    }
  })
  res.lrScore = total/sum
  res.dayCount = Object.keys(res.days).length
})
resources.sort(function(a,b){
  let diff = a.lrScore - b.lrScore
  if (diff == 0) {
    return a.dayCount - b.dayCount
  } else return diff
})

// Compute max broadcastings per day
let countPerDay = {}
resources.forEach(res => {
  for (let day in res.days) {
    let count = countPerDay[day] || 0
    Object.values(res.days[day]).forEach(c => {
      count += +c
    })
    countPerDay[day] = count
  }
})
const maxCount = d3.max(Object.values(countPerDay))

/// Build and draw visualization

// Additional settings. TODO: move up
settings.dayPxWidth = 32
settings.dayPxSep = 6
settings.resPxSep = 6

// Virtual plot each resource
resources.forEach(res => {
  res.dateBlocks = []
  // Let's get the min and max
  res.dateOffsetExtent = d3.extent(Object.keys(res.days).filter(dateOffset => {
    return Object.values(res.days[dateOffset]).length > 0
  }))
  for (dateOffset=res.dateOffsetExtent[0]; dateOffset<=res.dateOffsetExtent[1]; dateOffset++) {
    let colorCode = getColorCode(dateIndex[dateOffset])
    let groupsObj = res.days[dateOffset]
    let pixels = []
    if (groupsObj) {
      for (let g in groupsObj) {
        for (let i=0; i<groupsObj[g]; i++) {
          let col = colorCode[g]
          if (col === undefined) {
            col = colorCode[""]
          }
          pixels.push(col)
        }
      }
      pixels = shuffle(pixels)
    }
    const dateBlock = {
      px: pixels,
      do: dateOffset,
      h: Math.ceil(pixels.length/settings.dayPxWidth),
    }
    res.dateBlocks.push(dateBlock)
  }
  res.block = {
    x: settings.dayPxSep + (settings.dayPxWidth + settings.dayPxSep) * res.dateOffsetExtent[0],
    w: (settings.dayPxWidth + settings.dayPxSep) * res.dateBlocks.length - settings.dayPxSep,
    h: d3.max(res.dateBlocks.map(db => db.h)),
  }

  // Draw that resource's visualization

  const blockCanvas = createCanvas(res.block.w, res.block.h)
  const bCtx = blockCanvas.getContext("2d")
  bCtx.lineWidth = 0;
  bCtx.fillStyle = "#666666";
  bCtx.beginPath();
  bCtx.fillRect(0, 0, bCtx.canvas.width, bCtx.canvas.height);
  res.dateBlocks.forEach((db, dbi) => {
    let yCurrent = 0
    let xCurrent = 0
    db.px.forEach(col => {
      bCtx.fillStyle = col;
      bCtx.beginPath();
      bCtx.fillRect(dbi * (settings.dayPxWidth + settings.dayPxSep) + xCurrent, yCurrent, 1, 1);
      xCurrent++
      if (xCurrent >= settings.dayPxWidth + ((dbi<res.dateBlocks.length-1)?(settings.dayPxSep):(0))) {
        xCurrent = 0
        yCurrent++
      }
    })
  })
  res.imgd = bCtx.getImageData(0, 0, blockCanvas.width, blockCanvas.height)
})

// Virtual plot the whole
// resources = resources.filter((d,i) => i<1000)

// Stack from top
let bars = {}
let wCurrent = 0
resources.forEach(res => {
  let yCurrent = 0
  res.dateBlocks.forEach(db => {
    let dateOffset = db.do
    yCurrent = Math.max(yCurrent, bars[dateOffset] || 0)
  })
  res.block.y = yCurrent
  yCurrent += res.block.h + settings.resPxSep
  res.dateBlocks.forEach(db => {
    bars[db.do] = yCurrent
  })
  wCurrent = Math.max(wCurrent, res.block.x + res.block.w + settings.dayPxSep)
})
let hCurrent = d3.max(Object.values(bars))

/*
// Naive (stairs)
let yCurrent = settings.resPxSep
let wCurrent = 0
resources.forEach(res => {
  res.block.y = yCurrent
  yCurrent += res.block.h + settings.resPxSep
  wCurrent = Math.max(wCurrent, res.block.x + res.block.w + settings.dayPxSep)
})
let hCurrent = yCurrent
*/

// Init canvas
let canvas = createCanvas(wCurrent, hCurrent)
const ctx = canvas.getContext("2d")

// Background
ctx.lineWidth = 0;
ctx.fillStyle = "#303040";
ctx.beginPath();
ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

// Paint each image data
resources.forEach(res => {
  ctx.putImageData(res.imgd, res.block.x, res.block.y)
})


let imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
const out = fs.createWriteStream(`data/broadcastings from ${settings.sdate} to ${settings.edate}.png`)
const stream = canvas.createPNGStream()
stream.pipe(out)
out.on('finish', () => {
  console.log("\nDone.")
})








// Functions we need
function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function getPolAffData(){
  if (polAffData === undefined) {
    try {
      // Load affiliations file as string
      const polAffDataJson = fs.readFileSync('political_affiliations.json', "utf8")

      try {
        polAffData = JSON.parse(polAffDataJson)
        console.log('Political affiliations loaded and parsed');

        return polAffData
      } catch (error) {
        console.error("Error: the political affiliations file could not be parsed.", error)
      }
    } catch (error) {
      console.error("Error: the political affiliations file could not be loaded", error)
    }
  } else {
    return polAffData
  }
}

function getColorCode(date){
  const polAffData = getPolAffData()
  let era
  polAffData.eras.forEach(e => {
    let sdate = new Date(e.startDate)
    let edate = new Date(e.endDate)
    if (sdate <= date && date <= edate ) {
      era = e
    }
  })

  if (era===undefined) {
    console.error(`No corresponding era found in political affiliations file`);
  } else {
    let colorCode = {"": "#a4a4a4"}
    era.affiliations.forEach(a => {
      colorCode[a.id] = a.color
    })
    return colorCode
  }
}

function getLrIndex(){
  const polAffData = getPolAffData()
  let lrIndex = {}
  polAffData.eras.forEach(e => {
    e.affiliations.forEach(a => {
      lrIndex[a.id] = a.leftRightIndex
    })
  })
  return lrIndex
}
