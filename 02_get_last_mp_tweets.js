import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client } from "twitter-api-sdk";
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

console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

console.log("Hello world")
const client = new Client("MY-BEARER-TOKEN");

// async function main() {
//   const client = new Client(process.env.BEARER_TOKEN as string);
//   await client.tweets.addOrDeleteRules(
//     {
//       add: [
//         { value: "cat has:media", tag: "cats with media" },
//         { value: "cat has:media -grumpy", tag: "happy cats with media" },
//         { value: "meme", tag: "funny things" },
//         { value: "meme has:images" },
//       ],
//     }
//   );
//   const rules = await client.tweets.getRules();
//   console.log(rules);
//   const stream = client.tweets.searchStream({
//     "tweet.fields": ["author_id", "geo"],
//   });
//   for await (const tweet of stream) {
//     console.log(tweet.data?.author_id);
//   }
// }