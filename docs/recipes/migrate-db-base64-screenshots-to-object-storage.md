# Recipe: Migrate DB Base64 Screenshots to Object Storage

## Goal

Move screenshot payloads out of database text fields and into object storage while preserving feedback history.

## Why

Database-stored base64 screenshots:

- increase database size quickly
- slow list/admin queries
- complicate retention/deletion
- increase accidental exposure risk
- make response redaction harder

## Migration Shape

Before:

```text
feedback.screenshotData = "data:image/jpeg;base64,..."
feedback.screenshotsJson = "[...]"
```

After:

```text
feedback.attachments = [
  {
    kind: "screenshot",
    storageKey: "feedback/{feedbackId}/{attachmentId}.jpg",
    contentType: "image/jpeg",
    byteSize: 123456
  }
]
```

## Safe Migration Steps

1. Add attachment metadata fields/table.
2. Update new writes to store screenshots in object storage.
3. Keep legacy read fallback for old feedback.
4. Backfill old base64 screenshots to object storage in batches.
5. Verify object existence and metadata.
6. Update list endpoints to return `hasScreenshot` and attachment metadata only.
7. Remove legacy base64 fields only after backup and verification.

## Verification

- Old feedback screenshots still render through fallback.
- New feedback screenshots use signed object URLs.
- Admin list does not load raw screenshot bodies.
- Backfilled count equals legacy screenshot count.
- Failed backfill rows are logged and retryable.

## Rollback

- Do not delete legacy fields until at least one release after successful backfill.
- Keep a script to rebuild attachment metadata from legacy fields while they still exist.
