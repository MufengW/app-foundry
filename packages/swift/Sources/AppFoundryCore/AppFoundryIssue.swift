import Foundation

public struct AppFoundryIssue: Error, Equatable {
  public let code: String
  public let message: String
  public let details: [String: String]

  public init(_ message: String, code: String, details: [String: String] = [:]) {
    self.message = message
    self.code = code
    self.details = details
  }
}

public struct ByteLimit: Equatable {
  public let maxBytes: Int

  public init(maxBytes: Int) {
    self.maxBytes = max(0, maxBytes)
  }

  public func validate(byteCount: Int, label: String) throws {
    if byteCount < 0 {
      throw AppFoundryIssue("\(label) byte count is invalid.", code: "byte_count_invalid")
    }
    if byteCount > maxBytes {
      throw AppFoundryIssue(
        "\(label) exceeds the configured byte limit.",
        code: "file_too_large",
        details: [
          "maxBytes": String(maxBytes),
          "byteCount": String(byteCount)
        ]
      )
    }
  }
}

public enum AppFoundryStrings {
  public static func trimmedNonEmpty(_ value: String, fieldName: String) throws -> String {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      throw AppFoundryIssue("\(fieldName) is required.", code: "\(fieldName)_required")
    }
    return trimmed
  }
}
