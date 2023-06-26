import { update_mp_list } from "./0100_update_mp_list.js";
import { get_last_mp_tweets } from "./0200_get_last_mp_tweets.js";
import { extract_cited_resources } from "./0300_extract_cited_resources.js";
import { normalize_urls } from "./0400_normalize_urls.js";
import { aggregate_main_resources } from "./0500_aggregate_main_resources.js";
import { resource_extract_data } from "./0510_resource_extract_data.js";
import { resource_extract_expressions } from "./0520_resource_extract_expressions.js";
import { get_political_tweets } from "./0600_get_political_tweets.js";
import { build_corpus } from "./0700_build_corpus.js";
import { network } from "./0800_network.js";
import { network_layout } from "./0900_network_layout.js";
import { render_map_twitter } from "./1000_render_map_twitter.js";
import { render_legend_twitter } from "./1010_render_legend_twitter.js";
import { render_map_4k_no_labels } from "./1100_render_map_4K_no_labels.js";
import { render_map_4k_top_labels } from "./1200_render_map_4K_top_labels.js";
import { render_map_large } from "./1300_render_map_large.js";
import { render_pol_heatmaps } from "./1400_render_pol_heatmaps.js";
import { who_says_what } from "./1500_who_says_what.js";

const _scripts = [
	{
		id: 100,
		title: "Update MP list",
		run: update_mp_list,
		omit: false,
	},{
		id: 200,
		title: "Get lastest MP tweets",
		run: get_last_mp_tweets,
		omit: false,
	},{
		id: 300,
		title: "Extract cited resource",
		run: extract_cited_resources,
		omit: false,
	},{
		id: 400,
		title: "Normalize URLs",
		run: normalize_urls,
		omit: false,
	},{
		id: 500,
		title: "Aggregate main resource",
		run: aggregate_main_resources,
		omit: false,
	},{
		id: 510,
		title: "Resources: extract data",
		run: resource_extract_data,
		omit: false,
	},{
		id: 520,
		title: "Resources: extract expressions",
		run: resource_extract_expressions,
		omit: false,
	},{
		id: 600,
		title: "Get political tweets",
		run: get_political_tweets,
		omit: false,
	},{
		id: 700,
		title: "Build corpus",
		run: build_corpus,
		omit: false,
	},{
		id: 800,
		title: "Build network",
		run: network,
		omit: false,
	},{
		id: 900,
		title: "Compute network layout",
		run: network_layout,
		omit: false,
	},{
		id: 1000,
		title: "Render map: Twitter format",
		run: render_map_twitter,
		omit: false,
	},{
		id: 1010,
		title: "Render legend for the Twitter format",
		run: render_legend_twitter,
		omit: false,
	},{
		id: 1100,
		title: "Render map: 4K no labels",
		run: render_map_4k_no_labels,
		omit: false,
	},{
		id: 1200,
		title: "Render map: 4K top labels",
		run: render_map_4k_top_labels,
		omit: false,
	},{
		id: 1300,
		title: "Render map: large",
		run: render_map_large,
		omit: true,
	},{
		id: 1400,
		title: "Render political heatmaps",
		run: render_pol_heatmaps,
		omit: false,
	},{
		id: 1500,
		title: "Who says what?",
		run: who_says_what,
		omit: false,
	}
]

// Index
let _index = {}
_scripts.forEach(s => {
	_index[s.id] = s
})

// Object
export const scripts = (()=>{
	let ns = {} // Namespace

	ns.get = function(){
		return _scripts
	}

	ns.getIndex = function(){
		return _index
	}

	return ns
})()
