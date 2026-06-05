# SwiftUI Feedback Demo

This example shows how a native app can compose AppFoundry Swift primitives into
a feedback form without AppFoundry owning the app's UI, auth, routing, or
backend URL.

The demo:

- prepares screenshot bytes with magic-byte validation
- creates storage-key-backed feedback attachments
- validates a feedback draft before submission
- builds multipart form data for an app-provided upload transport

It intentionally uses a placeholder transport. Production apps should provide
their own transport that attaches auth headers, targets the app backend, and
handles retries.

## Build

```bash
swift build --package-path examples/swiftui-feedback-demo
```

## Use In A SwiftUI App

```swift
import SwiftUI
import AppFoundrySwiftUIFeedbackDemo

struct SettingsView: View {
  var body: some View {
    AppFoundryFeedbackDemoView(
      context: .init(platform: "ios", appVersion: "1.0"),
      transport: URLSessionFeedbackDemoTransport(endpoint: feedbackURL)
    )
  }
}
```

The demo view is a reference implementation, not a required UI. Apps can copy
the composition pattern and keep their own screens.
