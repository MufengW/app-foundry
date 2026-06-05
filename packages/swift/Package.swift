// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "AppFoundry",
  platforms: [
    .iOS(.v15),
    .macOS(.v13)
  ],
  products: [
    .library(name: "AppFoundry", targets: [
      "AppFoundryCore",
      "AppFoundryImage",
      "AppFoundryFeedback",
      "AppFoundryUpload"
    ]),
    .library(name: "AppFoundryCore", targets: ["AppFoundryCore"]),
    .library(name: "AppFoundryImage", targets: ["AppFoundryImage"]),
    .library(name: "AppFoundryFeedback", targets: ["AppFoundryFeedback"]),
    .library(name: "AppFoundryUpload", targets: ["AppFoundryUpload"])
  ],
  targets: [
    .target(name: "AppFoundryCore"),
    .target(name: "AppFoundryImage", dependencies: ["AppFoundryCore"]),
    .target(name: "AppFoundryFeedback", dependencies: [
      "AppFoundryCore",
      "AppFoundryImage"
    ]),
    .target(name: "AppFoundryUpload", dependencies: ["AppFoundryCore"]),
    .testTarget(name: "AppFoundrySwiftTests", dependencies: [
      "AppFoundryCore",
      "AppFoundryImage",
      "AppFoundryFeedback",
      "AppFoundryUpload"
    ])
  ]
)
