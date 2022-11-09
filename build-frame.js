import { Command } from 'commander';
import { frameBuilder } from './-frame-builder.js'

/// CLI logic
let program, options
program = new Command();
program
	.name('frame-builder')
	.description('Utility usable as a CLI. Build frames that can be made into a video.')
  .requiredOption('-t, --type <type>', 'Type of frame. Choices: regular, broadcasting, polheatmap, user.')
  .option('-d, --date <date>', 'Date as "YYYY-MM-DD". Defaults to today.')
  .option('-r, --range <daterange>', 'Timeline date range as "YYYY-MM-DD YYYY-MM-DD"')
  .option('-p, --polgroup <group-id>', 'ID of the political affiliation. Necessary to the polheatmap mode.')
  .option('-u, --user <username>', 'Twitter handle to track. Necessary to the user mode.')
	.option('-s, --search <expression>', 'For broadcasting mode, which term to look for?')
  .showHelpAfterError()
  .parse(process.argv);

options = program.opts();

if (options.type == "polheatmap" && !options.polgroup) {
	console.error("/!\\ The polheatmap mode requires a polgroup.\n")
	process.exit()
}

// Checks and execution
const validTypes = [
	"regular",
	"regular-720",
	"regular-1080",
	"broadcasting",
	"broadcasting-720",
	"polheatmap",
	"polheatmap-720",
	"user"
]
if (options.type && validTypes.indexOf(options.type)>=0) {
	let fbOptions = {}
	if (options.range) {
		fbOptions.dateRange = options.range.split(" ").map(d => new Date(d))
	}
	if (options.polgroup) {
		fbOptions.heatmapPolGroup = options.polgroup
	}
	if (options.user) {
		fbOptions.username = options.user
	}
	if (options.search) {
		let searchTerm = (options.search || "").toLowerCase()
		fbOptions.filtering = {
			shortName: options.search,
			filter: b => b.tweet_text.toLowerCase().indexOf(searchTerm) >= 0
		}
	}
	let today = new Date()
	today.setHours(0,0,0,0)
	await frameBuilder.build(options.type, options.date ? new Date(options.date) : today, fbOptions)
} else {
	console.error("INVALID TYPE")
}
