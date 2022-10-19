import * as fs from "fs";
import * as d3 from 'd3';
import { createCanvas, loadImage, ImageData } from "canvas"
import { computeBroadcastingsViz } from "./viz_broadcastings.js";

let settings = {}
settings.sdate = "2022-07-22"
settings.edate = "2022-08-03"

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

console.log(`\nAll broadcastings loaded (${broadcastings.length} rows)`)

// Extract stream data
// Let's be super simple and track the most popular hashtags over the whole period.
let topThreshold = 25
let hashtagsIndex = {}
broadcastings.forEach(b => {
  let tags = JSON.parse(b.tweet_hashtags)
  tags.forEach(t => {
    hashtagsIndex[t] = (hashtagsIndex[t] || 0) + 1
  })
})
let hashtags = Object.keys(hashtagsIndex).map(tag => {
  return {tag:tag, count:hashtagsIndex[tag]}
})
hashtags.sort(function(a,b){ return b.count - a.count })
hashtagsIndex = {}
hashtags
  .filter((t,i) => i<topThreshold)
  .forEach(t => {
    hashtagsIndex[t.tag] = t.count
  })
let days = {}
broadcastings.forEach(b => {
  let tags = JSON.parse(b.tweet_hashtags)
  tags.forEach(t => {
    if (hashtagsIndex[t]) {
      let dayObj = days[b.date_offset] || {}
      dayObj[t] = (dayObj[t] || 0) + 1
      days[b.date_offset] = dayObj
    }
  })
})
let streamGraphData = []
for (let date_offset in days) {
  for (let tag in days[date_offset]) {
    streamGraphData.push({
      date_offset: date_offset,
      date: dateIndex[date_offset],
      tag: tag,
      count: days[date_offset][tag]
    })
  }
}

// Write file
const streamGraphFile = `data/Stream data from ${settings.sdate} to ${settings.edate}.csv`
const streamGraphString = d3.csvFormat(streamGraphData)
try {
  fs.writeFileSync(streamGraphFile, streamGraphString)
  console.log("Stream graph data saved.")
} catch(error) {
  console.error("Error: Stream graph data could not be saved.")
}

console.log("\nDone.")