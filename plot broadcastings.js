import * as fs from "fs";
import * as d3 from 'd3';
import { createCanvas, loadImage, ImageData } from "canvas"
import { computeBroadcastingsViz } from "./viz_broadcastings.js";

let settings = {}
settings.sdate = "2022-07-22"
settings.edate = "2022-10-04"

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)
let dateOffset = 0
let dateIndex = {}

let year, month, datem, folder
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
const lrIndex = {
  "LFI": -1,
  "GDR": -0.8,
  "ECO": -0.6,
  "SOC": -0.4,
  "MODEM": -0.2,
  "REN": 0.0,
  "LIOT": 0.0,
  "NI": 0.0,
  "HOR": 0.2,
  "LR": 0.8,
  "RN": 1.0,
}

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

// Draw the thing
let canvas = createCanvas(maxDateOffset, maxCount)
const ctx = canvas.getContext("2d")

// Colors
const colorCode = {
  "LFI": "#aa2400",
  "GDR": "#db3a5d",
  "SOC": "#e882bf",
  "ECO": "#2db24a",
  "LIOT": "#cacf2b",
  "REN": "#ffaf00",
  "MODEM": "#e28813",
  "HOR": "#3199aa",
  "LR": "#4747a0",
  "RN": "#604a45",
  "": "#a4a4a4",
}

// White bg
ctx.lineWidth = 0;
ctx.fillStyle = "#FFFFFF";
ctx.beginPath();
ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

// Paint resources
for (dateOffset=0; dateOffset<maxDateOffset; dateOffset++) {
  let yCurrent = 0
  resources.forEach(res => {
    let groupsObj = res.days[dateOffset]
    if (groupsObj) {
      let pixels = []
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
      pixels[0] = "#FFFFFF" // Borders
      pixels.forEach(col => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.fillRect(dateOffset, yCurrent++, 1, 1);
      })
    }
  })
}

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