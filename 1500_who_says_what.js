import { Command } from 'commander';
import { createCanvas, loadImage, ImageData } from "canvas"
import { createLogger, format, transports } from "winston";
import * as fs from "fs";
import * as d3 from 'd3';
import dotenv from "dotenv";
import { computeCellsOverlay } from "./-viz-cells.js";

dotenv.config();

export async function who_says_what(date) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	const logLevels = {
	  fatal: 0,
	  error: 1,
	  warn: 2,
	  info: 3,
	  debug: 4,
	  trace: 5,
	};

	const logLevel = "info"

	const logger = createLogger({
		level: logLevel,
	  levels: logLevels,
	  format: format.combine(format.timestamp(), format.json()),
	  transports: [
	  	new transports.Console(),
	  	new transports.File({ filename: `${thisFolder}/1500_who_says_what.log` })
	  ],
	});

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	async function main() {

		// Load spat users
		const usersFile = `${thisFolder}/network_nodes_spat.csv`
		const users = loadFile(usersFile, 'network_nodes_spat')

		// Load last broadcastings
		const broadcastingsFile = `${thisFolder}/broadcastings.csv`
		const broadcastings = loadFile(broadcastingsFile, 'broadcastings')

		// Index broadcasted resources per user
		let resByUserIndex = {}
		broadcastings.forEach(b => {
			let resources = resByUserIndex[b.broadcaster_username] || []
			resources.push(b.resource_id)
			resByUserIndex[b.broadcaster_username] = resources
		})

		// Store the count of resources per user as weight
		users.forEach(u => {
			u.resources = resByUserIndex[u.username] || []
			u.weight = u.resources.length
		})

		// Find barycenter
		let xTotal = 0
		let yTotal = 0
		let wTotal = 0
		users.forEach(u => {
			xTotal += (+u.x || 0) * u.weight
			yTotal += (+u.y || 0) * u.weight
			wTotal += u.weight
		})
		const barycenter = {x:xTotal/wTotal, y:yTotal/wTotal}

		// Find max distance on x or y between any node and the barycenter
		let dMax = 0
		users.forEach(u => {
			const x = +u.x || 0
			const y = +u.y || 0
			dMax = Math.max(dMax, Math.max(Math.abs(barycenter.x-x), Math.abs(barycenter.y-y)))
		})
		dMax += 1 // we take a bit larger to avoid problems

		/// Rudimentary quad tree
		// We very roughly aim for the equivalent of a 4x4 split of the broadcastings
		const weightThreshold = 33000 / 16
		let initQuad = {
			x: barycenter.x - dMax,
			y: barycenter.y - dMax,
			w: 2*dMax,
			users: users,
			weight: wTotal,
		}
		let quadsToTest = [initQuad]
		let finalQuads = []
		while (quadsToTest.length>0) {
			let quad = quadsToTest.pop()

			if (quad.users.length > 0){
				// Test
				if (quad.weight < weightThreshold || quad.users.length == 1) {
					// We'good! Keep that quad.
					finalQuads.push(quad)
				} else {
					// We split!
					// Create four empty quads
					let quadNW = {
						x: quad.x,
						y: quad.y,
						w: quad.w/2,
						users: [],
						weight: 0,
					}
					let quadNE = {
						x: quad.x + quad.w/2,
						y: quad.y,
						w: quad.w/2,
						users: [],
						weight: 0,
					}
					let quadSE = {
						x: quad.x + quad.w/2,
						y: quad.y + quad.w/2,
						w: quad.w/2,
						users: [],
						weight: 0,
					}
					let quadSW = {
						x: quad.x,
						y: quad.y + quad.w/2,
						w: quad.w/2,
						users: [],
						weight: 0,
					}
					// Sort the users
					let xMid = quad.x+quad.w/2
					let yMid = quad.y+quad.w/2
					quad.users.forEach(u => {
						const x = +u.x || 0
						const y = +u.y || 0
						if (x < xMid) {
							if (y < yMid) {
								quadNW.users.push(u)
							} else {
								quadSW.users.push(u)
							}
						} else {
							if (y < yMid) {
								quadNE.users.push(u)
							} else {
								quadSE.users.push(u)
							}
						}
					})
					// Compute the weights and add the sub-quads to the queue
					let subquads = [quadNW, quadNE, quadSE, quadSW]
					subquads.forEach(q => {
						q.weight = d3.sum(q.users.map(u => u.weight))
						quadsToTest.push(q)
					})
				}
			} // If no users, do nothing (discard the quad).
		}

		// Sort the resources for each quad
		finalQuads.forEach(quad => {
			let quadResIndex = {}
			quad.users.forEach(u => {
				u.resources.forEach(res => {
					quadResIndex[res] = (quadResIndex[res] || 0) + 1
				})
			})
			// Get the counts and sort
			quad.resources = []
			for (let res in quadResIndex) {
				quad.resources.push({id:res, count:quadResIndex[res]})
			}
			quad.resources.sort(function(a,b){return b.count-a.count})
		})

		// Sort the top resources of each quad by count
		let keyResourcesIndex = {}
		finalQuads.forEach(quad => {
			let res = quad.resources[0]
			if (res) {
				let res2 = keyResourcesIndex[res.id] || {...res, quads:[], quadWeight:0}
				res2.count += res.count
				res2.quads.push(quad)
				res2.quadWeight += quad.weight
				keyResourcesIndex[res.id] = res2
			}
		})
		let keyResources = Object.values(keyResourcesIndex)
		keyResources.sort(function(a,b){return b.count-a.count})
		
		// Truncate to what resources cover at least 80% of the broadcastings
		const countTotal = d3.sum(keyResources.map(res => res.quadWeight))
		const countThreshold = 0.8 * countTotal
		let countTemp = 0
		let flag = true
		keyResources = keyResources.filter(res => {
			let flagTemp = flag
			countTemp += res.quadWeight
			if (countTemp > countThreshold) {
				flag = false
			}
			return flagTemp
		})

		keyResources = keyResources.filter((d,i)=>i<8) // No more than 8 key resources

	  // Main canvas
		// let canvas = createCanvas(3840, 2160)
		let canvas = createCanvas(3560, 3590)
		const ctx = canvas.getContext("2d")

	  // Get background
	  const bgPath = `${thisFolder}/Carto Twitter.png`
		const bgImg = await loadImage(bgPath)
	  ctx.drawImage(bgImg, 0, 0)

	  // Get overlay
	  const oImgd = await computeCellsOverlay(date, keyResources)
	  // let oCanvas = createCanvas(3840, 2160)
	  let oCanvas = createCanvas(3560, 3590)
	  const oCtx = oCanvas.getContext("2d")
	  oCtx.putImageData(oImgd, 0, 0)

	  ctx.drawImage(oCanvas, 0, 0)

		// Load resources file
		const resourceFile = `${thisFolder}/resources_7days_aggregated_expressions.csv`
		const resources = loadFile(resourceFile, 'resources')

		// Index
		let resIndex = {}
		resources.forEach(res => {
			resIndex[res.id] = res
		})

		// Build key resources bundle
	  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		let keyResourcesBundle = []
		keyResources.forEach((res, i) => {
			let row = {rank:alphabet[i], ...resIndex[res.id]}
			keyResourcesBundle.push(row)
			console.log(row.rank, row.type, row.url)
		})

		// Save key resources bundle
		const keyResFile = `${thisFolder}/key_resources.csv`
		const keyResString = d3.csvFormat(keyResourcesBundle)
		try {
			fs.writeFileSync(keyResFile, keyResString)
			logger
				.child({ context: {keyResFile} })
				.info('Key resources JSON file saved successfully');
		} catch(error) {
			logger
				.child({ context: {keyResFile, error} })
				.error('The key resources JSON file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The key resources JSON file could not be saved.`}));
				logger.end();
			})
		}

		console.log("Done.")
	  return await saveFrame(canvas, `${thisFolder}/Key resources.png`)
	}

	return main();

	function loadFile(filePath, title) {
		try {
			// Load file as string
			const csvString = fs.readFileSync(filePath, "utf8")
			// Parse string
			const data = d3.csvParse(csvString);
			logger
				.child({ context: {filePath} })
				.info(`File "${title}" loaded`);
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error(`The file "${title}" could not be loaded`);
		}
	}

	async function saveFrame(canvas, filePath) {
		const stream = canvas.createPNGStream()
		return new Promise(resolve => {
      const out = fs.createWriteStream(filePath)
      stream.pipe(out)
      out.on("finish", () => {
        console.log("The PNG file was created.")
        resolve(filePath)
      });
    });
	}
}
