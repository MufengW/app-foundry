# AppFoundry Swift

SwiftPM package for native feedback, screenshot, and upload primitives.

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

## Development

```bash
swift test --package-path packages/swift
swift build --package-path examples/swiftui-feedback-demo
```

The Swift package is part of the V0 scaffold and is not published yet.

See [SwiftUI Feedback Demo](../../examples/swiftui-feedback-demo) for a
compilable reference composition that keeps UI, auth, and backend routing
app-owned.
