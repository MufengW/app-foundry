# Roadmap

## Stage 0: RFC and Scaffold

Outcome:

- AppFoundry repo has positioning, contracts, ADRs, and reusable recipes.
- No consumer app behavior changes.

Deliverables:

- README
- AGENTS guide
- RFC-0001
- Build vs Adopt
- Package Boundaries
- Consumer Integration Strategy
- Contract docs for feedback/debug/media

## Stage 1: Core Debug Safety

Outcome:

- Shared redaction and debug event sanitization are implemented and tested.
- Consumer apps can use the same redaction behavior through local wrappers.

Deliverables:

- JS package scaffold
- redaction implementation
- debug event sanitizer
- unit tests
- one consumer adoption example

Success criteria:

- bulk debug ingestion is sanitized before persistence.
- consumer behavior remains compatible.

## Stage 2: Media Safety Core

Outcome:

- Object storage and media validation contracts are reusable.

Deliverables:

- `ObjectStore` interface
- object key helpers
- upload validation helpers
- bytes/base64 upload validation helpers
- S3/R2 adapter
- signed URL helpers
- tests

Success criteria:

- existing media flows can use shared helpers.
- app-specific upload behavior remains inside the consumer app.

## Stage 3: Feedback Contracts

Outcome:

- Feedback contracts and attachment models are shared.

Deliverables:

- feedback service interfaces
- repository/notifier/debug/storage adapter contracts
- attachment metadata model
- admin/user lifecycle types
- tests

Success criteria:

- a consumer app can keep its feedback workflow while using shared contracts.
- multi-screenshot and scoped-log-compatible models are reusable.

## Stage 4: Storage-Backed Feedback Attachments

Outcome:

- Screenshots are stored in object storage, not database base64 fields.

Deliverables:

- migration recipe
- `storeFeedbackAttachment` helper
- write path for object-storage screenshots
- legacy read fallback
- backfill script plan
- verification tests

Success criteria:

- feedback list endpoints avoid loading screenshot bodies
- screenshot access uses signed URLs
- rollback remains possible

## Stage 5: Swift Package

Outcome:

- SwiftUI/native app primitives are shared.

Deliverables:

- `AppFoundryCore`
- `AppFoundryImage`
- `AppFoundryFeedback`
- `AppFoundryUpload`
- screenshot magic-byte preparation primitives
- annotation geometry value types
- multipart form-data builder
- image compression tests where practical
- sample SwiftUI feedback demo

Success criteria:

- consumer apps can replace app-local image/feedback primitives incrementally.
- feedback UI primitives do not import or assume any consumer app UI.

## Stage 6: Agent CLI

Outcome:

- AI coding agents can audit and add AppFoundry features more reliably.

Initial scaffold:

- `@app-foundry/cli`
- read-only `doctor`
- read-only `audit-privacy`
- `add feedback --dry-run` adoption checklist

Potential commands:

```bash
npx app-foundry doctor
npx app-foundry audit-privacy
npx app-foundry add feedback --dry-run
```

This is not V0 unless earlier stages are stable.

## Stage 7: Public Release

Outcome:

- AppFoundry is ready for limited public usage.

Prerequisites:

- license finalized
- package names finalized
- examples runnable
- docs complete
- no consumer app secrets, internal paths, or product-specific leakage
- tagged release

## Stage 8: Commercial Option

Outcome:

- Decide whether to build hosted feedback inbox.

Only pursue if there are adoption signals:

- hosted requests
- integration support requests
- external users beyond stars
- repeatable setup pain
