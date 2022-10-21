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

  let yesterday = new Date(targetDate.getTime());
  yesterday.setDate(targetDate.getDate() - 1);
  const yyear = yesterday.getFullYear()
  const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

  let localeData, polAffData

  const width = 3590
  const height = 3590

  let canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")


  const locale = getLocaleData()
  
  const xOffset = 12
  // Draw the title and info
  let y = 100
  drawText(ctx, `${locale.legendTwitter.title} ${yyear}-${ymonth}-${ydatem}`, xOffset, y, "start", "#303040", 0, "104px Raleway")
  y += 24 // Margin
  locale.legendTwitter.textRows.forEach(txt => {
    y += 54
    drawText(ctx, txt, xOffset, y, "start", "#303040", 0, "semibold 46px Raleway")
  })
  // Légende couleurs
  y += 36
  const squareSize = 48
  const colorCode = getColorCode(targetDate)
  colorCode.forEach(d => {
    drawSquare(xOffset, y, squareSize, d.color)
    drawText(ctx, d.name, xOffset+squareSize+12, y+46, "start", "#303040", 0, "bold 40px Raleway")
    y += squareSize+12
  })
  // Footer
  y = height - 36
  drawText(ctx, locale.legendTwitter.footer, xOffset, y, "start", "#303040", 0, "56px Raleway")

  // Save legend
  const legendFilename = `${thisFolder}/Legend Twitter.png`
  let imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const out = fs.createWriteStream(legendFilename)
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => {
    console.log("Legend saved.")
  })

  // Internal methods
  function drawText(ctx, txt, x, y, textAlign, text_color, text_border_thickness, font) {
    ctx.textAlign = textAlign || "start";
    ctx.font = font
    if (text_border_thickness > 0) {
      ctx.lineWidth = text_border_thickness;
      ctx.fillStyle = text_color;
      ctx.strokeStyle = text_color;
      ctx.fillText(
        txt,
        x,
        y
      );
      ctx.strokeText(
        txt,
        x,
        y
      );
    } else {
      ctx.lineWidth = 0;
      ctx.fillStyle = text_color;
      ctx.fillText(
        txt,
        x,
        y
      );
    }
  }

  function drawSquare(x, y, size, color) {
    ctx.strokeStyle = "#303040";
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.fillRect(x, y, size, size);
    ctx.rect(x, y, size, size);
    ctx.stroke();
  }

  function getLocaleData() {
    if (localeData === undefined) {
      try {
        // Load affiliations file as string
        const localeDataJson = fs.readFileSync('locale.json', "utf8")

        try {
          localeData = JSON.parse(localeDataJson)
          console.log('Locale loaded and parsed');

          return localeData
        } catch (error) {
          console.error("Error: the locale file could not be parsed.", error)
        }
      } catch (error) {
        console.error("Error: the locale file could not be loaded", error)
      }
    } else {
      return localeData
    }
  }

  function getPolAffData() {
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
    const locale = getLocaleData()
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
      let colorCode = []
      era.affiliations.forEach(a => {
        if (a.showInLegend) {
          colorCode.push({
            name: a.name,
            color: a.color
          })
        }
      })
      colorCode.push({name:locale.misc.otherAffiliation, color: "#a4a4a4"})
      return colorCode
    }
  }
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