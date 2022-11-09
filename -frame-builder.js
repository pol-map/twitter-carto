import { createCanvas, loadImage, ImageData } from "canvas"
import * as fs from "fs";
import * as d3 from 'd3';
import * as StackBlur from "stackblur-canvas";
import { computeBroadcastingsViz } from "./-viz-broadcastings.js"
import { computeUserViz } from "./-viz-user.js"
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
		options.user = (options.user===undefined) ? "UnknownUser" : options.user

		switch(type) {
			case "regular":
		    return await ns.buildRegularFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    	)
		    break;
			case "regular-720":
		    return await ns.buildRegularFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		"720"
		    	)
		    break;
			case "regular-1080":
		    return await ns.buildRegularFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		"1080"
		    	)
		    break;
			case "polheatmap":
		    return await ns.buildPolHeatmapFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.heatmapPolGroup,
		    	)
		    break;
			case "polheatmap-720":
		    return await ns.buildPolHeatmapFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.heatmapPolGroup,
		    		"720",
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
		    		options.remember,
		    	)
		    break;
		  case "broadcasting-720":
		    return await ns.buildBroadcastingFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.filtering,
		    		options.remember,
		    		"720",
		    	)
		    break;
			case "user":
		    return await ns.buildUserFrame(
		    		date,
		    		options.dateRange,
		    		options.labels,
		    		options.fileFormat,
		    		options.reuseIfExists,
		    		options.username,
		    	)
		    break;
		  default:
		    console.error(`ERROR: Unknown frame type "${type}". The frame could not be built.`)
		}
	}


	/// TYPE: USER
	
	ns.buildUserFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, username) {
		let fileTitle = `User ${username} from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		let ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		ctx.drawImage(bgImg, 0, 0)

		// Darken background
		let tempCanvas = createCanvas(3840, 2160)
		const tempCtx = tempCanvas.getContext("2d")
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

		// Draw overlay
	  const oImgd = await ns.getUserOverlay(date, username)
		let oCanvas = createCanvas(ctx.canvas.width, ctx.canvas.height)
	  const oCtx = oCanvas.getContext("2d")
	  oCtx.putImageData(oImgd, 0, 0)
		ctx.globalCompositeOperation = "source-over"
	  ctx.globalAlpha = 1;
	  ctx.drawImage(oCanvas, 0, 0)
	  
	  // Post adjustments
	  ctx.globalCompositeOperation = "multiply"
	  ctx.globalAlpha = 0.8;
	  ctx.drawImage(ctx.canvas, 0, 0)
		
		// Reset
	  ctx.globalCompositeOperation = "source-over"
	  ctx.globalAlpha = 1;

		ns.drawUserLegend(ctx, date, dateRange, username)

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawUserLegend = function(ctx, date, dateRange, username) {
		const xOffset = 12
		let y

		// Draw the title and info
		y = 84
		ns.drawText(ctx, `@${username}`, xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
		y += 30 // Margin

		let timelineBox
		timelineBox = {
			x: ctx.canvas.width*2/3,
			y: 12,
			w: ctx.canvas.width/3 - 24,
			h: 200
		}
		ns.drawTimeline(ctx, timelineBox, false, date, dateRange, true)

	  // Footer
	  y = ctx.canvas.height - 28
	  ns.drawText(ctx, ns.locale.legendTwitter.footer, xOffset, y, "start", "#303040", 0, "38px Raleway")
	}

	ns.getUserOverlay = async function(date, username) {
		const folder = ns.getSourceFolder(date)

		// Load users for 1 month to retrieve the id of username
		let users = []
	  let usersFilePath = `${folder}/user_corpus_1month.csv`
	  if (fs.existsSync(usersFilePath)) {
	    try {
	      // Load file as string
	      let csvString = fs.readFileSync(usersFilePath, "utf8")
	      // Parse string
	      users = d3.csvParse(csvString);
	      console.log(`Users loaded (${users.length} rows)`)

	    } catch (error) {
	      console.error(`An error occurred during the loading and parsing of users`, error)
	    }
	  } else {
	    console.warn(`Users not found`)
	  }

	  // Find the id of username
	  let userId = "0"
	  let usernameLC = username.toLowerCase()
	  users.forEach(u => {
	  	if (u.username.toLowerCase() == usernameLC) {
	  		userId = ""+u.id
	  	}
	  })

		// Load all edges
		let allEdges = []
	  let allEdgesFilePath = `${folder}/network_edges.csv`
	  if (fs.existsSync(allEdgesFilePath)) {
	    try {
	      // Load file as string
	      let csvString = fs.readFileSync(allEdgesFilePath, "utf8")
	      // Parse string
	      allEdges = d3.csvParse(csvString);
	      console.log(`Edges loaded (${allEdges.length} rows)`)

	    } catch (error) {
	      console.error(`An error occurred during the loading and parsing of edges`, error)
	    }
	  } else {
	    console.warn(`Edges not found`)
	  }

	  // Filter for those connected to username
	  allEdges = allEdges.filter(u => u.Source==userId || u.Target==userId)

	  // Load broadcastings
		let broadcastings = []
	  let broadcastingsFilePath = `${folder}/broadcastings.csv`
	  if (fs.existsSync(broadcastingsFilePath)) {
	    try {
	      // Load file as string
	      let csvString = fs.readFileSync(broadcastingsFilePath, "utf8")
	      // Parse string
	      broadcastings = d3.csvParse(csvString);
	      console.log(`Broadcastings loaded (${broadcastings.length} rows)`)

	    } catch (error) {
	      console.error(`An error occurred during the loading and parsing of broadcastings`, error)
	    }
	  } else {
	    console.warn(`Broadcastings not found`)
	  }

	  // Build day edges list
	  let dayEdges = []
	  broadcastings.forEach(b => {
	    JSON.parse(b.tweet_mentions).forEach(d => {
	    	if (d==userId || b.broadcaster_id==userId) {
		      dayEdges.push({
		        Source: b.broadcaster_id,
		        Target: d,
		      })
		    }
	    })
	  })

	  // Get image
	  const overlayImgd = await computeUserViz(date, userId, allEdges, dayEdges)
	  return overlayImgd
	}


	/// TYPE: HEATMAP

	ns.buildPolHeatmapFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, polGroup, imgFormat) {
		let fileTitle = `Heatmap ${polGroup} ${(imgFormat?(imgFormat+" "):"")}from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		let ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		
		// Heatmap
		const hmPath = `${ns.getSourceFolder(date)}/heatmap pol ${polGroup}.png`
		const hmImg = await loadImage(hmPath)

		ns.compositeHeatmap(ctx, bgImg, hmImg)

	  ctx.globalCompositeOperation = "source-over"
	  ctx.globalAlpha = 1;
		ns.drawHeatmapLegend(ctx, date, dateRange, polGroup, imgFormat)

		if (imgFormat == "720") {
			// Rescale 
			let newCanvas = createCanvas(1280, 720)
			const newCtx = newCanvas.getContext("2d")
			let sx = 0
			let sy = 0
			let sw = 3840
			let sh = 2160
			let dx = 0
			let dy = 0
			let dw = 1280
			let dh = 720
			newCtx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
			canvas = newCanvas
			ctx = newCtx
		}

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawHeatmapLegend = function(ctx, date, dateRange, polGroup, imgFormat) {
		let polGroups = ns.getPolGroups(dateRange)
		const xOffset = 12

		// Draw the title
		let y
		if (imgFormat == "720") {
			y = 120
			ns.locale.videoHeatmap.titleRows.forEach(txt => {
					ns.drawText(ctx, txt.replace("{POLGROUP}", polGroups[polGroup]), xOffset, y, "start", "#EEEEEE", 0, "84px Raleway")
					y += 100
				})
		} else {
			y = 84
			ns.locale.videoHeatmap.titleRows.forEach(txt => {
				ns.drawText(ctx, txt.replace("{POLGROUP}", polGroups[polGroup]), xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
				y += 80
			})
		}

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
	
	ns.buildRegularFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, imgFormat) {
		let fileTitle = `Regular ${(imgFormat?(imgFormat+" "):"")}from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

		// Check existing
		if (reuseIfExists && fs.existsSync(ns.getFrameFilePath(fileFormat, fileTitle))) {
			let filePath = ns.getFrameFilePath(fileFormat, fileTitle)
			console.info("Frame reused from "+filePath)
			return filePath
		}

		// Main canvas
		let canvas = createCanvas(3840, 2160)
		let ctx = canvas.getContext("2d")

		// Get background
		const bgPath = ns.getBgPath(date, labels)
		const bgImg = await loadImage(bgPath)
		ctx.drawImage(bgImg, 0, 0)
		
		if (imgFormat == "1080") {
			// Crop 
			let newCanvas = createCanvas(2160, 2160)
			const newCtx = newCanvas.getContext("2d")
			// Check this to understand:
			// https://stackoverflow.com/questions/26015497/how-to-resize-then-crop-an-image-with-canvas
			let sx = (3840/2) - (2160/2)
			let sy = 0
			let sw = 2160
			let sh = 2160
			let dx = 0
			let dy = 0
			let dw = 2160
			let dh = 2160
			newCtx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
			canvas = newCanvas
			ctx = newCtx
		}

		ns.drawRegularLegend(ctx, date, dateRange, imgFormat)

		if (imgFormat == "1080") {
			// Rescale 
			let newCanvas = createCanvas(1080, 1080)
			const newCtx = newCanvas.getContext("2d")
			let sx = 0
			let sy = 0
			let sw = 2160
			let sh = 2160
			let dx = 0
			let dy = 0
			let dw = 1080
			let dh = 1080
			newCtx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
			canvas = newCanvas
			ctx = newCtx
		} else if (imgFormat == "720") {
			// Rescale 
			let newCanvas = createCanvas(1280, 720)
			const newCtx = newCanvas.getContext("2d")
			let sx = 0
			let sy = 0
			let sw = 3840
			let sh = 2160
			let dx = 0
			let dy = 0
			let dw = 1280
			let dh = 720
			newCtx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
			canvas = newCanvas
			ctx = newCtx

		}

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawRegularLegend = function(ctx, date, dateRange, imgFormat) {
		const xOffset = 12
		let y

		if (imgFormat == "720") {
			// Draw the title
			y = 120
			ns.drawText(ctx, ns.locale.video.title, xOffset, y, "start", "#303040", 0, "84px Raleway")
		} else if (imgFormat == "1080") {
			// Draw the title
			y = 84
			ns.drawText(ctx, ns.locale.video.titleShort, xOffset, y, "start", "#303040", 0, "66px Raleway")
		} else {
			// Draw the title and info
			y = 84
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
		}

		let timelineBox
		if (imgFormat == "1080") {
			timelineBox = {
				x: ctx.canvas.width/2,
				y: 12,
				w: ctx.canvas.width/2 -24,
				h: 200
			}
		} else {
			timelineBox = {
				x: ctx.canvas.width*2/3,
				y: 12,
				w: ctx.canvas.width/3 - 24,
				h: 200
			}
		}
		ns.drawTimeline(ctx, timelineBox, true, date, dateRange, false)

	  // Footer
	  y = ctx.canvas.height - 28
	  ns.drawText(ctx, ns.locale.legendTwitter.footer, xOffset, y, "start", "#303040", 0, "38px Raleway")
	}


	/// TYPE: BROADCASTING

	ns.buildBroadcastingFrame = async function(date, dateRange, labels, fileFormat, reuseIfExists, filtering, remember, imgFormat) {
		let fileTitle = `Broadcasting ${filtering.shortName} ${(imgFormat?(imgFormat+" "):"")}from ${ns.dashDate(dateRange[0])} to ${ns.dashDate(dateRange[1])} date ${ns.dashDate(date)}`

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
		let ctx = canvas.getContext("2d")

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
		ns.drawBroadcastingsLegend(ctx, date, dateRange, filtering.name || filtering.shortName, imgFormat)

		if (imgFormat == "720") {
			// Rescale 
			let newCanvas = createCanvas(1280, 720)
			const newCtx = newCanvas.getContext("2d")
			let sx = 0
			let sy = 0
			let sw = 3840
			let sh = 2160
			let dx = 0
			let dy = 0
			let dw = 1280
			let dh = 720
			newCtx.drawImage(canvas, sx, sy, sw, sh, dx, dy, dw, dh)
			canvas = newCanvas
			ctx = newCtx
		}

		return await ns.saveFrame(canvas, fileFormat, fileTitle)
	}

	ns.drawBroadcastingsLegend = function(ctx, date, dateRange, filterName, imgFormat) {
		const xOffset = 12
		let y

		// Draw the title
		if (imgFormat == "720") {
			y = 120
			ns.drawText(ctx, ns.locale.videoBroadcastings.title.replace('{FILTER_NAME}', filterName), xOffset, y, "start", "#EEEEEE", 0, "84px Raleway")
		} else {
			y = 84
			ns.drawText(ctx, ns.locale.videoBroadcastings.title.replace('{FILTER_NAME}', filterName), xOffset, y, "start", "#EEEEEE", 0, "66px Raleway")
		}

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

		// Draw timeline box (for monitoring)
		// ctx.fillStyle = "rgba(120,120,120,0.5)"
		// ctx.lineWidth = 0;
	 //  ctx.fillRect(timelineBox.x, timelineBox.y, timelineBox.w, timelineBox.h);

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
		// tdata.end.setDate(tdata.end.getDate()+1)
		tdata.days = 0
		tdata.months = {}
		tdata.years = {}

		let d = new Date(tdata.start)
		// This threshold is used to determine if we're the same day.
		// It could be zero, but then the leap hour between Summer and Winter times
		// would cause issues. One hour is 3600 seconds, so 3600000ms.
		// We use a bit more to account for potential leap seconds and other things if any.
		const sameDayThreshold = -4000000
		while (tdata.end-d >= sameDayThreshold) {
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
