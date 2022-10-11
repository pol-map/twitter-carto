import { update_mp_list } from "./01_update_mp_list.js";
import { get_last_mp_tweets } from "./02_get_last_mp_tweets.js";
import { extract_cited_resources } from "./03_extract_cited_resources.js";
import { normalize_urls } from "./04_normalize_urls.js";
import { aggregate_main_resources } from "./05_aggregate_main_resources.js";
import { get_political_tweets } from "./06_get_political_tweets.js";
import { build_corpus } from "./07_build_corpus.js";
import { network } from "./08_network.js";
import { network_layout } from "./09_network_layout.js";
import { render_map_twitter } from "./10_render_map_twitter.js";
import { render_map_4k_no_labels } from "./11_render_map_4K_no_labels.js";
import { render_map_4k_top_labels } from "./12_render_map_4K_top_labels.js";
import { render_map_large } from "./13_render_map_large.js";
import { render_pol_heatmaps } from "./14_render_pol_heatmaps.js";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import * as d3 from 'd3';

dotenv.config();

let settings = {}
settings.sdate = "2022-09-01"
settings.edate = "2022-10-11"
settings.forceRerun = true // Set to true if you want to re-run scripts even though the files are there. It will not re-harvest uselessly.

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

const twitterClient = new Client(process.env.BEARER_TOKEN);

let targetDate

// If in update mode, we want to delete obsolete files
if (settings.forceRerun) {
	console.log("UPDATE MODE: deleting obsolete files...")
	targetDate = new Date(startDate)
	while (targetDate <= endDate) {
		let year = targetDate.getFullYear()
		let month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let folder = `data/${year}/${month}/${datem}`

		// Files to delete for that day
		let filesToDelete = [
			'resources_7days_aggregated.csv',
			'broadcastings.csv',
		]
		filesToDelete.forEach(f => {
			let fileName = `${folder}/${f}`
			if (fs.existsSync(fileName)) {
				fs.unlinkSync(fileName)
			}
		})

		// Files to delete from the 7-day window
		for (let dateOffset = 0; dateOffset >= -6; dateOffset--) {
			let date2 = new Date(targetDate.getTime());
			date2.setDate(date2.getDate() + dateOffset);
			let year2 = date2.getFullYear()
			let month2 = (1+date2.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			let datem2 = (date2.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
			let folder2 = `data/${year2}/${month2}/${datem2}`
			let filesToDelete = [
				'source_corpus.csv',
				'twitter_handles.csv',
				'twitter_valid_users.csv',
				'resources_cited_by_mps.csv',
				'resources_cited_by_mps_normalized.csv',
				'resources_cited_by_mps_parsed.csv',
				'resources_cited_by_mps_resolved.csv',
			]
			filesToDelete.forEach(f => {
				let fileName = `${folder2}/${f}`
				if (fs.existsSync(fileName)) {
					fs.unlinkSync(fileName)
				}
			})
		}
		targetDate.setDate(targetDate.getDate() + 1)
	}
	console.log("...done.")
}

// Harvest & compute data
targetDate = new Date(startDate)
while (targetDate <= endDate) {
	await retrieveBroadcastings(targetDate)
	targetDate.setDate(targetDate.getDate() + 1)
}

async function retrieveBroadcastings(date) {
	console.log("\n\n# RETRIEVING BROADCASTINGS #####################################")
	console.log("# DATE:", date)

	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let folder = `data/${year}/${month}/${datem}`

	// We will need the resources cited by MPs for that day
	// and the 6 days before. Let's check that we have that for each of them.
	for (let dateOffset = 0; dateOffset >= -6; dateOffset--) {
		let date2 = new Date(date.getTime());
		date2.setDate(date2.getDate() + dateOffset);
		let year2 = date2.getFullYear()
		let month2 = (1+date2.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let datem2 = (date2.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		let folder2 = `data/${year2}/${month2}/${datem2}`

		await getResourcesCitedByMPs(date2)

		let resourcesCitedPath = `${folder2}/resources_cited_by_mps.csv`
		if (fs.existsSync(resourcesCitedPath)) {
			console.log("Resources cited by MPs found.")
		} else {
			await extract_cited_resources(date2)
		}

		let resourcesNormPath = `${folder2}/resources_cited_by_mps_normalized.csv`
		if (fs.existsSync(resourcesNormPath)) {
			console.log("Normalized resources cited by MPs found.")
		} else {
			await normalize_urls(date2)
		}
	}

	let resources7daysPath = `${folder}/resources_7days_aggregated.csv`
	if (fs.existsSync(resources7daysPath)) {
		console.log("Resources aggregated over 7 days found.")
	} else {
		await aggregate_main_resources(date)
	}
	
	let broadcastingsPath = `${folder}/broadcastings.csv`
	if (fs.existsSync(broadcastingsPath)) {
		console.log("Broadcastings file for the day found.")
	} else {
		await get_political_tweets(date, true)
	}

}

async function getResourcesCitedByMPs(date) {
	console.log("\n\n# Retrieving resources cited by MPs for date", date)

	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let folder = `data/${year}/${month}/${datem}`

	// Update the MPs list for that day if necessary
	let handlesPath = `${folder}/twitter_handles.csv`
	if (fs.existsSync(handlesPath)) {
		console.log("Twitter handles found.")
	} else {
		console.log("Twitter handles not found. Updating MP list for that day.")
		// Caveat: we use today's MP list, as we do not know better.
		await update_mp_list(date)
	}

	// Get last MP tweets if necessary
	let validUsersPath = `${folder}/twitter_valid_users.csv`
	if (fs.existsSync(validUsersPath)) {
		console.log("Valid Twitter users (MPs) found.")
	} else {
		console.log("Valid Twitter users (MPs) not found. Updating for that day.")
		// Caveat: we retrieve user IDs from the handles (usernames) as they are today,
		// and not necessarily as they were on that day.
		let handleList = loadHandles(handlesPath)
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
			console.warn('Some handles are invalid (misformed)');		
		}

		if (handleList && handleList.length > 0) {
			let users = await retrieveUserIds(handleList)

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
				console.error('The user data retrieved from Twitter could not be reconciled with the original data', error);
				return {success:false, msg:"The user data retrieved from Twitter could not be reconciled with the original data."}
			}

			console.log('Reconciled user data');

			// Save retrieved user data
			const usersFile = `${folder}/twitter_valid_users.csv`
			const usersCsvString = d3.csvFormat(users)
			try {
				fs.writeFileSync(usersFile, usersCsvString)
				console.log('Valid users file saved successfully');
			} catch(error) {
				console.error('The valid users file could not be saved', error);
				return {success:false, msg:"The valid users file could not be saved."}
			}

	  	// Create the tweets directory if necessary
	  	const tweetsDir = `${folder}/tweets`
	  	if (!fs.existsSync(tweetsDir)){
			  fs.mkdirSync(tweetsDir);
			}

			// For each user, load the day before's tweets
		  for (let i in users) {
		  	const id = users[i].id
		  	const tweetsFile = `${tweetsDir}/${id}.json`
		  	if (fs.existsSync(tweetsFile)) {
		  		console.log(`\tTweets file for user ${id} found.`);
		  	} else {
			  	const tweetData = await getDayBeforesTweets(date, id)
			  	// Save data as JSON
					const tweetsString = JSON.stringify(tweetData)
					try {
						fs.writeFileSync(tweetsFile, tweetsString)
					} catch(error) {
						console.error(`The tweets file for user ${id} could not be saved`, error);
					}
				}
		  }
		  console.log('Tweets of the day before for all valid handles retrieved.');
		} else {
			console.error('No handles to fetch');
			return {success:false, msg:"No handles to fetch."}
		}
	}
}

// Functions
function loadHandles(filePath) {
	try {
		// Load file as string
		const csvString = fs.readFileSync(filePath, "utf8")
		// Parse string
		const data = d3.csvParse(csvString);
		console.log('Handles file loaded');
		return data
	} catch (error) {
		console.error('The handles file could not be loaded', error);
	}
}

async function retrieveUserIds(handleList) {
	console.log('Retrieve Twitter ids from handles');
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
	console.log(`${users.length} users ids retrieved`);
	return users

	async function fetchNextBatch(_result) {
		let result = _result || []
		const batch = batches.shift()
		console.log('Fetch batch of handles');
		try {
			const usernamesLookup = await twitterClient.users.findUsersByUsername({
	      usernames: batch
	    });
	    if (usernamesLookup.errors && usernamesLookup.errors.length > 0) {
	  		console.warn('Some twitter handles could not be found');
	    }
	    if (usernamesLookup.data && usernamesLookup.data.length > 0) {
		    console.log('Batch of handles retrieved');
				result = result.concat(usernamesLookup.data)
			} else {
	  		console.warn('No handles retrieved in this batch');			
			}

	    batchNumber++
	    if (batches.length > 0) {
	    	return fetchNextBatch(result)
	    } else {
	    	return result
	    }
	  } catch(error) {
			console.error('The API call to retrieve ids from handles failed', error);
			return result
	  }
	}
}

async function getDayBeforesTweets(date, id) {
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

	let yesterday = new Date(date.getTime());
	yesterday.setDate(date.getDate() - 1);

	const yyear = yesterday.getFullYear()
	const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})

	// User rate limit: 300 queries per 15 minutes. So we wait the right amount of time to throttle.
	await new Promise(resolve => setTimeout(resolve, 15*60*1000/300))

	const settings = {
		query: `from:${id} -is:reply`,

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

    start_time: `${yyear}-${ymonth}-${ydatem}T00:00:00Z`,
    end_time: `${year}-${month}-${datem}T00:00:00Z`,

    //The maximum number of results
    "max_results": 100,
  }
	try {
    const usersTweets = await twitterClient.tweets.tweetsFullarchiveSearch(
      settings
    );
    if (usersTweets.errors) {
	    console.warn(`\tErrors returned for ${usersTweets.errors.length} tweets that we retrieved for user ${id}`);    	
    }
    if (usersTweets.data) {
	    console.log(`\t${usersTweets.data.length} tweets retrieved for user ${id}`);    	
    } else {
	    console.log(`\tNo tweets retrieved for user ${id}`);
    }
    return usersTweets || {}
  } catch (error) {
    console.error('\tThe API call to retrieve tweets from id failed', error);
		return {}
  }
}