import * as HME from "h264-mp4-encoder";
import * as fs from "fs";
import { createCanvas, loadImage, ImageData } from "canvas"

const sdate = "2022-07-22"
const edate = "2022-08-03"
const startingDate = new Date(sdate)
const endDate = new Date(edate)
let date = startingDate
let canvas = createCanvas(3840, 2160)
canvas.width = 3840
canvas.height = 2160
const ctx = canvas.getContext("2d")

const framesPerSecond = 30; // FPS (frame rate)
const framesPerImage = 15; // How long in frames does each image stay

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

async function encodeFrame() {
	if (endDate-date >= 0) {
		year = date.getFullYear()
		month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
  	path = `data/${year}/${month}/${datem}/${cartoFilename}`

		console.log("Add frames for "+path)
  	const img = await loadImage(path)
    ctx.drawImage(img, 0, 0, 3840, 2160)
    drawLegend(ctx, `${year}-${month}-${datem}`)
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

function drawLegend(ctx, datetxt) {
	const xOffset = 12
	// Draw the title and info
	let y = 64
	drawText(ctx, "CARTE DU DÉBAT POLITIQUE FRANÇAIS SUR TWITTER", xOffset, y, "start", "#303040", 0, "52px Raleway")
	y += 64
	drawText(ctx, "DATE : "+datetxt, xOffset, y, "start", "#303040", 0, "bold 52px Raleway")
	y += 64
	drawText(ctx, "Carte des interactions Twitter mentionnant des documents du débat politique.", xOffset, y, "start", "#303040", 0, "28px Raleway")
	y += 40
	drawText(ctx, "Le débat politique est défini comme les tweets ou pages web les plus mentionnés par les députés de France.", xOffset, y, "start", "#303040", 0, "28px Raleway")
	y += 40
	drawText(ctx, "Les comptes Twitter visualisés sont les plus représentés dans les interactions des 30 jours précédents.", xOffset, y, "start", "#303040", 0, "28px Raleway")
	y += 40
	drawText(ctx, "La couleur approxime l'affiliation politique. Elle est dérivée de la similarité avec ce que tweetent les députés.", xOffset, y, "start", "#303040", 0, "28px Raleway")
	y += 40
	drawText(ctx, "La position est dérivée des tweets : on est proche des comptes avec qui on interagit dans le débat politique.", xOffset, y, "start", "#303040", 0, "28px Raleway")

	// Légende couleurs
	y += 60
	const colorCode = [
		{abb:"LFI", name:"La France insoumise", color: "#aa2400"}, // Dark red
		{abb:"GDR", name:"Gauche démocrate et républicaine", color: "#db3a5d"}, // Dark red-pink
		{abb:"SOC", name:"Socialistes et apparentés", color: "#e882bf"}, // Old pink
		{abb:"ECO", name:"Écologiste", color: "#2db24a"}, // Green
		{abb:"LIOT", name:"Libertés, Indépendants, Outre-mer et Territoires", color: "#cacf2b"}, // Yellow (greenish)
		{abb:"REN", name:"Renaissance", color: "#ffaf00"}, // Orange
		{abb:"MODEM", name:"Démocrate (MoDem et Indépendants)", color: "#e28813"}, // Dark orange
		{abb:"HOR", name:"Horizons et apparentés", color: "#3199aa"}, // Teal
		{abb:"LR", name:"Les Républicains", color: "#4747a0"}, // Blue
		{abb:"RN", name:"Rassemblement National", color: "#604a45"}, // Brown
		{abb:"NI", name:"Non inscrit", color: "#9d9d9d"}, // Grey
	]
	colorCode.forEach(d => {
		drawSquare(xOffset, y, 48, d.color)
		drawText(ctx, d.name, xOffset+60, y+40, "start", "#303040", 0, "32px Raleway")
		y += 60
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
    ctx
  }
}

// Test the drawing of the context
// testDrawLegend()
async function testDrawLegend() {
	year = date.getFullYear()
	month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	path = `data/${year}/${month}/${datem}/${cartoFilename}`
	const img = await loadImage(path)
  ctx.drawImage(img, 0, 0, 3840, 2160)
  drawLegend(ctx, `${year}-${month}-${datem}`)
  imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const out = fs.createWriteStream('data/test draw legend.png')
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => {
  	console.log("Test done.")
  })
}

