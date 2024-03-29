import { Command } from 'commander';
import { frameBuilder as fb } from "./-frame-builder.js";
import { getPolAffiliations } from "./-get-pol-affiliations.js"
import { createCanvas, loadImage, ImageData } from "canvas"
import * as HME from "h264-mp4-encoder";
import * as fs from "fs";

/// CLI config
let program, options
program = new Command();
program
	.name('build-mp4')
	.description('Build a MP4 video by compiling and rendering frames.')
  .requiredOption('-t, --type <type>', 'Type of video. Choices: regular, regular-720, broadcasting, polheatmaps.')
  .requiredOption('-r, --range <daterange>', 'Timeline date range as "YYYY-MM-DD YYYY-MM-DD"')
  .option('-s, --search <expression>', 'For broadcasting mode, which term to look for?')
  .option('-f, --fpi <frames-per-image>', 'How many frames each rendered image stays (note: the video is 30FPS)')
  .option('-u, --user <username>', 'Twitter handle to track. Necessary to the user mode.')
  .option('-c, --recycle', 'Do not recompute frames already there')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

let searchTerm = (options.search || "").toLowerCase()
let polAffs = getAllPoliticalAffiliations()
let polAff = polAffs.pop()

// Type-dependent options
let defaultFpi, fileRootName, width, height
switch (options.type) {
	case "regular":
		defaultFpi = 3
		fileRootName = "MP4 Carto"
		width = 3840
		height = 2160
		break;
	case "regular-720":
		defaultFpi = 3
		fileRootName = "MP4 720p Carto"
		width = 1280
		height = 720
		break;
	case "polheatmaps":
		defaultFpi = 3
		fileRootName = getPolheatmapFilerootname(polAff)
		width = 3840
		height = 2160
		break;
	case "polheatmaps-720":
		defaultFpi = 3
		fileRootName = getPolheatmap720Filerootname(polAff)
		width = 1280
		height = 720
		break;
	case "broadcasting":
		defaultFpi = 3
		fileRootName = "MP4 "+options.search
		width = 3840
		height = 2160
		break;
	case "broadcasting-720":
		defaultFpi = 3
		fileRootName = "MP4 720p "+options.search
		width = 1280
		height = 720
		break;
	case "user":
		defaultFpi = 3
		fileRootName = "MP4 User "+options.user
		width = 3840
		height = 2160
		break;
	default:
		defaultFpi = 3
		fileRootName = "MP4 Video"
}

function getPolheatmapFilerootname(polAff){ return "MP4 Pol "+polAff; }
function getPolheatmap720Filerootname(polAff){ return "MP4 720p Pol "+polAff; }

// Encode video
let settings = {}
settings.sdate = options.range.split(" ")[0]
settings.edate = options.range.split(" ")[1]
settings.framesPerSecond = 30; // FPS (frame rate)
settings.framesPerImage = options.fpi || defaultFpi; // How long in frames does each image stay. 1=quick, 15=slow.
settings.filtering = {
	shortName: options.search,
	filter: b => b.tweet_text.toLowerCase().indexOf(searchTerm) >= 0
}

const outputFolder = "data/video" // Storing built frames (cache)
if (!fs.existsSync(outputFolder)){
  fs.mkdirSync(outputFolder, { recursive: true });
}

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)

let encoder
HME.default.createH264MP4Encoder()
	.then(enc => {
		encoder = enc
    encoder.width = width;
    encoder.height = height;
    encoder.frameRate = settings.framesPerSecond;
    encoder.quantizationParameter = 12 // Default 33. Higher means better compression, and lower means better quality [10..51].
    encoder.initialize();
  })
  .then(encodeFrame)

async function encodeFrame() {
	// This threshold is used to determine if we're the same day.
	// It could be zero, but then the leap hour between Summer and Winter times
	// would cause issues. One hour is 3600 seconds, so 3600000ms.
	// We use a bit more to account for potential leap seconds and other things if any.
	const sameDayThreshold = -4000000
	if (endDate-date >= sameDayThreshold) {
		let year = date.getFullYear()
		let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	let folder = `data/${year}/${month}/${datem}`

		console.log("\n# Add frames for "+folder)

		let frameFile
		switch (options.type) {
			case "regular":
				frameFile = await fb.build(options.type, date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						reuseIfExists:options.recycle,
					}
				)
				break;
			case "regular-720":
				frameFile = await fb.build(options.type, date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						reuseIfExists:options.recycle,
					}
				)
				break;
			case "polheatmaps":
				frameFile = await fb.build("polheatmap", date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						reuseIfExists:options.recycle,
						heatmapPolGroup: polAff,
					}
				)
				break;
			case "polheatmaps-720":
				frameFile = await fb.build("polheatmap-720", date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						reuseIfExists:options.recycle,
						heatmapPolGroup: polAff,
					}
				)
				break;
			case "broadcasting":
				frameFile = await fb.build(options.type, date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						filtering:settings.filtering,
						reuseIfExists:options.recycle,
					}
				)
				break;
			case "broadcasting-720":
				frameFile = await fb.build(options.type, date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						filtering:settings.filtering,
						reuseIfExists:options.recycle,
					}
				)
				break;
			case "user":
				frameFile = await fb.build(options.type, date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						username:options.user,
						reuseIfExists:options.recycle,
					}
				)
				break;
			default:
		}
		
		console.log("Frame generated:",frameFile)
		let frameImage = await loadImage(frameFile)
		
		let canvas = createCanvas(width, height)
		const ctx = canvas.getContext("2d")
		ctx.drawImage(frameImage, 0, 0)
		let imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  	for (let i=0; i<settings.framesPerImage; i++) {
  	  encoder.addFrameRgba(imgd.data);
		}
    date.setDate(date.getDate() + 1)
    return encodeFrame()
  } else {
  	encoder.finalize();
    let uint8Array = encoder.FS.readFile(encoder.outputFilename);
    fs.writeFileSync(`${outputFolder}/${fileRootName} from ${settings.sdate} to ${settings.edate}.mp4`, Buffer.from(uint8Array));

    if( (options.type == "polheatmaps" || options.type == "polheatmaps-720") && polAffs.length>0) {
	  	polAff = polAffs.pop()
	  	switch (options.type) {
				case "polheatmaps":
					fileRootName = getPolheatmapFilerootname(polAff)
					break;
				case "polheatmaps-720":
					fileRootName = getPolheatmap720Filerootname(polAff)
					break;
			}
			date = new Date(startDate)
			encoder.initialize()
			return encodeFrame()
		} else {
	    encoder.delete();
	    console.log("Done.")
		}
  }
}

function getAllPoliticalAffiliations() {
	const polAffData = getPolAffiliations()
	let polAffiliations = {}
	// TODO: keep only the eras that intersect with the date range
	polAffData.eras.forEach(era => {
		era.affiliations.forEach(a => {
			if (a.makeHeatmap){
				polAffiliations[a.id] = true
			}
		})
	})
	return Object.keys(polAffiliations)
}