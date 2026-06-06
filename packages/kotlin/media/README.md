# AppFoundry Kotlin Media

Kotlin/JVM media upload preparation for consumer apps that want AppFoundry's
magic-byte validation without taking a dependency on a specific Android UI,
HTTP client, backend route, or object-store provider.

The package validates bytes before an app-owned multipart adapter uploads them:

- detects JPEG, PNG, GIF, WebP, MP4/MOV, WebM, WAV, MP3, M4A, and Ogg bytes
- checks declared MIME compatibility
- enforces byte limits
- returns a normalized MIME type and file extension

## Local Source Adoption

During the pre-publish V0 phase, Android consumers can include this source from
a pinned AppFoundry submodule:

```kotlin
android {
    sourceSets {
        getByName("main") {
            java.srcDir("../../app-foundry/packages/kotlin/media/src/main/kotlin")
        }
        getByName("test") {
            java.srcDir("../../app-foundry/packages/kotlin/media/src/test/kotlin")
        }
    }
}
```

## Example

```kotlin
import com.appfoundry.media.MediaUploadPolicies
import com.appfoundry.media.MediaUploadPreflight

val prepared = MediaUploadPreflight.prepare(
    bytes = bytes,
    declaredMimeType = declaredMimeType,
    policy = MediaUploadPolicies.image(maxBytes = 5 * 1024 * 1024),
)

val mimeType = prepared.mimeType
val extension = prepared.extension
```
