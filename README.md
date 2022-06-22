# twitter-carto
Mapping Twitter landscapes with networks

# Install

```js
npm install
```

Then a small but necessary thing: you also need to install Minet, which depends on your OS. Check the releases there:
https://github.com/medialab/minet/releases

* Install the Minet binaries in your a ```minet``` folder to create at the root of the repository (or somewhere else... It's just a matter of .gitignore)
* Edit the location of the Minet executable in the ```.env``` file (see just below)

## Config
Duplicate and rename ```default.env``` into ```.env``` and edit it to inform your own settings (API keys...)

# What the script does

1. It sources the list of current parliament members (MPs or "députés" in French) from Regards Citoyens, which contains their Twitter handle (when they have one)
2. It gets the list of their tweets from yesterday (midnight to midgniht GMT, so basically 2AM-2AM French time), excluding replies.
3. It extracts the "resources" cited in those tweets. A resource can be either a tweet that was mentioned or retweeted, or a URL from outside of Twitter.
4. It normalizes the URLs using the Minet library, so that they are more comparable.
5. It aggregates the resources so that we know when multiple MPs have cited them, not only for yesterday but also the days before up to one full week. Intuitively, these resources represent the current state of the political debate in the last 7-day window, as seen from the parliament.
6. For each the top 100 resources the most cited by MPs in the last 7 days, we retrieve up to 1000 user who also "broadcasted" that resource, i.e. either retweeted it if it's a tweet, or mentioned it in a non-retweet, non-reply tweet if it's a URL.

