import { Command } from 'commander';


export let frameBuilder = (()=>{
	let ns = {} // Namespace

	ns.helloWorld = function() {
		console.log("Hello World")
	}

	return ns
})()


/// CLI logic
const program = new Command();

program
	.name('frame-builder')
	.description('A building block to other scripts. Usable as a CLI. Builds video frames for existing data.')
  .option('-a, --auto', 'Auto mode.')
  .parse(process.argv);

const options = program.opts();

if (options.auto) {
	frameBuilder.helloWorld()
}