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

console.log("\n\n# UPDATE MP LIST #####################################")
//update_mp_list(date);

console.log("\n\n# GET LAST MP TWEETS #################################")
// get_last_mp_tweets(date);

console.log("\n\n# EXTRACT CITED RESOURCES ############################")
// extract_cited_resources(date);

console.log("\n\n# NORMALIZE URLS #####################################")
// normalize_urls(date);

console.log("\n\n# AGGREGATE MAIN RESOURCES ###########################")
// aggregate_main_resources(date);

console.log("\n\n# GET POLITICAL TWEETS ###############################")
// get_political_tweets(date);

console.log("\n\n# BUILD CORPUS #######################################")
// build_corpus(date);

console.log("\n\n# NETWORK ############################################")
// network(date);

console.log("\n\n# NETWORK LAYOUT #####################################")
network_layout(date);

