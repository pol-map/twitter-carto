import { Command } from 'commander';
import { frameBuilder as fb } from "./-frame-builder.js";
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
  .option('-c, --recycle', 'Do not recompute frames already there')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

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
		fileRootName = "MP4 Heatmap"
		width = 3840
		height = 2160
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
	default:
		defaultFpi = 3
		fileRootName = "MP4 Video"
}

let searchTerm = (options.search || "").toLowerCase()

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
				console.log(frameFile)
				break;
			case "polheatmaps":
				// TODO
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
    encoder.delete();
    fs.writeFileSync(`${outputFolder}/${fileRootName} from ${settings.sdate} to ${settings.edate}.mp4`, Buffer.from(uint8Array));
    console.log("Done.")
  }
}

