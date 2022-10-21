import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as d3 from 'd3';
import dotenv from "dotenv";

dotenv.config();

export async function render_legend_twitter(date) {
  const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
  const year = targetDate.getFullYear()
  const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const thisFolder = `data/${year}/${month}/${datem}`

  const width = 3590
}

// Command line arguments
// Date argument
let date = undefined
const dateArgRegexp = /d(ate)?=([0-9]{4}\-[0-9]{2}\-[0-9]{2})/i
process.argv.forEach(d => {
  let found = d.match(dateArgRegexp)
  if (found && found[2]) {
    date = found[2]
  }
})
// Auto mode (run the script)
if (process.argv.some(d => ["a","-a","auto","-auto"].includes(d))) {
  console.log("Run script"+((date)?(" on date "+date):("")))
  render_legend_twitter(date)
}