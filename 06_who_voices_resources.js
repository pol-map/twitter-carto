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
  	new transports.File({ filename: `${thisFolder}/06_who_voices_resources.log` })
  ],
});

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

	// Who cited those resources as of today?

	// Q: How many resources can we afford to track? It's a matter of time.
	// One call takes up to 12s because of Twitter rate limit.
	// But that is per page (so per 100) and we track up to 1000 so that's 2 minutes max per response.
	// A reasonable cap for this is 6 hours, aka 360 min, aka 180 resources.
	// Let's keep this order of magnitude, and aim at the top 100 resources of the last 7 days.
	const maxResources = 100

	const retweetingDir = `${thisFolder}/retweeting`
	if (!fs.existsSync(retweetingDir)){
	  fs.mkdirSync(retweetingDir);
	}
	const diffurlDir = `${thisFolder}/diffURL`
	if (!fs.existsSync(diffurlDir)){
	  fs.mkdirSync(diffurlDir);
	}

	let broadcastings = []

	for (let i = 0; i<resources.length && i<maxResources; i++) {
		const res = resources[i]

		if (res.type == "tweet") {
			// CASE 1: TWEETS - We can ask Twitter directly who retweeted it (but we do not know when)
			
			const maxPages = 10 // 100 users per page, so we cap the retweeters to 1000
			let page = 0
			let pageToken
			while (page<maxPages) {
				
				const fileName = `${retweetingDir}/${res.id}-${page.toLocaleString('en-US', {minimumIntegerDigits: 3, useGrouping: false})}.json`
				
				let usersResponse
				// If the file exists, we just load it (recovery system)
				if (fs.existsSync(fileName)){
					let usersResponseRaw
					try {
						usersResponseRaw = fs.readFileSync(fileName);
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, fileName, error:error.message} })
							.error(`JSON file read error. The data could not be recovered.`);
					}
					if (usersResponseRaw) {
						try {
					  	usersResponse = JSON.parse(usersResponseRaw);
					  	logger
					  		.child({ context: {res, page, fileName, usersResponse} })
								.trace(`Users data response retrieved from local cache ${fileName}`);
				  	} catch (error) {
							console.log("Error", error)
							logger
								.child({ context: {res, page, fileName, usersResponseRaw, error:error.message} })
								.error(`JSON file cannot be parsed. The data could not be recovered.`);
							usersResponse = undefined
						}
					}
				}

				// If the file does not exist or failed, query Twitter.
				if (usersResponse === undefined) {
					usersResponse = await getRetweetingUsers(res.id, pageToken)
					// Save response
					const usersResponseString = JSON.stringify(usersResponse)
					fs.writeFile(fileName, usersResponseString, error => {
					  if (error) {
							logger
								.child({ context: {res, page, fileName, error} })
								.error(`The retweeting file for resource ${i}, id ${res.id}, page ${page} could not be saved`);
					  } else {
						  logger
								.child({ context: {res, page, fileName} })
								.debug(`The retweeting file for resource ${i}, id ${res.id}, page ${page} was saved successfully`);
					  }
					});

				}
				// Process the results
				if (usersResponse && usersResponse.data && usersResponse.data.length > 0) {
					try {
						usersResponse.data.forEach(d => {
							let broadcasting = {
								broadcaster_id: d.id,
								broadcaster_name: d.name,
								broadcaster_username: d.username,
								// resource_group_main: res.group_main,
								resource_groups: res.groups,
								resource_id: res.id,
								resource_type: res.type,
								// resource_url: res.url,
							}
							broadcastings.push(broadcasting)
						})
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, usersResponse, error:error.message} })
							.error(`User response data could not be processed for resource ${i}, id ${res.id}, page ${page}.`);
					}
				}
				page++
				if (usersResponse && usersResponse.meta && usersResponse.meta.next_token) {
					pageToken = usersResponse.meta.next_token
				} else break;
			}
		} else if (res.type == "url") {
			// CASE 2: URLs - We can use Twitter's SEARCH api

			const maxPages = 10 // 100 users per page, so we cap the tweets to 1000
			let page = 0
			let pageToken
			while (page<maxPages) {
				const urlSignature = res.id.replace(/[^a-zA-Z0-9_-]/gi, '-').slice(0, 100)
				const fileName = `${diffurlDir}/${urlSignature}-${page.toLocaleString('en-US', {minimumIntegerDigits: 3, useGrouping: false})}.json`
				
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
					tweetsResponse = await getSearchUrlInTweets(res.id, pageToken)
					// Save response
					const tweetsResponseString = JSON.stringify(tweetsResponse)
					fs.writeFile(fileName, tweetsResponseString, error => {
					  if (error) {
							logger
								.child({ context: {res, page, fileName, error} })
								.error(`The tweeting file for resource ${i},  ${truncate(res.url)}, page ${page} could not be saved`);
					  } else {
						  logger
								.child({ context: {res, page, fileName} })
								.debug(`The tweeting file for resource ${i},  ${truncate(res.url)}, page ${page} was saved successfully`);
					  }
					});

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
							.error(`An error occured when indexing the user data from URL tweeting response data for resource ${i}, ${truncate(res.url)}, page ${page}.`);
					}
					try {
						tweetsResponse.data.forEach(d => {
							let broadcasting = {
								broadcaster_id: userIndex[d.author_id].id,
								broadcaster_name: userIndex[d.author_id].name,
								broadcaster_username: userIndex[d.author_id].username,
								// resource_group_main: res.group_main,
								resource_groups: res.groups,
								resource_id: res.id,
								resource_type: res.type,
								// resource_url: res.url,
							}
							broadcastings.push(broadcasting)
						})
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {res, page, usersResponse, error:error.message} })
							.error(`URL tweeting response data could not be processed for resource ${i}, ${truncate(res.url)}, page ${page}.`);
					}
				}
				page++
				if (tweetsResponse && tweetsResponse.meta && tweetsResponse.meta.next_token) {
					pageToken = tweetsResponse.meta.next_token
				} else break;
			}
		}
	}

	logger
		.child({ context: {broadcastingsLength:broadcastings.length } })
		.info(`Broadcastings retrieved (${broadcastings.length})`);

	// Save broadcastings as CSV
	const broadcastingsFile = `${thisFolder}/broadcastings_7days.csv`
	const broadcastingsString = d3.csvFormat(broadcastings)
	try {
		fs.writeFileSync(broadcastingsFile, broadcastingsString)
		logger
			.child({ context: {broadcastingsFile} })
			.info('Broadcastings file saved successfully');
	} catch(error) {
		logger
			.child({ context: {broadcastingsFile, error} })
			.error('The broadcastings file could not be saved');
	}

	console.log("Done.")
}

main();

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

async function getRetweetingUsers(id, pageToken) {
	// User rate limit: 75 queries per 15 minutes. So we wait the right amount of time to throttle.
	await new Promise(resolve => setTimeout(resolve, 15*60*1000/75)) // wait 12 seconds

	const settings = {
    //The maximum number of results
    "max_results": 100,
  }
  if (pageToken) {
  	settings.pagination_token = pageToken
  }
	try {

    const users = await twitterClient.users.tweetsIdRetweetingUsers(
      //The ID of the User to list Tweets of
      id,
      settings
    );

    if (users.errors) {
	    logger
	  		.child({ context: {id} })
				.warn(`Errors returned for ${users.errors.length} users that retweeted tweet ${id}`);    	
    }
    if (users.data) {
	    logger
	  		.child({ context: {id} })
				.info(`${users.data.length} users retrieved that retweeted ${id}`);
    } else {
	    logger
	  		.child({ context: {id} })
				.warn(`No users retrieved that retweeted ${id}`);
    }
    logger
  		.child({ context: {id, settings, users} })
			.trace(`Users data response retrieved`);
    return users || {}
  } catch (error) {
    console.log("Error", error)
		logger
			.child({ context: {id, settings, error:error.message} })
			.error('The API call to retrieve retweeting users failed');
		return {}
  }
}

async function getSearchUrlInTweets(url, pageToken) {
	// User rate limit: 180 queries per 15 minutes. So we wait the right amount of time to throttle.
	await new Promise(resolve => setTimeout(resolve, 15*60*1000/180)) // wait 5.33 seconds

	const settings = {
		"query": `-is:retweet -is:reply url:"${url}"`,
		"sort_order":["recency"],
		"expansions":"author_id",
		"user.fields":[
			"id",
			"name",
			"username",
		],
    "max_results": 100,
  }
  if (pageToken) {
  	settings.pagination_token = pageToken
  }
	try {

    const tweets = await twitterClient.tweets.tweetsRecentSearch(settings);

    if (tweets.errors) {
	    logger
	  		.child({ context: {url} })
				.warn(`Errors returned for ${tweets.errors.length} tweets mentioning URL ${url}`);    	
    }
    if (tweets.data) {
	    logger
	  		.child({ context: {url} })
				.info(`${tweets.data.length} tweets retrieved that mention ${url}`);
    } else {
	    logger
	  		.child({ context: {url} })
				.warn(`No tweets mentioned ${url}`);
    }
    logger
  		.child({ context: {url, settings, tweets} })
			.trace(`Tweets data response retrieved`);
    return tweets || {}
  } catch (error) {
    console.log("Error", error)
		logger
			.child({ context: {url, settings, error:error.message} })
			.error('The API call to retrieve tweets mentioning a URL failed');
		return {}
  }
}

function truncate(input) {
   if (input.length > 50) {
      return input.substring(0, 50) + '...';
   }
   return input;
};