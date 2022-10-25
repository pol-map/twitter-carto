import { Command } from 'commander';
import * as fs from "fs";

import { render_legend_twitter } from "./10B_render_legend_twitter.js";

/// CLI logic
let program, options
program = new Command();
program
	.name('run-step')
	.description('Run a single step of the whole process.')
  .option('-d, --date <YYYY-MM-DD>', 'Date where to run the step. Defaults to today.')
  .requiredOption('-s, --step <number>', 'Step number.')
  // .option('-r, --recycle', 'Do not recompute frames already there')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

// Date
const date = (options.date === undefined)?(new Date()):(new Date(options.date))
console.log(`Run script ${options.step} for the ${date}`)

// Type-dependent options
switch (options.step) {
	case "10B":
		render_legend_twitter(date)
		break;
	default:
		// Nothing
		console.error("Unknown step")
}
