import { update_mp_list } from "./01_update_mp_list.js";
import { get_last_mp_tweets } from "./02_get_last_mp_tweets.js";
import { extract_cited_resources } from "./03_extract_cited_resources.js";
import { normalize_urls } from "./04_normalize_urls.js";
import { aggregate_main_resources } from "./05_aggregate_main_resources.js";
import { get_political_tweets } from "./06_get_political_tweets.js";
import { build_corpus } from "./07_build_corpus.js";
import { network } from "./08_network.js";
import { network_layout } from "./09_network_layout.js";

const date = undefined; // Now

console.log("\n\n# 01. UPDATE MP LIST #####################################")
update_mp_list(date)
	.then(result => {
		if (result.success) {
			console.info("# UPDATE MP LIST SUCCESSFUL.",result.msg)
		} else {
			console.error("# UPDATE MP LIST FAILED", result.msg)
		}
	}, error => {
		console.error("# UPDATE MP LIST ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 02. GET LAST MP TWEETS #################################")
		return get_last_mp_tweets(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# GET LAST MP TWEETS SUCCESSFUL.",result.msg)
		} else {
			console.error("# GET LAST MP TWEETS FAILED", result.msg)
		}
	}, error => {
		console.error("# GET LAST MP TWEETS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 03. EXTRACT CITED RESOURCES ############################")
		return extract_cited_resources(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# EXTRACT CITED RESOURCES SUCCESSFUL.",result.msg)
		} else {
			console.error("# EXTRACT CITED RESOURCES FAILED", result.msg)
		}
	}, error => {
		console.error("# EXTRACT CITED RESOURCES ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 04. NORMALIZE URLS #####################################")
		return normalize_urls(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# NORMALIZE URLS SUCCESSFUL.",result.msg)
		} else {
			console.error("# NORMALIZE URLS FAILED", result.msg)
		}
	}, error => {
		console.error("# NORMALIZE URLS ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 05. AGGREGATE MAIN RESOURCES ###########################")
		return aggregate_main_resources(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# AGGREGATE MAIN RESOURCES SUCCESSFUL.",result.msg)
		} else {
			console.error("# AGGREGATE MAIN RESOURCES FAILED", result.msg)
		}
	}, error => {
		console.error("# AGGREGATE MAIN RESOURCES ERROR", error)
	})

	.then(() => {
		console.log("\n\n# 06. GET POLITICAL TWEETS ###############################")
		return get_political_tweets(date)
	})
	.then(result => {
		if (result.success) {
			console.info("# GET POLITICAL TWEETS SUCCESSFUL.",result.msg)
		} else {
			console.error("# GET POLITICAL TWEETS FAILED", result.msg)
		}
	}, error => {
		console.error("# GET POLITICAL TWEETS ERROR", error)
	})
	
	.then(() => {
		console.log("\n\n# 07. BUILD CORPUS #######################################")
		return build_corpus(date)
	})
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
		console.log("\n\n# 08. NETWORK ############################################")
		return network(date)
	})
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
		console.log("\n\n# 09. NETWORK LAYOUT #####################################")
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

