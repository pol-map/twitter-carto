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
import {largestConnectedComponentSubgraph} from 'graphology-components';

dotenv.config();

export async function network(date) {

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
	  	new transports.Console({
	      // level: 'info',
	      format: format.combine(
	        format.colorize(),
	        format.simple(),
	        format.printf(log => log.message) // Just show the message
	      )
	    }),
	  	new transports.File({ filename: `${thisFolder}/0800_network.log` })
	  ],
	});
	logger.on('error', function (err) { console.log("Logger error :(") });

	logger.info('***** RUN SCRIPT ****');
	logger.info('Log level is '+logLevel);

	async function main() {
		
		const usersFile = `${thisFolder}/user_corpus_1month.csv`
		let users = loadUsers(usersFile)

		// Build network
		let g
		const k = process.env.K_CORE_K || 4 // k-core
		try {
			let userIndex = {}
			g = new Graph({type: "directed", allowSelfLoops: false});
			users.forEach(u => {
				let u2 = {...u, label:u.name}
				userIndex[u.id] = true
				delete u2.id
				delete u2.resources
				delete u2.cited
				delete u2.lang
				if (process.env.FOCUS_LANG) {
					let lang = JSON.parse(u.lang)
					u2.focus_lang = +(u2.focus_lang || 0) + lang[process.env.FOCUS_LANG]
				}
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
			// Delete nodes that do not match criteria (focus language)
			if (process.env.FOCUS_LANG && process.env.FOCUS_LANG_THRESHOLD && process.env.FOCUS_LANG_THRESHOLD>0) {

				const threshold = +process.env.FOCUS_LANG_THRESHOLD
				let nodesRemoved = 0
				g.nodes().filter(nid => {
					if (!g.getNodeAttribute(nid, 'focus_lang') >= threshold) {
						nodesRemoved++
						g.dropNode(nid)
					}
				})
				logger
					.info(`Language focus: ${nodesRemoved} nodes have been removed from the raw network.`);

			}
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

			// Get the largest component
			g = largestConnectedComponentSubgraph(g);
			logger
				.info(`Largest connected component selected (${g.order} nodes, ${g.size} edges).`);

		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the building of the network`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the building of the network.`}));
				logger.end();
		  });
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
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The nodes file could not be saved.`}));
				logger.end();
		  });
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
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`${g.order} nodes and ${g.size} edges saved successfully.`}));
				logger.end();
		  });
		} catch(error) {
			logger
				.child({ context: {edgesFile, error} })
				.error('The edges file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The edges file could not be saved.`}));
				logger.end();
		  });
		}

		console.log("Done.")
	}

	return main();

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
}
