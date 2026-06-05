# Debug Event Contract

## Purpose

Define a portable debug event format that can be emitted by clients and servers, redacted before persistence, and snapshotted into feedback reports.

## Recommended Event Shape

```ts
export interface DebugEvent {
  id?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string | null;
  source: DebugSource;
  platform?: DebugPlatform;
  level?: DebugLevel;
  eventType: string;
  screen?: string;
  endpoint?: string;
  debugPrefix?: string;
  tags?: string[];
  message?: string;
  payload?: unknown;
  occurredAt: string;
}
```

## Sources

Recommended source values:

- `ios`
- `android`
- `web`
- `backend`
- `ai`
- `worker`

## Privacy Requirements

Debug events must be redacted before persistence, including bulk ingestion.

Default redaction must cover:

- passwords
- current/new password fields
- access/refresh/id tokens
- JWTs
- authorization headers
- cookies
- API keys
- push/APNs/device tokens
- base64 image/audio/screenshot fields
- inline AI/media data
- screenshot/photo arrays

## Snapshot Policy

Feedback attachments should snapshot a bounded window:

- default lookback: 30 minutes
- default max events: 2000
- optional scope/tag filter
- retain only as long as needed for triage

## Implementation Notes

Redaction must happen before writes, including bulk ingestion paths. Source,
platform, scope, request, and session fields should remain generic enough to
support native, web, backend, worker, and AI-tooling events.
