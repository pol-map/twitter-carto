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

	const logLevel = "info"

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

		// TODO:
		// Extract the text content from Twitter resources

		// TODO:
		// Fetch the text content from URL resources
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
		}


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