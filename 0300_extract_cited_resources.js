import { getLogger } from "./-get-logger.js"
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
	const logger = getLogger(`${thisFolder}/0300_extract_cited_resources.log`)
	logger.level = "info"
	logger.info('***** RUN SCRIPT ****');

	async function main() {
		const mpTweetsFile = `${thisFolder}/yesterdays_mp_tweets.csv`
		let mpTweets = loadMpTweets(mpTweetsFile)
		logger
			.child({ context: {mpTweets} })
			.debug('MP Tweets from yesterday');
		try {
			// Extract resources
			/*
				What we consider a resource cited by a tweet:
				* What the API defines as "referenced tweets", which consists of
					* The retweeted tweet
					* Mentioned tweets (quoted)
				* What the API defines as "entities" when it is:
					* A URL -> can be a doublon with a referenced tweet
					* A media, like a photo or video (then defined as its Twitter URL)
			*/
			// const tweetsDir = `${thisFolder}/tweets`
			const resources = []
			for (let i = 0; i < mpTweets.length; i++) {
				let t = mpTweets[i]
				try {
					// Referenced tweets
					let citedTweets = {}
					if (t.retweeted_id) {
						citedTweets[t.retweeted_id] = true
					}
					if (t.quoted_id) {
						citedTweets[t.quoted_id] = true
					}

					// URLs
					let urls = {}
					if (t.links) {
						t.links.split("|").forEach(url => {
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
					// if (t.media_urls) {
					// 	t.media_urls.split("|").forEach(url => {
					// 		urls[url] = true
					// 	})
					// }

					// Register resources
					Object.keys(citedTweets).forEach(ct => {
						resources.push({
							user_handle: t.user_screen_name,
							user_id: t.user_id,
							tweet_id: t.id,
							tweet_created_at: t.local_time,
							resource_type:'tweet',
							resource_id:ct,
							resource_url:(citedTweets[ct]===true)?(''):(citedTweets[ct]),
						})
					})
					Object.keys(urls).forEach(url => {
						resources.push({
							user_handle: t.user_screen_name,
							user_id: t.user_id,
							tweet_id: t.id,
							tweet_created_at: t.local_time,
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

	function loadMpTweets(filePath) {
		try {
			// Load file as string
			const csvString = fs.readFileSync(filePath, "utf8")
			// Parse string
			const data = d3.csvParse(csvString);
			logger
				.child({ context: {filePath} })
				.info('MP Tweets file loaded');
			return data
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {filePath, error:error.message} })
				.error('The MP Tweets file could not be loaded');
		}
	}

}
