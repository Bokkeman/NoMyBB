# NoMyBB privacy policy

Draft for version 1.0.12. Replace `CONTACT_EMAIL` and set the date before you publish this page.

Effective date: DATE

This policy covers the NoMyBB browser extension for Chrome and the NoMyBB browser extension for Firefox. The two editions keep separate copies of their settings and cache. Uninstalling one does not clear the other.

NoMyBB is an independent tool. It is not affiliated with MyBroadband, Newsday, BusinessTech, or Deepseek.

Contact: CONTACT_EMAIL

## What the extension does

NoMyBB rewrites news headlines on sites you choose. MyBroadband, Newsday, and BusinessTech are built in. You can add another https site from the settings page. Rewriting, summaries, and follow-up answers are produced by Deepseek with an API key you supply.

The extension does not require an account with NoMyBB. It does not show ads. It does not sell data. It does not send analytics.

## Data stored on your device

The extension stores this in the browser's extension storage:

- Your Deepseek API key.
- The topics you choose to ignore, the sites you add, and related settings.
- A cache of article URLs, original headlines, replacement headlines, summaries, and up to eight follow-up questions and answers per article. The default cache holds 100 articles. You can set it from 1 to 2000. Older entries are deleted. Clear cache deletes the cache.
- A local record of the latest version check, so the version file is requested at most once a day.

## Data sent to Deepseek

When a headline is not already cached, NoMyBB sends this to `https://api.deepseek.com`:

- The article URL and the headline as published.
- A short excerpt: the page description and up to eight paragraphs from the article body, cut at 3,500 characters.
- The ignore-topic list you saved, so Deepseek can mark a matching story.

When you ask a follow-up on an article that has a summary, NoMyBB sends the headline, the summary, a longer body excerpt cut at 8,600 characters, your question (up to 500 characters), and up to four earlier questions and answers from that article. Deepseek may run a web search to answer. Up to four source links from that search can be shown under the answer and stored in the local cache.

When you choose Automatic for a new site, or Inspect on a site you already added, NoMyBB first asks permission for that hostname. If you allow it, NoMyBB fetches that site's home page and sends a trimmed copy of the page markup, up to 48,000 characters, with scripts and styles removed, so Deepseek can suggest selectors. Nothing is sent until you choose Automatic or Inspect.

The API key is sent only to `api.deepseek.com`, as the credential for these requests. It is not sent to the news sites or to GitHub.

Deepseek processes these requests under its own terms and privacy policy. Confirm the current policy address before you rely on it: https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html

## Data sent to GitHub

About once a day the extension requests `https://raw.githubusercontent.com/Bokkeman/NoMyBB/main/VERSION`. That response is a version number in plain text. The extension does not run it. The request does not include the API key, headlines, or article text.

## Sites the extension reads

On a built-in news site, NoMyBB reads headlines and article text so it can rewrite them. It does not read passwords or form data.

Access to any other site is off until you add that site. The browser then asks you to allow that hostname. Denying the prompt leaves the site unchanged.

## Your choices

- Leave the API key empty. Headlines stay as published, and nothing is sent to Deepseek.
- Clear the cache in settings.
- Remove a site you added, or reset a built-in site's rules.
- Dismiss the update notice. That stores the version you dismissed and does not send article text.
- Remove the extension. The browser deletes that edition's extension storage.

## Changes

If this policy changes, the published page will keep a new effective date. The extension will show a notice if the way it handles data changes after you install it.
