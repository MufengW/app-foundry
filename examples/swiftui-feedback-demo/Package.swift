// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "AppFoundrySwiftUIFeedbackDemo",
  platforms: [
    .iOS(.v15),
    .macOS(.v13)
  ],
  products: [
    .library(name: "AppFoundrySwiftUIFeedbackDemo", targets: ["AppFoundrySwiftUIFeedbackDemo"])
  ],
  dependencies: [
    .package(name: "AppFoundry", path: "../../packages/swift")
  ],
  targets: [
    .target(
      name: "AppFoundrySwiftUIFeedbackDemo",
      dependencies: [
        .product(name: "AppFoundryCore", package: "AppFoundry"),
        .product(name: "AppFoundryImage", package: "AppFoundry"),
        .product(name: "AppFoundryFeedback", package: "AppFoundry"),
        .product(name: "AppFoundryUpload", package: "AppFoundry")
      ]
    )
  ]
)
