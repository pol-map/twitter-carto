import { Command } from 'commander';
import { frameBuilder } from './-frame-builder.js'

/// CLI logic
let program, options
program = new Command();
program
	.name('frame-builder')
	.description('Utility usable as a CLI. Build frames that can be made into a video.')
  .requiredOption('-t, --type <type>', 'Type of frame. Choices: regular, broadcasting, polheatmap.')
  .option('-d, --date <date>', 'Date as "YYYY-MM-DD". Defaults to today.')
  .option('-r, --range <daterange>', 'Timeline date range as "YYYY-MM-DD YYYY-MM-DD"')
  .option('-p, --polgroup <group-id>', 'ID of the political affiliation. Necessary to the polheatmap mode.')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

if (options.type == "polheatmap" && !options.polgroup) {
	console.error("/!\\ The polheatmap mode requires a polgroup.\n")
	process.exit()
}

// Checks and execution
const validTypes = ["regular", "regular-1080", "broadcasting", "polheatmap"]
if (options.type && validTypes.indexOf(options.type)>=0) {
	let fbOptions = {}
	if (options.range) {
		fbOptions.dateRange = options.range.split(" ").map(d => new Date(d))
	}
	if (options.polgroup) {
		fbOptions.heatmapPolGroup = options.polgroup
	}
	await frameBuilder.build(options.type, options.date ? new Date(options.date) : new Date(), fbOptions)
} else {
	console.error("INVALID TYPE")
}
