import Foundation
import AppFoundryCore

public struct MultipartPart: Equatable {
  public var name: String
  public var filename: String?
  public var contentType: String?
  public var body: Data

  public init(name: String, filename: String? = nil, contentType: String? = nil, body: Data) {
    self.name = name
    self.filename = filename
    self.contentType = contentType
    self.body = body
  }
}

public struct MultipartFormData: Equatable {
  public let body: Data
  public let contentType: String
}

public enum MultipartFormDataBuilder {
  public static func build(parts: [MultipartPart], boundary: String = UUID().uuidString) throws -> MultipartFormData {
    guard !parts.isEmpty else {
      throw AppFoundryIssue("Multipart form data requires at least one part.", code: "multipart_parts_required")
    }
    try validateHeaderToken(boundary, fieldName: "boundary")

    var body = Data()
    for part in parts {
      try validateHeaderToken(part.name, fieldName: "name")
      if let filename = part.filename {
        try validateHeaderToken(filename, fieldName: "filename")
      }

      body.appendUTF8("--\(boundary)\r\n")
      body.appendUTF8("Content-Disposition: form-data; name=\"\(part.name)\"")
      if let filename = part.filename {
        body.appendUTF8("; filename=\"\(filename)\"")
      }
      body.appendUTF8("\r\n")
      if let contentType = part.contentType {
        try validateHeaderToken(contentType, fieldName: "contentType")
        body.appendUTF8("Content-Type: \(contentType)\r\n")
      }
      body.appendUTF8("\r\n")
      body.append(part.body)
      body.appendUTF8("\r\n")
    }
    body.appendUTF8("--\(boundary)--\r\n")

    return MultipartFormData(
      body: body,
      contentType: "multipart/form-data; boundary=\(boundary)"
    )
  }

  private static func validateHeaderToken(_ value: String, fieldName: String) throws {
    let hasUnsafeScalar = value.unicodeScalars.contains { scalar in
      scalar == "\r" || scalar == "\n" || scalar == "\""
    }
    if value.isEmpty || hasUnsafeScalar {
      throw AppFoundryIssue("Multipart \(fieldName) is invalid.", code: "multipart_header_value_invalid")
    }
  }
}

private extension Data {
  mutating func appendUTF8(_ value: String) {
    append(Data(value.utf8))
  }
}
