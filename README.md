# twitter-carto
Mapping Twitter landscapes with networks

# Install

```js
npm install
```

Then two small but necessary things:

1. You need to install Minet, which depends on your OS. Check the releases there: https://github.com/medialab/minet/releases
	* Install the Minet binaries in your a ```minet``` folder to create at the root of the repository (or somewhere else... It's just a matter of .gitignore)
	* Edit the location of the Minet executable in the ```.env``` file (see just below)

2. Download and install the Raleway font family (all of it). It is necessary to drawing the maps: https://www.fontsquirrel.com/fonts/raleway

## Config

1. Duplicate and rename ```default.env``` into ```.env``` and edit it to inform your own settings:
	* Twitter API key (you need that, obviously!)
	* Path to the folder where you downloaded the Minet stuff
2. Duplicate and rename ```default_corpus_settings.json```.  into ```corpus_settings.json``` and edit it:
	* URL to the CSV file containing the list of Twitter users we follow as starting points (MPs)
	* CSV separator (you know, ```,``` or ```;```)
	* Which columns contain the Twitter handle (**without the @**), the name of the person, and its political affiliation.
3. Duplicate and rename ```default_political_affiliations.json```.  into ```political_affiliations.json``` and edit it:
	* "Eras" allow you to have different time periods with different parties. You may have just one era like in the default file.
	* The "id" of a political affiliation is never shown. **It must match the affiliations in the source corpus.**
	* The "name" is what is shown.
	* The attribute "block" may be set to "left", "center", "right" or "". It is used to calibrate the map's position, so at least one affiliation must be "left", one must be "center", and one "right".
	* The "leftRightAxis" is used sometimes when we need a stable order of the affiliations for some visualizations. Only the order matters, not the values themselves, but you may find practical to see it as -1=left, 0=center and 1=right.
	* "showInLegend" may be set to *false* for edge-case affiliations that you do not want to appear in the legends of the maps.
	* "makeHeatmap" can similarly be set to *false* if you want to skip building the heatmap of that affiliation.

# What the script does

1. It sources the list of current parliament members (MPs or "députés" in French) from Regards Citoyens or another source, which contains their Twitter handle (when they have one). Output files: ```twitter_handles.csv```
2. It gets the list of their tweets from yesterday (midnight to midnight GMT, so basically 2AM-2AM French time), excluding replies. Output files: ```twitter_valid_users.csv``` (handles that have an id) and ```tweets/[user_id].json``` (API response for each user).
3. It extracts the "resources" cited in those tweets. A resource can be either a tweet that was mentioned or retweeted, or a URL from outside of Twitter. Output file: ```resources_cited_by_mps.csv```.
4. It normalizes the URLs using the Minet library, so that they are more comparable. Output_file: ```resources_cited_by_mps_normalized.csv```
5. It aggregates the (most cited) resources in a 7-day window (cited by MPs). Intuitively, these resources represent the current state of the political debate in the last 7 days, as seen from the parliament. Output file: ```resources_7days_aggregated.csv```
6. For the resources the most cited by MPs in the last 7 days, it retrieves up to 2.5K users who also "broadcasted" that resource yesterday, i.e. either mentioned it in a reply, retweet or quote. We stop harvesting at 33K broadcasting, so that we get ~1M broadcastings monthly. Output files: ```broadcastings/[id]-[page].json``` (API responses) and ```broadcastings.csv``` for the aggregated result.
7. It extracts the list of the users that broadcasted during the 30 days, capped at 1 million and keeping those with that had the most interactions. It tracks the affiliation of the MPs that broadcasted the same resources, if any affiliation is present in the source file. When one affiliation accounts for two thirds or more of those alignments, it marks it as the main affiliation of that person. That just means that this person is particularly aligned with the themes broadcasted by the MPs of that group, regardless of whether or not they agree on a political or ideological level. For convenience, let us call this set of users "the corpus". Output file: ```user_corpus_1month.csv```
8. It extracts the network of users that have at least 4 interactions (mentioning or being mentioned in broadcastings; that number is configurable) with other users of the network. Output files: ```network_edges.csv``` and ```network_nodes.csv```.
9. It applies a layout to the network, and sets node sizes and colors. A color is applied if the account has at least 10 broadcastings similar to those of MPs with colored affiliations (those colors are blended with respective weights). Output files: ```network_spat.gexf``` and ```network_nodes_spat.csv```.

# In short

Today's **broadcastings** are yesterday's tweet that mention a resource also tweeted by one or more MP during last week, and that are either a reply, a retweet, or a quote (they are interactions).

The **network** consists of the users mentioning each others in last month's broadcastings, filtered down to the 4-core.

# Out of memory error
In case the defatul 1 Gb RAM is not enough, specify a higher limit. For instance:
```
node --max-old-space-size=16384 01_update_mp_list.js
```
Values: 8192, 16384, 32768... depending on the computer.