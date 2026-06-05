import Foundation
import SwiftUI
import AppFoundryCore
import AppFoundryImage
import AppFoundryFeedback
import AppFoundryUpload

@MainActor
public protocol FeedbackDemoTransport {
  func submit(_ submission: FeedbackSubmission, multipart: MultipartFormData?) async throws
}

public struct NoopFeedbackDemoTransport: FeedbackDemoTransport {
  public init() {}

  public func submit(_ submission: FeedbackSubmission, multipart: MultipartFormData?) async throws {}
}

public struct URLSessionFeedbackDemoTransport: FeedbackDemoTransport {
  public var endpoint: URL
  public var session: URLSession
  public var configureRequest: (inout URLRequest) -> Void

  public init(
    endpoint: URL,
    session: URLSession = .shared,
    configureRequest: @escaping (inout URLRequest) -> Void = { _ in }
  ) {
    self.endpoint = endpoint
    self.session = session
    self.configureRequest = configureRequest
  }

  public func submit(_ submission: FeedbackSubmission, multipart: MultipartFormData?) async throws {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    if let multipart {
      request.setValue(multipart.contentType, forHTTPHeaderField: "Content-Type")
      request.httpBody = multipart.body
    } else {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONEncoder().encode(submission)
    }
    configureRequest(&request)

    let (_, response) = try await session.data(for: request)
    if let httpResponse = response as? HTTPURLResponse, !(200..<300).contains(httpResponse.statusCode) {
      throw AppFoundryIssue(
        "Feedback submission failed.",
        code: "feedback_submit_failed",
        details: ["statusCode": String(httpResponse.statusCode)]
      )
    }
  }
}

public struct AppFoundryFeedbackDemoView<Transport: FeedbackDemoTransport>: View {
  @State private var type: FeedbackType = .bug
  @State private var content = ""
  @State private var attachDebugLogs = true
  @State private var screenshot: DemoScreenshot?
  @State private var status = SubmissionStatus.idle

  private let context: FeedbackContext
  private let transport: Transport
  private let makeStorageKey: (ImageContentType) -> String

  public init(
    context: FeedbackContext = FeedbackContext(platform: "ios"),
    transport: Transport,
    makeStorageKey: @escaping (ImageContentType) -> String = { contentType in
      "feedback/demo/\(UUID().uuidString.lowercased()).\(contentType.fileExtension)"
    }
  ) {
    self.context = context
    self.transport = transport
    self.makeStorageKey = makeStorageKey
  }

  public var body: some View {
    Form {
      Picker("Type", selection: $type) {
        Text("Bug").tag(FeedbackType.bug)
        Text("Feature").tag(FeedbackType.feature)
        Text("Other").tag(FeedbackType.other)
      }

      Section("Feedback") {
        TextEditor(text: $content)
          .frame(minHeight: 120)
        Toggle("Attach debug logs", isOn: $attachDebugLogs)
      }

      Section("Screenshot") {
        if let screenshot {
          LabeledContent("Prepared", value: "\(screenshot.prepared.byteSize) bytes")
          LabeledContent("Content type", value: screenshot.prepared.contentType.rawValue)
        } else {
          Text("No screenshot attached")
            .foregroundStyle(.secondary)
        }
        Button("Attach sample PNG", action: attachSampleScreenshot)
      }

      Section {
        Button(action: submit) {
          if status.isSubmitting {
            ProgressView()
          } else {
            Text("Submit")
          }
        }
        .disabled(status.isSubmitting || content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      }

      if let message = status.message {
        Section {
          Text(message)
            .foregroundStyle(status.isError ? .red : .secondary)
        }
      }
    }
  }

  private func attachSampleScreenshot() {
    do {
      let data = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      let prepared = try ScreenshotPreparer.prepare(data: data, declaredContentType: nil)
      let attachment = try ScreenshotAttachmentFactory.attachment(
        for: prepared,
        storageKey: makeStorageKey(prepared.contentType)
      )
      screenshot = DemoScreenshot(prepared: prepared, attachment: attachment)
      status = .idle
    } catch {
      status = .failed(error)
    }
  }

  private func submit() {
    Task {
      status = .submitting
      do {
        let attachments = screenshot.map { [$0.attachment] } ?? []
        let submission = try FeedbackDraft(
          type: type,
          content: content,
          context: context,
          attachments: attachments,
          attachDebugLogs: attachDebugLogs,
          debugLogScopes: attachDebugLogs ? ["app.feedback"] : []
        ).validated()

        let multipart = try buildMultipart(for: submission)
        try await transport.submit(submission, multipart: multipart)
        status = .submitted
      } catch {
        status = .failed(error)
      }
    }
  }

  private func buildMultipart(for submission: FeedbackSubmission) throws -> MultipartFormData {
    var parts = [
      MultipartPart(
        name: "payload",
        contentType: "application/json",
        body: try JSONEncoder().encode(submission)
      )
    ]
    if let screenshot {
      parts.append(
        MultipartPart(
          name: "screenshot",
          filename: "screenshot.\(screenshot.prepared.contentType.fileExtension)",
          contentType: screenshot.prepared.contentType.rawValue,
          body: screenshot.prepared.data
        )
      )
    }
    return try MultipartFormDataBuilder.build(parts: parts)
  }
}

private struct DemoScreenshot {
  var prepared: PreparedScreenshot
  var attachment: FeedbackAttachment
}

private enum SubmissionStatus {
  case idle
  case submitting
  case submitted
  case failed(Error)

  var isSubmitting: Bool {
    if case .submitting = self { return true }
    return false
  }

  var isError: Bool {
    if case .failed = self { return true }
    return false
  }

  var message: String? {
    switch self {
    case .idle, .submitting:
      return nil
    case .submitted:
      return "Feedback submitted."
    case .failed(let error):
      if let issue = error as? AppFoundryIssue {
        return "\(issue.code): \(issue.message)"
      }
      return error.localizedDescription
    }
  }
}
