# @app-foundry/media

Storage-agnostic media contracts and object-key helpers.

## Example

```js
import {
  IMAGE_UPLOAD_CONTENT_TYPES,
  detectUploadContentType,
  extractObjectKey,
  validateBase64Upload,
  validateUpload,
  validateUploadBytes,
} from "@app-foundry/media";

const key = extractObjectKey("https://media.example.com/feedback/report.jpg", {
  allowedOrigins: ["https://media.example.com"],
});

const detectedContentType = detectUploadContentType(bytes);
const validation = validateUpload({
  declaredContentType: "image/jpeg",
  detectedContentType,
  byteSize: 420_000,
  maxBytes: 2_000_000,
  requireDetectedContentType: true,
});

const image = validateUploadBytes({
  bytes,
  allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
  maxBytes: 2_000_000,
  requireDetectedContentType: true,
});

const inlineImage = validateBase64Upload({
  data: "data:image/png;base64,...",
  allowedContentTypes: IMAGE_UPLOAD_CONTENT_TYPES,
  maxBytes: 2_000_000,
  requireDetectedContentType: true,
});
```

Stored records should prefer object keys over long-lived public URLs. Adapters
can sign those keys close to response time for S3, R2, MinIO, or another object
store.

## Safety Defaults

`detectUploadContentType` provides a lightweight magic-byte sniffer for common
image, video, and audio uploads. `validateUpload` treats declared MIME type as
insufficient by itself when `requireDetectedContentType` is enabled: the
detected type must exist, match the declared type, and be in the allowed list.

Some media signatures identify a container rather than the final media kind.
MP4, QuickTime, and M4A are treated as compatible ISO-BMFF declarations; WebM
audio/video declarations are treated as compatible WebM container declarations;
`audio/wav` and `audio/x-wav` are treated as aliases.

`validateUploadBytes` and `validateBase64Upload` wrap detection and validation
for common backend adapters. When a caller omits `declaredContentType`, these
helpers can infer it from magic bytes; callers handling container aliases such
as M4A can set `preferDeclaredContentType` to keep the app-facing MIME type
while still requiring compatible detected bytes.
