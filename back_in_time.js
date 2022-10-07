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
settings.sdate = "2022-10-01"
settings.edate = "2022-10-06"

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

const twitterClient = new Client(process.env.BEARER_TOKEN);

let targetDate = new Date(startDate)
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
		date2.setDate(date.getDate() + dateOffset);
		await getResourcesCitedByMPs(date2)
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

			// For each user, load the day before's tweets
		  for (let i in users) {
		  	const id = users[i].id
		  	const tweetData = await getDayBeforesTweets(date, id)
		  	// Save data as JSON
		  	const tweetsDir = `${folder}/tweets`
		  	if (!fs.existsSync(tweetsDir)){
				  fs.mkdirSync(tweetsDir);
				}
		  	const tweetsFile = `${tweetsDir}/${id}.json`
				const tweetsString = JSON.stringify(tweetData)
				try {
					fs.writeFileSync(tweetsFile, tweetsString)
				} catch(error) {
					console.error(`The tweets file for user ${id} could not be saved`);
				}
		  }
		  console.log('Tweets of the day before for all valid handles retrieved.');
		} else {
			console.error('No handles to fetch');
			return {success:false, msg:"No handles to fetch."}
		}
	}
}

/*
console.log("\n\n# 01. UPDATE MP LIST #####################################")
update_mp_list(date)
	.then(result => {
		if (result.success) {
			console.info("# UPDATE MP LIST SUCCESSFUL.",result.msg)
		} else {
			console.error("# UPDATE MP LIST FAILED", result.msg)
		}
	}, error => {
		console.error("# UPDATE MP LIST ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 02. GET LAST MP TWEETS #################################")
		return get_last_mp_tweets(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# GET LAST MP TWEETS SUCCESSFUL.",result.msg)
		} else {
			console.error("# GET LAST MP TWEETS FAILED", result.msg)
		}
	}, error => {
		console.error("# GET LAST MP TWEETS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 03. EXTRACT CITED RESOURCES ############################")
		return extract_cited_resources(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# EXTRACT CITED RESOURCES SUCCESSFUL.",result.msg)
		} else {
			console.error("# EXTRACT CITED RESOURCES FAILED", result.msg)
		}
	}, error => {
		console.error("# EXTRACT CITED RESOURCES ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 04. NORMALIZE URLS #####################################")
		return normalize_urls(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# NORMALIZE URLS SUCCESSFUL.",result.msg)
		} else {
			console.error("# NORMALIZE URLS FAILED", result.msg)
		}
	}, error => {
		console.error("# NORMALIZE URLS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 05. AGGREGATE MAIN RESOURCES ###########################")
		return aggregate_main_resources(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# AGGREGATE MAIN RESOURCES SUCCESSFUL.",result.msg)
		} else {
			console.error("# AGGREGATE MAIN RESOURCES FAILED", result.msg)
		}
	}, error => {
		console.error("# AGGREGATE MAIN RESOURCES ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 06. GET POLITICAL TWEETS ###############################")
		return get_political_tweets(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# GET POLITICAL TWEETS SUCCESSFUL.",result.msg)
		} else {
			console.error("# GET POLITICAL TWEETS FAILED", result.msg)
		}
	}, error => {
		console.error("# GET POLITICAL TWEETS ERROR", error)
	})
	
	.then(() => {
		console.log("\n\n# 07. BUILD CORPUS #######################################")
		return build_corpus(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# BUILD CORPUS SUCCESSFUL.",result.msg)
		} else {
			console.error("# BUILD CORPUS FAILED", result.msg)
		}
	}, error => {
		console.error("# BUILD CORPUS ERROR", error)
	})
	
	.then(() => {
		console.log("\n\n# 08. NETWORK ############################################")
		return network(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# NETWORK SUCCESSFUL.",result.msg)
		} else {
			console.error("# NETWORK FAILED", result.msg)
		}
	}, error => {
		console.error("# NETWORK ERROR", error)
	})
	
	.then(() => {
		console.log("\n\n# 09. NETWORK LAYOUT #####################################")
		return network_layout(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# NETWORK LAYOUT SUCCESSFUL.",result.msg)
		} else {
			console.error("# NETWORK LAYOUT FAILED", result.msg)
		}
	}, error => {
		console.error("# NETWORK LAYOUT ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 10. RENDER MAP TWITTER #################################")
		return render_map_twitter(date)
	})
	.then(() => {
		console.info("# RENDER MAP TWITTER DONE.")
	}, error => {
		console.error("# RENDER MAP TWITTER ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 11. RENDER MAP 4k NO LABELS ############################")
		return render_map_4k_no_labels(date)
	})
	.then(() => {
		console.info("# RENDER MAP 4K NO LABELS DONE.")
	}, error => {
		console.error("# RENDER MAP 4K NO LABELS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 12. RENDER MAP 4k TOP LABELS ###########################")
		return render_map_4k_top_labels(date)
	})
	.then(() => {
		console.info("# RENDER MAP 4K TOP LABELS DONE.")
	}, error => {
		console.error("# RENDER MAP 4K TOP LABELS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 13. RENDER MAP LARGE ###################################")
		return render_map_large(date)
	})
	.then(() => {
		console.info("# RENDER MAP LARGE SUCCESSFUL.")
	}, error => {
		console.error("# RENDER MAP LARGE ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 14. RENDER POL HEATMAPS ################################")
		return render_pol_heatmaps(date)
	})
	.then(() => {
		console.info("# RENDER POL HEATMAPS SUCCESSFUL.")
	}, error => {
		console.error("# RENDER POL HEATMAPS ERROR", error)
	})
*/


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