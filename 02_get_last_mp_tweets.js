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

const logLevel = "trace"

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
	handleList = handleList.slice(0, 20); // TODO: REMOVE ME

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
		const users = await appendUserIds(handleList)
		logger
			.child({ context: {users} })
			.debug('User data retrieved from Twitter');

		// Reconcile users with original data
		try {
			let handleIndex = {}
			handleList.forEach(d => {
				handleIndex[d.handle.toLowerCase()] = d
			})
			users.forEach(d => {
				d.source = handleIndex[d.username.toLowerCase()]
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

	  // const tweet = await client.tweets.findTweetById("20");
	  // console.log(tweet.data.text);

	  // For each mp, load yesterday's tweets (max 100)		
	} else {
		logger
			.child({ context: {handleList} })
			.error('No handles to fetch');
	}
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

async function appendUserIds(handleList) {
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
	// Get id from handle

	// TODO
	// try {
 //    const usersTweets = await twitterClient.tweets.usersIdTweets(
 //      //The ID of the User to list Tweets of
 //      2244994945,
 //      {
 //        //A comma separated list of fields to expand
 //        expansions: ["author_id"],

 //        //A comma separated list of Tweet fields to display
 //        "tweet.fields": [
 //          "created_at",
 //          "author_id",
 //          "conversation_id",
 //          "public_metrics",
 //          "context_annotations",
 //        ],

 //        //A comma separated list of User fields to display
 //        "user.fields": ["username"],

 //        //The maximum number of results
 //        max_results: 5,
 //      }
 //    );
 //    console.dir(usersTweets, {
 //      depth: null,
 //    });
 //  } catch (error) {
 //    console.log(error);
 //  }
}