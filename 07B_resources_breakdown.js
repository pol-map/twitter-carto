import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
/*import Graph from "graphology";
import gexf from "graphology-gexf";
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import {largestConnectedComponentSubgraph} from 'graphology-components';*/

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
	  	new transports.Console(),
	  	new transports.File({ filename: `${thisFolder}/07B_resources_breakdown.log` })
	  ],
	});

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	async function main() {
		
		const usersFile = `${thisFolder}/user_corpus_1month.csv`
		let users = loadUsers(usersFile)

		// Build resources breakdown
		let resources = {}
		try {
			users.forEach(u => {
				JSON.parse(u.resources).forEach(rid => {
					let r = resources[rid] || {id:rid, tweetedby:0, tweeted:0, uids:{}, usernames:{}}
					r.tweeted++
					r.uids[u.id] = true
					r.usernames[u.username] = true
					resources[rid] = r
				})
			})
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the building of the resources breakdown`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the building of the resources breakdown.`}));
				logger.end();
		  });
		}

		// Save resources breakdown as a CSV
		let resList = Object.values(resources)
		resList = resList.map(r => {
			// Note: r.tweeted is the number of times it has been tweeted,
			// including multiple times by the same user. Spam happens.
			// r.tweetedby is the number of tweets by distinct users.
			r.tweetedby = Object.keys(r.uids).length
			r.uids = JSON.stringify(Object.keys(r.uids))
			r.usernames = JSON.stringify(Object.keys(r.usernames))
			return r
		})
		resList.sort(function(a,b) {return b.tweetedby - a.tweetedby})
		const resFile = `${thisFolder}/resources_1month.csv`
		const resString = d3.csvFormat(resList)
		try {
			fs.writeFileSync(resFile, resString)
			logger
				.child({ context: {resFile} })
				.info('Resources file saved successfully');
		} catch(error) {
			logger
				.child({ context: {nodesFile, error} })
				.error('The resources file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The resources file could not be saved.`}));
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

// Command line arguments
// Date argument
let date = undefined
const dateArgRegexp = /d(ate)?=([0-9]{4}\-[0-9]{2}\-[0-9]{2})/i
process.argv.forEach(d => {
	let found = d.match(dateArgRegexp)
	if (found && found[2]) {
		date = found[2]
	}
})
// Auto mode (run the script)
if (process.argv.some(d => ["a","-a","auto","-auto"].includes(d))) {
	console.log("Run script"+((date)?(" on date "+date):("")))
	network(date)
}