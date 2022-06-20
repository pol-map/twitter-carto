const { createLogger, format, transports } = require("winston");
const https = require('https');
const http = require('http');
const fs = require('fs');

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
  	new transports.File({ filename: `${thisFolder}/01_update_mp.log` })
  ],
});

console.log("Log level is", logLevel)
logger.info('Log level is '+logLevel);

/**
 * Downloads file from remote HTTP[S] host and puts its contents to the
 * specified location.
 */
async function download(url, filePath) {
  const proto = !url.charAt(4).localeCompare('s') ? https : http;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        fs.unlink(filePath, () => {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        });
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => resolve(fileInfo));

    request.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}

const sourceFileURL = "https://nosdeputes.fr/deputes/enmandat/csv"
const sourceFileSave = `${thisFolder}/nosdeputes_source.csv`

logger
	.child({ context: {sourceFileURL, sourceFileSave} })
	.debug('Download source file');

download(sourceFileURL, sourceFileSave)
	.then(
		result => {
			logger
				.child({ context: {sourceFileURL, sourceFileSave} })
				.info('Source file downloaded');

			console.log("Done.")
		},
  	error => {
			logger
				.child({ context: {sourceFileURL, sourceFileSave, error} })
				.error('Failed to download source file');

			console.log("Done (failed).")
  	}
	)
