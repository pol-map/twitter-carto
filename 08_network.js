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
	
	const usersFile = `${thisFolder}/user_corpus_1month.csv`
	let users = loadUsers(usersFile)

	// Build network
	let g
	const k = 4 // k-core
	try {
		let userIndex = {}
		g = new Graph({type: "directed", allowSelfLoops: false});
		users.forEach(u => {
			let u2 = {...u, label:u.name}
			userIndex[u.id] = true
			delete u2.id
			delete u2.resources
			delete u2.cited
			g.addNode(u.id, u2)
		})
		users.forEach(u => {
			const cited = JSON.parse(u.cited)
			cited.forEach(v => {
				if (userIndex[v] && u.id != v) {
					g.addEdge(u.id, v)
				}
			})
		})
		g.edges().forEach(eid => {
			g.setEdgeAttribute(eid, "weight", 1) // We omit duplicates
		})
		logger
			.child({ context: {"nodes":g.order, "edges":g.size} })
			.info(`Network built (${g.order} nodes, ${g.size} edges).`);

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
		delete e.weight
		e.Type = "Directed"
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

