import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import { spawn } from "child_process";
import { Language } from 'node-nlp'
import tokenizer from 'wink-tokenizer'
import paragraphs from 'talisman/tokenizers/paragraphs/index.js'
import sentences from 'talisman/tokenizers/sentences/index.js'
import * as rakejs from '@shopping24/rake-js'

dotenv.config();

export async function resource_extract_expressions(date) {

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
	  	new transports.File({ filename: `${thisFolder}/05C_resource_extract_expressions.log` })
	  ],
	});

	logger.info('***** RUN SCRIPT ****');
	console.log("Log level is", logLevel)
	logger.info('Log level is '+logLevel);

	const twitterClient = new Client(process.env.BEARER_TOKEN);

	// Some settings
	const minExpressionLength = 2

	async function main() {
		// We'll need yesterday's folder
		let yesterday = new Date(targetDate.getTime());
		yesterday.setDate(targetDate.getDate() - 1);
		const yyear = yesterday.getFullYear()
		const ymonth = (1+yesterday.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const ydatem = (yesterday.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
		const yesterdaysFolder = `data/${yyear}/${ymonth}/${ydatem}`

		// Load resources with text
		const resFile_agg = `${thisFolder}/resources_7days_aggregated_text.csv`
		let resources = loadFile(resFile_agg, 'resources')

		// Load stop words in multiple languages
		// (adapted from https://raw.githubusercontent.com/vgrabovets/multi_rake/master/multi_rake/stopwords.py )
		let stopwords = {}
    try {
      // Load affiliations file as string
			const stopwordsJson = fs.readFileSync('stopwords-all.json', "utf8")
      
      try {
        stopwords = JSON.parse(stopwordsJson)
        logger
					.info(`Stop words loaded and parsed`);
      } catch (error) {
        logger
					.child({ context: {error, stopwordsJson} })
					.error(`Error: the stop words could not be parsed.`);
      }
    } catch (error) {
      logger
				.child({ context: {error} })
				.error(`Error: the stop words could not be loaded.`);
    }

		// Load articles in multiple languages
		let articles = {}
    try {
      // Load affiliations file as string
			const articlesJson = fs.readFileSync('articles-all.json', "utf8")
      
      try {
        articles = JSON.parse(articlesJson)
        logger
					.info(`Articles loaded and parsed`);
      } catch (error) {
        logger
					.child({ context: {error, articlesJson} })
					.error(`Error: the articles could not be parsed.`);
      }
    } catch (error) {
      logger
				.child({ context: {error} })
				.error(`Error: the articles could not be loaded.`);
    }
		
		// Extract expressions
		let expressions, expressionsKept
		try {
			let expIndex = {}
			resources.forEach(res => {
				let lang = res.lang
				if (lang && lang.length<2) {
					lang = undefined
				}
				let expressions
				try {
					expressions = extractExpressions(stopwords, articles, res.text_long, lang)
				} catch(error) {
					console.log("Error", error)
					logger
						.child({ context: {res, error:error.message} })
						.error(`Expressions could not be extracted for resource ${res.id}`);
					expressions = {}
				}
				for (let exp in expressions) {
					let score = expressions[exp]
					let expObj = expIndex[exp] || {exp:exp, score:0, count:0}
					expObj.score += score
					expObj.count += 1
					expIndex[exp] = expObj
				}
				res.raked_exp = Object.keys(expressions)
			})
			expressions = Object.values(expIndex)
			expressions.sort(function(a,b){ return b.score-a.score })
			
			// Estimate coverage
			let countDistribution = []
			resources.forEach(res => {
				let maxCount = d3.max(res.raked_exp.map(exp => expIndex[exp].count)) || 0
				countDistribution[maxCount] = (countDistribution[maxCount] || 0) + 1
			})
			let threshold
			let target = 0.9 * resources.length // We want to keep expressions covering 90% of the corpus
			let coverage = 0
			for (let i=countDistribution.length-1; i>=0; i--){
				coverage += countDistribution[i] || 0
				threshold = i
				if (coverage >= target) {
					break
				}
			}

			// Keep the expressions above the threshold
			resources.forEach(res => {
				res.covering_exp = res.raked_exp.filter(exp => expIndex[exp].count >= threshold)
			})
			expressionsKept = expressions.filter(e => e.count >= threshold)
		} catch(error) {
			console.log("Error", error)
			logger
				.child({ context: {error:error.message} })
				.error(`ERROR during the extraction of expressions.`);
		}

		/*
		// Search for each of those expressions in the long text of each resource,
		// but only if they are long enough, because the small ones can so easily
		// be there for other reasons.
		const lengthThreshold = 10
		resources.forEach(res => {
			let text = (res.text_long || "").toLowerCase()
			let expressions = {}
			res.covering_exp.forEach(exp => {
				expressions[exp] = true
			})
			expressionsKept.forEach(e => {
				if (e.exp.length >= lengthThreshold && text.indexOf(e.exp.toLowerCase()) >= 0 ){
					expressions[e.exp] = true
				}
			})
			res.main_exp = Object.keys(expressions)
		})
		*/

		let resourcesWithExpressions = resources.map(res => {
			res.raked_exp = JSON.stringify(res.raked_exp)
			res.covering_exp = JSON.stringify(res.covering_exp)
			return res
		})

		const resFile_aggregated_withExpressions = `${thisFolder}/resources_7days_aggregated_expressions.csv`
		const resourcesWithExpressionsString = d3.csvFormat(resourcesWithExpressions)
		try {
			fs.writeFileSync(resFile_aggregated_withExpressions, resourcesWithExpressionsString)
			logger
				.info(`Aggregated resources with expressions extracted file saved successfully (${resourcesWithExpressions.length} rows).`);
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:true, msg:`${resourcesWithExpressions.length} with expressions extracted saved successfully.`}));
				logger.end();
			})
		} catch(error) {
			logger
				.child({ context: {resourcesWithExpressionsString, error} })
				.error('Aggregated resources with expressions extracted file could not be saved');
			return new Promise((resolve, reject) => {
				logger.once('finish', () => resolve({success:false, msg:`The aggregated resources with expressions extracted could not be saved.`}));
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

	function extractExpressions(stopwords, articles, text, lang) {

		if (lang === undefined) {
			// Language detection from NLP.js
			const language = new Language();
		  const guess = language.guess(text);
		  lang = guess[0].alpha2
		}

	  const swList = stopwords[lang] || []
	  const aList = articles[lang] || []

	  if (lang == "" || lang == "und") {
	  	logger
				.child({ context: {text} })
				.debug(`No language could be detected for that text.`);
	  } else {
		  if (swList.length == 0) {
		  	logger
					.warn(`Stop words list not found for language ${lang}`);
		  }
		  if (aList.length == 0) {
		  	logger
					.warn(`Article words list not found for language ${lang}`);
		  }
		}

	  // Tokenize into sentences with Talisman.js
	  const paragraphList = paragraphs(text)
	  let sentenceList = []
	  paragraphList.forEach(p => {
	  	sentences(p).forEach(s => {
	  		sentenceList.push(s)
	  	})
	  })

  	// We will tokenize with Wink.js
	  let multilingualTokenizer = tokenizer();

	  // Process the sentences
	  let expressions = {}
	  sentenceList.forEach((s,i) => {
	  	// Tokens include word, punctuation, email, mention, hashtag, emoticon, and emoji etc.
		  let tokens = multilingualTokenizer.tokenize(s);
		  // What we want to do, here, is to replace the tokens that are neither words nor punctuation
		  // by neutral markers that will not disrupt RAKE, or just remove them.
		  let replacements = {}
		  let s2 = ''+s
		  tokens
		  	.forEach((t,i) => {
		  		if (t.tag == "url") {
		  			s2 = s2.replace(t.value, " ")
		  		} else if (t.tag != "word" && t.tag != "punctuation") {
		  			let formattedNumber = i.toLocaleString('en-US', {
					    minimumIntegerDigits: 6,
					    useGrouping: false
					  })
		  			const k = `TOKEN${formattedNumber}`
		  			replacements[k] = t
		  			s2 = s2.replace(t.value, k+" ")
		  		}
		  	})
	
		  // Find keyphrases with RAKE
		  const { result } = rakejs.extract(s2)
		  	.setOptions({ articles: aList, stopWords: swList })
				.pipe(rakejs.extractKeyPhrases)
				// .pipe(rakejs.extractAdjoinedKeyPhrases)
				.pipe(rakejs.keywordLengthFilter)
				.pipe(rakejs.distinct)
				.pipe(rakejs.scoreWordFrequency)
				.pipe(rakejs.sortByScore);

			// Get the weird stuff back in
			result.forEach(d => {
				for (let k in replacements) {
					d.phrase = d.phrase.replace(k, replacements[k].value)
				}
				if (d.phrase.length >= minExpressionLength) {
					expressions[d.phrase] = (expressions[d.phrase] || 0) + d.score
				}
			})
	  })
	  return expressions
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
	resource_extract_expressions(date)
}