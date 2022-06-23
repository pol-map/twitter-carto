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
  	new transports.File({ filename: `${thisFolder}/08_network.log` })
  ],
});

logger.info('***** RUN SCRIPT ****');
console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

async function main() {
	
	const usersFile = `${thisFolder}/users_corpus_7days.csv`
	let users = loadUsers(usersFile)

	// Build network
	let g
	const pmi_threshold = 0.1
	const k = 2 // k-core
	try {
		g = new Graph();
		users.forEach(u => {
			let u2 = {...u, label:u.name}
			delete u2.id
			delete u2.resources
			delete u2.cited
			g.addNode(u.id, u2)
		})
		users.forEach(u => {
			const cited = JSON.parse(u.cited)
			cited.forEach(v => {
				g.addEdge(u.id, v)
			})
		})
		logger
			.child({ context: {"nodes":g.order, "edges":g.size} })
			.info(`Network built (${g.order} nodes, ${g.size} edges). Edges below a PMI of ${pmi_threshold} have been omitted.`);

		// Extract k-core
		logger
			.info(`Extract k-core (k=${k})...`);
		let nodeRemoved = true
		while (nodeRemoved) {
			let nodesToRemove = g.nodes().filter(nid => g.degree(nid)<k)
			nodeRemoved = nodesToRemove.length > 0
			nodesToRemove.forEach(nid => {
				g.dropNode(nid)
			})
		}
		logger
			.info(`K-core extracted (${g.order} nodes, ${g.size} edges).`);
		const degreeMax = d3.max(g.nodes().map(nid => g.degree(nid)))
		g.nodes().forEach(nid => {
			let n = g.getNodeAttributes(nid)
			n.size = 4 + (28-4) * Math.pow(g.degree(nid)/degreeMax, 1.3)
		})
		// Layout
		logger
			.info(`Compute layout...`);

		// Applying a random layout before starting
		g.nodes().forEach((nid,i) => {
			// g.setNodeAttribute(nid, "x", i%20)
			// g.setNodeAttribute(nid, "y", (i-i%20)/20)
			g.setNodeAttribute(nid, "x", Math.random()*1000)
			g.setNodeAttribute(nid, "y", Math.random()*1000)
		})

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
		// Refine FA2
		forceAtlas2.assign(g, {iterations: 50, settings: {
			linLogMode: false,
			outboundAttractionDistribution: false,
			adjustSizes: false,
			edgeWeightInfluence: 0,
			scalingRatio: 1,
			strongGravityMode: true,
			gravity: 0.005,
			slowDown: 10,
			barnesHutOptimize: false,
			barnesHutTheta: 1.2,
		}});
		noverlap.assign(g, {
		  maxIterations: 500,
		  settings: {
		  	margin: 1,
		    ratio: 1.1,
		    speed:10,
		  }
		});
		noverlap.assign(g, {
		  maxIterations: 200,
		  settings: {
		  	margin: 1,
		    ratio: 1.1,
		    speed:5,
		  }
		});
		noverlap.assign(g, {
		  maxIterations: 100,
		  settings: {
		  	margin: 1,
		    ratio: 1.1,
		    speed:1,
		  }
		});

		logger
			.info(`Layout computed.`);

	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the building of the network`);
	}

	// Save nodes and edges as tables
	const nodes = g.nodes().map(nid => {
		let n = {...g.getNodeAttributes(nid)}
		n.Id = nid
		n.Label = n.label
		delete n.label
		return n
	})
	const nodesFile = `${thisFolder}/network_nodes.csv`
	const nodesString = d3.csvFormat(nodes)
	try {
		fs.writeFileSync(nodesFile, nodesString)
		logger
			.child({ context: {nodesFile} })
			.info('Nodes file saved successfully');
	} catch(error) {
		logger
			.child({ context: {nodesFile, error} })
			.error('The nodes file could not be saved');
	}
	const edges = g.edges().map(eid => {
		let e = {...g.getEdgeAttributes(eid)}
		e.Source = g.source(eid)
		e.Target = g.target(eid)
		e.Weight = e.weight
		delete e.weight
		e.Type = "undirected"
		return e
	})
	const edgesFile = `${thisFolder}/network_edges.csv`
	const edgesString = d3.csvFormat(edges)
	try {
		fs.writeFileSync(edgesFile, edgesString)
		logger
			.child({ context: {edgesFile} })
			.info('Edges file saved successfully');
	} catch(error) {
		logger
			.child({ context: {edgesFile, error} })
			.error('The edges file could not be saved');
	}
	// Save the network (no edges, it's too heavy, but they're in the edges file)
	// g.clearEdges()
	const networkFile = `${thisFolder}/network_7days.gexf`
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

function loadUsers(filePath) {
	try {
		// Load file as string
		const csvString = fs.readFileSync(filePath, "utf8")
		// Parse string
		const data = d3.csvParse(csvString);
		logger
			.child({ context: {filePath} })
			.info('Users file loaded');
		return data
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {filePath, error:error.message} })
			.error('The users file could not be loaded');
	}
}

