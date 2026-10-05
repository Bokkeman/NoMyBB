# NoMyBB

Browser extensions that clean headlines on MyBroadband, Newsday, and BusinessTech. They drop clickbait, name the vague places and people, and hide topics you choose to ignore.

- `nomybb` is the Chrome extension.
- `nomybbff` is the Firefox extension. Firefox 142 or newer is required.

Each browser keeps its own settings and cache. Open the toolbar button and save a Deepseek API key. The key stays in extension storage and is sent only to api.deepseek.com, along with the headline and article text being cleaned.

On an article page, the summary is followed by a box where you can ask Deepseek a follow-up. The article text is the starting point. Deepseek then searches the web for what the question needs beyond that page. The question, the answer, and the pages it used appear above the box.

After you change the extension files, reload the extension, then refresh any open news tab.

## Chrome, developer mode

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose the `nomybb` folder, the one that contains `manifest.json`.
5. Pin NoMyBB from the extensions menu and open it to save your API key.

Chrome keeps an unpacked extension after you restart the browser. Use the reload control on the NoMyBB card at `chrome://extensions` when you pick up a new version of this folder.

## Firefox, temporary add-on

Firefox loads an unpacked extension as a temporary add-on. That is the debugging install, and Firefox removes it when Firefox exits.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Choose `manifest.json` inside the `nomybbff` folder.
4. Open NoMyBB from the toolbar and save your API key.

Load the temporary add-on again after you restart Firefox. The extension id stays `nomybbff@bokkeman.github.io`, so the saved API key, site rules, and cached headlines are still there on the next load.
