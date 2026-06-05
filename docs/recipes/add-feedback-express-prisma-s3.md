# Recipe: Add Feedback to an Existing Express/Prisma/S3 App

## Goal

Add production-safe feedback with object-storage-backed screenshots and optional debug log snapshots to an existing Express app.

## Intended Consumer

This recipe is written for AI coding agents and human maintainers.

## Preconditions

- Express backend exists.
- Some authenticated user context exists.
- Database can store feedback metadata.
- S3-compatible object storage exists or can be configured.

## Steps

1. Add feedback database records.
2. Add attachment database records or JSON metadata.
3. Add an `ObjectStore` adapter for the storage provider.
4. Store screenshots with `storeFeedbackAttachment`.
5. Add feedback create endpoint.
6. Add user feedback list endpoint.
7. Add admin list/seen/resolve endpoints.
8. Add optional debug snapshot attachment.
9. Ensure screenshots are not stored as base64 text in the database.
10. Add tests for permissions, size limits, redaction, and admin lifecycle.

## Required Safety Checks

- Reject unsupported content types.
- Validate magic bytes, not only declared MIME.
- Limit screenshot count and size.
- Validate uploads before writing object storage.
- Redact debug logs before persistence.
- Do not return raw screenshot data in list responses.
- Use signed URLs for private attachments.

## Verification

- Submit feedback without screenshot.
- Submit feedback with screenshot.
- Submit feedback with multiple screenshots if enabled.
- Submit feedback with attached debug logs.
- Confirm user can list only their own feedback.
- Confirm admin can list/resolve/mark seen.
- Confirm raw screenshot/base64 is absent from list payloads.
- Confirm uploaded object exists in storage.

## Rollback

- Keep old feedback endpoint until the new one is verified.
- If migrating screenshots out of DB, keep legacy read fallback until migration completes.
