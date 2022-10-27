import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import Graph from "graphology";
import gexf from "graphology-gexf";
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import { getPolAffiliations } from "./-get-pol-affiliations.js"

dotenv.config();

export async function network_layout(date) {

	let polAffData

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// We'll need yesterday's folder
	let yesterday = new Date(targetDate.getTime());
	yesterday.setDate(targetDate.getDate() - 1);
	const yyear = yesterday.getFullYear()
	const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const yesterdaysFolder = `data/${yyear}/${ymonth}/${ydatem}`

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
	  	new transports.Console({
	      // level: 'info',
	      format: format.combine(
	        format.colorize(),
	        format.simple(),
	        format.printf(log => log.message) // Just show the message
	      )
	    }),
	  	new transports.File({ filename: `${thisFolder}/0900_network_layout.log` })
	  ],
	});
	logger.on('error', function (err) { console.log("Logger error :(") });

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	async function main() {

		const nodesFile = `${thisFolder}/network_nodes.csv`
		let nodes = loadFile(nodesFile, "Nodes")
		const edgesFile = `${thisFolder}/network_edges.csv`
		let edges = loadFile(edgesFile, "Edges")
		// We load the Twitter valid users to force their political affiliation, if any
		const usersFile = `${thisFolder}/twitter_valid_users.csv`
		let users = loadFile(usersFile, "Twitter valid users")

		// Let's also try to load yesterday's network
		const ySpatNodesFile = `${yesterdaysFolder}/network_nodes_spat.csv`
		let yNodes = []
		try {
			if (fs.existsSync(ySpatNodesFile)) {
				yNodes = loadFile(ySpatNodesFile, "network_nodes_spat (from the day before)")
			} else {
				logger
					.warn(`Yesterday's spatialized network file could not be found (not a big deal): ${ySpatNodesFile}`);
			}
		} catch(e) {
			logger
				.warn(`Yesterday's spatialized network file could not be found (not a big deal): ${ySpatNodesFile}`);
		}

		// Build user index
		let userIndex = {}
		for (let i = 0; i < users.length; i++) {
			let user = users[i]
			userIndex[user.handle] = user.group
		}

		// Build yesterday's nodes coordinates index
		let ynIndex = {}
		for (let i = 0; i < yNodes.length; i++) {
			let n = yNodes[i]
			ynIndex[n.Id] = n
		}

		// Build network
		let g
		try {
			g = new Graph({type: "directed", allowSelfLoops: false});
			nodes.forEach(node => {
				let group = userIndex[node.username]
				if (group === undefined) {
					node.mp_group = "None"
				} else {
					node.mp_group = group
					node.main_group = group					
				}
				g.addNode(node.Id, node)
			})
			edges.forEach(edge => {
				g.addEdge(edge.Source, edge.Target)
			})
			logger
				.child({ context: {"nodes":g.order, "edges":g.size} })
				.info(`Network loaded (${g.order} nodes, ${g.size} edges).`);
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the loading of the network`);
		}

		// Set node size
		try {
			const inDegreeMax = d3.max(g.nodes().map(nid => g.inDegree(nid)))
			const minSize = +process.env.LAYOUT_NODE_SIZE_MIN || 2
			const maxSize = +process.env.LAYOUT_NODE_SIZE_MAX || 30
			g.nodes().forEach(nid => {
				let n = g.getNodeAttributes(nid)
				n.size = minSize + ( (maxSize-minSize) * Math.pow(g.inDegree(nid)/inDegreeMax, 0.7) )
			})
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred when setting node sizes`);
		}

		// Set node colors
		try {
			const colorCode = getColorCode(targetDate)
			const defaultColor = d3.color("#a4a4a4");
			const inDegreeMax = d3.max(g.nodes().map(nid => g.inDegree(nid)))
			g.nodes().forEach(nid => {
				let n = g.getNodeAttributes(nid)
				let l = 0
				let a = 0
				let b = 0
				let total = 0
				if (n.mp_group == "None") {
					Object.keys(colorCode).forEach(k => {
						const count = +n[`mp_align_${k}`]
						if (count > 0) {
							const lab = d3.lab(colorCode[k])
							l += lab.l * count
							a += lab.a * count
							b += lab.b * count
							total += count
						}
					})
					if (total > 10) {
						const lab = d3.lab(l/total, a/total, b/total)
						n.color = lab.formatHex()
						n.colored = "yes"
					} else {
						n.color = defaultColor.formatHex()
						n.colored = "no"
					}
				} else {
					let color = colorCode[n.mp_group]
					if (color === undefined) {
						color = defaultColor
						logger
							.child({ context: {node:n} })
							.error(`The group of node ${n.Id} (${n.username}), namely "${n.mp_group}", is unknown (no color code).`);
					}
					n.color = color.formatHex()
					n.colored = "yes"
				}
			})
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred when setting node colors`);
		}

		/// LAYOUT
		const howManyLayoutSteps = 6
		try {
			// Initial positions
			logger
				.info(`Compute layout 1/${howManyLayoutSteps} - Initial positions...`);

			// Applying a random layout before starting
			const spreading = 10000
			g.nodes().forEach((nid,i) => {
				// g.setNodeAttribute(nid, "x", i%20)
				// g.setNodeAttribute(nid, "y", (i-i%20)/20)
				g.setNodeAttribute(nid, "x", (Math.random()-0.5)*spreading)
				g.setNodeAttribute(nid, "y", (Math.random()-0.5)*spreading)
			})

			// If the node already existed yesterday, use yesterday's coordinates.
			g.nodes().forEach((nid,i) => {
				const yn = ynIndex[nid]
				if (yn) {
					g.setNodeAttribute(nid, "x", yn.x)
					g.setNodeAttribute(nid, "y", yn.y)
				}
			})

			logger
				.info(`Layout 1/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (1/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (1/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}

		try {
			// Rough sketch
			logger
				.info(`Compute layout 2/${howManyLayoutSteps} - Rough sketch...`);

			// Applying FA2 (basis)
			forceAtlas2.assign(g, {iterations: 800, settings: {
				linLogMode: true,
				outboundAttractionDistribution: false,
				adjustSizes: false,
				edgeWeightInfluence: 0,
				scalingRatio: +process.env.LAYOUT_SCALING_RATIO || 0.01,
				strongGravityMode: true,
				gravity: 0.001,
				slowDown: 5,
				barnesHutOptimize: true,
				barnesHutTheta: 1.2,
			}});

			logger
				.info(`Layout 2/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (2/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (2/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}

		try {
			// Refine
			logger
				.info(`Compute layout 3/${howManyLayoutSteps} - Precision pass...`);

			// Refine FA2
			forceAtlas2.assign(g, {iterations: 80, settings: {
				linLogMode: true,
				outboundAttractionDistribution: false,
				adjustSizes: false,
				edgeWeightInfluence: 0,
				scalingRatio: +process.env.LAYOUT_SCALING_RATIO || 0.01,
				strongGravityMode: true,
				gravity: 0.001,
				slowDown: 20,
				barnesHutOptimize: true,
				barnesHutTheta: 0.3,
			}});

			logger
				.info(`Layout 3/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (3/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (3/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}

		try {
			// Refine
			logger
				.info(`Compute layout 4/${howManyLayoutSteps} - Slow refine...`);

			// Refine FA2
			forceAtlas2.assign(g, {iterations: 8, settings: {
				linLogMode: true,
				outboundAttractionDistribution: false,
				adjustSizes: false,
				edgeWeightInfluence: 0,
				scalingRatio: +process.env.LAYOUT_SCALING_RATIO || 0.01,
				strongGravityMode: true,
				gravity: 0.001,
				slowDown: 10,
				barnesHutOptimize: false,
				barnesHutTheta: 0.3,
			}});

			logger
				.info(`Layout 4/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (4/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (4/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}

		try {
			// Prevent node overlap
			logger
				.info(`Compute layout 5/${howManyLayoutSteps} - Prevent node overlap...`);

			noverlap.assign(g, {
			  maxIterations: 120,
			  settings: {
			  	gridSize: 64,
			  	margin: 0.9,
			    ratio: 1.05,
			    speed:8,
			  }
			});
			noverlap.assign(g, {
			  maxIterations: 80,
			  settings: {
			  	gridSize: 64,
			  	margin: 0.6,
			    ratio: 1.05,
			    speed:4,
			  }
			});
			noverlap.assign(g, {
			  maxIterations: 40,
			  settings: {
			  	gridSize: 64,
			  	margin: 0.3,
			    ratio: 1.05,
			    speed:1,
			  }
			});

			logger
				.info(`Layout 5/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (5/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (5/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}

		try {
			// Calibrate according to political axes
			logger
				.info(`Compute layout 6/${howManyLayoutSteps} - Rotate and center...`);

			// First of all, let's compute barycenters:
			// Everything, the left, the right, and the center.
			const blockCode = getBlockCode(targetDate)

			// First, let's center on zero.
			let everything = {x:0, y:0, count:0}
			g.nodes().forEach((nid,i) => {
				const n = g.getNodeAttributes(nid)
				everything.count++
				everything.x += +n.x
				everything.y += +n.y
			})
			everything.x /= everything.count
			everything.y /= everything.count
			g.nodes().forEach((nid,i) => {
				const n = g.getNodeAttributes(nid)
				n.x -= everything.x
				n.y -= everything.y
			})

			// Then, let's rotate so that the left is on the left and the right on the right.
			let left = {x:0, y:0, count:0}
			let right = {x:0, y:0, count:0}
			g.nodes().forEach((nid,i) => {
				const n = g.getNodeAttributes(nid)
				// We only use the official affiliations of MPs.
				if (n.mp_group != "None") {
					const block = blockCode[n.mp_group]
					if (block == "left") {
						left.count++
						left.x += +n.x
						left.y += +n.y
					} else if (block == "right") {
						right.count++
						right.x += +n.x
						right.y += +n.y
					}
				}
			})
			left.x /= left.count
			left.y /= left.count
			right.x /= right.count
			right.y /= right.count
			const angle = Math.atan2(right.y-left.y, right.x-left.x)

			if (isNaN(angle)) {
				logger
					.warn(`No left-right angle found (probably an issue with political parties)`);
			} else {
				g.nodes().forEach((nid,i) => {
					const n = g.getNodeAttributes(nid)
					let a = Math.atan2(+n.y, +n.x)
					let d = Math.sqrt(Math.pow(+n.x,2) + Math.pow(+n.y,2))
					a -= angle
					n.x = d*Math.cos(a)
					n.y = d*Math.sin(a)
				})

				// And finally, let's ensure the center is on top.
				let center = {x:0, y:0, count:0}
				g.nodes().forEach((nid,i) => {
					const n = g.getNodeAttributes(nid)
					// We only use the official affiliations of MPs.
					if (n.mp_group != "None") {
						const block = blockCode[n.mp_group]
						if (block == "center") {
							center.count++
							center.x += +n.x
							center.y += +n.y
						}
					}
				})
				center.x /= center.count
				center.y /= center.count
				const flip = center.y < 0
				if (flip) {
					g.nodes().forEach((nid,i) => {
						const n = g.getNodeAttributes(nid)
						n.y = -n.y
					})
				}
			}

			logger
				.info(`Layout 6/${howManyLayoutSteps} computed.`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the layout (6/${howManyLayoutSteps}) of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the layout (6/${howManyLayoutSteps}) of the network.`}));
				logger.end();
		  });
		}
		
		// Save nodes and edges as tables
		const nodes_spat = g.nodes().map(nid => {
			let n = {...g.getNodeAttributes(nid)}
			return n
		})
		const nodesSpatFile = `${thisFolder}/network_nodes_spat.csv`
		const nodesString = d3.csvFormat(nodes)
		try {
			fs.writeFileSync(nodesSpatFile, nodesString)
			logger
				.child({ context: {nodesSpatFile} })
				.info('Nodes file saved successfully');
		} catch(error) {
			logger
				.child({ context: {nodesSpatFile, error} })
				.error('The nodes file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The nodes file could not be saved.`}));
				logger.end();
		  });
		}
		
		// Save the network (no edges, it's too heavy, but they're in the edges file)
		g.clearEdges()
		const networkFile = `${thisFolder}/network_spat.gexf`
		let gexfString
		try {
			gexfString = gexf.write(g);
		} catch(error) {
			logger
				.child({ context: {networkFile, error} })
				.error('The network file could not be written into a string');
		}
		try {
			fs.writeFileSync(networkFile, gexfString)
			logger
				.child({ context: {networkFile} })
				.info('Network (no edges) saved successfully as a GEXF');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`Network (no edges) saved successfully as a GEXF.`}));
				logger.end();
		  });
		} catch(error) {
			logger
				.child({ context: {networkFile, error} })
				.error('The network file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The network file could not be saved.`}));
				logger.end();
		  });
		}
		
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
				.info(`${title} file loaded`);
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error(`The ${title} file could not be loaded`);
		}
	}

	function getColorCode(date){
		const polAffData = getPolAffiliations()
		let era
		polAffData.eras.forEach(e => {
			let sdate = new Date(e.startDate)
			let edate = new Date(e.endDate)
			if (sdate <= date && date <= edate ) {
				era = e
			}
		})

		if (era===undefined) {
			logger
				.child({ context: {date, polAffData} })
				.error(`No corresponding era found in political affiliations file`);
		} else {
			let colorCode = {}
			era.affiliations.forEach(a => {
				colorCode[a.id] = d3.color(a.color)
			})
			return colorCode
		}
	}
	
	function getBlockCode(date){
		const polAffData = getPolAffiliations()
		let era
		polAffData.eras.forEach(e => {
			let sdate = new Date(e.startDate)
			let edate = new Date(e.endDate)
			if (sdate <= date && date <= edate ) {
				era = e
			}
		})

		if (era===undefined) {
			logger
				.child({ context: {date, polAffData} })
				.error(`No corresponding era found in political affiliations file`);
		} else {
			let blockCode = {}
			era.affiliations.forEach(a => {
				blockCode[a.id] = a.block
			})
			return blockCode
		}
	}
}
