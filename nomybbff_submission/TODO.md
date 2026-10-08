# List NoMyBB on addons.mozilla.org

Work top to bottom. Do not commit a Deepseek API key into this folder. Upload the Firefox package from `nomybbff`, not the Chrome package from `nomybb`.

- [ ] Use the same privacy page as the Chrome listing if you publish `nomybb_submission/PRIVACY_POLICY.md` once. The copy in this folder is the same text. Replace `CONTACT_EMAIL` and `DATE` before publishing, and use that HTTPS URL here.
- [ ] Add the settings-page notice from `nomybb_submission/TODO.md` to both `popup.html` files before you upload, then bump `VERSION` and both manifests if that change is not already in the version you ship.
- [ ] Build a zip with `manifest.json` at the root of the archive. Do not include preview pages.

```powershell
$stage = Join-Path $env:TEMP 'nomybbff-zip'
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item nomybbff\manifest.json, nomybbff\background.js, nomybbff\content.js, nomybbff\content.css, nomybbff\shared.js, nomybbff\popup.html, nomybbff\popup.js, nomybbff\popup.css, nomybbff\LICENSE -Destination $stage
Copy-Item nomybbff\icons $stage\icons -Recurse
Compress-Archive -Path "$stage\*" -DestinationPath nomybbff_submission\nomybb-firefox.zip -Force
```

- [ ] Sign in at https://addons.mozilla.org/developers/ and accept the Firefox Add-on Distribution Agreement if it is still waiting.
- [ ] Submit a new add-on and upload `nomybb-firefox.zip`.
- [ ] Paste the listing text from `LISTING.md`. Set the license to CC0 and the homepage to https://github.com/Bokkeman/NoMyBB.
- [ ] Put the published privacy-policy URL in the privacy-policy field.
- [ ] Confirm the data-collection section matches `DATA_COLLECTION.md`. The manifest already declares `websiteContent` and `authenticationInfo`. Do not switch it to `none`.
- [ ] Add screenshots of a rewritten MyBroadband listing and of the settings page with the disclosure visible.
- [ ] Paste `REVIEWER_NOTES.md` into Notes to Reviewer. Put a temporary Deepseek key only in that form.
- [ ] Submit. The source in the zip is the readable source, so you do not need a second source archive unless you later minify or bundle the code.
- [ ] Answer review questions from `REVIEWER_NOTES.md`, `DATA_COLLECTION.md`, and the privacy policy.
- [ ] After it is approved, ship a later change as a new version with a higher number in `nomybbff/manifest.json`.
