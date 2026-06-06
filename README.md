# AppFoundry

Production rails for AI-built apps.

AppFoundry is an adapter-first toolkit for teams that already have an app and
backend, but need safer production patterns around feedback, screenshots,
debug context, media uploads, and object storage.

The V0 wedge is deliberately narrow:

> Self-hostable feedback and debug context for native and web apps with
> existing backends.

AppFoundry does not replace your backend. It gives you small, testable
contracts and helpers that can be adopted inside an existing Express, Prisma,
Rails, Django, mobile, or serverless stack without forcing a platform migration.

## Status

This repository is in early V0 scaffold stage. APIs are being extracted from
real production apps, but they are not yet stable enough for a public package
release.

Current packages:

| Package | Purpose |
| --- | --- |
| `@app-foundry/core` | Shared errors, policy helpers, and small contracts. |
| `@app-foundry/debug` | Privacy-safe debug event redaction and snapshot helpers. |
| `@app-foundry/feedback` | Feedback creation, attachment, lifecycle, and repository contracts. |
| `@app-foundry/media` | Object-key helpers and lightweight image/video/audio upload validation. |
| `@app-foundry/storage-s3` | S3-compatible object-store adapter shell for S3, R2, and MinIO. |
| `@app-foundry/cli` | Read-only agent CLI scaffold for repo health and privacy audits. |
| `packages/swift/AppFoundryCore` | Swift shared errors, byte limits, and validation helpers. |
| `packages/swift/AppFoundryImage` | Swift screenshot magic-byte detection and annotation geometry contracts. |
| `packages/swift/AppFoundryFeedback` | Swift feedback draft, attachment, and submission value types. |
| `packages/swift/AppFoundryUpload` | Swift multipart form-data builder and upload primitives. |

Planned or recipe-backed areas:

- Express controller adapters
- Prisma repository adapters
- migration recipes for database-stored base64 media

Examples:

- [SwiftUI Feedback Demo](examples/swiftui-feedback-demo)

## Why This Exists

AI coding tools make it easy to generate working apps quickly. The hard part is
turning those apps into production-safe software.

Common failure modes include:

- storing screenshots or image base64 directly in the database
- validating uploads by declared MIME type only
- leaking tokens, screenshots, or prompt payloads through debug logs
- collecting feedback without useful device, version, or request context
- coupling media storage to one provider or one app-specific schema
- migrating production data without a tested backup and restore path

AppFoundry turns those problems into reusable contracts, focused helpers, and
agent-readable recipes.

## Non-Goals

AppFoundry is not:

- a backend-as-a-service
- a full auth platform
- a social graph or contacts system
- an analytics suite
- a generic utilities bucket
- a hosted support desk

The goal is production infrastructure that can live inside your app-owned
backend, not a new platform you have to move onto.

## Install

The packages are not published yet. During V0 extraction, consumer apps can use
a local sibling dependency:

```json
{
  "dependencies": {
    "@app-foundry/debug": "file:../../app-foundry/packages/js/debug",
    "@app-foundry/feedback": "file:../../app-foundry/packages/js/feedback",
    "@app-foundry/media": "file:../../app-foundry/packages/js/media"
  }
}
```

After the public package boundary stabilizes, these will move to registry
versions.

For pre-release CI or deployment, a consumer app may pin AppFoundry as a
repo-local submodule or otherwise include it in the build context. Treat that
pointer like a dependency version: update it intentionally, run focused tests,
and commit it with the app changes that rely on the new contracts.

## Development

Install dependencies and run the contract tests:

```bash
npm install
npm test
npm run build
swift test --package-path packages/swift
swift build --package-path examples/swiftui-feedback-demo
node packages/js/cli/src/cli.js doctor
```

The root workspace runs tests across `packages/js/*/test/*.test.js`.

CLI commands:

```bash
node packages/js/cli/src/cli.js doctor
node packages/js/cli/src/cli.js audit-privacy --path .
node packages/js/cli/src/cli.js add feedback --dry-run
```

## Quick Examples

### Redact Debug Payloads

```js
import { redactPayload, sanitizeDebugEvents } from "@app-foundry/debug";

const payload = redactPayload({
  authorization: "Bearer secret-token",
  screenshotBase64: "iVBORw0KGgoAAAANSUhEUgAA..."
});

const safeEvents = sanitizeDebugEvents([
  { type: "network", payload, occurredAt: new Date().toISOString() }
]);
```

### Validate Uploaded Media

```js
import { IMAGE_UPLOAD_CONTENT_TYPES, validateUploadBytes } from "@app-foundry/media";

const result = validateUploadBytes({
  bytes: imageBuffer,
  allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
  maxBytes: 5 * 1024 * 1024,
  requireDetectedContentType: true
});

if (!result.ok) {
  throw new Error(result.errors.join(", "));
}
```

### Create Feedback Through an App-Owned Repository

```js
import { createFeedbackService } from "@app-foundry/feedback";

const feedback = createFeedbackService({
  repository: {
    create: async (input) => appFeedbackTable.insert(input),
    listForUser: async (query) => appFeedbackTable.listForUser(query),
    listForAdmin: async (query) => appFeedbackTable.listForAdmin(query),
    markSeen: async (input) => appFeedbackTable.markSeen(input),
    resolve: async (input) => appFeedbackTable.resolve(input)
  }
});

await feedback.create({
  content: "The screenshot picker hangs on save.",
  userId: "user_123",
  context: { platform: "ios" },
  attachDebugLogs: true
});
```

Structured reports can use portable field semantics while still persisting to
the app-owned `content` column:

```js
await feedback.create({
  type: "bug",
  structuredContent: {
    observedBehavior: "The feedback sheet closed after adding a screenshot.",
    expectedBehavior: "The draft should stay open.",
    suspectedCause: "The sheet state is reset on dismiss."
  },
  structuredContentOptions: {
    headings: {
      observedBehavior: "Observed",
      expectedBehavior: "Expected",
      suspectedCause: "Suspected cause"
    }
  },
  userId: "user_123"
});
```

`observedBehavior` is required by default. The optional fields are omitted when
blank, and the generated text is handed to the same repository adapter as plain
`content`, so no database migration is required.

### Store Feedback Screenshot Attachments

```js
import { storeFeedbackAttachment } from "@app-foundry/feedback";

const { attachment } = await storeFeedbackAttachment({
  objectStore,
  body: imageBytes,
  declaredContentType: requestFile.contentType,
  kind: "screenshot",
  purpose: "feedback",
  ids: [feedbackId],
  maxBytes: 5 * 1024 * 1024
});

await feedback.create({
  content: "The annotation layer shifted after save.",
  userId: "user_123",
  attachments: [attachment]
});
```

The helper validates upload bytes before storage, writes through an injected
object-store adapter, and returns metadata that can be persisted by the
app-owned feedback repository.
Use `normalizeFeedbackAttachmentStatus()` when a consumer API accepts the
feedback row but drops an optional screenshot or other attachment.

## Documentation

Start here:

- [RFC-0001: AppFoundry V0 Plan](docs/RFC-0001-appfoundry-v0.md)
- [Package Boundaries](docs/package-boundaries.md)
- [Consumer Integration Strategy](docs/consumer-integration.md)
- [Build vs Adopt](docs/build-vs-adopt.md)
- [Roadmap](docs/roadmap.md)

Recipes:

- [Privacy-Safe Debug Logs](docs/recipes/privacy-safe-debug-logs.md)
- [Add Feedback with Express, Prisma, and S3](docs/recipes/add-feedback-express-prisma-s3.md)
- [Migrate Database Base64 Screenshots to Object Storage](docs/recipes/migrate-db-base64-screenshots-to-object-storage.md)

Reference contracts:

- [Debug Event Contract](docs/contracts/debug-event.md)
- [Feedback Contract](docs/contracts/feedback.md)
- [Media Object Contract](docs/contracts/media-object.md)

## Production Safety Principles

- Keep app ownership of auth, database schema, and deployment.
- Sanitize debug data before persistence, not only before display.
- Store large media in object storage and persist object metadata in the
  database.
- Validate media bytes, not just declared MIME types.
- Keep migrations reversible until production verification is complete.
- Before any production data migration, create a fresh backup and verify it with
  a restore drill.

## Contributing

AppFoundry is not open for broad external contribution yet. During V0, the
project accepts small, focused changes that improve contracts, tests, docs, and
consumer adoption recipes without adding app-specific language.

When contributing:

- keep public APIs app-agnostic
- add focused tests for every helper or contract change
- document migration and rollback paths
- avoid behavior changes in consumer apps unless they are explicitly planned

## Security

Please do not open public issues containing secrets, tokens, screenshots, user
data, or production database details. Until a formal security policy is added,
report sensitive findings through the private maintainer channel.

## License

License is not finalized in this scaffold. The recommended default is
Apache-2.0 because AppFoundry is infrastructure/SDK code and may benefit from
an explicit patent grant.
