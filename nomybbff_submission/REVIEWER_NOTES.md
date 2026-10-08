# Notes for the Firefox reviewer

Paste this into Notes to Reviewer. Add the temporary key only in that form. Do not commit a live key to the repository.

The uploaded zip is the source. It is plain JavaScript, not minified and not bundled, so a separate source package is not required. Add-on id: `nomybbff@bokkeman.github.io`. Minimum Firefox: 142. This package is the Firefox edition (`background.scripts`), not the Chrome service-worker package.

NoMyBB is not affiliated with MyBroadband, Newsday, or BusinessTech. The test pages are public.

## How to test

1. Install the add-on. Firefox should ask for website content and authentication information, matching `data_collection_permissions`.
2. Open the toolbar button. Paste this temporary Deepseek API key and click Save: PASTE_A_TEMPORARY_KEY_IN_THE_AMO_FORM_ONLY
3. Open https://mybroadband.co.za/news and wait. Uncached headlines are fetched and sent to api.deepseek.com. A progress bar at the top of the page shows the run.
4. Open one article. The main headline is rewritten, a Summary box is at the top of the article body, and the headline links below and beside the article are rewritten. Links in the body text are unchanged. Hover a rewritten headline to see the original title when it differs.
5. Ask a follow-up on that article, then reload. The answer is still above the box.
6. Add an ignore topic that matches a visible story, save, and reload the listing. That card is hidden.
7. Clear the API key, save, and reload the listing. Headlines stay as the site published them, and the page reports that a key is required.

The first uncached visit can take a few minutes.

## Permissions

`https://*/*` is optional. It is not granted at install. A click on Automatic, Inspect, or Save for one new hostname requests only `https://that-host/*` and `https://www.that-host/*`.

`scripting` registers the content script on a site the user has added and allowed.

`https://raw.githubusercontent.com/Bokkeman/NoMyBB/*` downloads the text file VERSION at most once a day. The body is read as a version number and is not executed.

`storage` holds the key, settings, and headline cache on the device. `alarms` drops cache entries above the user's limit about every six hours.

## Privacy

The privacy policy URL matches the published policy. Website content and the API key are sent to api.deepseek.com for headline rewriting. They are not sold.
