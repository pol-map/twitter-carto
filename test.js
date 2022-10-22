import { frameBuilder as fb } from "./frame-builder.js";

let settings = {}
settings.sdate = "2022-10-01"
settings.edate = "2022-10-04"

const startDate = new Date(settings.sdate)
const endDate = new Date(settings.edate)

let date = new Date(startDate)

let frameFile = await fb.build("broadcasting", date, {dateRange: [startDate, endDate], labels:false, filtering:{shortName:"test", filter:(d,i)=>i<100}})
console.log("Frame generated:",frameFile)
