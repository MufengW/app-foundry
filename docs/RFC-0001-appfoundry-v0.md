# RFC-0001: AppFoundry V0 Plan

## Status

Draft.

## Product Thesis

AppFoundry is production rails for AI-built apps.

It helps generated or rapidly built apps become production-safe without forcing a backend migration.

The first wedge is:

> Self-hostable feedback, annotated screenshots, privacy-safe debug logs, and media upload safety for apps that already have a backend.

## Background

Rapidly built apps often converge on the same production-safety needs:

- validating image, video, audio, and screenshot uploads
- compressing and preparing client-side media
- collecting feedback with useful app, device, and version context
- attaching bounded debug snapshots to feedback
- redacting secrets and inline media before persistence
- moving large media out of databases and into object storage
- signing object references close to response time
- documenting backup, restore, rollback, and verification steps

AppFoundry extracts those repeated needs into small contracts, helpers, and
recipes that existing apps can adopt without replacing their backend.

## Goals

- Provide stable, framework-agnostic contracts for feedback, debug logs, and media safety.
- Make privacy-safe behavior the default.
- Support existing backends through adapters instead of requiring migration to a platform.
- Make the repo friendly to AI coding agents through recipes and explicit contracts.
- Keep public APIs app-agnostic and free of consumer-specific product concepts.

## Non-Goals

- Replace Supabase, Appwrite, Parse, PostHog, Highlight, Sentry, Uppy, or Better Auth.
- Provide a full auth framework in V0.
- Provide contacts/friends/social graph in V0.
- Provide a hosted SaaS dashboard in V0.
- Provide analytics, session replay, crash reporting, or feature flags.
- Encode consumer-specific business concepts in core APIs.

## V0 Modules

### Core

Common types and policies:

- branded IDs where useful
- typed result/errors
- privacy policy helpers
- redaction keys/policies
- attachment size limits
- clocks and test helpers

### Debug

Responsibilities:

- debug event schema
- source/platform typing
- request/session correlation
- scoped log tags
- redaction before persistence
- snapshot policies for feedback attachments
- retention and truncation policy helpers

Core must not assume a database. It should expose interfaces such as:

```ts
export interface DebugLogRepository {
  append(event: DebugEvent): Promise<void>;
  appendMany(events: DebugEvent[]): Promise<void>;
  findSnapshot(query: DebugSnapshotQuery): Promise<DebugEvent[]>;
}
```

### Media

Responsibilities:

- declared MIME + magic-byte validation
- max-size policies
- object key policies
- object-store abstraction
- presigned URL helpers
- extraction of object keys from URLs or stored values
- response-field signing helpers

Core must target this shape, not R2 directly:

```ts
export interface ObjectStore {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getSignedReadUrl(input: SignReadUrlInput): Promise<SignedUrl>;
}
```

### Feedback

Responsibilities:

- feedback request/response contracts
- screenshot/media attachment references
- attached debug log snapshot flow
- admin list/seen/resolve lifecycle contracts
- user-owned feedback list/resolve lifecycle contracts
- notifier hooks

Core must be storage/repository agnostic:

```ts
export interface FeedbackRepository {
  create(input: CreateFeedbackRecordInput): Promise<FeedbackRecord>;
  listForUser(query: UserFeedbackQuery): Promise<FeedbackRecord[]>;
  listForAdmin(query: AdminFeedbackQuery): Promise<FeedbackRecordPage>;
  markSeen(input: MarkFeedbackSeenInput): Promise<void>;
  resolve(input: ResolveFeedbackInput): Promise<FeedbackRecord>;
  userResolve(input: UserResolveFeedbackInput): Promise<FeedbackRecord>;
}
```

### Express Adapter

Reference routes/middleware for Express apps. This package may depend on Express, but the core feedback/debug/media packages must not.

### Storage S3 Adapter

S3-compatible implementation for:

- AWS S3
- Cloudflare R2
- MinIO

### Prisma Adapter

Optional reference adapter and schema guidance. This should be treated as a pattern, not the only supported persistence layer.

### Swift Package

Targets:

- `AppFoundryCore`
- `AppFoundryImage`
- `AppFoundryFeedback`
- `AppFoundryUpload`

Swift responsibilities:

- image compression
- crop request/result types
- screenshot annotation composition
- feedback form state primitives
- multipart/base64/object upload abstractions
- client-side debug event submission contracts

## Source Pattern Guidelines

AppFoundry should extract only reusable infrastructure patterns:

- feedback lifecycle: create, list, seen, resolve, and notify
- multi-attachment feedback submission
- scoped debug log snapshots
- redaction before persistence
- request/session/source correlation
- client-side image preparation and screenshot annotation primitives
- object key extraction and response-time signing
- multipart upload validation and storage adapters
- migration recipes with backup, restore, rollback, and verification guidance

AppFoundry should not extract product workflows:

- app-specific media generation
- inventory, catalog, relationship, memory, or social graph behavior
- full auth/session frameworks
- business-specific admin screens

## Migration Strategy

### Phase 0: Scaffold and Contracts

- Create docs, package directories, and core contracts.
- Add tests for redaction and object-key helpers.
- Do not modify consumer apps yet.

### Phase 1: Debug and Redaction

- Extract redaction and debug event schema.
- Adopt in one consumer app through an app-local wrapper.
- Extend to bulk debug ingestion once tests prove redaction-before-write behavior.

### Phase 2: Feedback Contracts and Storage-Backed Attachments

- Extract feedback contracts and attachment models.
- Preserve the consumer app's current feedback behavior.
- Migrate screenshots from database base64 to object storage only with a verified backup and restore path.
- Add multi-screenshot, annotation, and scoped log support through shared contracts.

### Phase 3: Media Safety

- Extract object-store interfaces, S3/R2 adapter, validation, and presign helpers.
- Use existing multipart upload flows as references for reusable validation.
- Keep app-specific AI/image transports outside V0 core until they can be generalized safely.

### Phase 4: Optional Auth Session Helpers

- Extract client refresh coordinator and secure token store patterns only after feedback/media APIs stabilize.
- Treat logout revocation and token versioning as optional adapter guidance, not V0 core.

### Phase 5: Optional Social Helpers

- Extract only generic relationship state-machine helpers if still useful.
- Keep app-specific inventory, sharing, discoverability, or social behavior inside consumer apps.

## Dependency Strategy

During active extraction:

- Use a sibling local repository during development.
- Consumer apps should use local path dependencies.
- Do not add AppFoundry as a submodule until V0 APIs stabilize.

After V0 stabilizes:

- Tag AppFoundry releases.
- Pin consumer apps to tags or package versions.
- Consider npm/SwiftPM publication.

## Open Questions

- Package scaffold currently uses `@app-foundry/*`; confirm npm scope availability before the first public tag.
- Final license: recommended Apache-2.0.
- Whether to build a CLI in V0 or after the first app adoption.
- Whether the first public demo should be SwiftUI-first or web+Express-first.
