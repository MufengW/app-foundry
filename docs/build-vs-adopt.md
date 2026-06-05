# Build vs Adopt

This document defines where AppFoundry should build original value and where it should reuse or adapt existing open-source tools.

## Build

### Feedback and Debug Context Glue

Build this because it is the product wedge.

Capabilities:

- feedback lifecycle contracts
- screenshot attachment flow
- annotated screenshot composition contracts
- debug log snapshot attachment
- scoped log tags
- user/admin resolve/seen lifecycle
- privacy-safe payload defaults

### Redaction and Privacy Policies

Build this because it must be consistent across feedback, debug logs, uploads, and recipes.

Capabilities:

- base64 redaction
- secret/token redaction
- screenshot/log truncation
- inline data redaction
- defensive handling of circular objects
- safe defaults for client and server logs

### Adapter Contracts

Build this because AppFoundry's differentiation is supporting existing stacks.

Contracts:

- `ObjectStore`
- `FeedbackRepository`
- `DebugLogRepository`
- `FeedbackNotifier`
- `AuthContextProvider`
- `RedactionPolicy`
- `AttachmentPolicy`

### Agent Recipes

Build this because AI coding workflows consume instructions differently from human-only SDK consumers.

Recipes should be explicit enough for a coding agent to:

- add feedback to an existing Express app
- add SwiftUI feedback UI
- migrate base64 screenshots to object storage
- audit upload validation
- audit debug log redaction

## Adopt or Adapt

### Object Storage

Do not build a storage backend. Build adapters for S3-compatible object stores.

Targets:

- AWS S3
- Cloudflare R2
- MinIO
- Supabase Storage later if useful

### Image Processing

Use proven libraries where possible.

Backend:

- `sharp` for image thumbnail/resize/metadata work

iOS:

- UIKit/CoreGraphics for compression/composition
- Mantis as an optional crop UI adapter
- PencilKit as an optional annotation adapter

### Upload Protocols

Do not replace Uppy or tus.

Potential integration:

- Uppy for web uploader UI
- tus for resumable large uploads
- native Swift/Kotlin upload clients for app-specific UX

### Auth

Do not build a full auth framework in V0.

Potential integrations:

- Better Auth for TypeScript apps
- existing custom JWT refresh-token systems
- Supabase/Appwrite auth through adapters if needed later

### Observability

Do not replace Sentry, GlitchTip, PostHog, Highlight, or OpenReplay.

Potential integrations:

- send feedback links to issue/error trackers
- attach AppFoundry feedback IDs to external errors
- import redacted debug snapshots into external tools

## Avoid

- Generic utility modules without a product capability.
- One-off consumer app business logic.
- Hard dependency on Prisma in core packages.
- Hard dependency on Express in core packages.
- Hard dependency on R2 naming conventions in core packages.
- Hosted-only behavior in open-source core.
