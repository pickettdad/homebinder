import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Stage 0 native shell (PLAN-STAGE-0). Production loads the BUNDLED `dist` — never a
 * remote `server.url`, which would leave the app blank offline and defeat the whole
 * offline-first product. The default `capacitor://localhost` scheme is kept deliberately:
 * a custom host/port breaks getUserMedia (the voice-note path) on iOS.
 */
const config: CapacitorConfig = {
  appId: "ca.housesteady.field",
  appName: "HouseSteady Field",
  webDir: "dist",
  ios: {
    // Make the RELEASE/TestFlight build inspectable from Safari's Web Inspector.
    // Capacitor sets `WKWebView.isInspectable = isWebDebuggable`, and that flag
    // defaults to TRUE only in DEBUG builds and FALSE in production (see the vendored
    // source: CAPInstanceDescriptor.swift `webContentsDebuggingEnabled` → else `#if DEBUG`).
    // Our only distribution is a Release archive to TestFlight, so without this the shipped
    // app never appears in "Develop ▸ <device>" — which is exactly why a launch-time web-view
    // failure read as "no inspectable applications" and couldn't be diagnosed on-device.
    // Safe here: this app is a private field-test build, never a public App Store release.
    // Revisit (set false) if it ever ships to the public store.
    webContentsDebuggingEnabled: true,
  },
};

export default config;
