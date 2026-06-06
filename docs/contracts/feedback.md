# Feedback Contract

## Purpose

Define a portable feedback model that supports user feedback, screenshot attachments, debug log snapshots, and admin triage without assuming a specific database or web framework.

## Core Concepts

### Feedback

A user-submitted report or suggestion.

Recommended fields:

- `id`
- `userId`
- `type`
- `content`
- `structuredContent`
- `context`
- `platform`
- `appVersion`
- `appBuild`
- `deviceModel`
- `osVersion`
- `attachments`
- `debugSnapshot`
- `status`
- `seenAt`
- `resolvedAt`
- `resolvedBy`
- `adminNote`
- `createdAt`
- `updatedAt`

### Attachment

An object-storage-backed artifact linked to feedback.

Attachment types:

- `screenshot`
- `annotated_screenshot`
- `photo`
- `log_archive`
- `other`

Recommended fields:

- `id`
- `kind`
- `storageKey`
- `contentType`
- `byteSize`
- `width`
- `height`
- `createdAt`

### Attachment Status

A submission response may report whether an optional attachment was accepted
without turning the whole feedback submission into a failure.

Recommended fields:

- `attached`
- `error`

Supported `error` values:

- `validation_failed`
- `upload_failed`
- `storage_unavailable`
- `not_provided`
- `unknown`

Consumers should treat `{ attached: false }` as non-blocking when the feedback
record itself was created. Show a warning only when the attachment matters to
the user, and avoid retrying provider or storage work implicitly.

### Debug Snapshot

A bounded, redacted set of debug events attached at submission time.

Recommended fields:

- `attached`
- `eventCount`
- `windowStartedAt`
- `windowEndedAt`
- `scopes`
- `storageKey` or repository reference
- `redactionPolicyVersion`

### Structured Content

A portable authoring model for bug reports that still stores as plain feedback
content.

Recommended fields:

- `observedBehavior`
- `expectedBehavior`
- `suspectedCause`

`observedBehavior` is required by default. Optional fields are omitted when
blank. Consumer apps may override section headings to preserve their current
admin copy, but AppFoundry owns the field semantics and content builder.

## Interfaces

```ts
export interface CreateFeedbackInput {
  userId?: string | null;
  type: FeedbackType;
  content?: string;
  structuredContent?: StructuredFeedbackContentInput;
  structuredContentOptions?: StructuredFeedbackContentOptions;
  context?: FeedbackContext;
  attachments?: FeedbackAttachmentInput[];
  attachDebugLogs?: boolean;
  debugLogScopes?: string[];
}

export interface StructuredFeedbackContentInput {
  observedBehavior?: string;
  expectedBehavior?: string;
  suspectedCause?: string;
}

export interface FeedbackService {
  create(input: CreateFeedbackInput): Promise<CreateFeedbackResult>;
  listForUser(query: UserFeedbackQuery): Promise<FeedbackRecord[]>;
  listForAdmin(query: AdminFeedbackQuery): Promise<FeedbackRecordPage>;
  markSeen(input: MarkFeedbackSeenInput): Promise<void>;
  markSeenMany(input: MarkFeedbackSeenManyInput): Promise<FeedbackBulkMutationResult>;
  resolve(input: ResolveFeedbackInput): Promise<FeedbackRecord>;
  resolveMany(input: ResolveFeedbackManyInput): Promise<FeedbackBulkMutationResult>;
  userResolve(input: UserResolveFeedbackInput): Promise<FeedbackRecord>;
}

export interface StoreFeedbackAttachmentInput {
  objectStore: { putObject(input: PutObjectInput): Promise<StoredObject> };
  body: Uint8Array | ArrayBuffer | ArrayBufferView;
  declaredContentType?: string | null;
  kind?: FeedbackAttachmentKind;
  storageKey?: string;
  purpose?: string;
  ids?: string[];
  maxBytes?: number;
  allowedContentTypes?: string[];
}

export interface StoreFeedbackAttachmentResult {
  attachment: FeedbackAttachmentRecord;
  storedObject: StoredObject;
  validation: ValidateUploadResult;
}

export type FeedbackAttachmentStatusError =
  | "validation_failed"
  | "upload_failed"
  | "storage_unavailable"
  | "not_provided"
  | "unknown";

export type FeedbackAttachmentStatus =
  | { attached: true }
  | { attached: false; error: FeedbackAttachmentStatusError };
```

Admin list queries may include portable triage filters:

- `changedSince`: rows whose create/seen/resolve/user-resolve state changed after a timestamp
- `createdSince`: rows created at or after a timestamp
- `resolved`: filter resolved or unresolved rows
- `seen`: filter seen or unseen rows
- `limit`: capped at 500 by the service before calling the repository

Bulk lifecycle inputs normalize and de-duplicate string IDs before calling the
repository. `markSeenMany({ all: true })` intentionally passes an empty ID list
with `all: true` so the app-owned repository can decide the correct scope.

`storeFeedbackAttachment` is the write-path helper for storage-backed
screenshots and similar feedback media. It validates bytes and content type
before calling `objectStore.putObject`, then returns a normalized attachment
record that can be persisted by the app-owned repository.

## Privacy Defaults

- Screenshots should be stored in object storage, not inline database text.
- Feedback list endpoints should not return raw screenshot data by default.
- Attachment upload helpers should reject inline `data`, `base64`, and
  `screenshotBase64` fields.
- Debug snapshots must be redacted before persistence.
- Secret fields and base64-like payloads must be redacted defensively.
- Attachments should have explicit retention and deletion policies.

## Migration Notes

When migrating an existing app, preserve the app's current feedback lifecycle
first. Move screenshots and other large attachments to object storage behind a
reversible write path, and keep legacy read fallback until production
verification is complete.
