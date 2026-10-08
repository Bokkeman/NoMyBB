# Chrome permission justifications

Paste one justification per permission. Keep each one specific to this extension.

## storage

Saves the user's Deepseek API key, ignore list, site rules, and the local cache of rewritten headlines, summaries, and follow-up answers. Nothing in this store is synced to a NoMyBB server.

## scripting

Registers the extension's content script on a news site only after the user adds that site and the browser grants that site. The three built-in sites are listed in the manifest.

## alarms

Wakes about every six hours to delete cached articles above the limit the user set (1 to 2000, default 100).

## Host permission https://mybroadband.co.za/* and https://www.mybroadband.co.za/*

Reads headlines and article text on MyBroadband so they can be rewritten. The same reason applies to the Newsday and BusinessTech host permissions:

- https://newsday.co.za/*
- https://www.newsday.co.za/*
- https://businesstech.co.za/*
- https://www.businesstech.co.za/*

## Host permission https://api.deepseek.com/*

Sends headline-rewrite and follow-up requests to Deepseek with the API key the user saved. No other host receives the API key.

## Host permission https://raw.githubusercontent.com/Bokkeman/NoMyBB/*

Reads the plain-text file VERSION at most once a day to see if a newer release exists. The response is parsed as a version number and is never executed. The request does not include the API key or article text.

## Optional host permission https://*/*

Not granted at install. When the user adds one extra site, the extension requests only `https://that-host/*` and `https://www.that-host/*`, from a click on Automatic, Inspect, or Save. Denying the prompt leaves that site unchanged.
