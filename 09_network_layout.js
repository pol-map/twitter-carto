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

dotenv.config();

const now = new Date()
const year = now.getFullYear()
const month = (1+now.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
const datem = (now.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
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
  	new transports.File({ filename: `${thisFolder}/09_network_layout.log` })
  ],
});

logger.info('***** RUN SCRIPT ****');
console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

async function main() {
	
	const nodesFile = `${thisFolder}/network_nodes.csv`
	let nodes = loadFile(nodesFile, "Nodes")
	const edgesFile = `${thisFolder}/network_edges.csv`
	let edges = loadFile(edgesFile, "Edges")

	// Build network
	let g
	try {
		let userIndex = {}
		g = new Graph({type: "directed", allowSelfLoops: false});
		nodes.forEach(node => {
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
		g.nodes().forEach(nid => {
			let n = g.getNodeAttributes(nid)
			n.size = 3 + ( (40-3) * Math.pow(g.inDegree(nid)/inDegreeMax, 0.7) )
		})
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred when setting node sizes`);
	}

	// Set node colors
	try {
		const colorCode = {
			"LFI": d3.color("#aa2400"),
			"GDR": d3.color("#db3a5d"),
			"SOC": d3.color("#e882bf"),
			"ECO": d3.color("#2db24a"),
			"LIOT": d3.color("#cacf2b"),
			"REN": d3.color("#ffbc00"),
			"MODEM": d3.color("#e28813"),
			"HOR": d3.color("#3199aa"),
			"LR": d3.color("#4747a0"),
			"RN": d3.color("#604a45"),
		}
		const defaultColor = d3.color("#a4a4a4");
		const inDegreeMax = d3.max(g.nodes().map(nid => g.inDegree(nid)))
		g.nodes().forEach(nid => {
			let n = g.getNodeAttributes(nid)
			let l = 0
			let a = 0
			let b = 0
			let total = 0
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
		})
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred when setting node colors`);
	}

	/// LAYOUT
	const howManyLayoutSteps = 4
	try {
		// Initial positions
		logger
			.info(`Compute layout 1/${howManyLayoutSteps} - Initial positions...`);

		// Applying a random layout before starting
		g.nodes().forEach((nid,i) => {
			// g.setNodeAttribute(nid, "x", i%20)
			// g.setNodeAttribute(nid, "y", (i-i%20)/20)
			g.setNodeAttribute(nid, "x", Math.random()*1000)
			g.setNodeAttribute(nid, "y", Math.random()*1000)
		})

		logger
			.info(`Layout 1/${howManyLayoutSteps} computed.`);

	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the layout (1/${howManyLayoutSteps}) of the network`);
	}

	try {
		// Rough sketch
		logger
			.info(`Compute layout 2/${howManyLayoutSteps} - Rough sketch...`);

		// Applying FA2 (basis)
		forceAtlas2.assign(g, {iterations: 1000, settings: {
			linLogMode: false,
			outboundAttractionDistribution: false,
			adjustSizes: false,
			edgeWeightInfluence: 0,
			scalingRatio: 1,
			strongGravityMode: true,
			gravity: 0.005,
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
	}

	try {
		// Refine
		logger
			.info(`Compute layout 3/${howManyLayoutSteps} - Refine...`);

		// Refine FA2
		forceAtlas2.assign(g, {iterations: 100, settings: {
			linLogMode: false,
			outboundAttractionDistribution: false,
			adjustSizes: false,
			edgeWeightInfluence: 0,
			scalingRatio: 1,
			strongGravityMode: true,
			gravity: 0.005,
			slowDown: 25,
			barnesHutOptimize: true,
			barnesHutTheta: 0.5,
		}});

		logger
			.info(`Layout 3/${howManyLayoutSteps} computed.`);

	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the layout (3/${howManyLayoutSteps}) of the network`);
	}

	try {
		// Prevent node overlap
		logger
			.info(`Compute layout 4/${howManyLayoutSteps} - Prevent node overlap...`);

		noverlap.assign(g, {
		  maxIterations: 500,
		  settings: {
		  	gridSize: 64,
		  	margin: 1,
		    ratio: 1.1,
		    speed:10,
		  }
		});
		noverlap.assign(g, {
		  maxIterations: 200,
		  settings: {
		  	gridSize: 64,
		  	margin: 1,
		    ratio: 1.1,
		    speed:5,
		  }
		});
		noverlap.assign(g, {
		  maxIterations: 100,
		  settings: {
		  	gridSize: 64,
		  	margin: 1,
		    ratio: 1.1,
		    speed:1,
		  }
		});

		logger
			.info(`Layout 4/${howManyLayoutSteps} computed.`);

	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the layout (4/${howManyLayoutSteps}) of the network`);
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
	} catch(error) {
		logger
			.child({ context: {networkFile, error} })
			.error('The network file could not be saved');
	}

	
	console.log("Done.")
}

main();

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

