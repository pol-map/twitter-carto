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
6. For each the top 300 resources the most cited by MPs in the last 7 days, it retrieves up to 500 users who also "broadcasted" that resource, i.e. either retweeted it if it's a tweet, or mentioned it in a non-retweet, non-reply tweet if it's a URL.
7. It extracts the list of users who broadcasted those top 300 resources, capped at 100K and keeping those with that broadcasted those the most, and it tracks the affiliation of the MPs that broadcasted the same resources. When one affiliation accounts for two thirds or more of those alignments, it marks it as the main affiliation of that person. That just means that this person is particularly aligned with the themes broadcasted by the MPs of that group, regardless of whether or not they agree on a political or ideological level. For convenience, let us call this set of users "the corpus".
8. It extracts all the pairs of users from the corpus that have broadcasted at least 2 of the top 300 resources in common. For those pairs, it computes the pointwise mutual information (PMI) about the probability that a resource gets broadcasted by those two users (each pair). It exports the "co-broadcast" network of the users from the corpus, connected by edges weighted by the PMI.

# Out of memory error
In case the defatul 1 Gb RAM is not enough, specify a higher limit. For instance:
```
node --max-old-space-size=16384 01_update_mp_list.js
```
Values: 8192, 16384, 32768... depending on the computer.