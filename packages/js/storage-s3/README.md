# @app-foundry/storage-s3

S3-compatible `ObjectStore` adapter shell for AWS S3, Cloudflare R2, and
MinIO-style clients.

This package intentionally does not import the AWS SDK in V0 scaffold. Apps can
inject an S3-compatible client, command constructors, and a presigner.

## Example

```js
import { createS3ObjectStore } from "@app-foundry/storage-s3";

const store = createS3ObjectStore({
  bucket: "app-media",
  client,
  commands: { PutObjectCommand, DeleteObjectCommand, GetObjectCommand },
  getSignedUrl,
});

await store.putObject({
  key: "feedback/project/report.jpg",
  body: bytes,
  contentType: "image/jpeg",
});
```

Keeping SDK imports outside this package lets AppFoundry core packages stay
portable and keeps consumer apps in control of SDK versions and credentials.
