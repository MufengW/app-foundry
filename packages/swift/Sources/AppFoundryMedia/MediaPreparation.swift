import Foundation
import AppFoundryCore

public enum MediaContentType: String, CaseIterable, Codable, Equatable, Hashable, Sendable {
  case imageJpeg = "image/jpeg"
  case imagePng = "image/png"
  case imageGif = "image/gif"
  case imageWebp = "image/webp"
  case videoMp4 = "video/mp4"
  case videoQuickTime = "video/quicktime"
  case videoWebm = "video/webm"
  case audioWebm = "audio/webm"
  case audioMp4 = "audio/mp4"
  case audioM4a = "audio/m4a"
  case audioWav = "audio/wav"
  case audioXWav = "audio/x-wav"
  case audioMpeg = "audio/mpeg"
  case audioOgg = "audio/ogg"

  public init?(mimeType: String?) {
    guard let normalized = Self.normalize(mimeType) else { return nil }
    self.init(rawValue: normalized)
  }

  public var fileExtension: String {
    switch self {
    case .imageJpeg:
      return "jpg"
    case .imagePng:
      return "png"
    case .imageGif:
      return "gif"
    case .imageWebp:
      return "webp"
    case .videoMp4:
      return "mp4"
    case .videoQuickTime:
      return "mov"
    case .videoWebm, .audioWebm:
      return "webm"
    case .audioMp4, .audioM4a:
      return "m4a"
    case .audioWav, .audioXWav:
      return "wav"
    case .audioMpeg:
      return "mp3"
    case .audioOgg:
      return "ogg"
    }
  }

  public static let imageUploadContentTypes: Set<MediaContentType> = [
    .imageJpeg,
    .imagePng,
    .imageGif,
    .imageWebp
  ]

  public static let videoUploadContentTypes: Set<MediaContentType> = [
    .videoMp4,
    .videoQuickTime,
    .videoWebm
  ]

  public static let audioUploadContentTypes: Set<MediaContentType> = [
    .audioWebm,
    .audioMp4,
    .audioM4a,
    .audioWav,
    .audioXWav,
    .audioMpeg,
    .audioOgg
  ]

  public static let defaultAllowedContentTypes: Set<MediaContentType> =
    imageUploadContentTypes
    .union(videoUploadContentTypes)
    .union(audioUploadContentTypes)

  public static func normalize(_ mimeType: String?) -> String? {
    guard let mimeType else { return nil }
    let normalized = mimeType
      .split(separator: ";", maxSplits: 1)
      .first?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()
    guard let normalized, !normalized.isEmpty else { return nil }
    return normalized
  }

  public static func contentTypesAreCompatible(
    declared: MediaContentType,
    detected: MediaContentType
  ) -> Bool {
    if declared == detected {
      return true
    }

    let isoBmffMimes: Set<MediaContentType> = [
      .videoMp4,
      .videoQuickTime,
      .audioMp4,
      .audioM4a
    ]
    if isoBmffMimes.contains(declared), isoBmffMimes.contains(detected) {
      return true
    }

    let webmMimes: Set<MediaContentType> = [.videoWebm, .audioWebm]
    if webmMimes.contains(declared), webmMimes.contains(detected) {
      return true
    }

    let wavMimes: Set<MediaContentType> = [.audioWav, .audioXWav]
    return wavMimes.contains(declared) && wavMimes.contains(detected)
  }
}

public struct MediaPreparationPolicy: Equatable, Sendable {
  public var maxBytes: Int
  public var allowedContentTypes: Set<MediaContentType>
  public var requireDetectedContentType: Bool
  public var inferDeclaredContentType: Bool
  public var preferDeclaredContentType: Bool

  public init(
    maxBytes: Int = 10 * 1024 * 1024,
    allowedContentTypes: Set<MediaContentType> = MediaContentType.defaultAllowedContentTypes,
    requireDetectedContentType: Bool = true,
    inferDeclaredContentType: Bool = true,
    preferDeclaredContentType: Bool = false
  ) {
    self.maxBytes = maxBytes
    self.allowedContentTypes = allowedContentTypes
    self.requireDetectedContentType = requireDetectedContentType
    self.inferDeclaredContentType = inferDeclaredContentType
    self.preferDeclaredContentType = preferDeclaredContentType
  }
}

public struct PreparedMediaUpload: Equatable, Sendable {
  public let data: Data
  public let contentType: MediaContentType
  public let detectedContentType: MediaContentType?
  public let declaredContentType: MediaContentType?
  public let byteSize: Int

  public init(
    data: Data,
    contentType: MediaContentType,
    detectedContentType: MediaContentType?,
    declaredContentType: MediaContentType?
  ) {
    self.data = data
    self.contentType = contentType
    self.detectedContentType = detectedContentType
    self.declaredContentType = declaredContentType
    self.byteSize = data.count
  }

  public var fileExtension: String {
    contentType.fileExtension
  }
}

public enum MediaUploadPreparer {
  public static func prepare(
    data: Data,
    declaredContentType: String?,
    policy: MediaPreparationPolicy = MediaPreparationPolicy()
  ) throws -> PreparedMediaUpload {
    if data.isEmpty {
      throw AppFoundryIssue("Media data is required.", code: "media_empty")
    }

    try ByteLimit(maxBytes: policy.maxBytes).validate(byteCount: data.count, label: "Media")

    let detected = detectContentType(data)
    let declaredRaw = MediaContentType.normalize(declaredContentType)
    let declared = MediaContentType(rawValue: declaredRaw ?? "")

    if let declaredRaw, declared == nil {
      throw AppFoundryIssue(
        "Declared media content type is not allowed.",
        code: "declared_content_type_not_allowed",
        details: ["declared": declaredRaw]
      )
    }

    let effectiveDeclared = declared ?? (policy.inferDeclaredContentType ? detected : nil)

    if policy.requireDetectedContentType && detected == nil {
      throw AppFoundryIssue("Media content type could not be detected.", code: "missing_detected_content_type")
    }

    if let effectiveDeclared, !policy.allowedContentTypes.contains(effectiveDeclared) {
      throw AppFoundryIssue(
        "Declared media content type is not allowed.",
        code: "declared_content_type_not_allowed",
        details: ["declared": effectiveDeclared.rawValue]
      )
    }

    if let detected,
      !policy.allowedContentTypes.contains(detected) &&
      !(effectiveDeclared.map { policy.allowedContentTypes.contains($0) &&
        MediaContentType.contentTypesAreCompatible(declared: $0, detected: detected)
      } ?? false) {
      throw AppFoundryIssue(
        "Detected media content type is not allowed.",
        code: "detected_content_type_not_allowed",
        details: ["detected": detected.rawValue]
      )
    }

    if let effectiveDeclared, let detected,
      !MediaContentType.contentTypesAreCompatible(declared: effectiveDeclared, detected: detected) {
      throw AppFoundryIssue(
        "Declared media content type does not match detected bytes.",
        code: "content_type_mismatch",
        details: [
          "declared": effectiveDeclared.rawValue,
          "detected": detected.rawValue
        ]
      )
    }

    let contentType: MediaContentType?
    if policy.preferDeclaredContentType {
      contentType = effectiveDeclared ?? detected
    } else {
      contentType = detected ?? effectiveDeclared
    }

    guard let contentType else {
      throw AppFoundryIssue("Media content type is required.", code: "missing_content_type")
    }

    return PreparedMediaUpload(
      data: data,
      contentType: contentType,
      detectedContentType: detected,
      declaredContentType: effectiveDeclared
    )
  }

  public static func detectContentType(_ data: Data) -> MediaContentType? {
    let bytes = [UInt8](data.prefix(32))
    guard bytes.count >= 4 else { return nil }

    if bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
      return .imageJpeg
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
      return .imagePng
    }
    if bytes.count >= 6 &&
      bytes[0] == 0x47 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x38 &&
      (bytes[4] == 0x37 || bytes[4] == 0x39) &&
      bytes[5] == 0x61 {
      return .imageGif
    }
    if bytes.count >= 12 &&
      ascii(bytes, start: 0, length: 4) == "RIFF" &&
      ascii(bytes, start: 8, length: 4) == "WEBP" {
      return .imageWebp
    }
    if bytes.count >= 12 &&
      ascii(bytes, start: 0, length: 4) == "RIFF" &&
      ascii(bytes, start: 8, length: 4) == "WAVE" {
      return .audioWav
    }
    if bytes.count >= 12 && ascii(bytes, start: 4, length: 4) == "ftyp" {
      let brand = ascii(bytes, start: 8, length: 4).lowercased()
      if brand == "qt  " {
        return .videoQuickTime
      }
      if brand == "m4a " || brand == "m4b " || brand == "m4p " {
        return .audioMp4
      }
      return .videoMp4
    }
    if bytes[0] == 0x1a && bytes[1] == 0x45 && bytes[2] == 0xdf && bytes[3] == 0xa3 {
      return .videoWebm
    }
    if ascii(bytes, start: 0, length: 4) == "OggS" {
      return .audioOgg
    }
    if ascii(bytes, start: 0, length: 3) == "ID3" {
      return .audioMpeg
    }
    if bytes[0] == 0xff && (bytes[1] & 0xe0) == 0xe0 {
      return .audioMpeg
    }

    return nil
  }

  private static func ascii(_ bytes: [UInt8], start: Int, length: Int) -> String {
    guard bytes.count >= start + length else { return "" }
    return String(bytes: bytes[start..<(start + length)], encoding: .ascii) ?? ""
  }
}
