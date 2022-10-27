import { Command } from 'commander';
import * as fs from "fs";

import { scripts } from "./-all-scripts.js";

/// CLI logic
let program, options
program = new Command();
program
	.name('run-step')
	.description('Run a single step of the whole process.')
  .requiredOption('-s, --step <number>', 'Required. Step number.')
  .option('-d, --date <YYYY-MM-DD>', 'Date where to run the step. Defaults to today.')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

// Date
const date = (options.date === undefined)?(new Date()):(new Date(options.date))

// Run step
const scriptIndex = scripts.getIndex()
let step = scriptIndex[+options.step]
if (step) {
	console.log(`### Run script ${options.step} for the ${date}`)
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
} else {
	console.error("ERROR: Unknown step", +options.step)
	console.info("Valid steps:")
	scripts.get()
		.forEach(s => {
			console.info(`  ${s.id.toLocaleString('en-US', {minimumIntegerDigits: 4, useGrouping: false})}`, `-> ${s.title}`)
		})
}
