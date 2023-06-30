import { getLogger } from "./-get-logger.js"
import * as fs from "fs";
import * as d3 from 'd3';
import dotenv from "dotenv";
import { spawn } from "child_process";

dotenv.config();

export async function get_last_mp_tweets(date) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	const logger = getLogger(`${thisFolder}/0200_get_last_mp_tweets.log`)
	logger.level = "info"
	logger.info('***** RUN SCRIPT ****');

	const handlesFile = `${thisFolder}/twitter_handles.csv`

	async function main() {
		let handleList = loadHandles(handlesFile)
		let tweetsFilesSavecSuccessfully = 0;

		// Check that the handles are valid
		const handleRegex = /^[A-Za-z0-9_]{1,15}$/
		let invalidHandles = []
		handleList = handleList.filter(d => {
			const match = d.handle.match(handleRegex)
			if (!match) {
				invalidHandles.push(d.handle)
			}
			return match
		})
		if (invalidHandles.length > 0) {
			logger
				.child({ context: {invalidHandles} })
				.warn('Some handles are invalid (misformed)');		
		}

		if (handleList && handleList.length > 0) {
			let users = await retrieveUserIds(handleList)
			logger
				.child({ context: {users} })
				.debug('User data retrieved from Twitter');

			// Reconcile users with original data
			try {
				let handleIndex = {}
				handleList.forEach(d => {
					handleIndex[d.handle.toLowerCase()] = d
				})
				users = users
				.filter(d => {
					if (handleIndex[d.username.toLowerCase()]){
						return true
					} else {
						logger
							.child({ context: {user:d} })
							.warn(`User ${d.username.toLowerCase()} was retrieved but did not match with the query list. It probably indicates that the user has changed handle. That user will be ignored.`);
					}
				})
				.map(d => {
					let sourceData = handleIndex[d.username.toLowerCase()]
					sourceData.sourcename = sourceData.name
					delete sourceData.name
					return { ...d, ...sourceData }
				})
			} catch (error) {
				console.log("Error", error)
				logger
					.child({ context: {error:error.message} })
					.error('The user data retrieved from Twitter could not be reconciled with the original data');
				return {success:false, msg:"The user data retrieved from Twitter could not be reconciled with the original data."}
			}

			logger
				.child({ context: {users} })
				.debug('Reconciled user data');

			// Save retrieved user data
			const usersFile = `${thisFolder}/twitter_valid_users.csv`
			const usersCsvString = d3.csvFormat(users)
			try {
				fs.writeFileSync(usersFile, usersCsvString)
				logger
					.child({ context: {usersFile} })
					.info('Valid users file saved successfully');
			} catch(error) {
				logger
					.child({ context: {usersFile, error} })
					.error('The valid users file could not be saved');
				return {success:false, msg:"The valid users file could not be saved."}
			}

		  // For each user, load yesterday's tweets with Minet
			// Build CSV file for the queries
			let yesterday = new Date(targetDate.getTime());
			yesterday.setDate(targetDate.getDate() - 1);
			const yyear = yesterday.getFullYear()
			const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			const queryFile = `${thisFolder}/queries_for_mp_tweets.csv`
			const queryCsvString = d3.csvFormat(users.map(d => {
				return {query: `from:${d.handle} include:nativeretweets since:${yyear}-${ymonth}-${ydatem} until:${year}-${month}-${datem}`}
			}))
			try {
				fs.writeFileSync(queryFile, queryCsvString)
				logger
					.child({ context: {queryFile} })
					.info('Queries file saved successfully');
			} catch(error) {
				logger
					.child({ context: {queryFile, error} })
					.error('The queries file could not be saved');
				return {success:false, msg:"The queries file could not be saved."}
			}
			let minetSettings = ["twitter", "scrape", "tweets", "query", "-i", queryFile, "--limit", "100"]
			if (process.env.MINET_TWITTER_COOKIE && process.env.MINET_TWITTER_COOKIE.length > 0) {
				minetSettings = minetSettings.concat(["--cookie", `"${process.env.MINET_TWITTER_COOKIE}"`])
			}	
			let minetResultString
			try {
				minetResultString = await minet(minetSettings)
				logger
					.child({ context: {minetResultString} })
					.debug('Minet output');
			} catch (error) {
				console.log("Error", error)
				logger
					.child({ context: {minetSettings, error:error?error.message:"unknown"} })
					.error(`An error occurred during the retrieval of yesterday's MP tweets`);
				return new Promise((resolve, reject) => {
					logger.once('finish', () => resolve({success:false, msg:`An error occurred during the retrieval of yesterday's MP tweets.`}));
					logger.end();
				});
			}
			// Save Minet output as CSV
			const minetFile_resolved = `${thisFolder}/yesterdays_mp_tweets.csv`
			try {
				fs.writeFileSync(minetFile_resolved, minetResultString)
				logger
					.child({ context: {minetFile_resolved} })
					.info('MP tweets file saved successfully');
			} catch(error) {
				logger
					.child({ context: {minetFile_resolved, error} })
					.error('The MP tweets file could not be saved');
				return new Promise((resolve, reject) => {
					logger.once('finish', () => resolve({success:false, msg:`The MP tweets file could not be saved.`}));
					logger.end();
				});
			}
		  logger
				.info('Yesterday\'s tweets for all valid handles retrieved.');
		} else {
			logger
				.child({ context: {handleList} })
				.error('No handles to fetch');
			return {success:false, msg:"No handles to fetch."}
		}
		console.log("Done.")
		return {success:true, msg:`Tweets harvested.`}
	}

	return main();

	function loadHandles(filePath) {
		try {
			// Load file as string
			const csvString = fs.readFileSync(filePath, "utf8")
			// Parse string
			const data = d3.csvParse(csvString);
			logger
				.child({ context: {filePath} })
				.info('Handles file loaded');
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error('The handles file could not be loaded');
		}
	}

	async function retrieveUserIds(handleList) {
		logger.info('Retrieve user IDs from Twitter');
		const resultsFile = `${thisFolder}/queries_for_mp_handles_results.csv`
		if (!fs.existsSync(resultsFile)){
			// Strategy: scrape 1 tweet per handle to check it exists and get more info
			const queryFile = `${thisFolder}/queries_for_mp_handles.csv`
			const queryCsvString = d3.csvFormat(handleList.map(d => {
				return {query: `from:${d.handle} include:nativeretweets`}
			}))
			try {
				fs.writeFileSync(queryFile, queryCsvString)
				logger
					.child({ context: {queryFile} })
					.info('Queries file saved successfully');
			} catch(error) {
				logger
					.child({ context: {queryFile, error} })
					.error('The queries file could not be saved');
				return {success:false, msg:"The queries file could not be saved."}
			}
			let minetSettings = ["twitter", "scrape", "tweets", "query", "-i", queryFile, "--limit", "1", "-o", resultsFile]
			if (process.env.MINET_TWITTER_COOKIE && process.env.MINET_TWITTER_COOKIE.length > 0) {
				minetSettings = minetSettings.concat(["--cookie", `"${process.env.MINET_TWITTER_COOKIE}"`])
			}
			try {
				await minet(minetSettings)
				logger
					.child({ context: {minetSettings} })
					.debug('Minet queries done.');
			} catch (error) {
				console.log("Error", error)
				logger
					.child({ context: {minetSettings, error:error?error.message:"unknown"} })
					.error(`An error occurred during the retrieval of yesterday's MP tweets`);
				return new Promise((resolve, reject) => {
					logger.once('finish', () => resolve({success:false, msg:`An error occurred during the retrieval of yesterday's MP tweets.`}));
					logger.end();
				});
			}
		} else {
			logger
				.info('Query results file found (using it).');
		}

		// Load the results
		let outputData = []
		outputData = loadFile(resultsFile, "Yesterday's MP tweets")

		// Extract user data
		let users = {}
		outputData.forEach(d => {
			let user = {
				id: d.user_id,
				username: d.user_screen_name,
				name: d.user_name,
			}
			users[user.id] = user
		})
		users = Object.values(users)

		logger
			.info(`${users.length} users ids retrieved`);
		return users
	}

	function loadFile(filePath, title) {
		try {
			// Load file as string
			const csvString = fs.readFileSync(filePath, "utf8")
			// Parse string
			const data = d3.csvParse(csvString);
			logger
				.child({ context: {filePath} })
				.info(`File "${title}" loaded`);
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error(`The file "${title}" could not be loaded`);
		}
	}

	function minet(opts) {
	  // call Minet with opts which is an array of strings, each beeing an arg name or arg value
	  let csvString = ''
	  return new Promise((resolve, reject) => {
	    //TODO: add timeout which would reject and kill subprocess
	    try {
	      // activate venv
	      // recommend to use venv to install/use python deps
	      // env can be ignored if minet is accessible from command line globally
	      console.log("Exec: minet", opts.join(" "));
	      const minet = spawn(process.env.MINET_BINARIES, opts, {windowsVerbatimArguments:true});
	      minet.stdout.setEncoding("utf8");
	      minet.stdout.on("data", (data) => {
	      	csvString += data
	      });
	      minet.stderr.setEncoding("utf8");
	      minet.stderr.on("data", (data) => {
					console.log(data)
	      	logger
						.info('Minet process: '+data.trim().split("\r")[0]);
	      });
	      minet.on("close", (code) => {
	        if (code === 0) {
	        	resolve(csvString);
	        	logger
							.info(`MINET exited with no error`);
	        } else {
		      	logger
							.error(`MINET exited on an ERROR: the process closed with code ${code}`);
	          reject();
	        }
	      });
	    } catch (error) {
	      console.log("Error", error)
				logger
					.child({ context: {opts, error:error.message} })
					.error('An error occurred when trying to execute MINET.');
	    }
	  });
	}
}
