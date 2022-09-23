import * as HME from "h264-mp4-encoder";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"

const sdate = "2022-07-22"
const edate = "2022-08-05"
const startingDate = new Date(sdate)
const endDate = new Date(edate)
let date = startingDate
let canvas = createCanvas(3840, 2160)
canvas.width = 3840
canvas.height = 2160
const ctx = canvas.getContext("2d")

const framesPerSecond = 30; // FPS (frame rate)
const framesPerImage = 20; // How long in frames does each image stay

const cartoFilename = "Carto 4K top labels.png"
let encoder, uint8Array, year, month, datem, path, img, imgd
HME.default.createH264MP4Encoder()
	.then(enc => {
		encoder = enc
    // Must be a multiple of 2.
    encoder.width = 3840;
    encoder.height = 2160;
    encoder.frameRate = framesPerSecond;
    encoder.initialize();
  })
  .then(encodeFrame)
// encodeFrame()
async function encodeFrame() {
	if (endDate-date >= 0) {
		year = date.getFullYear()
		month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	path = `data/${year}/${month}/${datem}/${cartoFilename}`

		console.log("Add frames for "+path)
  	const img = await loadImage(path)
    ctx.drawImage(img, 0, 0, 3840, 2160)
    imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)

    // console.log("ctx", ctx.getImageData(0, 0, 3840 * 2160))
    // imgd = ctx.getImageData(0, 0, 3840 * 2160).data
    // console.log("imgd", imgd)
    // Add a single gray frame, the alpha is ignored.
    // encoder.addFrameRgba(new Uint8Array(encoder.width * encoder.height * 4).fill(128))
    // For canvas:
    for (let i=0; i<framesPerImage; i++) {
  	  encoder.addFrameRgba(imgd.data);
		}
    date.setDate(date.getDate() + 1)
    return encodeFrame()
  } else {
  	encoder.finalize();
    uint8Array = encoder.FS.readFile(encoder.outputFilename);
    encoder.delete();
    fs.writeFileSync(`data/Evolution from ${sdate} to ${edate}.mp4`, Buffer.from(uint8Array));
    console.log("Done.")
  }
}

/*let date = startingDate
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# RENDER MAP TWITTER FOR ${year}-${month}-${datem} ##############################`)

	render_map_twitter(date)
		.then(() => {
			console.info("# RENDER MAP TWITTER DONE.")
		}, error => {
			console.error("# RENDER MAP TWITTER ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K NO LABELS ####################")
			return render_map_4k_no_labels(date)
		})
		.then(() => {
			console.info("# RENDER MAP 4K NO LABELS DONE.")
		}, error => {
			console.error("# RENDER MAP 4K NO LABELS ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K TOP LABELS ####################")
			return render_map_4k_top_labels(date)
		})
		.then(() => {
			console.info("# RENDER MAP 4K TOP LABELS DONE.")
		}, error => {
			console.error("# RENDER MAP 4K TOP LABELS ERROR", error)
		})

		.then(() => {
			date.setDate(date.getDate() + 1);
			if (endDate-date >= 0) {
				return redraw()
			} else {
				console.log("\n\n# DONE. ###############################")
			}
		})
}
redraw()

*/