# AppFoundry ArkTS Media

ArkTS media upload preparation for HarmonyOS clients that want AppFoundry's
magic-byte validation without taking a dependency on one app's picker, HTTP
client, backend route, or storage provider.

The package validates bytes before an app-owned multipart adapter uploads them:

- detects JPEG, PNG, GIF, WebP, MP4/MOV, WebM, WAV, MP3, M4A, and Ogg bytes
- checks declared MIME compatibility
- enforces byte limits
- returns a normalized MIME type and file extension

## Local Submodule Adoption

During the pre-publish V0 phase, HarmonyOS consumers can include this package
from a pinned AppFoundry submodule:

```json5
{
  "dependencies": {
    "@app-foundry/media": "file:../../app-foundry/packages/arkts/media"
  }
}
```

## Example

```ts
import { MediaUploadPolicies, prepareMediaUpload } from '@app-foundry/media';

const prepared = prepareMediaUpload(
  new Uint8Array(fileBytes),
  declaredMimeType,
  MediaUploadPolicies.image(5 * 1024 * 1024)
);

const mimeType = prepared.mimeType;
const extension = prepared.extension;
```
