import { network_layout } from "./09_network_layout.js";

const startingDate = new Date("2022-07-22")
const endDate = new Date("2022-09-22")

let date = startingDate
while (endDate-date >= 0) {
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# COMPUTE NETWORK LAYOUT FOR ${year}-${month}-${datem} ##############################`)

	network_layout(date)
		.then(result => {
			if (result.success) {
				console.info("# NETWORK LAYOUT SUCCESSFUL.",result.msg)
			} else {
				console.error("# NETWORK LAYOUT FAILED", result.msg)
			}
		}, error => {
			console.error("# NETWORK LAYOUT ERROR", error)
		})
		
	date.setDate(date.getDate() + 1);
}
console.log("\n\n# DONE. #")

