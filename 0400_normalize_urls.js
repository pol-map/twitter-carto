import { getLogger } from "./-get-logger.js"
import * as fs from "fs";
import * as d3 from 'd3';
import dotenv from "dotenv";
import { spawn } from "child_process";

dotenv.config();

export async function normalize_urls(date) {

	const targetDate = ((date === undefined)?(new Date() /*Now*/):(new Date(date)))
	const year = targetDate.getFullYear()
	const month = (1+targetDate.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const datem = (targetDate.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	const thisFolder = `data/${year}/${month}/${datem}`

	// Logger
	const logger = getLogger(`${thisFolder}/0400_normalize_urls.log`)
	logger.level = "info"
	logger.info('***** RUN SCRIPT ****');

	async function main() {
		const resFile = `${thisFolder}/resources_cited_by_mps.csv`
		const resFile_resolved = `${thisFolder}/resources_cited_by_mps_resolved.csv`
		// We need to delete the output file if it exists because Minet's recovery mode is activated
		if (fs.existsSync(resFile_resolved)){
			fs.unlinkSync(resFile_resolved);
		}
		// First, we resolve the URL redirections (using Minet)
		const resolveSettings = ["resolve", "resource_url", "-i", resFile, "-o", resFile_resolved, "--throttle", "3.0", "--resume"]
		let retries = 10
		while (retries>0) {
			retries--
			try {
				await minet(resolveSettings)
				retries = 0
			} catch (error) {
				if (retries>0) {
					logger
						.warn('Minet crashed, but that happens in this context. Retries left: '+retries);
				} else {
					console.log("Error", error)
					logger
						.child({ context: {error:error?error.message:"unknown"} })
						.error('An error occurred during the resolving of resources URLs');
					return new Promise((resolve, reject) => {
						logger.once('finish', () => resolve({success:false, msg:`An error occurred during the resolving of resources URLs.`}));
						logger.end();
					});
				}
			}
		}

		// Second, we parse the resolved URLs (to normalize them)
		const resFile_parsed = `${thisFolder}/resources_cited_by_mps_parsed.csv`
		const parsedSettings = ["url-parse", "resolved_url", "-i", resFile_resolved, "-o", resFile_parsed]
		let parsedDataString
		try {
			await minet(parsedSettings)
		} catch (error) {
			console.log("Error", error)
			logger
				.child({ context: {parsedSettings, error:error?error.message:"unknown"} })
				.error('An error occurred during Minet\'s parsing of resources URLs');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`An error occurred during Minet's parsing of resources URLs.`}));
				logger.end();
		  });
		}

		// Third, we load the file, we slightly clean and normalize it, and we re-save it
		let resourcesAfterMinet = loadResources(resFile_parsed);
		logger
			.child({ context: {resourcesAfterMinet} })
			.debug('Resources after Minet processing');
		let resourcesNormalized = resourcesAfterMinet.map(d => {
			delete d.index
			delete d.resolved_url
			delete d.status
			delete d.error
			delete d.redirects
			d.url_resolve_chain = d.chain
			d.normalized_url = d.normalized_url || d.resource_url
			delete d.inferred_redirection
			delete d.hostname
			d.normalized_url_host = d.normalized_hostname
			delete d.probably_shortened
			delete d.probably_typo
			delete d.fetch_original_index
			delete d.chain
			delete d.http_status
			delete d.resolution_error
			delete d.redirect_count
			delete d.redirect_chain
			delete d.shortened
			delete d.typo
			delete d.homepage
			delete d.should_resolve
			delete d.url_resolve_chain
			delete d.normalized_hostname
			return d
		})
		logger
			.child({ context: {resourcesNormalized} })
			.debug('Normalized resources');
		logger
			.info('Resources normalized (cleaned of unnecessary Minet stuff)');
		// Save normalized resources list as CSV
		const resFile_norm = `${thisFolder}/resources_cited_by_mps_normalized.csv`
		// Format filtered data as a string
		const resCsvString_norm = d3.csvFormat(resourcesNormalized)
		// Write clean file
		try {
			fs.writeFileSync(resFile_norm, resCsvString_norm)
			logger
				.child({ context: {resFile_norm} })
				.info('Normalized resources file saved successfully');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`${resourcesNormalized.length} resources normalized and saved successfully.`}));
				logger.end();
			})
		} catch(error) {
			logger
				.child({ context: {resFile_norm, error} })
				.error('The normalized resources file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The normalized resources file could not be saved.`}));
				logger.end();
			})
		}

		console.log("Done.")
	}

	return main();

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
