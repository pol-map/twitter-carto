import { createCanvas, loadImage, ImageData } from "canvas"
import * as fs from "fs";
import * as d3 from 'd3';
import * as StackBlur from "stackblur-canvas";
import { computeBroadcastingsViz } from "./-viz-broadcastings.js"
import { getLocale } from "./-get-locale.js"
import { getPolAffiliations } from "./-get-pol-affiliations.js"

/// MAIN
export let frameBuilder = (()=>{
	let ns = {} // Namespace

	ns.framesFolder = "data/frames" // Storing built frames (cache)
	if (!fs.existsSync(ns.framesFolder)){
    fs.mkdirSync(ns.framesFolder, { recursive: true });
	}

	// Get locale and affiliation data
	ns.locale = getLocale()
	ns.polAffData = getPolAffiliations()

	ns.build = async function(type, date, options) {
		// Default options
		options = options || {}
		options.dateRange = (options.dateRange===undefined) ? [new Date(date),new Date(date)] : options.dateRange
		options.reuseIfExists = (options.reuseIfExists===undefined) ? false : options.reuseIfExists
		options.fileFormat = (options.fileFormat===undefined) ? 'jpg' : options.fileFormat
		options.filtering = (options.filtering===undefined) ? {shortName:"All", filter:d=>true} : options.filtering
		options.remember = (options.remember===undefined) ? true : options.remember

		switch(type) {
			case "regular":
		    return await ns.buildRegularFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists
		    	)
		    break;
			case "polheatmap":
		    return await ns.buildPolHeatmapFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.heatmapPolGroup
		    	)
		    break;
		  case "broadcasting":
		    return await ns.buildBroadcastingFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.filtering,
		    		options.remember
		    	)
		    break;
		  default:
		    console.error(`ERROR: Unknown frame type "${type}". The frame could not be built.`)
		}
	}


	/// TYPE: HEATMAP

	ns.buildPolHeatmapFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, polGroup) {
		let fileTitle = `Heatmap ${polGroup} from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		const ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		
		// Heatmap
		const hmPath = `${ns.getSourceFolder(date)}/heatmap pol ${polGroup}.png`
		const hmImg = await loadImage(hmPath)

		ns.compositeHeatmap(ctx, bgImg, hmImg)

	  ctx.globalCompositeOperation = "source-over"
	  ctx.globalAlpha = 1;
		ns.drawHeatmapLegend(ctx, date, dateRange, polGroup)
		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawHeatmapLegend = function(ctx, date, dateRange, polGroup) {
		let polGroups = ns.getPolGroups(dateRange)
		const xOffset = 12

		// Draw the title and info
		let y = 84
		ns.locale.videoHeatmap.titleRows.forEach(txt => {
			ns.drawText(ctx, txt.replace("{POLGROUP}", polGroups[polGroup]), xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
			y += 80
		})

		let timelineBox = {
			x: 2*1280,
			y: 12,
			w: 1280-24,
			h: 200
		}
		ns.drawTimeline(ctx, timelineBox, false, date, dateRange, false)
	}

	ns.compositeHeatmap = function(ctx, bgImg, hmImg) {
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

	  // Multiply heatmap to itself for reinforcing the darker areas
	  tempCtx.globalCompositeOperation = "multiply"
	  tempCtx.globalAlpha = 1;
	  tempCtx.drawImage(tempCtx.canvas, 0, 0)
	  tempCtx.globalAlpha = 1;

		// Lighten up a little bit the heatmap
	  tempCtx.globalCompositeOperation = "source-over"
	  tempCtx.globalAlpha = 0.36;
	  tempCtx.beginPath()
	  tempCtx.rect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height)
	  tempCtx.fillStyle = "#FFFFFF"
	  tempCtx.fill()
	  tempCtx.closePath()

	  // Superpose heatmap
	  ctx.globalCompositeOperation = "lighten"
	  ctx.globalAlpha = 1;
	  ctx.drawImage(tempCtx.canvas, 0, 0)

	  // Post adjustments
	  ctx.globalCompositeOperation = "multiply"
	  ctx.globalAlpha = 0.8;
	  ctx.drawImage(ctx.canvas, 0, 0)
	}


	/// TYPE: REGULAR
	
	ns.buildRegularFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists) {
		let fileTitle = `Regular from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		const ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		ctx.drawImage(bgImg, 0, 0)
		
		ns.drawRegularLegend(ctx, date, dateRange)

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawRegularLegend = function(ctx, date, dateRange) {
		const xOffset = 12

		// Draw the title and info
		let y = 84
		ns.drawText(ctx, ns.locale.video.title, xOffset, y, "start", "#303040", 0, "66px Raleway")
		y += 30 // Margin
		ns.locale.video.textRows.forEach(txt => {
			y += 36
			ns.drawText(ctx, txt, xOffset, y, "start", "#303040", 0, "26px Raleway")
		})

		// Colors legend
		y += 60
		const colorCode = ns.getColorCode(date)
		colorCode.forEach(d => {
			ns.drawSquare(ctx, xOffset, y, 48, d.color, 2, "#303040")
			ns.drawText(ctx, d.name, xOffset+60, y+36, "start", "#303040", 0, "32px Raleway")
			y += 60
		})

		let timelineBox = {
			x: 2*1280,
			y: 12,
			w: 1280-24,
			h: 200
		}
		ns.drawTimeline(ctx, timelineBox, true, date, dateRange, false)
	}


	/// TYPE: BROADCASTING

	ns.buildBroadcastingFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, filtering, remember) {
		let fileTitle = `Broadcasting ${filtering.shortName} from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Reset memory if not remember
		if (!remember) {
			ns.broadcastingsMemoryCanvas = ns.initBroadcastingMemoryCanvas()
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		const ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		
		// Broadcastings overlay
		const boImgd = await ns.getBroadcastingsOverlay(date, filtering.filter)
		let boCanvas = createCanvas(3840, 2160)
		const boCtx = boCanvas.getContext("2d")
		boCtx.putImageData(boImgd, 0, 0)
		
		ns.compositeBroadcastingsOverlay(bgImg, boCanvas, ctx)

	  ctx.globalCompositeOperation = "source-over"
	  ctx.globalAlpha = 1;
		ns.drawBroadcastingsLegend(ctx, date, dateRange, filtering.name || filtering.shortName)

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawBroadcastingsLegend = function(ctx, date, dateRange, filterName) {
		const xOffset = 12

		// Draw the title and info
		let y = 84
		ns.drawText(ctx, ns.locale.videoBroadcastings.title.replace('{FILTER_NAME}', filterName), xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
		y += 80

		let timelineBox = {
			x: 2*1280,
			y: 12,
			w: 1280-24,
			h: 200
		}
		ns.drawTimeline(ctx, timelineBox, false, date, dateRange, true)
	}

	ns.compositeBroadcastingsOverlay = function(bgImg, hmImg, ctx) {
		const memoryCanvas = ns.broadcastingsMemoryCanvas
		const memoryCtx = memoryCanvas.getContext("2d")

		let tempCanvas = createCanvas(3840, 2160)
		const tempCtx = tempCanvas.getContext("2d")

		// Copy remembered frame in temp
		tempCtx.drawImage(memoryCtx.canvas, 0, 0)

		// Blur memory frame
		StackBlur.canvasRGBA(
	    memoryCtx.canvas,
	    0,
	    0,
	    memoryCtx.canvas.width,
	    memoryCtx.canvas.height,
	    42 // Blur radius
	  );

	  // Stack initial remembered frame from temp
	  memoryCtx.globalAlpha = 1;
	  memoryCtx.globalCompositeOperation = "lighten"
		memoryCtx.drawImage(tempCtx.canvas, 0, 0)

		// Just a small blur to it
		StackBlur.canvasRGBA(
	    memoryCtx.canvas,
	    0,
	    0,
	    memoryCtx.canvas.width,
	    memoryCtx.canvas.height,
	    3 // Blur radius
	  );

	  // Blacken the frame
	  memoryCtx.globalCompositeOperation = "source-over"
	  memoryCtx.globalAlpha = 0.064;
	  memoryCtx.beginPath()
	  memoryCtx.rect(0, 0, memoryCtx.canvas.width, memoryCtx.canvas.height)
	  memoryCtx.fillStyle = "#000000"
	  memoryCtx.fill()
	  memoryCtx.closePath()

		// Stack the overlay on top
	  memoryCtx.globalAlpha = 0.80;
	  memoryCtx.globalCompositeOperation = "lighten"
		memoryCtx.drawImage(hmImg, 0, 0)
	  memoryCtx.globalAlpha = 1;

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

	  // Draw the remembered frame in temp canvas for processing before stacking
	  tempCtx.drawImage(memoryCtx.canvas, 0, 0)

		// Lighten up a little bit the overlay
	  tempCtx.globalCompositeOperation = "source-over"
	  tempCtx.globalAlpha = 0.1;
	  tempCtx.beginPath()
	  tempCtx.rect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height)
	  tempCtx.fillStyle = "#FFFFFF"
	  tempCtx.fill()
	  tempCtx.closePath()

	  // Superpose remembered frame
	  ctx.globalCompositeOperation = "lighten"
	  ctx.globalAlpha = 1;
	  ctx.drawImage(tempCtx.canvas, 0, 0)

	  // Post adjustments
	  ctx.globalCompositeOperation = "multiply"
	  ctx.globalAlpha = 0.8;
	  ctx.drawImage(ctx.canvas, 0, 0)
	}

	ns.initBroadcastingMemoryCanvas = function() {
		const memoryCanvas = createCanvas(3840, 2160)
		const memoryCtx = memoryCanvas.getContext("2d")
		memoryCtx.beginPath()
		memoryCtx.rect(0, 0, memoryCtx.canvas.width, memoryCtx.canvas.height)
		memoryCtx.fillStyle = "#000000"
		memoryCtx.fill()
		memoryCtx.closePath()
		return memoryCanvas
	}

	ns.broadcastingsMemoryCanvas = ns.initBroadcastingMemoryCanvas()

	ns.getBroadcastingsOverlay = async function(date, broadcastingFilter) {
		const folder = ns.getSourceFolder(date)

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

	  // Look for target broadcastings
	  const targetBroadcastings = broadcastings.filter(broadcastingFilter)
	  console.log(targetBroadcastings.length, "target broadcastings")

	  // Build edges list
	  let edges = []
	  targetBroadcastings.forEach(b => {
	    JSON.parse(b.tweet_mentions).forEach(d => {
	      edges.push({
	        Source: b.broadcaster_id,
	        Target: d,
	      })
	    })
	  })

	  // Get heatmap
	  const hmImgd = await computeBroadcastingsViz(date, edges)
	  return hmImgd
	}


	/// COMMON

	ns.getColorCode = function(date){
		let era
		ns.polAffData.eras.forEach(e => {
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
			colorCode.push({name:ns.locale.misc.otherAffiliation, color: "#a4a4a4"})
			return colorCode
		}
	}

	ns.getPolGroups = function(dateRange){
		let polGroups = {}
	  ns.polAffData.eras.forEach(e => {
      let sdate = new Date(e.startDate)
      let edate = new Date(e.endDate)
      if (!( dateRange[1]<=sdate || edate<=dateRange[0] )) {
        e.affiliations.forEach(a => {
        	if (a.makeHeatmap) {
	          polGroups[a.id] = a.name
	        }
        })
      }
    })

	  return polGroups
	}

	ns.drawTimeline = function(ctx, timelineBox, blackOnWhite, date_original, dateRange_original, oneDay){
		// Shift the dates:
		// Most of the time in these scripts, when one gives a date, it is the date of the harvesting.
		// We did not change that here. But the date to display is the date of the data: the day before.
		// This is why we have to move the dates one day before.
		let date = new Date(date_original)
		date.setDate(date.getDate() - 1)
		let dateRange = [new Date(dateRange_original[0]), new Date(dateRange_original[1])]
		dateRange[0].setDate(dateRange[0].getDate() - 1)
		dateRange[1].setDate(dateRange[1].getDate() - 1)

		// Get timeline data
		const timelineData = ns.getTimelineData(dateRange)

	  ctx.lineCap="round";
	  ctx.lineJoin="round";

		// Write years labels
	  Object.values(timelineData.years).forEach(yd => {
	  	let x = timelineBox.x + timelineBox.w * yd.daymin / timelineData.days
	  	if (x < timelineBox.x + timelineBox.w - 50) {
		  	ns.drawText(ctx, yd.id, x, timelineBox.y+22, "start", blackOnWhite?"#303040":"#EEEEEE", 0, "bold 36px Raleway")
		  }
	  })

	  // Box for the 30-day window
	  let day = (date-dateRange[0])/(1000*3600*24)
	  let x = timelineBox.x + timelineBox.w * day / timelineData.days
	  let l = timelineBox.w * 31 / timelineData.days

	  // Draw the box behind
		if (oneDay) {
		  ctx.fillStyle = blackOnWhite?"rgba(0, 0, 0, 0.24)":"rgba(255, 255, 255, 0.24)";
		} else {
		  ctx.fillStyle = blackOnWhite?"#545664":"DDDDDD";
		}
	  ctx.lineWidth = 0;
	  ctx.fillRect(x, timelineBox.y+58, l, 24);

	  // Draw the boxes for the months (the timeline background)
    const mnames = ns.locale.monthNames
	  Object.values(timelineData.months).forEach(md => {
	  	let x = timelineBox.x + timelineBox.w * md.daymin / timelineData.days
	  	let l = timelineBox.w * md.days / timelineData.days
	  	if (l > 50) {
		  	ns.drawText(ctx, mnames[md.id] || "???", x, timelineBox.y+50, "start", blackOnWhite?"#303040":"#EEEEEE", 0, "bold 24px Raleway")
		  }
		  ctx.strokeStyle = blackOnWhite?"#303040":"#EEEEEE";
		  ctx.lineWidth = 3;
		  ctx.beginPath();
		  ctx.rect(x, timelineBox.y+58, l, 24);
		  ctx.stroke();
	  })

	  // Draw the box on top if needed
	  if (oneDay) {
		  x = timelineBox.x + timelineBox.w * (day+30) / timelineData.days
		  l = timelineBox.w / timelineData.days
		  ctx.strokeStyle = blackOnWhite?"#303040":"FFFFFF";
		  ctx.fillStyle = blackOnWhite?"#303040":"FFFFFF";
		  ctx.lineWidth = 3;
		  ctx.beginPath();
		  ctx.fillRect(x, timelineBox.y+58, l, 24);
		  ctx.rect(x, timelineBox.y+58, l, 24);
		  ctx.stroke();
	  }

	  // Write the big label for the date
	  let {year, month, datem} = ns.getDateBits(date)
		ns.drawText(ctx, `${datem} ${mnames[month]} ${year}`, x+l, timelineBox.y+164, "end", blackOnWhite?"#303040":"#EEEEEE", 0, "bold 80px Raleway")
		if (!oneDay) {
			ns.drawText(ctx, ns.locale.video.dateSubtitle, x+l, timelineBox.y+206, "end", blackOnWhite?"#303040":"#EEEEEE", 0, "32px Raleway")
		}
	}

	ns.getTimelineData = function(dateRange){
		let tdata = {}
		tdata.start = new Date(dateRange[0])
		tdata.start.setDate(tdata.start.getDate() - 30)
		tdata.end = new Date(dateRange[1])
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

	ns.drawText = function(ctx, txt, x, y, textAlign, text_color, text_border_thickness, font) {
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

  ns.drawSquare = function(ctx, x, y, size, color, strokeSize, strokeColor) {
    ctx.strokeStyle = strokeColor || "#303040";
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.fillStyle = color;
    ctx.lineWidth = strokeSize || 2;
    ctx.beginPath();
    ctx.fillRect(x, y, size, size);
    ctx.rect(x, y, size, size);
    ctx.stroke();
  }

	ns.getFrameFilePath = function(type, fileName) {
		return `${ns.framesFolder}/${fileName}.${type}`
	}

	ns.saveFrame = async function(canvas, type, fileName) {
		const filePath = ns.getFrameFilePath(type, fileName)
		switch(type) {
		  case "png":
		    return await ns.savePNG(canvas, filePath)
		    break;
		  case "jpg":
		    return await ns.saveJPG(canvas, filePath)
		    break;
		  default:
		    console.error(`ERROR: unknown file type "${type}". The file could not be saved.`)
		    return
		}
	}

	ns.savePNG = function(canvas, path) {
		const stream = canvas.createPNGStream()
		return new Promise(resolve => {
      const out = fs.createWriteStream(path)
      stream.pipe(out)
      out.on("finish", () => {
        console.log("The PNG file was created.")
        resolve(path)
      });
    });
	}

	ns.saveJPG = function(canvas, path) {
		let buffer = canvas.toBuffer('image/jpeg')
		try {
			fs.writeFileSync(path, buffer, "binary")
			console.log("The JPG file was created.")
			return new Promise(resolve => {resolve(path)})
		} catch (error) {
			console.error("The JPG file could not be created.")
		}
	}

	ns.getSourceFolder = function(date) {
		let {year, month, datem} = ns.getDateBits(date)
		return `data/${year}/${month}/${datem}`
	}

	ns.getBgPath = function(date, useLabels) {
		const folder = ns.getSourceFolder(date)
		return useLabels ? `${folder}/Carto 4K top labels.png` : `${folder}/Carto 4K no labels.png`
	}

	ns.getDateBits = function(date) {
		const year = date.getFullYear()
		const month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		return {year, month, datem}
	}

	ns.dashDate = function(date) {
		let {year, month, datem} = ns.getDateBits(date)
		return `${year}-${month}-${datem}`
	}

	return ns
})()
