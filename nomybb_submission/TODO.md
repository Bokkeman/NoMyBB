# List NoMyBB on the Chrome Web Store

Work top to bottom. Do not commit a Deepseek API key into this folder.

- [ ] Replace `CONTACT_EMAIL` and `DATE` in `PRIVACY_POLICY.md`.
- [ ] Publish that file at a public HTTPS address that opens without a login. A page on GitHub is enough. Copy the final URL.
- [ ] Add this notice to `nomybb/popup.html` and `nomybbff/popup.html`, directly above the Save button, so it is visible before the first article is sent:

```html
<p class="hint">NoMyBB sends headlines, a short article excerpt, and any follow-up question to api.deepseek.com. The API key stays in this browser and is sent only there. None of this is sold.</p>
```

- [ ] If you change the popup, bump `VERSION`, `nomybb/manifest.json`, and `nomybbff/manifest.json` to the next version before you upload. The zip you submit has to match that version.
- [ ] Build a zip whose root is the extension, not a parent folder. Leave out `preview.html`, `followup-preview.html`, `version-preview.html`, and `progress-seed.html`.

```powershell
$stage = Join-Path $env:TEMP 'nomybb-zip'
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item nomybb\manifest.json, nomybb\background.js, nomybb\content.js, nomybb\content.css, nomybb\shared.js, nomybb\popup.html, nomybb\popup.js, nomybb\popup.css, nomybb\LICENSE -Destination $stage
Copy-Item nomybb\icons $stage\icons -Recurse
Compress-Archive -Path "$stage\*" -DestinationPath nomybb_submission\nomybb-chrome.zip -Force
```

- [ ] Open https://chrome.google.com/webstore/devconsole and finish the one-time developer registration. A new publisher account can take extra time to verify.
- [ ] Upload `nomybb-chrome.zip`.
- [ ] Paste the store text from `LISTING.md`.
- [ ] Paste each justification from `PERMISSIONS.md` into the matching permission field.
- [ ] Fill the privacy form from `PRIVACY_FORM.md`. Use the published policy URL. Declare website content and authentication information.
- [ ] Add at least one screenshot, 1280×800 or 640×400. Show a rewritten headline on a MyBroadband listing, and the settings page with the disclosure visible.
- [ ] Paste `REVIEWER_NOTES.md` into the reviewer notes. Put a temporary Deepseek key only in that form, on the line marked for it.
- [ ] Submit. If review asks about `https://*/*` or about sending page text to Deepseek, answer from `PERMISSIONS.md` and `PRIVACY_POLICY.md`.
- [ ] After it is approved, ship later changes by uploading a zip with a higher version.
