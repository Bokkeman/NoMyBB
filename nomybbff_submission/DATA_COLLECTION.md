# Firefox data collection

The manifest already declares this. Leave it as written unless the extension starts sending something else.

```json
"data_collection_permissions": {
  "required": ["websiteContent", "authenticationInfo"]
}
```

Firefox shows these to the user at install because the add-on cannot do its job without them.

## websiteContent

Required. NoMyBB reads headlines and article text on the news sites you use, and sends the headline, the article URL, and an excerpt to api.deepseek.com. A follow-up also sends your question and up to four earlier answers. Automatic and Inspect send trimmed home-page markup only after you choose that action and allow that site.

## authenticationInfo

Required. The Deepseek API key is stored in extension storage and sent only to api.deepseek.com.

## Categories that stay off

- `none` would be false. The add-on does transmit data.
- `personallyIdentifyingInfo` is not collected. NoMyBB does not ask for the user's name, email, or address.
- `searchTerms` is not the browser's search history. A follow-up question is part of the website-content request for that article.
- `browsingActivity`, `websiteActivity`, `locationInfo`, `healthInfo`, `financialAndPaymentInfo`, `personalCommunications`, and `bookmarksInfo` are not collected or sent.
- There is no optional data category. The add-on does not have a separate telemetry switch.

If a later version transmits a new category, add it here and in `nomybbff/manifest.json` before the next upload. Firefox rejects a submission whose declaration does not match the code.
