import * as HME from "h264-mp4-encoder";
import * as fs from "fs";
import * as d3 from 'd3';
import { createCanvas, loadImage, ImageData } from "canvas"
import { computeHashtagsOverlay } from "./viz_hashtags.js";
import * as StackBlur from "stackblur-canvas";

let settings = {}
settings.sdate = "2022-07-22"
settings.edate = "2022-10-07"
settings.framesPerSecond = 30; // FPS (frame rate)
settings.framesPerImage = 30; // How long in frames does each image stay. 1=quick, 15=slow.

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)
let canvas = createCanvas(3840, 2160)
const ctx = canvas.getContext("2d")

let encoder, uint8Array, year, month, datem, folder, path, img, imgd
HME.default.createH264MP4Encoder()
	.then(enc => {
		encoder = enc
    // Must be a multiple of 2.
    encoder.width = 3840;
    encoder.height = 2160;
    encoder.frameRate = settings.framesPerSecond;
    encoder.quantizationParameter = 18 // Default 33. Higher means better compression, and lower means better quality [10..51].
    encoder.initialize();
  })
  .then(encodeFrame)

async function encodeFrame() {
	if (endDate-date >= 0) {
		year = date.getFullYear()
		month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	folder = `data/${year}/${month}/${datem}`

		console.log("\n# Add frames for "+folder)
  	const bg = "Carto 4K no labels.png"
	  await assembleFrame(folder, bg, ctx, date, year, month, datem)
		imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  	for (let i=0; i<settings.framesPerImage; i++) {
  	  encoder.addFrameRgba(imgd.data);
		}
    date.setDate(date.getDate() + 1)
    return encodeFrame()
  } else {
  	encoder.finalize();
    uint8Array = encoder.FS.readFile(encoder.outputFilename);
    encoder.delete();
    fs.writeFileSync(`data/Main hashtags from ${settings.sdate} to ${settings.edate}.mp4`, Buffer.from(uint8Array));
    console.log("Done.")
  }
}

async function getOverlay(date, folder) {
  // Load broadcastings
	let broadcastings = []
  let filePath = `${folder}/broadcastings.csv`
  if (fs.existsSync(filePath)) {
    try {
      // Load file as string
      let csvString = fs.readFileSync(filePath, "utf8")
      // Parse string
      broadcastings = d3.csvParse(csvString);
      console.log(`Broadcastings loaded (${broadcastings.length} rows)`)

    } catch (error) {
      console.error(`An error occurred during the loading and parsing of broadcastings`, error)
    }
  } else {
    console.warn(`Broadcastings not found`)
  }

  // Get heatmap
  const oImgd = await computeHashtagsOverlay(date, broadcastings)
  return oImgd
}

function drawLegend(ctx, date, year, month, datem) {
	const xOffset = 12
	// Draw the title and info
	let y = 84
	drawText(ctx, `Hashtag le plus partagé`, xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
	y += 80

	// Légende timeline
  ctx.lineCap="round";
  ctx.lineJoin="round";
	const timelineBox = {
		x: 2*1280,
		y: 12,
		w: 1280-24,
		h: 200,
	}
	const timelineData = getTimelineData()
  Object.values(timelineData.years).forEach(yd => {
  	let x = timelineBox.x + timelineBox.w * yd.daymin / timelineData.days
  	if (x < timelineBox.x + timelineBox.w - 50) {
	  	drawText(ctx, yd.id, x, timelineBox.y+22, "start", "#EEEEEE", 0, "bold 36px Raleway")
	  }
  })
  const mnames = {
  	"01": "JAN",
  	"02": "FEV",
  	"03": "MARS",
  	"04": "AVR",
  	"05": "MAI",
  	"06": "JUIN",
  	"07": "JUIL",
  	"08": "AOUT",
  	"09": "SEPT",
  	"10": "OCT",
  	"11": "NOV",
  	"12": "DEC",
  }
  Object.values(timelineData.months).forEach(md => {
  	let x = timelineBox.x + timelineBox.w * md.daymin / timelineData.days
  	let l = timelineBox.w * md.days / timelineData.days
  	if (l > 50) {
	  	drawText(ctx, mnames[md.id]||"???", x, timelineBox.y+50, "start", "#EEEEEE", 0, "bold 24px Raleway")
	  }
	  ctx.strokeStyle = "#EEEEEE";
	  ctx.lineWidth = 3;
	  ctx.beginPath();
	  ctx.rect(x, timelineBox.y+58, l, 24);
	  ctx.stroke();
  })

  let day = (date-startDate)/(1000*3600*24)
  let x, l
  // 30 days
  x = timelineBox.x + timelineBox.w * day / timelineData.days
  l = timelineBox.w * 31 / timelineData.days
  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  ctx.lineWidth = 0;
  ctx.beginPath();
  ctx.fillRect(x, timelineBox.y+58, l, 24);
  // 1 day
  x = timelineBox.x + timelineBox.w * (day+30) / timelineData.days
  l = timelineBox.w / timelineData.days
  ctx.strokeStyle = "#FFFFFF";
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = 0;
  ctx.beginPath();
  ctx.fillRect(x, timelineBox.y+58, l, 24);
  ctx.rect(x, timelineBox.y+58, l, 24);
  ctx.stroke();

	drawText(ctx, `${datem} ${mnames[month]} ${year}`, x+l, timelineBox.y+164, "end", "#EEEEEE", 0, "bold 80px Raleway")

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
}

let tdata
function getTimelineData(){
	if (tdata) {
		// Return cache
		return tdata
	} else {
		// Compute timeline data
		tdata = {}
		tdata.start = new Date(settings.sdate)
		tdata.start.setDate(startDate.getDate() - 30)
		tdata.end = new Date(settings.edate)
		tdata.days = 0
		tdata.months = {}
		tdata.years = {}

		let d = new Date(tdata.start)
		while (tdata.end-d >= 0) {
			let y = d.getFullYear()
			let m = (1+d.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			let dm = (d.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

			let mdata = tdata.months[y+"-"+m] || {id:m, days:[]}
			mdata.days.push(tdata.days)
			tdata.months[y+"-"+m] = mdata

			let ydata = tdata.years[y] || {id:y, days:[]}
			ydata.days.push(tdata.days)
			tdata.years[y] = ydata

			tdata.days++

			d.setDate(d.getDate() + 1)
		}
		Object.values(tdata.months).forEach(mdata => {
			mdata.daymin = Math.min(...mdata.days)
			mdata.daymax = Math.max(...mdata.days)
			mdata.days = mdata.days.length
		})
		Object.values(tdata.years).forEach(ydata => {
			ydata.daymin = Math.min(...ydata.days)
			ydata.daymax = Math.max(...ydata.days)
			ydata.days = ydata.days.length
		})
		return tdata
	}
}

function compositeHeatmap(bgImg, hmImg, ctx) {
	let tempCanvas = createCanvas(3840, 2160)
	const tempCtx = tempCanvas.getContext("2d")

	// Draw base map (background)
  ctx.drawImage(bgImg, 0, 0, 3840, 2160)

  // Luminosity layer
  tempCtx.beginPath()
  tempCtx.rect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height)
  tempCtx.fillStyle = "rgba(89, 94, 100)"
  tempCtx.fill()
  tempCtx.closePath()
  ctx.globalCompositeOperation = "luminosity"
  ctx.globalAlpha = 0.15;
  ctx.drawImage(tempCanvas, 0, 0)

  // Multiply layer
  tempCtx.beginPath()
  tempCtx.rect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height)
  tempCtx.fillStyle = "#000000"
  tempCtx.fill()
  tempCtx.closePath()
  ctx.globalCompositeOperation = "multiply"
  ctx.globalAlpha = 0.25;
  ctx.drawImage(tempCanvas, 0, 0)

  tempCtx.drawImage(hmImg, 0, 0)

  // Superpose heatmap
  ctx.globalCompositeOperation = "lighten"
  ctx.globalAlpha = 1;
  ctx.drawImage(tempCtx.canvas, 0, 0)

  // Post adjustments
  ctx.globalCompositeOperation = "multiply"
  ctx.globalAlpha = 0.8;
  ctx.drawImage(ctx.canvas, 0, 0)
}

async function assembleFrame(folder, bg, ctx, date, year, month, datem) {
	// Background
	const bgPath = `${folder}/${bg}`
	const bgImg = await loadImage(bgPath)
	
	// Heatmap
	const hmImgd = await getOverlay(date, folder)
	let hmCanvas = createCanvas(3840, 2160)
	const hmCtx = hmCanvas.getContext("2d")
	hmCtx.putImageData(hmImgd, 0, 0)
	
	compositeHeatmap(bgImg, hmCanvas, ctx)

  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1;
	drawLegend(ctx, date, year, month, datem)
}

// testAssembleFrame()
async function testAssembleFrame() {
	date = endDate
	year = date.getFullYear()
	month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	folder = `data/${year}/${month}/${datem}`
	const bg = "Carto 4K no labels.png"
  assembleFrame(folder, bg, ctx, date, year, month, datem)
  const out = fs.createWriteStream('data/test assemble frame.png')
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => {
  	console.log("Test done.")
  })
}