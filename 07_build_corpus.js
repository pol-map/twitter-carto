import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";

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
	
	// The goal of this script is twofold:
	// * Cap the total number of users in case it gets out of control (computationally)
	// * Count, for each account, how it aligns with the MPs (through the top 100 resources)
	// We do that simply from the broadcastings.
	const max_accounts = 100000;

	const broadcastingsFile = `${thisFolder}/broadcastings_7days.csv`
	let broadcastings = loadBroadcastings(broadcastingsFile)

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
				cited:b.tweet_mentions,
			}
			userData.resources.push(b.resource_id)

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
			let cited = JSON.parse(u.cited)
			u.cited = []
			cited.forEach(d => {
				if (userIndex[d]) {
					u.cited.push(d)
				}
			})
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
				count: u.resources.length,
				...u
			}
		})
		users.sort(function(a,b){ return b.count - a.count })
		users = users.slice(0, max_accounts)

		// Flatten
		users = users.map(u => {
			u.resources_total = u.count
			delete u.count
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
	const usersFile = `${thisFolder}/users_corpus_7days.csv`
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

function loadBroadcastings(filePath) {
	try {
		// Load file as string
		const csvString = fs.readFileSync(filePath, "utf8")
		// Parse string
		const data = d3.csvParse(csvString);
		logger
			.child({ context: {filePath} })
			.info('Broadcastings file loaded');
		return data
	} catch (error) {
		console.log("Error", error)
		logger
			.child({ context: {filePath, error:error.message} })
			.error('The broadcastings file could not be loaded');
	}
}