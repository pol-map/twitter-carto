import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";

dotenv.config();

const targetDate = new Date() // Now
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

const logLevel = "info"

const logger = createLogger({
	level: logLevel,
  levels: logLevels,
  format: format.combine(format.timestamp(), format.json()),
  transports: [
  	new transports.Console(),
  	new transports.File({ filename: `${thisFolder}/07_build_corpus.log` })
  ],
});

logger.info('***** RUN SCRIPT ****');
console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

async function main() {
	
	const max_accounts = 100000;

	// Load resources from today and previous days for one MONTH (30 days)
	let broadcastings = []
	let daysMissing = 0
	for (let offset = 0; offset > -30; offset--) {
		let day = new Date(targetDate.getTime());
		day.setDate(targetDate.getDate() + offset);
		let dyear = day.getFullYear()
		let dmonth = (1+day.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let ddatem = (day.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let dayFolder = `data/${dyear}/${dmonth}/${ddatem}`
		let filePath = `${dayFolder}/broadcastings.csv`
  	if (fs.existsSync(filePath)) {
			try {
				// Load file as string
				let csvString = fs.readFileSync(filePath, "utf8")
				// Parse string
				let data = d3.csvParse(csvString);
				logger
					.child({ context: {filePath} })
					.info(`Broadcastings for day offset ${offset} loaded (${data.length} rows)`);
				broadcastings = broadcastings.concat(data)
	
			} catch (error) {
				daysMissing++
				console.log("Error", error)
	
				logger
					.child({ context: {filePath, error:error.message} })
					.warn(`Broadcastings file ${filePath} could not be loaded`);
			}
  	} else {
  		daysMissing++
  		logger
				.child({ context: {filePath} })
				.warn(`Broadcastings not found for day offset ${offset}`);
  	}
	}
	logger
		.info(`Broadcastings for precedent days loaded (${daysMissing} days missing)`);
	logger
		.child({ context: {broadcastings} })
		.trace(`Broadcastings (${broadcastings.length} rows)`);

	// Build user index
	const userIndex = {}
	try {
		broadcastings.forEach(b => {
			let userData = userIndex[b.broadcaster_id] || {
				id: b.broadcaster_id,
				name: b.broadcaster_name,
				username: b.broadcaster_username,
				groups:{},
				resources:[],
				cited:{},
			}
			userData.resources.push(b.resource_id)
			JSON.parse(b.tweet_mentions).forEach(u2 => {
				userData.cited[u2] = true
			})

			let bgroups = JSON.parse(b.resource_groups)
			Object.keys(bgroups).forEach(g => {
				let count = userData.groups[g] || 0
				count += bgroups[g]
				userData.groups[g] = count
			})

			userIndex[b.broadcaster_id] = userData
		})
		logger
			.debug(`Users indexed (${Object.keys(userIndex).length})`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the indexation of users`);
	}

	// Index neighbors
	try {
		Object.values(userIndex).forEach(u => {
			u.cited = Object.keys(u.cited)
		})
		logger
			.debug(`Users neighbors indexed`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the indexation of user neighbors`);
	}

	// Flatten, sort and truncate the list if necessary
	let users
	try {
		let groupIndex = {}
		users = Object.values(userIndex).map(u => {
			Object.keys(u.groups).forEach(g => {
				groupIndex[g] = true
			})
			return {
				count_resources: u.resources.length,
				count_neighbors: u.cited.length,
				...u
			}
		})
		users.sort(function(a,b){ return b.count_neighbors - a.count_neighbors })
		users = users.slice(0, max_accounts)

		// Flatten
		users = users.map(u => {
			u.resources_total = u.count_resources
			delete u.count_resources
			u.interactions_total = u.count_neighbors
			delete u.count_neighbors
			let total = 0
			Object.keys(groupIndex).forEach(g => {
				let gCount = u.groups[g] || 0
				u['mp_align_'+g] = gCount
				total += gCount
			})
			let mainGroup = "Other"
			Object.keys(groupIndex).forEach(g => {
				let gCount = u.groups[g] || 0
				if (gCount > total*2/3) { // The main group, if any, is that aligned at two thirds or more with the user
					mainGroup = g
				}
			})
			u.main_group = mainGroup
			delete u.groups
			u.mp_align__TOTAL = total
			u.resources = JSON.stringify(u.resources)
			u.cited = JSON.stringify(u.cited)
			return u
		})

		logger
			.child({ context: {users_sample:users.slice(0,10)} })
			.debug(`Users list processed (${users.length})`);
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {error:error.message} })
			.error(`An error occurred during the processing of users list`);
	}

	// Save user list as CSV
	const usersFile = `${thisFolder}/user_corpus_1month.csv`
	const usersString = d3.csvFormat(users)
	try {
		fs.writeFileSync(usersFile, usersString)
		logger
			.child({ context: {usersFile} })
			.info('Users file saved successfully');
	} catch(error) {
		logger
			.child({ context: {usersFile, error} })
			.error('The users file could not be saved');
	}

	console.log("Done.")
}

main();
