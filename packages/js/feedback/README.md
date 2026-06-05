# @app-foundry/feedback

Framework-agnostic feedback service contracts.

## Example

```js
import { createFeedbackService, storeFeedbackAttachment } from "@app-foundry/feedback";

const feedback = createFeedbackService({
  repository,
  debugLogRepository,
  notifier,
});

const { attachment } = await storeFeedbackAttachment({
  objectStore,
  body: screenshotBytes,
  declaredContentType: "image/png",
  kind: "screenshot",
  purpose: "feedback",
  ids: ["project_123", "feedback_456"],
});

await feedback.create({
  userId: "user_123",
  type: "bug",
  content: "The feedback sheet froze after I attached logs.",
  attachments: [attachment],
  attachDebugLogs: true,
  debugLogScopes: ["api.feedback"],
});
```

Feedback can also be submitted as structured fields and rendered into the same
plain `content` value before persistence:

```js
await feedback.create({
  userId: "user_123",
  type: "bug",
  structuredContent: {
    observedBehavior: "The feedback sheet froze after I attached logs.",
    expectedBehavior: "The submit button should finish or show retry guidance.",
    suspectedCause: "Debug-log flush is blocking completion."
  }
});
```

Use `buildStructuredFeedbackContent()` directly when a route or client adapter
needs to preview, log, or test the generated body. `observedBehavior` is required
by default, while blank optional sections are omitted. Consumers can pass custom
`structuredContentOptions.headings` to preserve existing admin copy without
changing stored feedback rows.

The service owns validation, debug snapshot creation, lifecycle input
normalization, and notifier hooks. The consumer app still owns persistence
through a `FeedbackRepository` adapter. Attachment uploads write through an
injected object store, so S3, R2, MinIO, local test stores, and custom providers
can share the same validation path.

## Privacy Defaults

Feedback attachments are storage-key references, not inline base64. Attached
debug snapshots are built with `@app-foundry/debug`, so payloads are redacted
before they are handed to the repository.

`storeFeedbackAttachment` rejects inline `data`, `base64`, and
`screenshotBase64` fields, validates magic bytes before storage, and defaults to
common screenshot image content types.
