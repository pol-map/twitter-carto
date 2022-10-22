import { frameBuilder as fb } from "./frame-builder.js";
import { createCanvas, loadImage, ImageData } from "canvas"
import * as HME from "h264-mp4-encoder";
import * as fs from "fs";

let settings = {}
settings.sdate = "2022-10-10"
settings.edate = "2022-10-22"
settings.framesPerSecond = 30; // FPS (frame rate)
settings.framesPerImage = 3; // How long in frames does each image stay. 1=quick, 15=slow.
settings.filtering = {
	shortName: "Lola",
	filter: b => b.tweet_text.toLowerCase().indexOf("lola") >= 0
}

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)

let encoder
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
		let year = date.getFullYear()
		let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	let folder = `data/${year}/${month}/${datem}`

		console.log("\n# Add frames for "+folder)

		let frameFile = await fb.build(
			"broadcasting",
			date,
			{
				dateRange: [startDate, endDate],
				labels:false,
				filtering:settings.filtering,
				reuseIfExists:false,
			}
		)
		console.log("Frame generated:",frameFile)
		let frameImage = await loadImage(frameFile)
		
		let canvas = createCanvas(3840, 2160)
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
    fs.writeFileSync(`data/${settings.filtering.shortName} from ${settings.sdate} to ${settings.edate}.mp4`, Buffer.from(uint8Array));
    console.log("Done.")
  }
}

