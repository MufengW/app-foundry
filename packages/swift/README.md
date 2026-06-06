# AppFoundry Swift

SwiftPM package for native feedback, screenshot, media, and upload primitives.

The package is intentionally UI-agnostic. It does not import SwiftUI, UIKit, or
PencilKit in core targets. Consumer apps can wrap these value types with their
own screens, image pickers, annotation surfaces, upload clients, and auth.

## Targets

| Target | Purpose |
| --- | --- |
| `AppFoundryCore` | Shared errors, byte limits, and small validation helpers. |
| `AppFoundryImage` | Screenshot magic-byte detection, upload preparation, and annotation geometry contracts. |
| `AppFoundryFeedback` | Feedback draft, attachment, and submission value types. |
| `AppFoundryUpload` | Multipart form-data builder and upload request primitives. |
| `AppFoundryMedia` | Framework-agnostic media upload preflight for image, video, and audio bytes. |

## Example

```swift
import AppFoundryImage
import AppFoundryFeedback

let screenshot = try ScreenshotPreparer.prepare(
  data: imageData,
  declaredContentType: "image/png"
)

let attachment = try ScreenshotAttachmentFactory.attachment(
  for: screenshot,
  storageKey: "feedback/report-1/screenshot.png",
  annotated: true
)

let submission = try FeedbackDraft(
  type: .bug,
  content: "The annotation shifted after save.",
  attachments: [attachment],
  attachDebugLogs: true,
  debugLogScopes: ["api.feedback"]
).validated()
```

Structured bug reports can use the same field semantics as the JavaScript
feedback package while still submitting plain text to an app-owned API:

```swift
let structured = StructuredFeedbackContent(
  observedBehavior: "The feedback sheet closed after adding a screenshot.",
  expectedBehavior: "The draft should stay open.",
  suspectedCause: "The sheet state reset on dismiss."
)

let submission = try FeedbackDraft(
  type: .bug,
  structuredContent: structured,
  headings: StructuredFeedbackContentHeadings(
    observedBehavior: "Bug symptom",
    expectedBehavior: "Expected correct behavior",
    suspectedCause: "Possible root cause"
  ),
  attachDebugLogs: true
).validated()
```

Client responses can decode optional attachment status without treating the
whole feedback submission as failed:

```swift
let screenshot = try JSONDecoder().decode(
  FeedbackAttachmentStatus.self,
  from: Data(#"{"attached":false,"error":"validation_failed"}"#.utf8)
)
```

Audio, video, and image upload surfaces can preflight raw bytes before sending
base64 payloads or multipart bodies to an app-owned backend:

```swift
import AppFoundryMedia

let media = try MediaUploadPreparer.prepare(
  data: audioData,
  declaredContentType: "audio/m4a",
  policy: MediaPreparationPolicy(
    allowedContentTypes: MediaContentType.audioUploadContentTypes,
    preferDeclaredContentType: true
  )
)

let encoded = media.data.base64EncodedString()
```

## Development

```bash
swift test --package-path packages/swift
swift build --package-path examples/swiftui-feedback-demo
```

The Swift package is part of the V0 scaffold and is not published yet.

See [SwiftUI Feedback Demo](../../examples/swiftui-feedback-demo) for a
compilable reference composition that keeps UI, auth, and backend routing
app-owned.
