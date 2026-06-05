# Media Object Contract

## Purpose

Define storage-agnostic media and attachment objects for uploads, screenshots,
thumbnails, avatars, feedback artifacts, and short-lived AI audio inputs.

## Object Store Interface

```ts
export interface ObjectStore {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getSignedReadUrl(input: SignReadUrlInput): Promise<SignedUrl>;
}

export interface PutObjectInput {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  contentType: string;
  byteSize?: number;
  url?: string;
}

export interface SignReadUrlInput {
  key: string;
  expiresInSeconds?: number;
}
```

## Upload Validation

Validation should check:

- declared MIME type
- magic-byte detected MIME type
- maximum byte size
- allowed media category
- compatible container aliases such as M4A/MP4, WebM audio/video, and WAV aliases
- optional image dimensions
- filename/path normalization

Declared MIME type alone is insufficient.

## Key Policy

Object keys should be:

- app-controlled
- traceable enough for debugging
- free of raw user-provided filenames
- partitioned by purpose and optionally user/project
- safe to delete by prefix only when the prefix is app-owned

Example pattern:

```text
feedback/{projectId}/{feedbackId}/{attachmentId}.jpg
media/{userId}/{objectId}.jpg
avatars/{userId}/{objectId}.jpg
```

## Presigned URLs

Stored records should prefer storage keys over long-lived public URLs.

Response signing should:

- sign known object references close to response time
- avoid loading large attachment bodies into list responses
- return safe placeholders if signing fails
- use bounded cache where appropriate

## Migration Notes

Prefer storage keys over persisted public URLs during migrations. Keep
app-specific media pipelines outside V0 core until their validation and storage
needs can be expressed through generic contracts.
