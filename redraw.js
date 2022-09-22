import { network } from "./08_network.js";
import { network_layout } from "./09_network_layout.js";

const startingDate = new Date("2022-07-22")
const endDate = new Date("2022-09-22")

let date = startingDate
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# COMPUTE NETWORK FOR ${year}-${month}-${datem} ##############################`)

	network(date)
		.then(result => {
			if (result.success) {
				console.info("# NETWORK SUCCESSFUL.",result.msg)
			} else {
				console.error("# NETWORK FAILED", result.msg)
			}
		}, error => {
			console.error("# NETWORK ERROR", error)
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
			date.setDate(date.getDate() + 1);
			if (endDate-date >= 0) {
				return redraw()
			} else {
				console.log("\n\n# DONE. ###############################`)")
			}
		})
}
redraw()

