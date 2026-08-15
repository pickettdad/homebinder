// swift-tools-version: 5.9
import PackageDescription

// The names here are NOT free choices — the Capacitor CLI computes what it will look for from
// the npm package name and writes it into the generated `ios/App/CapApp-SPM/Package.swift`:
//
//   fixName("hs-native") → "HsNative"      (cli/dist/plugin.js: '-' → '_', then _x → X, capitalise)
//   → .package(name: "HsNative", path: "…/native/hs-native")
//   → .product(name: "HsNative", package: "HsNative")
//
// So the package name AND the library product name must both be exactly `HsNative`. If they
// drift, `cap sync` writes a Package.swift referring to a product that does not exist and the
// build fails at resolution — or, worse for us, the plugin is quietly left out. That pairing is
// asserted in `tests/native/pluginPackage.test.ts` so it cannot drift unnoticed.
//
// Platform and Capacitor version track the generated app project: it declares .iOS(.v15) and
// pins capacitor-swift-pm `exact: "8.4.2"`. A floor above the app's would fail resolution; the
// `upToNextMajor` range below intersects the app's exact pin rather than fighting it.
let package = Package(
    name: "HsNative",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "HsNative",
            targets: ["HsNative"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", .upToNextMajor(from: "8.4.2"))
    ],
    targets: [
        .target(
            name: "HsNative",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/HsNative")
    ]
)
