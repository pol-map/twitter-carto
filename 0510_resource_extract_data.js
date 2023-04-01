import { getLogger } from "./-get-logger.js"
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import { spawn } from "child_process";
import fetch from 'node-fetch';

dotenv.config();

export async function resource_extract_data(date) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	const logger = getLogger(`${thisFolder}/0510_resource_extract_data.log`)
	logger.level = "info"
	logger.info('***** RUN SCRIPT ****');

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
		const resFile_agg_Y = `${yesterdaysFolder}/resources_7days_aggregated_text.csv`
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
		logger
			.child({ context: {resources, newResources, resourcesOld} })
			.debug(`${resources.length} resources for today, ${newResources.length} new ones, ${Object.values(resourcesOld).length} old.`);
		logger
			.info(`Of today's ${resources.length} resources, ${newResources.length} are new.`);

		// Save the new Twitter resources
		let newResourcesTwitter = newResources.filter(r => r.type == "tweet")
		const resFile_twitter = `${thisFolder}/resources_newtoday_twitter.csv`
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
		const resFile_URL = `${thisFolder}/resources_newtoday_URL.csv`
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

		// // Extract the text content from Twitter resources
  	// const tweetsDir = `${thisFolder}/tweetsData`
  	// if (!fs.existsSync(tweetsDir)){
		//   fs.mkdirSync(tweetsDir);
		// }
  	// const mediaDir = `${thisFolder}/media`
		// if (!fs.existsSync(mediaDir)){
		//   fs.mkdirSync(mediaDir);
		// }
  	// const usersDir = `${thisFolder}/usersData`
		// if (!fs.existsSync(usersDir)){
		//   fs.mkdirSync(usersDir);
		// }
  	// let newResourcesTwitterFetched = []
		// let batches = []
		// let currentBatch = []
		// newResourcesTwitter.forEach(r => {
		// 	// Check if the tweet's content is already there
		// 	let fileName = `${tweetsDir}/${r.id}.json`
		// 	let tweetsResponse = undefined
		// 	if (fs.existsSync(fileName)){
		// 		// The data has been previously downloaded: load it.
		// 		let tweetsResponseRaw
		// 		try {
		// 			tweetsResponseRaw = fs.readFileSync(fileName);
		// 		} catch (error) {
		// 			console.log("Error", error)
		// 			logger
		// 				.child({ context: {res, page, fileName, error:error.message} })
		// 				.error(`JSON file read error. The data could not be recovered.`);
		// 			return new Promise((resolve, reject) => {
		// 				logger.once('finish', () => resolve({success:false, msg:`JSON file read error. The data could not be recovered.`}));
		// 				logger.end();
		// 		  });
		// 		}
		// 		if (tweetsResponseRaw) {
		// 			try {
		// 		  	tweetsResponse = JSON.parse(tweetsResponseRaw);
		// 		  	logger
		// 		  		.child({ context: {r, fileName, tweetsResponse} })
		// 					.trace(`Tweets data response retrieved from local cache ${fileName}`);
		// 	  	} catch (error) {
		// 				console.log("Error", error)
		// 				logger
		// 					.child({ context: {r, fileName, tweetsResponseRaw, error:error.message} })
		// 					.error(`JSON file cannot be parsed. The data could not be recovered.`);
		// 				tweetsResponse = undefined
		// 			}
		// 		}
		// 	}
		// 	// If the file does not exist or failed, query Twitter.
		// 	if (tweetsResponse === undefined) {
		// 		// Add the tweet to the batch of tweets to retrieve
		// 		currentBatch.push(r.id)
		// 		if (currentBatch.length >= 100) {
		// 			batches.push(currentBatch)
		// 			currentBatch = []
		// 		}
		// 	} else {
		// 		// Add the retrieved data to the list
		// 		newResourcesTwitterFetched.push(tweetsResponse)
		// 	}
		// })
		// if (currentBatch.length > 0) {
		// 	batches.push(currentBatch)
		// }
		// logger
		// 	.info(`${batches.length} batches built for ${newResourcesTwitter.length} resources (${newResourcesTwitterFetched.length} already downloaded).`);
		//
		// if (batches.length > 0) {
		// 	for (let b in batches) {
		// 		const batch = batches[b]
		// 		const settings = {
		// 			"ids": batch.join(","),
		// 			"expansions":[
		// 				"attachments.poll_ids",
		// 				"attachments.media_keys",
		// 				"author_id",
		// 				"edit_history_tweet_ids",
		// 				"entities.mentions.username",
		// 				"geo.place_id",
		// 				"in_reply_to_user_id",
		// 				"referenced_tweets.id",
		// 				"referenced_tweets.id.author_id",
		// 			],
		// 			"media.fields":[
		// 				"duration_ms",
		// 				"media_key",
		// 				"preview_image_url",
		// 				"type",
		// 				"url",
		// 				"alt_text",
		// 				"variants",
		// 			],
		// 			"tweet.fields": [
		// 				"attachments",
		// 	      "author_id",
		// 	      "context_annotations",
		// 	      "conversation_id",
		// 	      "created_at",
		// 	      "entities",
		// 	      "id",
		// 	      "in_reply_to_user_id",
		// 	      "lang",
		// 	      "possibly_sensitive",
		// 	      "referenced_tweets",
		// 	      "reply_settings",
		// 	      "source",
		// 	      "text",
		// 	      "withheld",
		// 	    ],
		// 			"user.fields":[
		// 				"id",
		// 				"name",
		// 				"username",
		// 			],
		// 	  }
		// 		let tweetsFetched = await getTweets(settings)
		// 		// Save each tweet's content
		// 		for (let t in tweetsFetched.data) {
		// 			const tweet = tweetsFetched.data[t]
		// 			newResourcesTwitterFetched.push(tweet)
		// 			// Save
		// 			const fileName = `${tweetsDir}/${tweet.id}.json`
		// 			const tweetString = JSON.stringify(tweet)
		// 			try {
		// 				fs.writeFileSync(fileName, tweetString)
		// 			  logger
		// 					.child({ tweet:tweet })
		// 					.debug(`The tweeting file for tweet ${tweet.id} was saved successfully`);
		// 			} catch(error) {
		// 				logger
		// 					.child({ tweet:tweet })
		// 					.error(`The tweeting file for tweet ${tweet.id} could not be saved`);						
		// 			}
		// 		}
		// 		// Save the data about each media
		// 		if (tweetsFetched.includes && tweetsFetched.includes.media) {
		// 			for (let i in tweetsFetched.includes.media) {
		// 				const media = tweetsFetched.includes.media[i]
		// 				// Save
		// 				const fileName = `${mediaDir}/${media.media_key}.json`
		// 				const mediaString = JSON.stringify(media)
		// 				try {
		// 					fs.writeFileSync(fileName, mediaString)
		// 				  logger
		// 						.child({ media:media })
		// 						.debug(`The file for media ${media.media_key} was saved successfully`);
		// 				} catch(error) {
		// 					logger
		// 						.child({ media:media })
		// 						.error(`The file for media ${media.media_key} could not be saved`);						
		// 				}
		// 			}
		// 		}
		// 	}
		// }

		// /// Retrieve tweet-resource author information
		// // Compile authors
		// let authorIndex = {}
		// newResourcesTwitterFetched.forEach(r => {
		// 	authorIndex[r.author_id] = true
		// })
		// const authorIds = Object.keys(authorIndex)
		// // Build author batches
		// batches = []
		// currentBatch = []
		// let newUsersFetched = []
		// authorIds.forEach(uId => {
		// 	let fileName = `${usersDir}/${uId}.json`
		// 	let usersResponse = undefined
		// 	if (fs.existsSync(fileName)){
		// 		// The data has been previously downloaded: load it.
		// 		let usersResponseRaw
		// 		try {
		// 			usersResponseRaw = fs.readFileSync(fileName);
		// 		} catch (error) {
		// 			console.log("Error", error)
		// 			logger
		// 				.child({ context: {res, page, fileName, error:error.message} })
		// 				.error(`JSON file read error. The data could not be recovered for ${fileName}.`);
		// 			return new Promise((resolve, reject) => {
		// 				logger.once('finish', () => resolve({success:false, msg:`JSON file read error. The data could not be recovered.`}));
		// 				logger.end();
		// 		  });
		// 		}
		// 		if (usersResponseRaw) {
		// 			try {
		// 		  	usersResponse = JSON.parse(usersResponseRaw);
		// 		  	logger
		// 		  		.child({ context: {uId, fileName, usersResponse} })
		// 					.trace(`Users data response retrieved from local cache ${fileName}.`);
		// 	  	} catch (error) {
		// 				console.log("Error", error)
		// 				logger
		// 					.child({ context: {r, fileName, usersResponseRaw, error:error.message} })
		// 					.error(`JSON file cannot be parsed. The data could not be recovered for ${fileName}.`);
		// 				usersResponse = undefined
		// 			}
		// 		}
		// 	}
		// 	// If the file does not exist or failed, query Twitter.
		// 	if (usersResponse === undefined) {
		// 		// Add the tweet to the batch of tweets to retrieve
		// 		currentBatch.push(uId)
		// 		if (currentBatch.length >= 100) {
		// 			batches.push(currentBatch)
		// 			currentBatch = []
		// 		}
		// 	} else {
		// 		// Add the retrieved data to the list
		// 		newUsersFetched.push(usersResponse)
		// 	}
		// })
		// if (currentBatch.length > 0) {
		// 	batches.push(currentBatch)
		// }
		// logger
		// 	.info(`${batches.length} batches built for ${authorIds.length} users (${newUsersFetched.length} already downloaded).`);
		// // Query API
		// if (batches.length > 0) {
		// 	for (let b in batches) {
		// 		const batch = batches[b]
		// 		const settings = {
		// 			"ids": batch.join(","),
		// 			"user.fields":[
		// 				"created_at",
		// 				"description",
		// 				"entities",
		// 				"id",
		// 				"location",
		// 				"name",
		// 				"pinned_tweet_id",
		// 				"profile_image_url",
		// 				"protected",
		// 				"public_metrics",
		// 				"url",
		// 				"username",
		// 				"verified",
		// 				"withheld",
		// 			],
		// 			"tweet.fields": [
		// 				"attachments",
		// 	      "author_id",
		// 	      "context_annotations",
		// 	      "conversation_id",
		// 	      "created_at",
		// 	      "entities",
		// 	      "geo",
		// 	      "id",
		// 	      "in_reply_to_user_id",
		// 	      "lang",
		// 	      "possibly_sensitive",
		// 	      "referenced_tweets",
		// 	      "reply_settings",
		// 	      "source",
		// 	      "text",
		// 	      "withheld",
		// 	    ],
		// 	  }
		// 		let usersFetched = await getUsers(settings)
		// 		// Save each user's content
		// 		for (let u in usersFetched.data) {
		// 			const user = usersFetched.data[u]
		// 			newUsersFetched.push(user)
		// 			// Save
		// 			const fileName = `${usersDir}/${user.id}.json`
		// 			const userString = JSON.stringify(user)
		// 			try {
		// 				fs.writeFileSync(fileName, userString)
		// 			  logger
		// 					.child({ user:user })
		// 					.debug(`The file for user ${user.id} was saved successfully`);
		// 			} catch(error) {
		// 				logger
		// 					.child({ user:user })
		// 					.error(`The file for user ${user.id} could not be saved`);	
		// 			}
		// 		}
		// 	}
		// }
		// // Build user index
		// let userIndex = {}
		// newUsersFetched.forEach(u => {
		// 	userIndex[u.id] = u
		// })

		// // Aggregate with existing resources
		// let newResourcesTwitterFetchedIndex = {}
		// newResourcesTwitterFetched.forEach(r => {
		// 	newResourcesTwitterFetchedIndex[r.id] = r
		// })
		// let newResourcesTwitterExtracted = newResourcesTwitter.map(r => {
		// 	let r2 = newResourcesTwitterFetchedIndex[r.id]
		// 	if (r2 === undefined) {
		// 		logger
		// 			.warn(`Aggregation error: new twitter resource ${r.id} could not be found in fetched resources index.`);
		// 		return r
		// 	} else {
		// 		let result = {...r}
		// 		result.text = r2.text
		// 		result.lang = r2.lang
		// 		result.author_id = r2.author_id
		// 		let user = userIndex[result.author_id]
		// 		if (user) {
		// 			result.author_username = user.username
		// 			result.author_name = user.name
		// 		} else {
		// 			logger
		// 				.error(`User ${result.author_id} not found in the index. It should be there by design.`);						
		// 		}
		// 		if (r2.attachments && r2.attachments.media_keys) {
		// 			result.media_keys = JSON.stringify(r2.attachments.media_keys)
		// 		}
		// 		return result
		// 	}
		// })

		// // Save the new Twitter resources file with enrichment
		// const resFile_twitter_extracted = `${thisFolder}/resources_newtoday_twitter_enriched.csv`
		// const newResourcesTwitterExtractedString = d3.csvFormat(newResourcesTwitterExtracted)
		// try {
		// 	fs.writeFileSync(resFile_twitter_extracted, newResourcesTwitterExtractedString)
		// 	logger
		// 		.child({ context: {resFile_twitter_extracted} })
		// 		.info('New Twitter resources with text file saved successfully');
		// } catch(error) {
		// 	logger
		// 		.child({ context: {resFile_twitter_extracted, error} })
		// 		.error('The new Twitter resources with text file could not be saved');
		// 	return new Promise((resolve, reject) => {
		// 		logger.once('finish', () => resolve({success:false, msg:`The new Twitter resources with text file could not be saved.`}));
		// 		logger.end();
		// 	})
		// }

		// // List media new today
		// let mediaIndex = {}
		// Object.values(newResourcesTwitterFetchedIndex).forEach(r => {
		// 	if (r.attachments && r.attachments.media_keys) {
		// 		r.attachments.media_keys.forEach(k => {
		// 			mediaIndex[k] = true
		// 		})
		// 	}
		// })

		// // Directory to store media images
		// const mediaImagesDir = `${thisFolder}/media-images`
		// if (!fs.existsSync(mediaImagesDir)){
		//   fs.mkdirSync(mediaImagesDir);
		// }

		// // Fetch meta data from file and download images
		// let i = 0
		// let imgTotal = Object.values(mediaIndex).length
		// for (let k in mediaIndex){
		// 	// Load
		// 	let dataString
		// 	try {
		// 		dataString = fs.readFileSync(`${mediaDir}/${k}.json`, "utf8")
		// 	} catch (error) {
		// 		logger
		// 			.child({ context: {media_key:k, error} })
		// 			.warn(`ERROR: The file for media ${k} could not be loaded.`);
		// 	}

		// 	// Parse
		// 	let data
		// 	if (dataString) {
		// 		try {
		// 			data = JSON.parse(dataString)
		// 		} catch (error) {
		// 			logger
		// 				.child({ context: {media_key:k, error} })
		// 				.warn(`ERROR: The data for media ${k} could not be parsed.`);
		// 		}
		// 	}

		// 	// Analyze and flatten
		// 	// Goal: media can be different things,
		// 	// but above all we want the URL with an image.
		// 	// And we download it.
		// 	let media = {id: k}
		// 	media.type = data.type
		// 	if (data.type == 'video') {
		// 		media.imgurl = data.preview_image_url
		// 		media.duration_ms = data.duration_ms
		// 		media.variants = JSON.stringify(data.variants)
		// 	} else if (data.type == "photo") {
		// 		media.imgurl = data.url
		// 		media.alt_text = data.alt_text || ""
		// 	}

		// 	if (media.imgurl) {
		// 		await (async () => {
		// 			try {
		// 				const fileFormat = media.imgurl.split('.').pop().toLowerCase()
		// 				if (fileFormat == "jpg" || fileFormat == "png") {
		// 					const fileName = `${k}.${fileFormat}`
		// 					const filePath = `${mediaImagesDir}/${fileName}`
		// 					if (!fs.existsSync(filePath)){
		// 						console.log(`Download image ${i}/${imgTotal}`, filePath)
		// 						const response = await fetch(media.imgurl)
		// 					  const buffer = await response.arrayBuffer()
		// 					  fs.writeFileSync(filePath, Buffer.from(buffer));
		// 					}
		// 					media.img = fileName
		// 				}
		// 			} catch (error) {
		// 				logger
		// 					.child({ context: {media:media, error} })
		// 					.warn(`The image for media ${k} could not be downloaded.`);
		// 			}
		// 		})()
		// 	}

		// 	// Index
		// 	mediaIndex[k] = media

		// 	i++
		// }

		// // Save the new media file
		// const media_extracted = `${thisFolder}/media_newtoday.csv`
		// const newMediaExtractedString = d3.csvFormat(Object.values(mediaIndex))
		// try {
		// 	fs.writeFileSync(media_extracted, newMediaExtractedString)
		// 	logger
		// 		.child({ context: {media_extracted} })
		// 		.info('Twitter media new today saved successfully');
		// } catch(error) {
		// 	logger
		// 		.child({ context: {media_extracted, error} })
		// 		.error('Twitter media new today could not be saved');
		// 	return new Promise((resolve, reject) => {
		// 		logger.once('finish', () => resolve({success:false, msg:`The Twitter media new today file could not be saved.`}));
		// 		logger.end();
		// 	})
		// }

		// Fetch the text content from URL resources
		const resFile_URL_fetched = `${thisFolder}/resources_newtoday_URL_fetched.csv`
		const fetchUrlSettings = ["fetch", "url", "-i", resFile_URL, "-o", resFile_URL_fetched]
		try {
			await minet(fetchUrlSettings)
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
		// Extract the text content from URL resources
		const resFile_URL_extracted = `${thisFolder}/resources_newtoday_URL_text.csv`
		const textExtractUrlSettings = ["extract", "-i", resFile_URL_fetched, "-I", "downloaded", "-o", resFile_URL_extracted]
		try {
			await minet(textExtractUrlSettings)
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

		// Load Minet result
		let newResourcesUrlExtracted = loadFile(resFile_URL_extracted, "new URL resources with text");
		// Aggregate new extracted information
		let newResourcesWithTextIndex = {}
		// From URLs
		newResourcesUrlExtracted.forEach(res => {
			newResourcesWithTextIndex[res.id] = {
				text: `${res.title?(res.title+". "):""}${res.description||""}`,
				text_long: `${res.title?(res.title+". \n"):""}${res.description?(res.description+". \n"):""}${res.raw_content||""}`,
			}
		})
		// From Twitter
		// newResourcesTwitterExtracted.forEach(res => {
		// 	newResourcesWithTextIndex[res.id] = {
		// 		text: res.text,
		// 		text_long: `${res.text}`,
		// 		lang: res.lang,
		// 		media_keys: res.media_keys,
		// 		author_username: res.author_username,
		// 		author_name: res.author_name,
		// 		url: `https://twitter.com/${res.author_username}/status/${res.id}`, // We rewrite the URL with fetched username
		// 	}
		// })
		newResourcesTwitter.forEach(res => {
			newResourcesWithTextIndex[res.id] = {
				text: res.text||"",
				text_long: `${res.text||""}`,
				lang: res.lang,
				media_keys: res.media_keys,
				author_username: res.author_username,
				author_name: res.author_name,
				url: `https://twitter.com/${res.author_username}/status/${res.id}`, // We rewrite the URL with fetched username
			}
		})
		// Save the resources with text content
		let resourcesWithText = resources.map(res => {
			let r2 = newResourcesWithTextIndex[res.id]
			if (r2===undefined) {
				return res
			} else {
				return {...res, ...r2}
			}
		})
		const resFile_aggregated_withText = `${thisFolder}/resources_7days_aggregated_text.csv`
		const resourcesWithTextString = d3.csvFormat(resourcesWithText)
		try {
			fs.writeFileSync(resFile_aggregated_withText, resourcesWithTextString)
			logger
				.info(`Aggregated resources with text file saved successfully (${resourcesWithText.length} rows).`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`${resourcesWithText.length} with text saved successfully.`}));
				logger.end();
			})
		} catch(error) {
			logger
				.child({ context: {resourcesWithTextString, error} })
				.error('Aggregated resources with text file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The aggregated resources with text could not be saved.`}));
				logger.end();
			})
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
					.info(`${tweets.data.length} tweets retrieved.`);
	    } else {
		    logger
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

	async function getUsers(settings) {
		// Rate limit: 300 queries per 15 minutes. So we wait the right amount of time to throttle.
		await new Promise(resolve => setTimeout(resolve, 15*60*1000/300))

		try {
	    let users
    	users = await twitterClient.users.findUsersById(settings);

	    if (users.errors) {
		    logger
		  		.child({ context: {settings} })
					.warn(`Errors returned for ${users.errors.length} users.`);    	
	    }
	    if (users.data) {
		    logger
					.info(`${users.data.length} users retrieved.`);
	    } else {
		    logger
					.warn(`No users retrieved.`);
	    }
	    logger
	  		.child({ context: {settings, users} })
				.trace(`Users data response retrieved.`);
	    return users || {}
	  } catch (error) {
	    console.log("Error", error)
			logger
				.child({ context: {settings, error:error.message} })
				.error('The API call to retrieve users failed.');
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
	      console.log("Exec: minet", opts.join(" "));
	      const minet = spawn(process.env.MINET_BINARIES, opts);
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
