import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";

dotenv.config();

export async function get_political_tweets(date, useFullArchive) {

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
	  	new transports.File({ filename: `${thisFolder}/06_get_political_tweets.log` })
	  ],
	});
	logger.on('error', function (err) { console.log("Logger error :(") });

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	const twitterClient = new Client(process.env.BEARER_TOKEN);

	async function main() {
		
		const resFile_agg = `${thisFolder}/resources_7days_aggregated.csv`
		let resources = loadResources(resFile_agg)
		resources.sort(function(a,b){ return b.count - a.count })
		logger
			.child({ context: {resources} })
			.trace('Sorted resources');

		const maxResources = +process.env.MAX_RESOURCES || 2500
		const maxTweets = 33000
		let harvestedTweetsCount = 0

		const broadcastingsDir = `${thisFolder}/broadcastings`
		if (!fs.existsSync(broadcastingsDir)){
		  fs.mkdirSync(broadcastingsDir);
		}

		let broadcastings = []

		for (let i = 0; i<resources.length && i<maxResources; i++) {
			const res = resources[i]

			const maxPages = 10 // 100 users per page
			let page = 0
			let pageToken
			while (page<maxPages) {
				let queryMain
				let fileHandle

				if (res.type == "tweet") {
					fileHandle = res.id
					queryMain = `"${res.id}"`
				} else if (res.type == "url") {
					fileHandle = res.id.replace(/[^a-zA-Z0-9_-]/gi, '-').slice(0, 100)
					queryMain = `url:"${res.id}"`
				}

				const fileName = `${broadcastingsDir}/${fileHandle}-${page.toLocaleString('en-US', {minimumIntegerDigits: 3, useGrouping: false})}.json`
				
				let tweetsResponse
				// If the file exists, we just load it (recovery system)
				if (fs.existsSync(fileName)){
					let tweetsResponseRaw
					try {
						tweetsResponseRaw = fs.readFileSync(fileName);
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, fileName, error:error.message} })
							.error(`JSON file read error. The data could not be recovered.`);
						return new Promise((resolve, reject) => {
							logger.once('finish', () => resolve({success:false, msg:`JSON file read error. The data could not be recovered.`}));
							logger.end();
					  });
					}
					if (tweetsResponseRaw) {
						try {
					  	tweetsResponse = JSON.parse(tweetsResponseRaw);
					  	logger
					  		.child({ context: {res, page, fileName, tweetsResponse} })
								.trace(`Tweets data response retrieved from local cache ${fileName}`);
				  	} catch (error) {
							console.log("Error", error)
							logger
								.child({ context: {res, page, fileName, tweetsResponseRaw, error:error.message} })
								.error(`JSON file cannot be parsed. The data could not be recovered.`);
							tweetsResponse = undefined
						}
					}
				}

				// If the file does not exist or failed, query Twitter.
				if (tweetsResponse === undefined) {
					let yesterday = new Date(targetDate.getTime());
					yesterday.setDate(targetDate.getDate() - 1);
					const yyear = yesterday.getFullYear()
					const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
					const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

					const settings = {
						"query": `(is:retweet OR is:reply OR is:quote) ${queryMain}`,
						"sort_order":["recency"],
						"expansions":"author_id",
						"user.fields":[
							"id",
							"name",
							"username",
						],
						"tweet.fields": [
				      "created_at",
				      "author_id",
				      "conversation_id",
				      "in_reply_to_user_id",
				      "referenced_tweets",
				      "attachments",
				      "entities",
				      "withheld",
				      "possibly_sensitive",
				      "lang",
				      "reply_settings",
				    ],
				    "start_time": `${yyear}-${ymonth}-${ydatem}T00:00:00Z`,
			    	"end_time": `${year}-${month}-${datem}T00:00:00Z`,
				    "max_results": 100,
				  }

					tweetsResponse = await getSearchQueryTweets(settings, pageToken)
					// Save response
					const tweetsResponseString = JSON.stringify(tweetsResponse)
					try {
						fs.writeFileSync(fileName, tweetsResponseString)
					  logger
							.child({ context: {res, page, fileName} })
							.debug(`The tweeting file for resource ${i},  ${truncate(res.id)}, page ${page} was saved successfully`);
					} catch(error) {
						logger
							.child({ context: {res, page, fileName, error} })
							.error(`The tweeting file for resource ${i},  ${truncate(res.id)}, page ${page} could not be saved`);						
					}
				}

				// Process the results
				if (tweetsResponse && tweetsResponse.data && tweetsResponse.data.length > 0) {
					// As the ids are in the "includes" section, we need to index them
					let userIndex = {}
					try {
						tweetsResponse.includes.users.forEach(u => {
							userIndex[u.id] = u
						})
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, usersResponse, error:error.message} })
							.error(`An error occured when indexing the user data of the broadcasing of resource ${i}, ${truncate(res.id)}, page ${page}.`);
					}
					try {
						harvestedTweetsCount += tweetsResponse.data.length
						tweetsResponse.data.forEach(d => {
							// Mentions
							let mentions = {}
							if (d.entities && d.entities.mentions){
								d.entities.mentions.forEach(m => {
									mentions[m.id] = true
								})
							}
							if (d.in_reply_to_user_id) {
								mentions[d.in_reply_to_user_id] = true
							}
							mentions = Object.keys(mentions)
							if (mentions.length > 0) {
								// Hashtags
								let hashtags = {}
								if (d.entities && d.entities.hashtags){
									d.entities.hashtags.forEach(h => {
										hashtags[h.tag] = true
									})
								}
								hashtags = Object.keys(hashtags)

								// Media
								let media = {}
								if (d.attachments && d.attachments.media_keys){
									d.attachments.media_keys.forEach(mk => {
										media[mk] = true
									})
								}
								media = Object.keys(media)
								
								// Create row (object)
								let broadcasting = {
									broadcaster_id: userIndex[d.author_id].id,
									broadcaster_name: userIndex[d.author_id].name,
									broadcaster_username: userIndex[d.author_id].username,
									// resource_group_main: res.group_main,
									resource_groups: res.groups,
									resource_id: res.id || res.url,
									resource_type: res.type,
									// resource_url: res.url,
									tweet_mentions: JSON.stringify(mentions),
									tweet_text: d.text,
									tweet_hashtags: JSON.stringify(hashtags),
									tweet_media: JSON.stringify(media),
									tweet_lang: ""+d.lang,
								}
								broadcastings.push(broadcasting)
							}
						})
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, usersResponse, error:error.message} })
							.error(`Broadcasting response data could not be processed for resource ${i}, ${truncate(res.id)}, page ${page}.`);
					}
				}
				page++
				if (tweetsResponse && tweetsResponse.meta && tweetsResponse.meta.next_token) {
					pageToken = tweetsResponse.meta.next_token
				} else break;
			}

			logger
				.info(`Resource ${i+1} retrieved (${harvestedTweetsCount}/${maxTweets} tweets)`);

			if (harvestedTweetsCount > maxTweets) {
				logger
					.info(`Daily tweet limit attained, stopping here. (${harvestedTweetsCount} tweets harvested)`);
				break
			}
		}

		logger
			.child({ context: {broadcastingsLength:broadcastings.length } })
			.info(`Broadcastings retrieved (${broadcastings.length})`);
		
		// Save broadcastings as CSV
		const broadcastingsFile = `${thisFolder}/broadcastings.csv`
		const broadcastingsString = d3.csvFormat(broadcastings)
		try {
		
			fs.writeFileSync(broadcastingsFile, broadcastingsString)
			logger
				.child({ context: {broadcastingsFile} })
				.info('Broadcastings file saved successfully');
		  
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`${broadcastings.length} broadcastings saved successfully.`}));
				logger.end();					
		  });
		} catch(error) {
			
			logger
				.child({ context: {broadcastingsFile, error} })
				.error('The broadcastings file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The broadcastings file could not be saved.`}));
				logger.end();
		  });

		}
		
		console.log("Done.")
	}

	return main();

	function loadResources(filePath) {
		try {
			// Load file as string
			const csvString = fs.readFileSync(filePath, "utf8")
			// Parse string
			const data = d3.csvParse(csvString);
			logger
				.child({ context: {filePath} })
				.info('Resources file loaded');
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error('The resources file could not be loaded');
		}
	}

	async function getSearchQueryTweets(settings, pageToken) {
    if (useFullArchive) {
			// User rate limit: 300 queries per 15 minutes. So we wait the right amount of time to throttle.
			await new Promise(resolve => setTimeout(resolve, 15*60*1000/300))
  	} else {
			// User rate limit: 450 queries per 15 minutes. So we wait the right amount of time to throttle.
			await new Promise(resolve => setTimeout(resolve, 15*60*1000/450))
    }

	  if (pageToken) {
	  	settings.pagination_token = pageToken
	  }
		try {

	    let tweets
	    if (useFullArchive) {
	    	tweets = await twitterClient.tweets.tweetsFullarchiveSearch(settings);
    	} else {
	    	tweets = await twitterClient.tweets.tweetsRecentSearch(settings);
	    }

	    if (tweets.errors) {
		    logger
		  		.child({ context: {settings} })
					.warn(`Errors returned for ${tweets.errors.length} tweets broadcasting ${settings.query}`);    	
	    }
	    if (tweets.data) {
		    logger
		  		.child({ context: {settings} })
					.info(`${tweets.data.length} tweets retrieved that broadcast ${settings.query}`);
	    } else {
		    logger
		  		.child({ context: {settings} })
					.warn(`No tweets broadcasting ${settings.query}`);
	    }
	    logger
	  		.child({ context: {settings, tweets} })
				.trace(`Tweets data response retrieved`);
	    return tweets || {}
	  } catch (error) {
	    console.log("Error", error)
			logger
				.child({ context: {settings, error:error.message} })
				.error('The API call to retrieve broadcasting tweets');
			return {}
	  }
	}

	function truncate(input) {
	   if (input.length > 50) {
	      return input.substring(0, 50) + '...';
	   }
	   return input;
	};
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
	get_political_tweets(date)
}