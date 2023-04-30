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

1. Get a Twitter cookie:
	* In Firefox, connect to Twitter on the account you want use for scraping.
	* From the repository of Minet, run this command: ```minet cookies firefox --url https://twitter.com```
	* Copy the result (i.e., the cookie) and paste it somewhere
2. Duplicate and rename ```-default.env``` into ```.env``` and edit it to inform your own settings:
	* Path to the folder where you downloaded the Minet stuff
	* Twitter cookie (paste it from just before, the cookie is just text)
3. Duplicate and rename ```-default-corpus-settings.json```.  into ```-corpus-settings.json``` and edit it:
	* URL to the CSV file containing the list of Twitter users we follow as starting points (MPs)
	* CSV separator (you know, ```,``` or ```;```)
	* Which columns contain the Twitter handle (**without the @**), the name of the person, and its political affiliation.
4. Duplicate and rename ```-default-political-affiliations.json```.  into ```-political-affiliations.json``` and edit it:
	* "Eras" allow you to have different time periods with different parties. You may have just one era like in the default file.
	* The "id" of a political affiliation is never shown. **It must match the affiliations in the source corpus.**
	* The "name" is what is shown.
	* The attribute "block" may be set to "left", "center", "right" or "". It is used to calibrate the map's position, so at least one affiliation must be "left", one must be "center", and one "right".
	* The "leftRightAxis" is used sometimes when we need a stable order of the affiliations for some visualizations. Only the order matters, not the values themselves, but you may find practical to see it as -1=left, 0=center and 1=right.
	* "showInLegend" may be set to *false* for edge-case affiliations that you do not want to appear in the legends of the maps.
	* "makeHeatmap" can similarly be set to *false* if you want to skip building the heatmap of that affiliation.

# What the script does, step by step

(The number featured at each step is the id of the corresponding script)

* ```0100``` It sources the list of current parliament members (MPs or "députés" in French) from Regards Citoyens or another source, which contains their Twitter handle (when they have one). Output files: ```twitter_handles.csv```
* ```0200``` It gets the list of their tweets from yesterday (midnight to midnight GMT, so basically 2AM-2AM French time), excluding replies. Output files: ```twitter_valid_users.csv``` (handles that have an id) and ```yesterdays_mp_tweets.csv``` (Data scraped by Minet).
* ```0300``` It extracts the "resources" cited in those tweets. A resource can be either a tweet that was mentioned or retweeted, or a URL from outside of Twitter. Output file: ```resources_cited_by_mps.csv```.
* ```0400``` It normalizes the URLs using the Minet library, so that they are more comparable. Output_file: ```resources_cited_by_mps_normalized.csv```
* ```0500``` It aggregates the (most cited) resources in a 7-day window (cited by MPs). Intuitively, these resources represent the current state of the political debate in the last 7 days, as seen from the parliament. Output file: ```resources_7days_aggregated.csv```
* ```0510``` This one does many things, but in short: enrich the resources tweeted by MPs.
	* It loads ```resources_7days_aggregated.csv``` for today and truncates it to the 1K resources most broadcasted by MPs. Then it loads ```resources_7days_aggregated.csv``` for *yesterday*, compares the two to retain only the new resources of the day. It then splits it in two files. ```resources_newtoday_twitter.csv``` containes the new twitter resources, and ```resources_newtoday_URL.csv``` the new URL resources.
	* For the new Twitter resources (i.e., tweets), it downloads the text content and meta data into ```tweetsData/[tweet_id].json```, and the metadata about each media mentioned, specifically, into ```media/[media_id].json```. It saves the list of Twitter resources new today enriched with text and media keys into ```resources_newtoday_twitter_enriched.csv```. 
	* *Note: "new today" means, in this context, that we do not have the data from yesterday; the purpose is to not download twice; it does NOT capture all the resources tweeted today, as some MPs may tweet resources we already had.*
	<!--* It downloads the thumbnails of each media new today into ```media-images/``` and saves the list of media from the Twitter resources new today into ```media_newtoday.csv```.-->
	* It fetches the text content of the URL resources with Minet into ```resources_newtoday_URL_fetched.csv```, which also incidendally downloads the HTML at the root into ```downloaded/``` (can be deleted for space, no problem), then extracts the text into ```resources_newtoday_URL_text.csv```
	* It compiles the new resources with the existing ones into ```resources_7days_aggregated_text.csv``` that contains retrieved text and additional data (media keys...) for the entries new today (and those from the days before are as they were, presumably fetched as well).
* ```0520``` It extracts expressions from text. It currently uses a mix of tokenization and the RAKE algorithm, that basically finds expressions between the stop words. It loads ```resources_7days_aggregated_text.csv``` and saves ```resources_7days_aggregated_expressions.csv```, which contains additional columns with the expressions extracted. *Note: the most present expressions depend on the whole dataset, so we need to recompute it each time even though we had the expressions from the days before.*
* ```0600``` For the resources the most cited by MPs in the last 7 days, capped to the 1K most broadcasted by MPs (in practice, that cap is never attained), it retrieves up to 1K users who also "broadcasted" that resource yesterday, i.e. either mentioned it in a reply, retweet or quote. We stop harvesting at 33K broadcasting, so that we get ~1M broadcastings monthly. Output files: ```broadcastings/[id]-[page].csv``` (Minet scraping result) and ```broadcastings.csv``` for the aggregated result. 
* ```0700``` It extracts the list of the users that broadcasted during the 30 days, capped at 1 million and keeping those with that had the most interactions. It tracks the affiliation of the MPs that broadcasted the same resources, if any affiliation is present in the source file. When one affiliation accounts for two thirds or more of those alignments, it marks it as the main affiliation of that person. That just means that this person is particularly aligned with the themes broadcasted by the MPs of that group, regardless of whether or not they agree on a political or ideological level. For convenience, let us call this set of users "the corpus". Output file: ```user_corpus_1month.csv```
* ```0800``` It extracts the network of users that have at least 4 interactions (mentioning or being mentioned in broadcastings; that number is configurable) with other users of the network. Output files: ```network_edges.csv``` and ```network_nodes.csv```.
* ```0900``` It applies a layout to the network, and sets node sizes and colors. A color is applied if the account has at least 10 broadcastings similar to those of MPs with colored affiliations (those colors are blended with respective weights). Output files: ```network_spat.gexf``` and ```network_nodes_spat.csv```.
* The scripts ```1000+``` render images using those data.
* ```1500``` Also crunches data. It loads ```broadcastings.csv```, and retains how many broadcastings each user has made for the day. It divides the map in large squares that it iteratively divides into sub-squares until each square contains no more than ~2K broadcastings. Then for each square, it finds the most broadcasted resource. It retains enough resources to cover 80% of the areas (weighted with # of broadcastings), but no more than 8. It saves that liste into ```key_resources.csv```.

# In short

Today's **broadcastings** are yesterday's tweets that mention a resource also tweeted by one or more MP during last week, and that are either a reply, a retweet, or a quote (they are interactions).

The **network** consists of the users mentioning each others in last month's broadcastings, filtered down to the 4-core.

# Out of memory error
In case the default 1 Gb RAM is not enough, specify a higher limit. For instance:
```
node --max-old-space-size=16384 run-step --help
```
Values: 8192, 16384, 32768... depending on the computer.