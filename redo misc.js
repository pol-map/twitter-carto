import { get_political_tweets } from "./06_get_political_tweets.js";

const startingDate = new Date("2022-07-22")
const endDate = new Date("2022-10-03")

let date = new Date(startingDate)
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# REDO RESOURCES FOR ${year}-${month}-${datem} ##############################`)

	get_political_tweets(date)
		.then(result => {
			if (result.success) {
				console.info("# REDO RESOURCES SUCCESSFUL.",result.msg)
			} else {
				console.error("# REDO RESOURCES FAILED", result.msg)
			}
		}, error => {
			console.error("# REDO RESOURCES ERROR", error)
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

