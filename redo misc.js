import { build_corpus } from "./07_build_corpus.js";
import { network } from "./08_network.js";
import { network_layout } from "./09_network_layout.js";
import { render_map_twitter } from "./10_render_map_twitter.js";
import { render_map_4k_no_labels } from "./11_render_map_4K_no_labels.js";
import { render_map_4k_top_labels } from "./12_render_map_4K_top_labels.js";

const startingDate = new Date("2022-07-21")
const endDate = new Date("2022-09-25")

let date = startingDate
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# BUILD CORPUS FOR ${year}-${month}-${datem} ##############################`)

	build_corpus(date)
		.then(result => {
			if (result.success) {
				console.info("# BUILD CORPUS SUCCESSFUL.",result.msg)
			} else {
				console.error("# BUILD CORPUS FAILED", result.msg)
			}
		}, error => {
			console.error("# BUILD CORPUS ERROR", error)
		})

		.then(() => {
			console.log("# NOW COMPUTE NETWORK ####################")
			return network(date)
		})
		.then(result => {
			if (result.success) {
				console.info("# NETWORK SUCCESSFUL.",result.msg)
			} else {
				console.error("# NETWORK FAILED", result.msg)
			}
		}, error => {
			console.error("# NETWORK LAYOUT ERROR", error)
		})

		.then(() => {
			console.log("# NOW COMPUTE NETWORK LAYOUT ####################")
			return network_layout(date)
		})
		.then(result => {
			if (result.success) {
				console.info("# NETWORK LAYOUT SUCCESSFUL.",result.msg)
			} else {
				console.error("# NETWORK LAYOUT FAILED", result.msg)
			}
		}, error => {
			console.error("# NETWORK LAYOUT ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP TWITTER ####################")
			return render_map_twitter(date)
		})
		.then(result => {
			console.info("# RENDER MAP TWITTER DONE.")
		}, error => {
			console.error("# RENDER MAP TWITTER ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K NO LABELS ####################")
			return render_map_4k_no_labels(date)
		})
		.then(() => {
			console.info("# RENDER MAP 4K NO LABELS DONE.")
		}, error => {
			console.error("# RENDER MAP 4K NO LABELS ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K TOP LABELS ####################")
			return render_map_4k_top_labels(date)
		})
		.then(() => {
			console.info("# RENDER MAP 4K TOP LABELS DONE.")
		}, error => {
			console.error("# RENDER MAP 4K TOP LABELS ERROR", error)
		})

		.then(() => {
			date.setDate(date.getDate() + 1);
			if (endDate-date >= 0) {
				return redraw()
			} else {
				console.log("\n\n# DONE. ###############################")
			}
		})
}
redraw()

