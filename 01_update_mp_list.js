const { createLogger, format, transports } = require("winston");
const https = require('https');
const http = require('http');
const fs = require('fs');

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

const logger = createLogger({
	level: "trace",
  levels: logLevels,
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: "data/test.log" })],
});


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
const sourceFileSave = "data/test.csv"

logger
	.child({ context: {sourceFileURL, sourceFileSave} })
	.debug('Download source file');

download(sourceFileURL, sourceFileSave)
	.then(
		function(result) {
			logger
				.child({ context: {sourceFileURL, sourceFileSave} })
				.info('Source file downloaded');

			console.log("Done.")
		},
  	function(error) {
			logger
				.child({ context: {sourceFileURL, sourceFileSave, error} })
				.error('Failed to download source file');

			console.log("Done (failed).")
  	}
	)
