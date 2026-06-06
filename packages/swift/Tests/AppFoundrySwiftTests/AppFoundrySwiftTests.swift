import XCTest
import Foundation
import AppFoundryCore
import AppFoundryImage
import AppFoundryFeedback
import AppFoundryUpload
import AppFoundryMedia

final class AppFoundrySwiftTests: XCTestCase {
  func testScreenshotPreparationUsesMagicBytesWhenDeclarationIsMissing() throws {
    let png = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    let prepared = try ScreenshotPreparer.prepare(data: png, declaredContentType: nil)

    XCTAssertEqual(prepared.contentType, .png)
    XCTAssertEqual(prepared.byteSize, png.count)
  }

  func testScreenshotPreparationRejectsMismatchedOrOversizedBytes() throws {
    let png = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    XCTAssertThrowsError(try ScreenshotPreparer.prepare(data: png, declaredContentType: "image/jpeg")) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "content_type_mismatch")
    }
    XCTAssertThrowsError(
      try ScreenshotPreparer.prepare(
        data: png,
        declaredContentType: "image/png",
        policy: ScreenshotPreparationPolicy(maxBytes: 4)
      )
    ) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "file_too_large")
    }
  }

  func testMediaPreparationAllowsCompatibleM4AAudio() throws {
    let m4a = Data([0x00, 0x00, 0x00, 0x18]) + Data("ftypM4A ".utf8) + Data([0x00, 0x00, 0x00, 0x00])
    let prepared = try MediaUploadPreparer.prepare(
      data: m4a,
      declaredContentType: "audio/m4a",
      policy: MediaPreparationPolicy(
        allowedContentTypes: MediaContentType.audioUploadContentTypes,
        preferDeclaredContentType: true
      )
    )

    XCTAssertEqual(prepared.contentType, .audioM4a)
    XCTAssertEqual(prepared.detectedContentType, .audioMp4)
    XCTAssertEqual(prepared.declaredContentType, .audioM4a)
    XCTAssertEqual(prepared.fileExtension, "m4a")
  }

  func testMediaPreparationRejectsMismatchedBytes() throws {
    let png = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    XCTAssertThrowsError(
      try MediaUploadPreparer.prepare(
        data: png,
        declaredContentType: "audio/m4a",
        policy: MediaPreparationPolicy(allowedContentTypes: MediaContentType.audioUploadContentTypes)
      )
    ) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "detected_content_type_not_allowed")
    }
  }

  func testMediaPreparationAllowsWavAlias() throws {
    let wav = Data("RIFF".utf8) + Data([0x00, 0x00, 0x00, 0x00]) + Data("WAVE".utf8)
    let prepared = try MediaUploadPreparer.prepare(
      data: wav,
      declaredContentType: "audio/x-wav",
      policy: MediaPreparationPolicy(
        allowedContentTypes: [.audioXWav],
        preferDeclaredContentType: true
      )
    )

    XCTAssertEqual(prepared.contentType, .audioXWav)
    XCTAssertEqual(prepared.detectedContentType, .audioWav)
    XCTAssertEqual(prepared.fileExtension, "wav")
  }

  func testAnnotationPrimitivesValidateNormalizedGeometry() throws {
    let pointA = try NormalizedImagePoint(x: 0.25, y: 0.5)
    let pointB = try NormalizedImagePoint(x: 0.75, y: 0.5)
    let color = try RGBAColor(red: 1, green: 0, blue: 0, alpha: 0.8)
    let stroke = try ScreenshotAnnotationStroke(points: [pointA, pointB], color: color, lineWidth: 4)
    let draft = ScreenshotAnnotationDraft(strokes: [stroke])

    XCTAssertFalse(draft.isEmpty)
    XCTAssertThrowsError(try NormalizedImagePoint(x: 1.1, y: 0.5)) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "annotation_point_invalid")
    }
  }

  func testFeedbackDraftValidationAndScreenshotAttachmentFactory() throws {
    let png = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    let prepared = try ScreenshotPreparer.prepare(data: png, declaredContentType: "image/png")
    let attachment = try ScreenshotAttachmentFactory.attachment(
      for: prepared,
      storageKey: "feedback/report-1/screenshot.png",
      annotated: true
    )

    let draft = FeedbackDraft(
      type: .bug,
      content: "  The annotation moved after save.  ",
      context: FeedbackContext(platform: "ios", appVersion: "1.0"),
      attachments: [attachment],
      attachDebugLogs: true,
      debugLogScopes: ["api.feedback", " api.feedback ", ""]
    )
    let submission = try draft.validated()

    XCTAssertEqual(submission.content, "The annotation moved after save.")
    XCTAssertEqual(submission.attachments[0].kind, .annotatedScreenshot)
    XCTAssertEqual(submission.debugLogScopes, ["api.feedback"])
    XCTAssertThrowsError(try FeedbackDraft(content: " ").validated()) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "feedback_content_required")
    }
    XCTAssertThrowsError(try FeedbackAttachment(storageKey: "https://example.com/shot.png", contentType: "image/png")) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "feedback_attachment_key_invalid")
    }
  }

  func testStructuredFeedbackContentBuildsPortableSections() throws {
    let content = StructuredFeedbackContent(
      observedBehavior: "  Sheet closed after I added a screenshot.  ",
      expectedBehavior: "Draft should stay open.",
      suspectedCause: "Sheet state is reset on dismiss."
    )

    XCTAssertEqual(
      try content.buildContent(),
      [
        "Observed behavior",
        "Sheet closed after I added a screenshot.",
        "",
        "Expected behavior",
        "Draft should stay open.",
        "",
        "Suspected cause",
        "Sheet state is reset on dismiss."
      ].joined(separator: "\n")
    )

    XCTAssertEqual(
      try StructuredFeedbackContent(
        observedBehavior: "  UI froze  ",
        expectedBehavior: "\n",
        suspectedCause: nil
      ).buildContent(headings: StructuredFeedbackContentHeadings(
        observedBehavior: "Bug symptom",
        expectedBehavior: "Expected",
        suspectedCause: "Possible cause"
      )),
      "Bug symptom\nUI froze"
    )

    XCTAssertThrowsError(try StructuredFeedbackContent(observedBehavior: " ").buildContent()) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "feedback_observed_behavior_required")
    }
    XCTAssertThrowsError(
      try StructuredFeedbackContent(observedBehavior: "UI froze").buildContent(
        headings: StructuredFeedbackContentHeadings(observedBehavior: " ", expectedBehavior: "Expected")
      )
    ) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "feedback_structured_heading_required")
    }
  }

  func testFeedbackDraftBuildsFromStructuredContent() throws {
    let draft = try FeedbackDraft(
      type: .bug,
      structuredContent: StructuredFeedbackContent(
        observedBehavior: "  Upload succeeded but screenshot disappeared.  ",
        expectedBehavior: "Screenshot should stay attached.",
        suspectedCause: "Client ignored the screenshot response status."
      ),
      headings: StructuredFeedbackContentHeadings(
        observedBehavior: "Bug symptom",
        expectedBehavior: "Expected correct behavior",
        suspectedCause: "Possible root cause"
      ),
      context: FeedbackContext(platform: "ios"),
      attachDebugLogs: true,
      debugLogScopes: ["api.feedback"]
    )

    let submission = try draft.validated()

    XCTAssertEqual(submission.type, .bug)
    XCTAssertEqual(submission.context.platform, "ios")
    XCTAssertTrue(submission.attachDebugLogs)
    XCTAssertEqual(submission.debugLogScopes, ["api.feedback"])
    XCTAssertEqual(
      submission.content,
      [
        "Bug symptom",
        "Upload succeeded but screenshot disappeared.",
        "",
        "Expected correct behavior",
        "Screenshot should stay attached.",
        "",
        "Possible root cause",
        "Client ignored the screenshot response status."
      ].joined(separator: "\n")
    )
  }

  func testFeedbackAttachmentStatusDecodesDroppedScreenshotResponses() throws {
    let dropped = try JSONDecoder().decode(
      FeedbackAttachmentStatus.self,
      from: Data(#"{"attached":false,"error":"validation_failed"}"#.utf8)
    )
    let unknown = try JSONDecoder().decode(
      FeedbackAttachmentStatus.self,
      from: Data(#"{"attached":false,"error":"vendor_specific_failure"}"#.utf8)
    )
    let attached = try JSONDecoder().decode(
      FeedbackAttachmentStatus.self,
      from: Data(#"{"attached":true,"error":"validation_failed"}"#.utf8)
    )

    XCTAssertEqual(dropped, FeedbackAttachmentStatus(attached: false, error: .validationFailed))
    XCTAssertEqual(unknown.error, .unknown)
    XCTAssertEqual(attached, FeedbackAttachmentStatus(attached: true))

    let encoded = try JSONEncoder().encode(FeedbackAttachmentStatus(attached: false, error: .uploadFailed))
    let decoded = try JSONDecoder().decode(FeedbackAttachmentStatus.self, from: encoded)

    XCTAssertEqual(decoded, FeedbackAttachmentStatus(attached: false, error: .uploadFailed))
  }

  func testMultipartFormDataBuilder() throws {
    let form = try MultipartFormDataBuilder.build(
      parts: [
        MultipartPart(name: "content", body: Data("A useful report".utf8)),
        MultipartPart(
          name: "screenshot",
          filename: "screenshot.png",
          contentType: "image/png",
          body: Data("PNGDATA".utf8)
        )
      ],
      boundary: "appfoundry-test-boundary"
    )
    let body = String(data: form.body, encoding: .utf8) ?? ""

    XCTAssertEqual(form.contentType, "multipart/form-data; boundary=appfoundry-test-boundary")
    XCTAssertTrue(body.contains("name=\"content\""))
    XCTAssertTrue(body.contains("filename=\"screenshot.png\""))
    XCTAssertTrue(body.contains("Content-Type: image/png"))
    XCTAssertTrue(body.hasSuffix("--appfoundry-test-boundary--\r\n"))
    XCTAssertThrowsError(
      try MultipartFormDataBuilder.build(parts: [
        MultipartPart(name: "bad\nname", body: Data())
      ])
    ) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "multipart_header_value_invalid")
    }
    XCTAssertThrowsError(
      try MultipartFormDataBuilder.build(parts: [
        MultipartPart(name: "screenshot", contentType: "image/png\r\nX-Test: 1", body: Data())
      ])
    ) { error in
      XCTAssertEqual((error as? AppFoundryIssue)?.code, "multipart_header_value_invalid")
    }
  }
}
