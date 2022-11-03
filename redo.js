import { Command } from 'commander';
import { scripts } from "./-all-scripts.js";

/// CLI logic
let program, options
program = new Command();
program
	.name('redo')
	.description('Rerun certain steps for a range of dates.')
  .requiredOption('-f, --first <YYYY-MM-DD>', 'First date to run the scripts. Required.')
  .requiredOption('-l, --last <YYYY-MM-DD>', 'Last date to run the scripts. Required.')
  .requiredOption('-s, --scripts <####-####>', 'The range of scripts, ex: 0100-0300. Required.')
  .option('-o, --omit <bool>', 'Omit some scripts? Default: true')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

const startingDate = new Date(options.first)
const endDate = new Date(options.last)

const scriptFirst = +(options.scripts.split("-")[0])
const scriptLast = +(options.scripts.split("-").pop())
if (isNaN(scriptFirst) || isNaN(scriptLast) || scriptFirst<0 || scriptLast>9999) {
	console.error("There is a problem with the script range:", [scriptFirst, scriptLast])
	process.exit(1)
}

// Date
let date = new Date(startingDate)
let steps

async function runDate() {
	console.log(`\n\n\n\n=========================================== RUN SCRIPTS for the`, date)
	steps = scripts.get().slice(0)

	steps = steps.filter(s => scriptFirst<=+s.id && +s.id<=scriptLast)
	
	if (options.omit && options.omit.toLowerCase() != "false") {
		steps = steps.filter(s => !s.omit)
	}
	runNextStep()
}

async function runNextStep() {
	let step = steps.shift()
	
	if (step) {
		// Big marker for the console
		const line = "################################################################"
		const hole = "###                                                          ###"
		console.log("\n")
		console.log(line)
		console.log(hole)
		let msg = `###   ${step.id.toLocaleString('en-US', {minimumIntegerDigits: 4, useGrouping: false})}  -  ${step.title.toUpperCase()}   `
		while (msg.length < line.length) { msg = msg + " " }
		msg = msg.substring(0, line.length-3) + "###"
		console.log(msg)
		console.log(hole)
		console.log(line)
		console.log("\n")

		step.run(date)
			.then(result => {
				if (result !== undefined && result.success !== undefined) {
					if (result.success) {
						console.info(`\n### SUCCESS: ${step.title}.`, result.msg)
					} else {
						console.error(`\n### FAIL: ${step.title}.`, result.msg)
					}
				} else {
					console.info(`\n### DONE: ${step.title}.`)
				}
			}, error => {
				console.error(`\n### ERROR: ${step.title}.`, error)
			})
			.then(runNextStep)
	} else {
		date.setDate(date.getDate() + 1);
		if (endDate-date >= 0) {
			return runDate()
		} else {
			console.log("\n\n### DONE.\n")
		}
	}
}

runDate()