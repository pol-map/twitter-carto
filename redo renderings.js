import { render_map_twitter } from "./10_render_map_twitter.js";
import { render_map_4k_no_labels } from "./11_render_map_4K_no_labels.js";
import { render_map_4k_top_labels } from "./12_render_map_4K_top_labels.js";

const startingDate = new Date("2022-07-22")
const endDate = new Date("2022-09-22")

let date = startingDate
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# COMPUTE NETWORK FOR ${year}-${month}-${datem} ##############################`)

	render_map_twitter(date)
		.then(result => {
			if (result.success) {
				console.info("# RENDER MAP TWITTER SUCCESSFUL.",result.msg)
			} else {
				console.error("# RENDER MAP TWITTER FAILED", result.msg)
			}
		}, error => {
			console.error("# RENDER MAP TWITTER ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K NO LABELS ####################")
			return render_map_4k_no_labels(date)
		})
		.then(result => {
			if (result.success) {
				console.info("# RENDER MAP 4K NO LABELS SUCCESSFUL.",result.msg)
			} else {
				console.error("# RENDER MAP 4K NO LABELS FAILED", result.msg)
			}
		}, error => {
			console.error("# RENDER MAP 4K NO LABELS ERROR", error)
		})

		.then(() => {
			console.log("# NOW RENDER MAP 4K TOP LABELS ####################")
			return render_map_4k_top_labels(date)
		})
		.then(result => {
			if (result.success) {
				console.info("# RENDER MAP 4K TOP LABELS SUCCESSFUL.",result.msg)
			} else {
				console.error("# RENDER MAP 4K TOP LABELS FAILED", result.msg)
			}
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

