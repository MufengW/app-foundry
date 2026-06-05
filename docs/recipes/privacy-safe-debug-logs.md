# Recipe: Privacy-Safe Debug Logs

## Goal

Capture useful app debug context without storing secrets, raw base64 media, or unbounded logs.

## Required Defaults

- Redact before persistence.
- Redact bulk ingestion as well as single events.
- Truncate large payloads.
- Add retention policy.
- Add feedback snapshot window.
- Avoid logging auth headers and cookies.
- Avoid logging raw AI/media inline data.

## Recommended Redaction Keys

Secret-like:

- `password`
- `currentPassword`
- `newPassword`
- `token`
- `accessToken`
- `refreshToken`
- `idToken`
- `jwt`
- `authorization`
- `cookie`
- `apiKey`
- `secret`
- `clientSecret`
- `deviceToken`
- `pushToken`
- `apnsToken`

Base64/media-like:

- `photoBase64`
- `imageBase64`
- `avatarBase64`
- `audioBase64`
- `screenshotBase64`
- `screenshots`
- `photos`
- `inlineData.data`

## Feedback Snapshot

Default policy:

- lookback: 30 minutes
- max events: 2000
- optional scopes/tags
- include client and server correlation IDs

## Agent Checklist

When auditing an existing app:

- Find all debug log writes.
- Check whether all writes pass through one redaction function.
- Check bulk ingestion.
- Check request/response capture middleware.
- Check high-volume endpoints and polling throttles.
- Check retention cleanup.
- Check feedback submission flushes logs before submit.
