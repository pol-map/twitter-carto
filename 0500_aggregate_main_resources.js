import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";

dotenv.config();

export async function aggregate_main_resources(date) {

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

	const logLevel = "info"

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
	  	new transports.File({ filename: `${thisFolder}/0500_aggregate_main_resources.log` })
	  ],
	});
	logger.on('error', function (err) { console.log("Logger error :(") });

	logger.info('***** RUN SCRIPT ****');
	logger.info('Log level is '+logLevel);

	async function main() {
		
		const usersFile = `${thisFolder}/twitter_valid_users.csv`
		let users = loadUsers(usersFile)

		// Index users
		let userIndex
		try {
			userIndex = {}
			users.forEach(u => {
				userIndex[u.id] = u
			})
			logger
				.child({ context: {userIndex} })
				.debug(`Users indexed`);
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {users, error:error.message} })
				.error(`An error occurred during the indexation of users`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the indexation of users.`}));
				logger.end();
		  });
		}

		// Load resources from today and previous days for one week
		let resources = []
		let daysMissing = 0
		for (let offset = 0; offset >= -6; offset--) {
			let day = new Date(targetDate.getTime());
			day.setDate(targetDate.getDate() + offset);
			let dyear = day.getFullYear()
			let dmonth = (1+day.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			let ddatem = (day.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			let dayFolder = `data/${dyear}/${dmonth}/${ddatem}`
			let filePath = `${dayFolder}/resources_cited_by_mps_normalized.csv`
	  	if (fs.existsSync(filePath)) {
				try {
					// Load file as string
					let csvString = fs.readFileSync(filePath, "utf8")
					// Parse string
					let data = d3.csvParse(csvString);
					logger
						.child({ context: {filePath} })
						.info(`Normalized resources for day offset ${offset} loaded (${data.length} rows)`);
					resources = resources.concat(data)
				} catch (error) {
					daysMissing++
					console.log("Error", error)
					logger
						.child({ context: {filePath, error:error.message} })
						.error(`The normalized resources file ${filePath} could not be loaded`);
				}
	  	} else {
	  		daysMissing++
	  		logger
					.child({ context: {filePath} })
					.error(`Normalized resources not found for day offset ${offset}`);
	  	}
		}
		logger
			.info(`Normalized resources for precedent days loaded (${daysMissing} days missing)`);
		logger
			.child({ context: {resources} })
			.trace(`Normalized resources (${resources.length} rows)`);

		// Aggregate resources
		let aggregatedResources
		try {
			let resIndex = {}
			resources.forEach(r => {
				let id
				if (r.resource_type == "tweet") {
					id = r.resource_id
				} else {
					id = r.normalized_url
				}
				let resList = resIndex[id] || []
				resList.push(r)
				resIndex[id] = resList
			})
			logger
				.child({ context: {resIndex} })
				.trace(`Indexed resources (${(Object.keys(resIndex)).length} different ids)`);
			aggregatedResources = Object.keys(resIndex).map(id => {
				let resList = resIndex[id]
				let url = ''

				// Use normalized URL if there is one
				resList.forEach(res => {
					if (res.normalized_url && res.normalized_url.length > 0) {
						let prefix = ''
						if (res.normalized_url.indexOf("http") != 0) {
							prefix = 'https://'
						}
						url = prefix+res.normalized_url
					}
				})

				// If still nothing, use non-normalized URL if there is one
				if (url == '') {
					resList.forEach(res => {
						if (res.resource_url && res.resource_url.length > 0) {
							url = res.resource_url
						}
					})
				}

				// If still nothing and it's a tweet, build a dummy Twitter url for convenience
				if (url == '' && resList[0].resource_type == 'tweet') {
					// TODO: find the actual source of the tweet
					url = `https://twitter.com/x/status/${id}`
				}

				// Get the groups
				let groupsIndex = {}
				resList.forEach(r => {
					let uid = r.user_id
					let user = userIndex[uid]
					if (user) {
						let group = user.group
						let gCount = groupsIndex[group] || 0
						gCount++
						groupsIndex[group] = gCount
					} else {
						logger
							.child({ context: {uid} })
							.warn(`User index not found: ${uid}. UNEXPECTED. DOUBLE CHECK why it happened. Possible causes: the user changed handle or is no more in source list.`);
					}
				})

				// Get main group
				let mainGroup
				if (Object.keys(groupsIndex).length == 0) {
					mainGroup = "None"
				} else if (Object.keys(groupsIndex).length == 1) {
					mainGroup = Object.keys(groupsIndex)[0]
				} else {
					let max = d3.max(Object.values(groupsIndex))
					let topGroups = []
					Object.keys(groupsIndex).forEach(g => {
						if (groupsIndex[g] == max) {
							topGroups.push(g)
						}
					})
					if (topGroups.length == 1) {
						mainGroup = topGroups[0]
					} else {
						mainGroup = "Other" // Tie
					}
				}

				return {
					id: id,
					type: resList[0].resource_type,
					count: resList.length,
					url: url,
					groups:JSON.stringify(groupsIndex),
					group_main: mainGroup,
				}
			})
			aggregatedResources.sort(function(a,b){ return b.count - a.count })
			logger
				.child({ context: {aggregatedResources} })
				.trace(`Aggregated resources (${aggregatedResources.length} rows)`);
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`An error occurred during the aggregation of resources`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during the aggregation of resources.`}));
				logger.end();
		  });
		}

		// Save aggregated resources as CSV
		const resFile_agg = `${thisFolder}/resources_7days_aggregated.csv`
		const resCsvString_agg = d3.csvFormat(aggregatedResources)
		try {
			fs.writeFileSync(resFile_agg, resCsvString_agg)
			logger
				.child({ context: {resFile_agg} })
				.info('Aggregated resources file saved successfully');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`Aggregated resources file saved successfully (${daysMissing} days missing).`}));
				logger.end();
		  });
		} catch(error) {
			logger
				.child({ context: {resFile_agg, error} })
				.error('The aggregated resources file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The aggregated resources file could not be saved.`}));
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
