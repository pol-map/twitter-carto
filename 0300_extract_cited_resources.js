import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";

dotenv.config();

export async function extract_cited_resources(date) {

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
	  	new transports.Console(),
	  	new transports.File({ filename: `${thisFolder}/0300_extract_cited_resources.log` })
	  ],
	});

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	async function main() {
		const usersFile = `${thisFolder}/twitter_valid_users.csv`
		let users = loadUsers(usersFile)
		logger
			.child({ context: {users} })
			.debug('Users');
		try {
			// Extract resources
			/*
				What we consider a resource cited by a tweet:
				* What the API defines as "referenced tweets", which includes
					* The retweeted tweet
					* Mentioned tweets (quoted)
				* What the API defines as "entities" when it is:
					* A URL -> can be a doublon with a referenced tweet
			*/
			const tweetsDir = `${thisFolder}/tweets`
			const resources = []
			for (let i = 0; i < users.length; i++) {
				let user = users[i]
		  	let id = user.id
		  	let tweetsFile = `${tweetsDir}/${id}.json`
		  	// Load JSON
		  	let tweetDataRaw
		  	try {
			  	tweetDataRaw = fs.readFileSync(tweetsFile);
		  	} catch (error) {
					console.log("Error", error)
					logger
						.child({ context: {id, tweetsFile, error:error.message} })
						.error(`JSON file cannot be read. The tweets from user ${id} will be ignored.`);
				}
				let tweetData
				if (tweetDataRaw) {
					try {
				  	tweetData = JSON.parse(tweetDataRaw);
			  	} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {id, tweetsFile, tweetDataRaw, error:error.message} })
							.error(`JSON file cannot be parsed. The tweets from user ${id} will be ignored.`);
					}
				}
				if (tweetData) {
					logger
						.child({ context: {id, tweetData} })
						.debug(`Tweets from user ${id}`);
					if (tweetData.data && tweetData.data.length>0) {
						logger
							.info(`${tweetData.data.length} tweets from user ${id}`);

						tweetData.data.forEach(t => {
							try {
								
								// Referenced tweets
								let citedTweets = {}
								if (t.referenced_tweets) {
									t.referenced_tweets.forEach(reft => {
										if (reft.type && (reft.type == "retweeted" || reft.type == "quoted")){
											citedTweets[reft.id] = true
										}
									})
								}

								// URLs
								let urls = {}
								if (t.entities && t.entities.urls) {
									t.entities.urls.forEach(u => {
										let url = u.expanded_url
										// We want to check that those URLs are not duplicates of referenced tweets
										let isReferencedTweet = false
										Object.keys(citedTweets).forEach(id => {
											if (url.indexOf(id)>=0) {
												isReferencedTweet = true
												citedTweets[id] = url
											}
										})
										if (!isReferencedTweet) {
											urls[url] = true
										}
									})
								}

								// Register resources
								Object.keys(citedTweets).forEach(ct => {
									resources.push({
										user_handle: users[i].handle,
										user_id: users[i].id,
										tweet_id: t.id,
										tweet_created_at: t.created_at,
										resource_type:'tweet',
										resource_id:ct,
										resource_url:(citedTweets[ct]===true)?(''):(citedTweets[ct]),
									})
								})
								Object.keys(urls).forEach(url => {
									resources.push({
										user_handle: users[i].handle,
										user_id: users[i].id,
										tweet_id: t.id,
										tweet_created_at: t.created_at,
										resource_type:'url',
										resource_id:'',
										resource_url:url,
									})
								})
							} catch (error) {
								console.log("Error", error)
								logger
									.child({ context: {id, tweet:t, error:error.message} })
									.error(`An error occurred when extracting the cited resources from a tweet of user ${id}.`);
							}
						})
					} else {
						logger
							.info(`No tweets from user ${id}`);
					}
				}
		  }

		  // Save resources list as CSV
	  	const resFile = `${thisFolder}/resources_cited_by_mps.csv`
			// Format filtered data as a string
			const resCsvString = d3.csvFormat(resources)
			// Write clean file
			try {
				fs.writeFileSync(resFile, resCsvString)
				logger
					.child({ context: {resFile} })
					.info('Resources file saved successfully');
				return new Promise((resolve, reject) => {
					logger.once('finish', () => resolve({success:true, msg:`${resources.length} resources saved successfully.`}));
					logger.end();
			  });
			} catch(error) {
				logger
					.child({ context: {resFile, error} })
					.error('The resources file could not be saved');
				return new Promise((resolve, reject) => {
					logger.once('finish', () => resolve({success:false, msg:"The resources file could not be saved."}));
					logger.end();
			  });
			}
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {users, error:error.message} })
				.error('An error occurred during the extraction of resources cited by MPs');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:"An error occurred during the extraction of resources cited by MPs."}));
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
