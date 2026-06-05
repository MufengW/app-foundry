# @app-foundry/debug

Portable debug-event contracts and privacy-first sanitizers.

## Example

```js
import { sanitizeDebugEvents } from "@app-foundry/debug";

const events = sanitizeDebugEvents([
  {
    source: "ios",
    eventType: "feedback_submit",
    debugPrefix: "api.feedback",
    payload: {
      screenshotBase64: "...",
      accessToken: "...",
    },
    occurredAt: new Date().toISOString(),
  },
]);
```

The sanitized payload redacts secret-like fields and known image/audio base64
fields before persistence. This is designed for both single-event writes and
bulk `/debug/log` ingestion.

## Privacy Defaults

Default redaction covers passwords, auth tokens, cookies, admin secrets, API
keys, push tokens, screenshot/photo arrays, and Gemini-style
`{ inlineData: { mimeType, data } }` payloads.
