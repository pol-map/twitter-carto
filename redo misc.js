import { resource_extract_text } from "./05B_resource_extract_text.js";
import { resource_extract_expressions } from "./05C_resource_extract_expressions.js";

const startingDate = new Date("2022-07-22")
const endDate = new Date("2022-10-19")

let date = new Date(startingDate)
const redraw = function(){
	let year = date.getFullYear()
	let month = (1+date.getMonth()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	let datem = (date.getDate()).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false})
	console.log(`\n\n# REDO EXPR EXTRACT FOR ${year}-${month}-${datem} ##############################`)

	resource_extract_expressions(date)
		.then(result => {
			if (result.success) {
				console.info("# REDO EXPR EXTRACT SUCCESSFUL.",result.msg)
			} else {
				console.error("# REDO EXPR EXTRACT FAILED", result.msg)
			}
		}, error => {
			console.error("# REDO EXPR EXTRACT ERROR", error)
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

