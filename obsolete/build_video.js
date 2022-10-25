import * as HME from "h264-mp4-encoder";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"

let settings = {}
settings.sdate = "2022-07-22"
settings.edate = "2022-10-14"
settings.framesPerSecond = 30; // FPS (frame rate)
settings.framesPerImage = 3; // How long in frames does each image stay. 1=quick, 15=slow.

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)
let canvas = createCanvas(3840, 2160)
canvas.width = 3840
canvas.height = 2160
const ctx = canvas.getContext("2d")


const cartoFilename = "Carto 4K no labels.png"
let encoder, uint8Array, year, month, datem, path, img, imgd, polAffData, localeData
HME.default.createH264MP4Encoder()
	.then(enc => {
		encoder = enc
    // Must be a multiple of 2.
    encoder.width = 3840;
    encoder.height = 2160;
    encoder.frameRate = settings.framesPerSecond;
    encoder.quantizationParameter = 12 // Default 33. Higher means better compression, and lower means better quality [10..51].
    encoder.initialize();
  })
  .then(encodeFrame)

async function encodeFrame() {
	if (endDate-date >= 0) {
		year = date.getFullYear()
		month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	path = `data/${year}/${month}/${datem}/${cartoFilename}`

		console.log("Add frames for "+path)
  	const img = await loadImage(path)
    ctx.drawImage(img, 0, 0, 3840, 2160)

    drawLegend(ctx, date, year, month, datem)
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
    fs.writeFileSync(`data/${cartoFilename.replace(".png","")} from ${settings.sdate} to ${settings.edate}.mp4`, Buffer.from(uint8Array));
    console.log("Done.")
  }
}

function drawLegend(ctx, date, year, month, datem) {
  const locale = getLocaleData()
	const xOffset = 12
	// Draw the title and info
	let y = 84
	drawText(ctx, locale.video.title, xOffset, y, "start", "#303040", 0, "66px Raleway")
	y += 60
	locale.video.textRows.forEach(txt => {
		drawText(ctx, txt, xOffset, y, "start", "#303040", 0, "26px Raleway")
		y += 36		
	})

	// Légende couleurs
	y += 60
	const colorCode = getColorCode(date)
	colorCode.forEach(d => {
		drawSquare(xOffset, y, 48, d.color)
		drawText(ctx, d.name, xOffset+60, y+36, "start", "#303040", 0, "32px Raleway")
		y += 60
	})

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
	  	drawText(ctx, yd.id, x, timelineBox.y+22, "start", "#303040", 0, "bold 36px Raleway")
	  }
  })
  let day = (date-startDate)/(1000*3600*24)
  let x = timelineBox.x + timelineBox.w * day / timelineData.days
  let l = timelineBox.w * 31 / timelineData.days
	ctx.strokeStyle = "#303040";
  ctx.fillStyle = "#545664";
  ctx.lineWidth = 0;
  ctx.beginPath();
  ctx.fillRect(x, timelineBox.y+58, l, 24);
  ctx.rect(x, timelineBox.y+58, l, 24);
  ctx.stroke();
  const mnames = locale.monthNames
  Object.values(timelineData.months).forEach(md => {
  	let x = timelineBox.x + timelineBox.w * md.daymin / timelineData.days
  	let l = timelineBox.w * md.days / timelineData.days
  	if (l > 50) {
	  	drawText(ctx, mnames[md.id] || "???", x, timelineBox.y+50, "start", "#303040", 0, "bold 24px Raleway")
	  }
	  ctx.strokeStyle = "#303040";
	  ctx.lineWidth = 3;
	  ctx.beginPath();
	  ctx.rect(x, timelineBox.y+58, l, 24);
	  ctx.stroke();
  })
	drawText(ctx, `${datem} ${mnames[month]} ${year}`, x+l, timelineBox.y+164, "end", "#303040", 0, "bold 80px Raleway")
	drawText(ctx, locale.video.dateSubtitle, x+l, timelineBox.y+206, "end", "#303040", 0, "32px Raleway")


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

// Test the drawing of the context
// testDrawLegend()
async function testDrawLegend() {
	date = startDate
	year = date.getFullYear()
	month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	path = `data/${year}/${month}/${datem}/${cartoFilename}`
	const img = await loadImage(path)
  ctx.drawImage(img, 0, 0, 3840, 2160)
  drawLegend(ctx, date, year, month, datem)
  imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const out = fs.createWriteStream('data/test draw legend.png')
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => {
  	console.log("Test done.")
  })
}

