import { Command } from 'commander';
import { frameBuilder as fb } from "./-frame-builder.js";
import { createCanvas, loadImage, ImageData } from "canvas"
import { Gif } from 'make-a-gif'
import * as fs from "fs";

/// CLI config
let program, options
program = new Command();
program
	.name('build-gif')
	.description('Build a GIF loop by compiling and rendering frames.')
  .requiredOption('-t, --type <type>', 'Required. Type of gif. Choices: regular (yes, only one for now).')
  .requiredOption('-r, --range <daterange>', 'Required. Timeline date range as "YYYY-MM-DD YYYY-MM-DD"')
  .option('-s, --search <expression>', 'For broadcasting mode, which term to look for?')
  .option('-f, --fduration <frames-duration>', 'How many milliseconds for each rendered frame?')
  .option('-c, --recycle', 'Do not recompute frames already there')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

// Type-dependent options
let defaultFpi, fileRootName
switch (options.type) {
	case "regular":
		defaultFpi = 3
		fileRootName = "GIF Carto"
		break;
	default:
		defaultFpi = 3
		fileRootName = "GIF loop"
}

let searchTerm = (options.search || "").toLowerCase()

let settings = {}
settings.sdate = options.range.split(" ")[0]
settings.edate = options.range.split(" ")[1]
// settings.framesPerImage = options.fpi || defaultFpi; // How long in frames does each image stay. 1=quick, 15=slow.
settings.filtering = {
	shortName: options.search,
	filter: b => b.tweet_text.toLowerCase().indexOf(searchTerm) >= 0
}

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)

;(async () => {
	// Build frames
	let frames = []
	while(endDate-date >= 0) {
		let year = date.getFullYear()
		let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	let folder = `data/${year}/${month}/${datem}`

		console.log("\n# Add frames for "+folder)

		let frameFile
		switch (options.type) {
			case "regular":
				frameFile = await fb.build("regular-1080", date,
					{
						dateRange: [startDate, endDate],
						labels:false,
						reuseIfExists:options.recycle,
					}
				)
				break;
			default:
		}
		
		console.log("Frame generated:",frameFile)
		let frameImage = await loadImage(frameFile)
		
		let canvas = createCanvas(1080, 1080)
		const ctx = canvas.getContext("2d")
		ctx.drawImage(frameImage, 0, 0)
		let buffer = canvas.toBuffer('image/jpeg')
		frames.push({
			src:buffer,
			duration: options.fduration || 500, // ms
		})

    date.setDate(date.getDate() + 1)
	}

	// Assemble frames
	console.log("Build gif")
	const myGif = new Gif(1080, 1080, 30)
	await myGif.setFrames(frames)

	// Render
	const Render = await myGif.encode()
	fs.writeFileSync(`data/${fileRootName} from ${settings.sdate} to ${settings.edate}.gif`, Render);
  console.log("Done.")
})()
