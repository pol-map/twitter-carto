import { createLogger, format, transports } from "winston";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as d3 from 'd3';
import { Client, auth } from "twitter-api-sdk";
import dotenv from "dotenv";
import { createCanvas, loadImage, ImageData } from "canvas"


dotenv.config();

export async function test(date) {

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
      new transports.File({ filename: `${thisFolder}/test.log` })
    ],
  });

  logger.info('***** RUN SCRIPT ****');
  console.log("Log level is", logLevel)
  logger.info('Log level is '+logLevel);

  async function main() {
    
    // Load resources from today and previous days for one MONTH (30 days)
    let broadcastings = []
    let filePath = `${thisFolder}/broadcastings.csv`
    if (fs.existsSync(filePath)) {
      try {
        // Load file as string
        let csvString = fs.readFileSync(filePath, "utf8")
        // Parse string
        broadcastings = d3.csvParse(csvString);
        logger
          .child({ context: {filePath} })
          .info(`Broadcastings loaded (${broadcastings.length} rows)`);
  
      } catch (error) {
        console.log("Error", error)
        logger
          .child({ context: {error:error.message} })
          .error(`An error occurred during the loading and parsing of broadcastings`);
      }
    } else {
      logger
        .child({ context: {filePath} })
        .warn(`Broadcastings not found`);
    }

    logger
      .child({ context: {broadcastings} })
      .trace(`Broadcastings (${broadcastings.length} rows)`);

    // Look for target broadcastings
    const targetFilter = function(res){ return res.resource_id == "taxesuperprofits.fr"}
    const targetBroadcastings = broadcastings.filter(targetFilter)
    
    // Load node positions
    /*let nodes
    filePath = `${thisFolder}/network_nodes_spat.csv`
    if (fs.existsSync(filePath)) {
      try {
        // Load file as string
        let csvString = fs.readFileSync(filePath, "utf8")
        // Parse string
        nodes = d3.csvParse(csvString);
        logger
          .child({ context: {filePath} })
          .info(`Nodes loaded (${nodes.length} rows)`);
  
      } catch (error) {
        console.log("Error", error)
        logger
          .child({ context: {error:error.message} })
          .error(`An error occurred during the loading and parsing of nodes`);
      }
    } else {
      logger
        .child({ context: {filePath} })
        .warn(`Nodes file not found`);
    }

    // Build nodes index
    let nodesIndex = {}
    nodes.forEach(n => {
      nodeIndex[n.Id] = n
    })*/

    // Build edges list
    let edges = []
    targetBroadcastings.forEach(b => {
      JSON.parse(b.tweet_mentions).forEach(d => {
        edges.push({
          Source: b.broadcaster_id,
          Target: d,
        })
      })
    })

    // Export target broadcastings as edges
    const edgesFile = `${thisFolder}/network_edges_broadcastings_test.csv`
    const edgesString = d3.csvFormat(edges)
    try {
      fs.writeFileSync(edgesFile, edgesString)
      logger
        .child({ context: {edgesFile} })
        .info('Edges file saved successfully');
      return new Promise((resolve, reject) => {
        logger.end();
      });
    } catch(error) {
      logger
        .child({ context: {edgesFile, error} })
        .error('The edges file could not be saved');
      return new Promise((resolve, reject) => {
        logger.once('finish', () => resolve({success:false, msg:`The edges file could not be saved.`}));
        logger.end();
      });
    }

    console.log("Done.")
  }

  return main();
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
  test(date)
}