import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import Graph from "graphology";
import gexf from "graphology-gexf";

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
  	new transports.File({ filename: `${thisFolder}/08_co_broadcasting_network.log` })
  ],
});

logger.info('***** RUN SCRIPT ****');
console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

async function main() {
	
	// We will look at all the accounts we have collected through the prism of what resources they share
	// in common with the MPs.
	// We will use, to build a link between two users, the probability that a given resource is cited by the
	// two users at the same time.
	// But we do not take that probability straight away, we use instead the PMI, pointwise mutual information.
	// https://en.wikipedia.org/wiki/Pointwise_mutual_information
	
	const usersFile = `${thisFolder}/users_corpus_7days.csv`
	let users = loadUsers(usersFile)

	// Index resources and users
	let resIndex = {}
	let userIndex = {}
	try {
		users.forEach(u => {
			userIndex[u.id] = u
			let resources = JSON.parse(u.resources)
			resources.forEach(r => {
				let uList = resIndex[r] || []
				uList.push(u.id)
				resIndex[r] = uList
			})
		})
		logger
			.debug(`Resources (${Object.keys(resIndex).length}) and users (${Object.keys(userIndex).length}) indexed`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the indexing`);
	}

	// Build pairs
	let pairs = {}
	try {
		logger
			.info(`Building pairs (links). That's expected to be long.`);
		Object.values(resIndex).forEach(uList => {
			for (let u=0; u<uList.length; u++) {
				for (let v=0; v<u; v++) {
					let pair = [uList[u], uList[v]]
					pair.sort()
					let p = pair.join("|")
					pairs[p] = (pairs[p] || 0)+1
				}
			}
		})
		logger
			.child({ context: {pairs_values_sample:Object.values(pairs).slice(0,10), pairs_keys_sample:Object.keys(pairs).slice(0,10), userIndex_values_sample:Object.values(userIndex).slice(0,10)} })
			.info(`Pairs built (${Object.keys(pairs).length})`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the building of user pairs (links)`);
	}

	// Compute the links (PMI).
	try {
		const threshold = 2
		const resources_total = Object.keys(resIndex).length
		const users_total = users.length
		pairs = Object.keys(pairs).map(pair => {
			let s = pair.split("|")
			return {
				u: s[0],
				v: s[1],
				count: pairs[pair]
			}
		}).filter(d => d.count >= threshold)
		logger
			.info(`Pairs reduced to ${pairs.length} after thresholding to ${threshold}+ broadcastings in common`);

		pairs = pairs.map(pair => {
			// p(u) is the probability that a resource gets broadcasted by user u.
			// It depends on how many resources that user cites.
			const p_u = userIndex[pair.u].resources_total/resources_total
			const p_v = userIndex[pair.v].resources_total/resources_total
			// p(u,v) is the probability that a resource is broadcasted at the same time by u and v.
			// We approximate it by the number of actual co-broadcastings between the two.
			const p_u_v = pair.count/resources_total
			// The PMI follows this simple rule
			const pmi = Math.log((p_u_v)/(p_u*p_v))

			pair.pmi = pmi
			pair.weight = Math.max(0, pmi)

			return pair
		})
		logger
			.child({ context: {pairs_sample:pairs.slice(0,10)} })
			.info(`Pairs PMI computed`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the computing of links`);
	}

	// Build network
	let g
	const pmi_threshold = 0.1
	try {
		g = new Graph();
		users.forEach(u => {
			let u2 = {...u, label:u.name}
			delete u2.id
			delete u2.resources
			g.addNode(u.id, u2)
		})
		pairs.forEach(pair => {
			if (pair.weight > 0.1) {
				g.addEdge(pair.u, pair.v, {weight:pair.weight, pmi:pair.pmi, co_broadcast:pair.count})
			}
		})
		logger
			.child({ context: {"nodes":g.order, "edges":g.size} })
			.info(`Network built (${g.order} nodes, ${g.size} edges). Edges below a PMI of ${pmi_threshold} have been omitted.`);

	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the building of the network`);
	}

	// Save the network
	const networkFile = `${thisFolder}/network_cobroadcast_top_resources_7days.gexf`
	try {
		const gexfString = gexf.write(g);
	} catch(error) {
		logger
			.child({ context: {networkFile, error} })
			.error('The network file could not be written into a string');
	}
	try {
		fs.writeFileSync(networkFile, gexfString)
		logger
			.child({ context: {networkFile} })
			.info('Network file saved successfully');
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

