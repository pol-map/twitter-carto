import { Command } from 'commander';
import { createLogger, format, transports } from "winston";
import * as fs from "fs";
import * as d3 from 'd3';
import dotenv from "dotenv";

dotenv.config();

export async function whoSaysWhat(date) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	// Inspiration: https://blog.appsignal.com/2021/09/01/best-practices-for-logging-in-nodejs.html
	const logLevels = {
	  fatal: 0,
	  error: 1,
	  warn: 2,
	  info: 3,
	  debug: 4,
	  trace: 5,
	};

	const logLevel = "trace"

	const logger = createLogger({
		level: logLevel,
	  levels: logLevels,
	  format: format.combine(format.timestamp(), format.json()),
	  transports: [
	  	new transports.Console(),
	  	new transports.File({ filename: `${thisFolder}/test.log` })
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

		console.log("Quads", finalQuads.map((q,i) => `${i} - ${q.users.length} users - ${q.resources.length} resources - ${q.weight} weight`))

		// Sort the top resources of each quad by count
		let keyResourcesIndex = {}
		finalQuads.forEach(quad => {
			let res = quad.resources[0]
			if (res) {
				keyResourcesIndex[res.id] = (keyResourcesIndex[res.id] || 0) + res.count
			}
		})
		let keyResources = []
		for (let resId in keyResourcesIndex) {
			keyResources.push({id:resId, count:keyResourcesIndex[resId]})
		}
		keyResources.sort(function(a,b){return b.count-a.count})
		// console.log("Key resources", keyResources)

		console.log("Done.")
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

}

/// CLI logic
let thisFile = "test.js" // Prevent the CLI logic to trigger when used as a module
if (process.argv[1].split(/[/\\]/).pop()==thisFile) {
	const program = new Command();
	program
		.name('frame-builder')
		.description('Utility usable as a CLI. Build frames that can be made into a video.')
	  .requiredOption('-a, --auto', 'Auto mode.')
	  .option('-d, --date <date>', 'Date as "YYYY-MM-DD". Defaults to today.')
	  .showHelpAfterError()
	  .parse(process.argv);

	const options = program.opts();

	if (options.auto) {
		await whoSaysWhat(options.date ? new Date(options.date) : new Date())
	}
}