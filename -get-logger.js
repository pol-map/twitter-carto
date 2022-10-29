import * as winston from "winston";

export function getLogger(filename) {
	const logLevels = {
	  fatal: 0,
	  error: 1,
	  warn: 2,
	  info: 3,
	  debug: 4,
	  trace: 5,
	};
	const logLevel = "trace"

	const colors = {
		fatal: "magenta",
		error: "red",
		warn: "yellow",
		info: "green",
		debug: "cyan",
		trace: "grey",
	}
	winston.addColors(colors)
	const logger = winston.createLogger({
		level: logLevel,
	  levels: logLevels,
	  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),

	  transports: [
	  	new winston.transports.Console({
	      format: winston.format.combine(
	      	winston.format(obj => {
	      		obj.message = `${(obj.level.length<5)?" ":""}${obj.timestamp.split(".")[0].replace("T", " ")}  ${obj.message}`
	      		delete obj.timestamp
	      		delete obj.context
	      		return obj
	      	})(),
	        winston.format.colorize(),
	        winston.format.simple(),
	      )
	    }),
	  	new winston.transports.File({ filename })
	  ],
	});
	logger.on('error', function (err) { console.error("Logger error :(") });
	return logger
}
