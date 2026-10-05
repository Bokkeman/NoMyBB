# NoMyBB for Firefox

Firefox extension that cleans headlines on MyBroadband, Newsday, and BusinessTech. It drops clickbait, names the vague places and people, and hides topics you ignore.

This folder is the Firefox build of the Chrome extension in `nomybb`. Settings, site rules, cached titles, and the on-page progress banner behave the same way. Firefox keeps its own copy of that data.

## Load it in Firefox

Firefox 142 or newer is required.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Choose `manifest.json` in this folder.

A temporary add-on is removed when Firefox exits. Load it again after a restart. The extension id is fixed, so saved settings survive that reload.

To keep it permanently, zip this folder with `manifest.json` at the root of the zip and submit the zip on [addons.mozilla.org](https://addons.mozilla.org/).

Open settings from the toolbar button. The Deepseek API key stays in Firefox extension storage and is sent only to api.deepseek.com, along with the headline and article text being cleaned.

On an article page, the summary is followed by a box where you can ask Deepseek a follow-up. The article text is the starting point. Deepseek then searches the web for what the question needs beyond that page. The question, the answer, and the pages it used appear above the box.
