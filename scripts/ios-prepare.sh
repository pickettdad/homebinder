#!/usr/bin/env bash
#
# Generate + prepare the iOS project. ONE declaration site, run by both proofs.
#
# Field 4 asks whether the tethered build and the TestFlight build behave the same. That question
# is only answerable if the two projects are prepared identically — every Info.plist key that CI
# injects and a local build does not is a difference that will be read as a finding when it is
# really a difference in this script's absence. So the local run and `ios-testflight.yml` both
# call this, and the only intended differences downstream are the build configuration and signing.
#
# `ios/` is gitignored and regenerated from scratch here on purpose: that is what CI does, and
# `cap sync` resolving the plugin through package.json is precisely the step that failed in July.
#
# Env:
#   HS_BUILD_NUMBER  optional; stamps CFBundleVersion (CI passes a timestamp so uploads are
#                    monotonic and each TestFlight build is identifiable). Left alone if unset.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ Regenerating ios/ from a clean state"
rm -rf ios
npx cap add ios
npx cap sync ios

PLIST="ios/App/App/Info.plist"

# WKWebView crashes on the PWA's camera/mic use without these usage strings.
/usr/libexec/PlistBuddy -c "Add :NSCameraUsageDescription string 'Photograph inspection findings, nameplates, and rooms.'" "$PLIST" || true
/usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'Record audio evidence and dictate notes.'" "$PLIST" || true
# HTTPS only, no proprietary encryption — auto-answers App Store Connect's export-compliance
# prompt on every upload instead of a manual click.
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" || true

if [ -n "${HS_BUILD_NUMBER:-}" ]; then
  echo "▸ CFBundleVersion = ${HS_BUILD_NUMBER}"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${HS_BUILD_NUMBER}" "$PLIST"
fi

# ⚑ The guard. A generated project that is simply MISSING the plugin still builds, still installs,
# and still runs — it just has no bridge, which on a device reads as an app that does nothing.
# That is the shape of the July failure, so it fails here, loudly, before an archive is made.
GENERATED="ios/App/CapApp-SPM/Package.swift"
if ! grep -q "HsNative" "$GENERATED"; then
  echo "✗ cap sync did not include the hs-native plugin in ${GENERATED}." >&2
  echo "  The plugin resolves through package.json (\"hs-native\": \"file:native/hs-native\")." >&2
  echo "  Check that npm install/ci linked it: node_modules/hs-native must exist." >&2
  exit 1
fi
echo "✓ hs-native present in ${GENERATED}"
