# Package Boundaries

This document defines the intended package/module boundaries for AppFoundry V0.

## Boundary Principles

- Public packages should map to capabilities, not implementation details.
- Core packages must be portable and testable without network, database, or framework dependencies.
- Adapter packages may be opinionated, but must remain replaceable.
- Swift targets should be small enough for apps to adopt only the pieces they need.
- Consumer apps should not import private/internal paths.

## JavaScript/TypeScript Packages

### `@app-foundry/core`

Purpose:

- shared errors
- result helpers
- clocks
- limits
- redaction policy types
- attachment policy types
- common test fixtures

Must not depend on:

- Express
- Prisma
- AWS SDK
- Node-only file system APIs unless guarded

### `@app-foundry/debug`

Purpose:

- debug event types
- redaction implementation
- debug snapshot query types
- tag/scope matching
- payload truncation
- retention policy helpers

Depends on:

- `@app-foundry/core`

Exports:

```ts
redactPayload
sanitizeDebugEvent
sanitizeDebugEvents
matchesDebugScopes
createDebugSnapshot
```

### `@app-foundry/media`

Purpose:

- `ObjectStore` interface
- stored object types
- MIME/magic-byte validation contracts
- image/video/audio upload safety defaults
- bytes and base64 upload validation helpers
- object key helpers
- signed URL types
- attachment metadata types

Depends on:

- `@app-foundry/core`

May optionally depend on:

- `file-type` in a validation subpath, if separated cleanly

Exports:

```ts
ObjectStore
StoredObject
validateUpload
extractObjectKey
isObjectKey
createObjectKey
```

### `@app-foundry/feedback`

Purpose:

- feedback request/response contracts
- feedback lifecycle service
- structured feedback content model and builder
- repository/notifier/debug/storage interfaces
- attachment handling policy
- user/admin query types

Depends on:

- `@app-foundry/core`
- `@app-foundry/debug`
- `@app-foundry/media`

Must not depend on:

- Express
- Prisma
- AWS SDK

Exports:

```ts
createFeedbackService
buildStructuredFeedbackContent
normalizeStructuredFeedbackInput
FeedbackRepository
DebugLogRepository
FeedbackNotifier
FeedbackRecord
CreateFeedbackInput
```

### `@app-foundry/express`

Purpose:

- Express middleware and route factory examples
- request auth context adapter
- multipart parsing integration examples

Depends on:

- Express
- AppFoundry core packages

Must avoid:

- requiring Prisma
- requiring one auth library
- requiring one storage provider

### `@app-foundry/storage-s3`

Purpose:

- S3-compatible `ObjectStore` implementation
- works with AWS S3, Cloudflare R2, and MinIO

Depends on:

- AWS SDK S3 client
- `@app-foundry/media`

### `@app-foundry/cli`

Purpose:

- read-only agent CLI scaffold
- repository health checks
- privacy-risk source audits
- adoption checklists for existing apps

Must avoid:

- rewriting app files without an explicit generator command
- running migrations or backfills
- assuming AppFoundry owns auth, routing, or deployment

### `@app-foundry/prisma-adapter`

Purpose:

- reference repository adapter patterns
- schema guidance
- example implementation for the demo app

Important:

This package is optional. AppFoundry core must work without Prisma.

## Swift Package Targets

### `AppFoundryCore`

Purpose:

- shared value types
- limits
- upload/feedback/debug contract models
- encoding/decoding helpers

### `AppFoundryImage`

Purpose:

- image compression
- image resizing
- screenshot preparation
- crop request/result data types
- optional adapters for crop UI should remain isolated

### `AppFoundryFeedback`

Purpose:

- feedback form state primitives
- screenshot attachment state
- debug-log flush status models
- feedback submit client protocol

Must avoid:

- forcing one app's UI style
- hardcoding copy
- hardcoding backend URL shape

### `AppFoundryUpload`

Purpose:

- multipart upload builder
- JSON/base64 upload transport abstraction
- upload progress state
- retry/recoverable error models

## Public API Discipline

Do:

- export stable top-level entry points
- keep app-specific examples under `examples/`
- document breaking changes

Do not:

- let consumer apps import from `src/internal`
- expose provider-specific classes as core requirements
- let consumer app naming leak into package names
