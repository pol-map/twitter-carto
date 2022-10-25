import { Command } from 'commander';
import { scripts } from "./_all_scripts.js";

/// CLI logic
let program, options
program = new Command();
program
	.name('run-all')
	.description('Run all the steps.')
  .option('-d, --date <YYYY-MM-DD>', 'Date where to run the step. Defaults to today.')
  // .option('-r, --recycle', 'Do not recompute frames already there')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

// Date
const date = (options.date === undefined)?(new Date()):(new Date(options.date))
console.log(`RUN ALL for the`, date)

let steps = scripts.get().slice(0).filter(s => !s.omit)
console.log(steps)

async function runNextStep() {
	let step = steps.shift()
	
	// Big marker for the console
	const line = "################################################################"
	const hole = "###                                                          ###"
	console.log("\n\n")
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
}

runNextStep()