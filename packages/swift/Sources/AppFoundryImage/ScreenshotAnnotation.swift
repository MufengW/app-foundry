import Foundation
import AppFoundryCore

public struct NormalizedImagePoint: Codable, Equatable {
  public let x: Double
  public let y: Double

  public init(x: Double, y: Double) throws {
    guard (0...1).contains(x), (0...1).contains(y) else {
      throw AppFoundryIssue("Annotation points must be normalized between 0 and 1.", code: "annotation_point_invalid")
    }
    self.x = x
    self.y = y
  }
}

public struct RGBAColor: Codable, Equatable {
  public let red: Double
  public let green: Double
  public let blue: Double
  public let alpha: Double

  public init(red: Double, green: Double, blue: Double, alpha: Double = 1) throws {
    for value in [red, green, blue, alpha] where !(0...1).contains(value) {
      throw AppFoundryIssue("RGBA color channels must be normalized between 0 and 1.", code: "annotation_color_invalid")
    }
    self.red = red
    self.green = green
    self.blue = blue
    self.alpha = alpha
  }
}

public struct ScreenshotAnnotationStroke: Codable, Equatable {
  public let points: [NormalizedImagePoint]
  public let color: RGBAColor
  public let lineWidth: Double

  public init(points: [NormalizedImagePoint], color: RGBAColor, lineWidth: Double) throws {
    guard points.count >= 2 else {
      throw AppFoundryIssue("Annotation strokes require at least two points.", code: "annotation_stroke_too_short")
    }
    guard lineWidth > 0 else {
      throw AppFoundryIssue("Annotation line width must be positive.", code: "annotation_line_width_invalid")
    }
    self.points = points
    self.color = color
    self.lineWidth = lineWidth
  }
}

public struct ScreenshotAnnotationDraft: Codable, Equatable {
  public var strokes: [ScreenshotAnnotationStroke]

  public init(strokes: [ScreenshotAnnotationStroke] = []) {
    self.strokes = strokes
  }

  public var isEmpty: Bool {
    strokes.isEmpty
  }
}
