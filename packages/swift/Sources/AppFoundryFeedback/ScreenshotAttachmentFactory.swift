import Foundation
import AppFoundryImage

public enum ScreenshotAttachmentFactory {
  public static func attachment(
    for preparedScreenshot: PreparedScreenshot,
    storageKey: String,
    annotated: Bool = false,
    createdAt: Date? = nil
  ) throws -> FeedbackAttachment {
    try FeedbackAttachment(
      kind: annotated ? .annotatedScreenshot : .screenshot,
      storageKey: storageKey,
      contentType: preparedScreenshot.contentType.rawValue,
      byteSize: preparedScreenshot.byteSize,
      createdAt: createdAt
    )
  }
}
