# Notes for the Chrome reviewer

Paste this into the reviewer-notes field at upload time. Add the temporary key only in that form. Do not commit a live key to the repository.

## What this submission is

NoMyBB 1.0.12 rewrites news headlines. The package is the `nomybb` extension. Source is plain JavaScript, not minified.

NoMyBB is not affiliated with MyBroadband, Newsday, or BusinessTech. Testing uses the public pages of those sites.

## How to test

1. Install the package and open the extension settings.
2. Paste this temporary Deepseek API key, then click Save: PASTE_A_TEMPORARY_KEY_IN_THE_STORE_FORM_ONLY
3. Open https://mybroadband.co.za/news and wait. Headlines that are not cached are fetched and sent to api.deepseek.com. A fixed progress bar at the top of the page shows the run. Cached headlines change without another model call.
4. Open one article. The main headline is the rewritten title. A Summary box appears at the top of the article body. Hover the headline to see the original title when it differs. The headline links under the article (Latest news, More news, Trending news) and in the side lists are rewritten. Links in the article body are not.
5. On that article, type a short follow-up and click Ask. The answer appears above the box. Reload the article. The answer is still there.
6. In settings, add one ignore topic that matches a visible story, save, and reload the news page. That card is hidden. Opening the article directly still shows it.
7. Leave the API key blank and reload a news page. Headlines stay as published, and the page says a key is required.

The first uncached visit can take a few minutes because each new article is fetched and then sent in a batch.

## Permissions that look broad

`https://*/*` is optional and is not granted at install. It is requested only after a click, and only for the one hostname the user is adding (`https://host/*` and `https://www.host/*`).

`scripting` is used to register the content script on a site the user has added and allowed.

`https://raw.githubusercontent.com/Bokkeman/NoMyBB/*` reads the text file VERSION. The body is parsed as `x.y.z` and is not executed.

## Privacy

The privacy policy URL in this submission matches PRIVACY_POLICY.md. Website content and the API key go to api.deepseek.com for the headline feature. They are not sold.
