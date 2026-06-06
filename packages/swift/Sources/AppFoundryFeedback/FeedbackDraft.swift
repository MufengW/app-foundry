import Foundation
import AppFoundryCore

public enum FeedbackType: String, Codable, Equatable {
  case bug
  case feature
  case other
}

public enum FeedbackAttachmentKind: String, Codable, Equatable {
  case screenshot
  case annotatedScreenshot = "annotated_screenshot"
  case photo
  case logArchive = "log_archive"
  case other
}

public struct FeedbackAttachment: Codable, Equatable {
  public var kind: FeedbackAttachmentKind
  public var storageKey: String
  public var contentType: String
  public var byteSize: Int?
  public var width: Double?
  public var height: Double?
  public var createdAt: Date?

  public init(
    kind: FeedbackAttachmentKind = .screenshot,
    storageKey: String,
    contentType: String,
    byteSize: Int? = nil,
    width: Double? = nil,
    height: Double? = nil,
    createdAt: Date? = nil
  ) throws {
    guard Self.isObjectKey(storageKey) else {
      throw AppFoundryIssue("Feedback attachment storage key is invalid.", code: "feedback_attachment_key_invalid")
    }
    self.kind = kind
    self.storageKey = storageKey
    self.contentType = contentType
    self.byteSize = byteSize
    self.width = width
    self.height = height
    self.createdAt = createdAt
  }

  public static func isObjectKey(_ value: String) -> Bool {
    if value.isEmpty || value.count > 512 { return false }
    if value.lowercased().hasPrefix("http://") || value.lowercased().hasPrefix("https://") { return false }
    if value.hasPrefix("/") || value.contains("\\") || value.contains("..") { return false }
    let parts = value.split(separator: "/", omittingEmptySubsequences: false)
    guard !parts.isEmpty, parts.allSatisfy({ !$0.isEmpty }) else { return false }
    guard let extensionPart = value.split(separator: ".").last?.lowercased() else { return false }
    let allowedExtensions = Set(["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm", "m4a", "mp3", "wav", "ogg"])
    guard allowedExtensions.contains(extensionPart) else { return false }
    return parts.allSatisfy { part in
      part.range(of: #"^[A-Za-z0-9][A-Za-z0-9._-]*$"#, options: .regularExpression) != nil
    }
  }
}

public enum FeedbackAttachmentStatusError: String, Codable, Equatable {
  case validationFailed = "validation_failed"
  case uploadFailed = "upload_failed"
  case storageUnavailable = "storage_unavailable"
  case notProvided = "not_provided"
  case unknown

  public init(rawStatusError: String?) {
    guard let normalized = rawStatusError?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    else {
      self = .unknown
      return
    }
    self = FeedbackAttachmentStatusError(rawValue: normalized) ?? .unknown
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    self.init(rawStatusError: try? container.decode(String.self))
  }
}

public struct FeedbackAttachmentStatus: Codable, Equatable {
  public var attached: Bool
  public var error: FeedbackAttachmentStatusError?

  private enum CodingKeys: String, CodingKey {
    case attached
    case error
  }

  public init(attached: Bool, error: FeedbackAttachmentStatusError? = nil) {
    self.attached = attached
    self.error = attached ? nil : (error ?? .unknown)
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let attached = (try? container.decode(Bool.self, forKey: .attached)) ?? false
    let error = try? container.decode(FeedbackAttachmentStatusError.self, forKey: .error)
    self.init(attached: attached, error: error)
  }
}

public struct FeedbackContext: Codable, Equatable {
  public var platform: String?
  public var appVersion: String?
  public var appBuild: String?
  public var deviceModel: String?
  public var osVersion: String?

  public init(
    platform: String? = nil,
    appVersion: String? = nil,
    appBuild: String? = nil,
    deviceModel: String? = nil,
    osVersion: String? = nil
  ) {
    self.platform = platform
    self.appVersion = appVersion
    self.appBuild = appBuild
    self.deviceModel = deviceModel
    self.osVersion = osVersion
  }
}

public struct StructuredFeedbackContentHeadings: Equatable {
  public var observedBehavior: String
  public var expectedBehavior: String
  public var suspectedCause: String

  public init(
    observedBehavior: String = "Observed behavior",
    expectedBehavior: String = "Expected behavior",
    suspectedCause: String = "Suspected cause"
  ) {
    self.observedBehavior = observedBehavior
    self.expectedBehavior = expectedBehavior
    self.suspectedCause = suspectedCause
  }
}

public struct StructuredFeedbackContent: Codable, Equatable {
  public var observedBehavior: String
  public var expectedBehavior: String?
  public var suspectedCause: String?

  public init(
    observedBehavior: String,
    expectedBehavior: String? = nil,
    suspectedCause: String? = nil
  ) {
    self.observedBehavior = observedBehavior
    self.expectedBehavior = expectedBehavior
    self.suspectedCause = suspectedCause
  }

  public func normalized(requireObservedBehavior: Bool = true) throws -> StructuredFeedbackContent {
    let observed = observedBehavior.trimmingCharacters(in: .whitespacesAndNewlines)
    if requireObservedBehavior && observed.isEmpty {
      throw AppFoundryIssue("feedback_observed_behavior is required.", code: "feedback_observed_behavior_required")
    }

    return StructuredFeedbackContent(
      observedBehavior: observed,
      expectedBehavior: trimmedOptional(expectedBehavior),
      suspectedCause: trimmedOptional(suspectedCause)
    )
  }

  public func buildContent(
    headings: StructuredFeedbackContentHeadings = StructuredFeedbackContentHeadings(),
    requireObservedBehavior: Bool = true
  ) throws -> String {
    let normalized = try normalized(requireObservedBehavior: requireObservedBehavior)
    var sections: [String] = []
    for (heading, value) in [
      (headings.observedBehavior, normalized.observedBehavior),
      (headings.expectedBehavior, normalized.expectedBehavior ?? ""),
      (headings.suspectedCause, normalized.suspectedCause ?? "")
    ] where !value.isEmpty {
      let normalizedHeading = heading.trimmingCharacters(in: .whitespacesAndNewlines)
      if normalizedHeading.isEmpty {
        throw AppFoundryIssue("Structured feedback heading is required.", code: "feedback_structured_heading_required")
      }
      sections.append("\(normalizedHeading)\n\(value)")
    }
    return sections.joined(separator: "\n\n")
  }

  private func trimmedOptional(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

public struct FeedbackDraftPolicy: Equatable {
  public var maxContentCharacters: Int
  public var maxAttachments: Int

  public init(maxContentCharacters: Int = 5_000, maxAttachments: Int = 5) {
    self.maxContentCharacters = maxContentCharacters
    self.maxAttachments = maxAttachments
  }
}

public struct FeedbackDraft: Equatable {
  public var type: FeedbackType
  public var content: String
  public var context: FeedbackContext
  public var attachments: [FeedbackAttachment]
  public var attachDebugLogs: Bool
  public var debugLogScopes: [String]

  public init(
    type: FeedbackType = .other,
    content: String = "",
    context: FeedbackContext = FeedbackContext(),
    attachments: [FeedbackAttachment] = [],
    attachDebugLogs: Bool = false,
    debugLogScopes: [String] = []
  ) {
    self.type = type
    self.content = content
    self.context = context
    self.attachments = attachments
    self.attachDebugLogs = attachDebugLogs
    self.debugLogScopes = debugLogScopes
  }

  public init(
    type: FeedbackType = .other,
    structuredContent: StructuredFeedbackContent,
    headings: StructuredFeedbackContentHeadings = StructuredFeedbackContentHeadings(),
    requireObservedBehavior: Bool = true,
    context: FeedbackContext = FeedbackContext(),
    attachments: [FeedbackAttachment] = [],
    attachDebugLogs: Bool = false,
    debugLogScopes: [String] = []
  ) throws {
    self.init(
      type: type,
      content: try structuredContent.buildContent(
        headings: headings,
        requireObservedBehavior: requireObservedBehavior
      ),
      context: context,
      attachments: attachments,
      attachDebugLogs: attachDebugLogs,
      debugLogScopes: debugLogScopes
    )
  }

  public func validated(policy: FeedbackDraftPolicy = FeedbackDraftPolicy()) throws -> FeedbackSubmission {
    let trimmed = try AppFoundryStrings.trimmedNonEmpty(content, fieldName: "feedback_content")
    if trimmed.count > policy.maxContentCharacters {
      throw AppFoundryIssue("Feedback content exceeds the configured character limit.", code: "feedback_content_too_long")
    }
    if attachments.count > policy.maxAttachments {
      throw AppFoundryIssue("Feedback attachment count exceeds the configured limit.", code: "feedback_attachments_too_many")
    }
    return FeedbackSubmission(
      type: type,
      content: trimmed,
      context: context,
      attachments: attachments,
      attachDebugLogs: attachDebugLogs,
      debugLogScopes: Array(Set(debugLogScopes.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }).filter { !$0.isEmpty }.sorted())
    )
  }
}

public struct FeedbackSubmission: Codable, Equatable {
  public let type: FeedbackType
  public let content: String
  public let context: FeedbackContext
  public let attachments: [FeedbackAttachment]
  public let attachDebugLogs: Bool
  public let debugLogScopes: [String]
}
