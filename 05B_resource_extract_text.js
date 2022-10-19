import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import { spawn } from "child_process";

dotenv.config();

export async function resource_extract_text(date) {

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

	const logLevel = "debug"

	const logger = createLogger({
		level: logLevel,
	  levels: logLevels,
	  format: format.combine(format.timestamp(), format.json()),
	  transports: [
	  	new transports.Console(),
	  	new transports.File({ filename: `${thisFolder}/05B_resource_extract_text.log` })
	  ],
	});

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	const twitterClient = new Client(process.env.BEARER_TOKEN);

	async function main() {
		// We'll need yesterday's folder
		let yesterday = new Date(targetDate.getTime());
		yesterday.setDate(targetDate.getDate() - 1);
		const yyear = yesterday.getFullYear()
		const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const yesterdaysFolder = `data/${yyear}/${ymonth}/${ydatem}`

		// Load resources_7days_aggregated.csv
		const resFile_agg = `${thisFolder}/resources_7days_aggregated.csv`
		let resources = loadFile(resFile_agg, 'resources')

		// Filter
		resources = resources.filter((d,i) => { return i < (+process.env.MAX_RESOURCES || 2500) })

		// Load yesterday's resources_7days_aggregated.csv if any
		const resFile_agg_Y = `${yesterdaysFolder}/resources_7days_aggregated.csv`
		let resources_Y = []
		if (fs.existsSync(resFile_agg_Y)) {
			resources_Y = loadFile(resFile_agg_Y, 'yesterday\'s resources')
		}

		// Compare to find the new resources
		let resourcesOld = {}
		resources_Y.forEach(r => {
			resourcesOld[r.id] = r
		})
		let newResources = resources.filter(r => {
			return resourcesOld[r] === undefined
		})

		// Save the new Twitter resources
		let newResourcesTwitter = newResources.filter(r => r.type == "tweet")
		const resFile_twitter = `${thisFolder}/resources_7days_new_twitter.csv`
		const resCsvString_twitter = d3.csvFormat(newResourcesTwitter)
		try {
			fs.writeFileSync(resFile_twitter, resCsvString_twitter)
			logger
				.child({ context: {resFile_twitter} })
				.info('Twitter resources file saved successfully');
		} catch(error) {
			logger
				.child({ context: {resFile_twitter, error} })
				.error('The Twitter resources file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The Twitter resources file could not be saved.`}));
				logger.end();
		  });
		}

		// Save the new URL resources
		let newResourcesURL = newResources.filter(r => r.type == "url")
		const resFile_URL = `${thisFolder}/resources_7days_new_URL.csv`
		const resCsvString_URL = d3.csvFormat(newResourcesURL)
		try {
			fs.writeFileSync(resFile_URL, resCsvString_URL)
			logger
				.child({ context: {resFile_URL} })
				.info('URL resources file saved successfully');
		} catch(error) {
			logger
				.child({ context: {resFile_URL, error} })
				.error('The URL resources file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The URL resources file could not be saved.`}));
				logger.end();
		  });
		}

		// Extract the text content from Twitter resources
  	const tweetsDir = `${thisFolder}/tweets`
  	if (!fs.existsSync(tweetsDir)){
		  fs.mkdirSync(tweetsDir);
		}
  	const mediaDir = `${thisFolder}/media`
		if (!fs.existsSync(mediaDir)){
		  fs.mkdirSync(mediaDir);
		}
  	let newResourcesTwitterFetched = []
		let batches = []
		let currentBatch = []
		newResourcesTwitter.forEach(r => {
			// Check if the tweet's content is already there
			let fileName = `${tweetsDir}/${r.id}.json`
			let tweetsResponse = undefined
			if (fs.existsSync(fileName)){
				// The data has been previously downloaded: load it.
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
				  		.child({ context: {r, fileName, tweetsResponse} })
							.trace(`Tweets data response retrieved from local cache ${fileName}`);
			  	} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {r, fileName, tweetsResponseRaw, error:error.message} })
							.error(`JSON file cannot be parsed. The data could not be recovered.`);
						tweetsResponse = undefined
					}
				}
			}
			// If the file does not exist or failed, query Twitter.
			if (tweetsResponse === undefined) {
				// Add the tweet to the batch of tweets to retrieve
				currentBatch.push(r.id)
				if (currentBatch.length >= 100) {
					batches.push(currentBatch)
					currentBatch = []
				}
			} else {
				// Add the retrieved data to the list
				newResourcesTwitterFetched.push(tweetsResponse)
			}
		})
		if (currentBatch.length > 0) {
			batches.push(currentBatch)
		}
		logger
			.info(`${batches.length} batches built for ${newResourcesTwitter.length} resources (${newResourcesTwitterFetched.length} already downloaded).`);

		if (batches.length > 0) {
			for (let b in batches) {
				const batch = batches[b]
				const settings = {
					"ids": batch.join(","),
					"expansions":[
						"attachments.poll_ids",
						"attachments.media_keys",
						"author_id",
						"edit_history_tweet_ids",
						"entities.mentions.username",
						"geo.place_id",
						"in_reply_to_user_id",
						"referenced_tweets.id",
						"referenced_tweets.id.author_id",
					],
					"media.fields":[
						"duration_ms",
						"media_key",
						"preview_image_url",
						"type",
						"url",
						"alt_text",
						"variants",
					],
					"tweet.fields": [
						"attachments",
			      "author_id",
			      "context_annotations",
			      "conversation_id",
			      "created_at",
			      "entities",
			      "id",
			      "in_reply_to_user_id",
			      "lang",
			      "possibly_sensitive",
			      "referenced_tweets",
			      "reply_settings",
			      "source",
			      "text",
			      "withheld",
			    ],
					"user.fields":[
						"id",
						"name",
						"username",
					],
			  }
				let tweetsFetched = await getTweets(settings)
				// Save each tweet's content
				for (let t in tweetsFetched.data) {
					const tweet = tweetsFetched.data[t]
					// Save
					const fileName = `${tweetsDir}/${tweet.id}.json`
					const tweetString = JSON.stringify(tweet)
					try {
						fs.writeFileSync(fileName, tweetString)
					  logger
							.child({ tweet:tweet })
							.debug(`The tweeting file for tweet ${tweet.id} was saved successfully`);
					} catch(error) {
						logger
							.child({ tweet:tweet })
							.error(`The tweeting file for tweet ${tweet.id} could not be saved`);						
					}
				}
				// Save the data about each media
				if (tweetsFetched.includes && tweetsFetched.includes.media) {
					for (let i in tweetsFetched.includes.media) {
						const media = tweetsFetched.includes.media[i]
						// Save
						const fileName = `${mediaDir}/${media.media_key}.json`
						const mediaString = JSON.stringify(media)
						try {
							fs.writeFileSync(fileName, mediaString)
						  logger
								.child({ media:media })
								.debug(`The file for media ${media.media_key} was saved successfully`);
						} catch(error) {
							logger
								.child({ media:media })
								.error(`The file for media ${media.media_key} could not be saved`);						
						}
					}
				}
			}
		}

		/*for (let i = 0; i<newResourcesTwitter.length; i++) {
			const res = newResourcesTwitter[i]

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
*/



		/*// Fetch the text content from URL resources
		const fetchUrlSettings = ["fetch", "url", resFile_URL]
		let fetchUrlDataString
		try {
			fetchUrlDataString = await minet(fetchUrlSettings)
			logger
				.child({ context: {fetchUrlDataString} })
				.debug('Minet fetch output');
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {fetchUrlSettings, error:((error)?(error.message):("undefined"))} })
				.error(`An error occurred during Minet's fetching of new resources URLs`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during Minet's fetching of new resources URLs.`}));
				logger.end();
		  });
		}
		// Save fetched resources as CSV
		const resFile_URL_fetched = `${thisFolder}/resources_7days_new_URL_fetched.csv`
		try {
			fs.writeFileSync(resFile_URL_fetched, fetchUrlDataString)
			logger
				.child({ context: {resFile_URL_fetched} })
				.info('New URL resources fetched file saved successfully');
		} catch(error) {
			logger
				.child({ context: {resFile_URL_fetched, error} })
				.error('The new URL resources fetched file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The new URL resources fetched file could not be saved.`}));
				logger.end();
			})
		}
		// Extract the text content from URL resources
		const textExtractUrlSettings = ["extract", resFile_URL_fetched]
		let textExtractUrlDataString
		try {
			textExtractUrlDataString = await minet(textExtractUrlSettings)
			logger
				.child({ context: {textExtractUrlDataString} })
				.debug('Minet extract output');
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {textExtractUrlSettings, error:((error)?(error.message):("undefined"))} })
				.error(`An error occurred during Minet's extraction of new resources URLs`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during Minet's extraction of new resources URLs.`}));
				logger.end();
		  });
		}
		// Save extracted resources as CSV
		const resFile_URL_extracted = `${thisFolder}/resources_7days_new_URL_text.csv`
		try {
			fs.writeFileSync(resFile_URL_extracted, textExtractUrlDataString)
			logger
				.child({ context: {resFile_URL_extracted} })
				.info('New URL resources with text file saved successfully');
		} catch(error) {
			logger
				.child({ context: {resFile_URL_extracted, error} })
				.error('The new URL resources with text file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The new URL resources with text file could not be saved.`}));
				logger.end();
			})
		}*/


		// TODO:
		// Save the resources with text content

		console.log("Done.")
	}

	return main();

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

	async function getTweets(settings) {
		// Rate limit: 300 queries per 15 minutes. So we wait the right amount of time to throttle.
		await new Promise(resolve => setTimeout(resolve, 15*60*1000/300))

		try {

	    let tweets
    	tweets = await twitterClient.tweets.findTweetsById(settings);

	    if (tweets.errors) {
		    logger
		  		.child({ context: {settings} })
					.warn(`Errors returned for ${tweets.errors.length} tweets.`);    	
	    }
	    if (tweets.data) {
		    logger
		  		.child({ context: {settings} })
					.info(`${tweets.data.length} tweets retrieved.`);
	    } else {
		    logger
		  		.child({ context: {settings} })
					.warn(`No tweets retrieved.`);
	    }
	    logger
	  		.child({ context: {settings, tweets} })
				.trace(`Tweets data response retrieved.`);
	    return tweets || {}
	  } catch (error) {
	    console.log("Error", error)
			logger
				.child({ context: {settings, error:error.message} })
				.error('The API call to retrieve tweets failed.');
			return {}
	  }
	}

	function minet(opts) {
	  // call Minet with opts which is an array of string each beeing an arg name or arg value
	  let csvString = ''
	  return new Promise((resolve, reject) => {
	    //TODO: add timeout which would reject and kill subprocess
	    try {
	      // activate venv
	      // recommend to use venv to install/use python deps
	      // env can be ignored if minet is accessible from command line globally
	      console.log("exec minet");
	      const minet = spawn(process.env.MINET_BINARIES, opts);
	      minet.stdout.setEncoding("utf8");
	      minet.stdout.on("data", (data) => {
	      	csvString += data
	      });
	      minet.stderr.setEncoding("utf8");
	      minet.stderr.on("data", (data) => {
	      	logger
						.child({ context: {data} })
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
	resource_extract_text(date)
}