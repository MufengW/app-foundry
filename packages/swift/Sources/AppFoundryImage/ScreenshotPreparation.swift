import Foundation
import AppFoundryCore

public enum ImageContentType: String, CaseIterable, Codable, Equatable {
  case jpeg = "image/jpeg"
  case png = "image/png"
  case gif = "image/gif"
  case webp = "image/webp"

  public init?(mimeType: String?) {
    guard let mimeType else { return nil }
    let normalized = mimeType
      .split(separator: ";", maxSplits: 1)
      .first?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    guard let normalized else { return nil }
    self.init(rawValue: normalized)
  }

  public var fileExtension: String {
    switch self {
    case .jpeg:
      return "jpg"
    case .png:
      return "png"
    case .gif:
      return "gif"
    case .webp:
      return "webp"
    }
  }
}

public struct ScreenshotPreparationPolicy: Equatable {
  public var maxBytes: Int
  public var allowedContentTypes: Set<ImageContentType>
  public var requireDetectedContentType: Bool

  public init(
    maxBytes: Int = 5 * 1024 * 1024,
    allowedContentTypes: Set<ImageContentType> = Set(ImageContentType.allCases),
    requireDetectedContentType: Bool = true
  ) {
    self.maxBytes = maxBytes
    self.allowedContentTypes = allowedContentTypes
    self.requireDetectedContentType = requireDetectedContentType
  }
}

public struct PreparedScreenshot: Equatable {
  public let data: Data
  public let contentType: ImageContentType
  public let byteSize: Int

  public init(data: Data, contentType: ImageContentType) {
    self.data = data
    self.contentType = contentType
    self.byteSize = data.count
  }
}

public enum ScreenshotPreparer {
  public static func prepare(
    data: Data,
    declaredContentType: String?,
    policy: ScreenshotPreparationPolicy = ScreenshotPreparationPolicy()
  ) throws -> PreparedScreenshot {
    if data.isEmpty {
      throw AppFoundryIssue("Screenshot data is required.", code: "image_empty")
    }

    try ByteLimit(maxBytes: policy.maxBytes).validate(byteCount: data.count, label: "Screenshot")

    let detected = detectContentType(data)
    let declared = ImageContentType(mimeType: declaredContentType)

    if policy.requireDetectedContentType && detected == nil {
      throw AppFoundryIssue("Screenshot content type could not be detected.", code: "missing_detected_content_type")
    }
    if let declared, let detected, declared != detected {
      throw AppFoundryIssue(
        "Declared screenshot content type does not match detected bytes.",
        code: "content_type_mismatch",
        details: [
          "declared": declared.rawValue,
          "detected": detected.rawValue
        ]
      )
    }

    guard let contentType = detected ?? declared else {
      throw AppFoundryIssue("Screenshot content type is required.", code: "missing_content_type")
    }
    guard policy.allowedContentTypes.contains(contentType) else {
      throw AppFoundryIssue(
        "Screenshot content type is not allowed.",
        code: "content_type_not_allowed",
        details: ["contentType": contentType.rawValue]
      )
    }

    return PreparedScreenshot(data: data, contentType: contentType)
  }

  public static func detectContentType(_ data: Data) -> ImageContentType? {
    let bytes = [UInt8](data.prefix(16))
    guard bytes.count >= 4 else { return nil }

    if bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
      return .jpeg
    }
    if bytes.count >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47 &&
      bytes[4] == 0x0d &&
      bytes[5] == 0x0a &&
      bytes[6] == 0x1a &&
      bytes[7] == 0x0a {
      return .png
    }
    if bytes.count >= 6 &&
      bytes[0] == 0x47 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x38 &&
      (bytes[4] == 0x37 || bytes[4] == 0x39) &&
      bytes[5] == 0x61 {
      return .gif
    }
    if bytes.count >= 12 &&
      ascii(bytes, start: 0, length: 4) == "RIFF" &&
      ascii(bytes, start: 8, length: 4) == "WEBP" {
      return .webp
    }
    return nil
  }

  private static func ascii(_ bytes: [UInt8], start: Int, length: Int) -> String {
    guard bytes.count >= start + length else { return "" }
    return String(bytes: bytes[start..<(start + length)], encoding: .ascii) ?? ""
  }
}
