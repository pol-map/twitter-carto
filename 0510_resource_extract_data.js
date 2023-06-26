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

		// TODO: extract text content and media from tweet resources

		// Load index of tweets if any (to not double-do it)
		let newResourcesTwitterExtractedIndex = {}
		const newResourcesTwitterExtracted = `${thisFolder}/resources_newtoday_twitter_enriched.csv`
  	if (fs.existsSync(newResourcesTwitterExtracted)){
			let newResourcesTwitterExtractedArray = loadFile(newResourcesTwitterExtracted, "Resources new today Twitter enriched")
			newResourcesTwitterExtractedArray.forEach(d => {
				if (d.id && d.id.length > 0){
					newResourcesTwitterExtractedIndex[d.id] = d
				}
			})
		}

		// Fetch data for tweet URLs
		for (let i=0; i<newResourcesTwitter.length; i++){
			const r = newResourcesTwitter[i]
			if (r.id && r.id.length>0){
				if (newResourcesTwitterExtractedIndex[r.id]) {
					logger.info(`Tweet ${i+1}/${newResourcesTwitter.length} found.`)
				} else {
					logger.info(`Enrich tweet ${i+1}/${newResourcesTwitter.length}.`)
					const scrapeTweetSettings = ["twitter", "scrape", "tweets", `"url:${r.id}"`, "--limit", "2", "--include-refs"]
					let csvdata
					try {
						csvdata = await minet(scrapeTweetSettings)
					} catch (error) {
						console.log("Error", error)
						logger
							.child({ context: {scrapeTweetSettings, error:((error)?(error.message):("undefined"))} })
							.error(`An error occurred during Minet's scraping of a tweet (${r.id})`);
						return new Promise((resolve, reject) => {
							logger.once('finish', () => resolve({success:false, msg:`An error occurred during Minet's scraping of a tweet.`}));
							logger.end();
						});
					}

					// Extract useful data from the csvdata
					const data = d3.csvParse(csvdata);
					let row = {}
					data.some(d => {
						if (''+d.id == r.id) {
							row = d
							return true
						}
					})
					if (row && row.id) {
						let media = []
						if (row.media_files && row.media_files.length > 0){
							const media_files = (row.media_files||'').split('|')
							const media_urls= (row.media_urls||'').split('|')
							const media_types= (row.media_types||'').split('|')
							media_files.forEach((fileName,i)=>{
								media.push({
									id: fileName,
									type: media_types[i],
									imgurl: media_urls[i],
									img: (checkFilename(fileName))?(fileName):(''),
								})
							})
						}
						newResourcesTwitterExtractedIndex[row.id] = {
							id: row.id,
							text: row.text,
							text_long: `${row.text}`,
							lang: row.lang,
							media_keys: JSON.stringify(media),
							author_username: row.user_screen_name,
							author_name: row.user_name,
							url: row.url
						}
					}
				}
			}
		}
		function checkFilename(fileName){
			if (fileName.indexOf("/")>=0 || fileName.indexOf("\\")>=0) {
				return false
			}
			const lowerCaseFileName = fileName.toLowerCase();
			if (lowerCaseFileName.endsWith('.jpg') || lowerCaseFileName.endsWith('.png')) {
				return true
			}
			return false
		}

		// Save the new Twitter resources file with enrichment
		const resFile_twitter_extracted = `${thisFolder}/resources_newtoday_twitter_enriched.csv`
		const newResourcesTwitterExtractedString = d3.csvFormat(Object.values(newResourcesTwitterExtractedIndex))
		try {
			fs.writeFileSync(resFile_twitter_extracted, newResourcesTwitterExtractedString)
			logger
				.child({ context: {resFile_twitter_extracted} })
				.info('New Twitter resources with text file saved successfully');
		} catch(error) {
			logger
				.child({ context: {resFile_twitter_extracted, error} })
				.error('The new Twitter resources with text file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The new Twitter resources with text file could not be saved.`}));
				logger.end();
			})
		}

		// List media new today
		let mediaIndex = {}
		Object.values(newResourcesTwitterExtractedIndex).forEach(r => {
			JSON.parse(r.media_keys).forEach(media => {
				mediaIndex[media.id] = media
			})
		})

		// Directory to store media images
		const mediaImagesDir = `${thisFolder}/media-images`
		if (!fs.existsSync(mediaImagesDir)){
		  fs.mkdirSync(mediaImagesDir);
		}

		// Fetch meta data from file and download images
		let i = 0
		let imgTotal = Object.values(mediaIndex).length
		for (let id in mediaIndex){
			const media = mediaIndex[id]
			if (media.img && media.img.length > 0) {
				await (async () => {
					try {
						const filePath = `${mediaImagesDir}/${media.img}`
						if (!fs.existsSync(filePath)){
							console.log(`Download image ${i}/${imgTotal}`, filePath)
							const response = await fetch(media.imgurl)
							const buffer = await response.arrayBuffer()
							fs.writeFileSync(filePath, Buffer.from(buffer));
						}
					} catch (error) {
						logger
							.child({ context: {media:media, error} })
							.warn(`The image for media ${media.id} could not be downloaded.`);
					}
				})()
			}

			i++
		}


		// // Save the new media file
		const media_extracted = `${thisFolder}/media_newtoday.csv`
		const newMediaExtractedString = d3.csvFormat(Object.values(mediaIndex))
		try {
			fs.writeFileSync(media_extracted, newMediaExtractedString)
			logger
				.child({ context: {media_extracted} })
				.info('Twitter media new today saved successfully');
		} catch(error) {
			logger
				.child({ context: {media_extracted, error} })
				.error('Twitter media new today could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The Twitter media new today file could not be saved.`}));
				logger.end();
			})
		}

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
		Object.values(newResourcesTwitterExtractedIndex).forEach(res => {
			newResourcesWithTextIndex[res.id] = {
				text: res.text,
				text_long: res.text_long,
				lang: res.lang,
				media_keys: JSON.stringify(JSON.parse(res.media_keys).map(media => media.id)),
				author_username: res.author_username,
				author_name: res.author_name,
				url: res.url
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
