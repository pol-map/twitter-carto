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
  	new transports.File({ filename: `${thisFolder}/02_get_last_mp_tweets.log` })
  ],
});

logger.info('***** RUN SCRIPT ****');
console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

const twitterClient = new Client(process.env.BEARER_TOKEN);
const handlesFile = `${thisFolder}/twitter_handles.csv`

async function main() {
	let handleList = loadHandles(handlesFile)

	// Check that the handles are valid (else, the Twitter API will reject them)
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
			users = users.map(d => {
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
		}

		logger
			.child({ context: {users} })
			.debug('Reconciled user data');

		// Save retrieved user data
		const usersFile = `${thisFolder}/twitter_valid_users.csv`
		const usersCsvString = d3.csvFormat(users)
		fs.writeFile(usersFile, usersCsvString, error => {
		  if (error) {
				logger
					.child({ context: {usersFile, error} })
					.error('The valid users file could not be saved');
		  } else {
			  logger
					.child({ context: {usersFile} })
					.info('Valid users file saved successfully');	  	
		  }
		});

	  // For each user, load yesterday's tweets
	  for (let i in users) {
	  	const id = users[i].id
	  	const tweetData = await getYesterdaysTweets(id)
	  	// Save data as JSON
	  	const tweetsDir = `${thisFolder}/tweets`
	  	if (!fs.existsSync(tweetsDir)){
			  fs.mkdirSync(tweetsDir);
			}
	  	const tweetsFile = `${tweetsDir}/${id}.json`
			const tweetsString = JSON.stringify(tweetData)
			fs.writeFile(tweetsFile, tweetsString, error => {
			  if (error) {
					logger
						.child({ context: {id, tweetsFile, error} })
						.error(`The tweets file for user ${id} could not be saved`);
			  } else {
				  logger
						.child({ context: {id, tweetsFile} })
						.debug('Tweets file saved successfully');	  	
			  }
			});
	  }
	  logger
			.info('Yesterday\'s tweets for all valid handles retrieved.');
	} else {
		logger
			.child({ context: {handleList} })
			.error('No handles to fetch');
	}
	console.log("Done.")
}

main();

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
	logger
		.child({ context: {handleList} })
		.debug('Retrieve Twitter ids from handles');
	const batchSize = 100
	let batches = []
	let currentBatch = []
	handleList.forEach((d,i) => {
		currentBatch.push(d.handle)
		if (i%batchSize == batchSize-1 || i==handleList.length-1) {
			batches.push(currentBatch.splice(0))
			currentBatch = []
		}
	})

	let batchNumber = 0
	const users = await fetchNextBatch()
	logger
		.info(`${users.length} users ids retrieved`);
	return users

	async function fetchNextBatch(_result) {
		let result = _result || []
		const batch = batches.shift()
		logger
			.debug('Fetch batch of handles');
		try {
			const usernamesLookup = await twitterClient.users.findUsersByUsername({
	      usernames: batch
	    });
	    if (usernamesLookup.errors && usernamesLookup.errors.length > 0) {
	  		logger
	    		.child({ context: {batchNumber, errors: usernamesLookup.errors} })
					.warn('Some twitter handles could not be found');
	    }
	    if (usernamesLookup.data && usernamesLookup.data.length > 0) {
		    logger
		  		.child({ context: {batchNumber, handlesRetrieved: usernamesLookup.data.length} })
					.info('Batch of handles retrieved');
				result = result.concat(usernamesLookup.data)
			} else {
	  		logger
	    		.child({ context: {batchNumber} })
					.warn('No handles retrieved in this batch');			
			}

	    batchNumber++
	    if (batches.length > 0) {
	    	return fetchNextBatch(result)
	    } else {
	    	return result
	    }
	  } catch(error) {
			console.log("Error", error)
			logger
				.child({ context: {batchNumber, error:error.message} })
				.error('The API call to retrieve ids from handles failed');
			return result
	  }
	}
}

async function getYesterdaysTweets(id) {
	let yesterday = new Date(now.getTime());
	yesterday.setDate(now.getDate() - 1);
	const yyear = yesterday.getFullYear()
	const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

	const settings = {
    //A comma separated list of Tweet fields to display
    "tweet.fields": [
      "created_at",
      "author_id",
      "conversation_id",
      "in_reply_to_user_id",
      "referenced_tweets",
      "attachments",
      "entities",
      "withheld",
      "public_metrics",
      "possibly_sensitive",
      "lang",
      "reply_settings",
    ],

    exclude: ["replies"],

    start_time: `${yyear}-${ymonth}-${ydatem}T00:00:00Z`,
    end_time: `${year}-${month}-${datem}T00:00:00Z`,

    //The maximum number of results
    "max_results": 100,
  }
	try {
    const usersTweets = await twitterClient.tweets.usersIdTweets(
      //The ID of the User to list Tweets of
      id,
      settings
    );
    if (usersTweets.errors) {
	    logger
	  		.child({ context: {id} })
				.warn(`Errors returned for ${usersTweets.errors.length} tweets that we retrieved for user ${id}`);    	
    }
    if (usersTweets.data) {
	    logger
	  		.child({ context: {id} })
				.info(`${usersTweets.data.length} tweets retrieved for user ${id}`);    	
    } else {
	    logger
	  		.child({ context: {id} })
				.info(`No tweets retrieved for user ${id}`);
    }
    logger
  		.child({ context: {id, settings, usersTweets} })
			.debug('Tweets retrieved');
    return usersTweets || {}
  } catch (error) {
    console.log("Error", error)
		logger
			.child({ context: {id, settings, error:error.message} })
			.error('The API call to retrieve tweets from id failed');
		return {}
  }
}