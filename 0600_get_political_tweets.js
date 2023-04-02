import { getLogger } from "./-get-logger.js"
import * as fs from "fs";
import * as d3 from 'd3';
import dotenv from "dotenv";
import { spawn } from "child_process";

dotenv.config();

export async function get_political_tweets(date, useFullArchive) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	const logger = getLogger(`${thisFolder}/0600_get_political_tweets.log`)
	logger.level = "info"
	logger.info('***** RUN SCRIPT ****');

	async function main() {
		
		const resFile_agg = `${thisFolder}/resources_7days_aggregated.csv`
		let resources = loadFile(resFile_agg, 'resources')
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

		let yesterday = new Date(targetDate.getTime());
		yesterday.setDate(targetDate.getDate() - 1);
		const yyear = yesterday.getFullYear()
		const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

		for (let i = 0; i<resources.length && i<maxResources; i++) {
			const res = resources[i]
			const maxResults = 1000
			let baseQuery
			if (res.type == "tweet") {
				baseQuery = `url:"${res.id}"`
			} else {
				baseQuery = res.url
			}
			const query = `${baseQuery} include:nativeretweets (filter:retweets OR filter:quote OR filter:replies) since:${yyear}-${ymonth}-${ydatem} until:${year}-${month}-${datem}`
			const fileHandle = res.url.replace(/[^a-zA-Z0-9_-]/gi, '-').slice(0, 100)
			const minetFile_resolved = `${broadcastingsDir}/${fileHandle}.csv`

			if (fs.existsSync(minetFile_resolved)){
				logger
					.child({ context: {file:minetFile_resolved} })
					.debug(`File found for resource ${res.url}`);
			} else {
				const minetSettings = ["twitter", "scrape", "tweets", `"${query}"`, "--limit", maxResults, "-o", minetFile_resolved]
				try {
					await minet(minetSettings)
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
			}
			
			// Load the file
			let tweets = loadFile(minetFile_resolved, `tweets res #${i} ${fileHandle}`)

			try {
				harvestedTweetsCount += tweets.length
				tweets.forEach(d => {
					// Mentions
					let mentions = {}
					if (d.to_userid) {
						mentions[d.to_userid] = true
					}
					if (d.retweeted_user_id) {
						mentions[d.retweeted_user_id] = true
					}
					if (d.quoted_user_id) {
						mentions[d.quoted_user_id] = true
					}
					if (d.mentioned_ids){
						d.mentioned_ids.split("|").forEach(id => {
							mentions[id] = true
						})
					}
					mentions = Object.keys(mentions)
					if (mentions.length > 0) {
						// Hashtags
						let hashtags = d.hashtags.split("|")

						// Media
						let media = d.media_urls.split("|")
						
						// Create row (object)
						let broadcasting = {
							broadcaster_id: d.user_id,
							broadcaster_name: d.user_name,
							broadcaster_username: d.user_screen_name,
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

	async function minet(opts) {
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
