import { render_pol_heatmaps } from "./14_render_pol_heatmaps.js";

const startingDate = new Date("2022-09-30")
const endDate = new Date("2022-10-13")

let date = startingDate
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# RENDER POL HEATMAPS FOR ${year}-${month}-${datem} ##############################`)

	render_pol_heatmaps(date)
		.then(() => {
			console.error("# RENDER POL HEATMAPS DONE.")
		}, error => {
			console.error("# RENDER POL HEATMAPS ERROR", error)
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

