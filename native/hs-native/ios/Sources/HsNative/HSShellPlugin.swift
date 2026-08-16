import Capacitor
import Foundation
import UIKit

/**
 The skeleton whose entire job is to prove the bridge, twice, before anything is built on it.

 Field 4 asks one question — *does a value cross from Swift to the web layer on real hardware,
 through a plugin package resolved by `cap sync`* — and the July failure is the reason it is asked
 on its own rather than discovered underneath a camera. `ios/` is generated on every build, so
 Swift written into `ios/App/` is destroyed; this package, reached through the repo's
 `package.json`, is the only durable shape.

 Two capabilities, because the camera needs both and a method-only proof would prove half:
 `echo` is a method returning a value, `heartbeat` is an event flowing native → web unprompted.

 On the returned fields, each of which is carrying weight:

 - `sentAt` comes back unchanged, so the argument is proven to have crossed *going out*, not just
   coming back. A stub that fabricated a response could not know it.
 - `device.model` / `device.hardware` / `device.systemVersion` come from UIDevice and `uname`.
   The web layer cannot fabricate `hardware` — "iPad13,4" is not in any user agent — so a
   plausible-looking response is evidence the bridge crossed rather than evidence something
   returned an object.
 - `plugin.buildConfiguration` is what makes prove-it-twice self-evidencing: the tethered Xcode
   run must report `Debug` and the TestFlight archive `Release`. If both report the same word,
   the test is wrong, not the plugin — and that is a finding, not a nuisance.
 */
@objc(HSShellPlugin)
public class HSShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HSShellPlugin"

    /// The name the web layer addresses. `src/native/hsShell.ts` must use this exact string, and
    /// `tests/native/pluginPackage.test.ts` fails if the two drift — a mismatch is invisible at
    /// compile time on both sides and shows up only as a plugin that is simply never there.
    public let jsName = "HSShell"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setIdleTimerDisabled", returnType: CAPPluginReturnPromise)
    ]

    /// The single declaration of the plugin's version. `native/hs-native/package.json` must carry
    /// the same string (asserted in tests) so "the two runs report the same plugin version" is a
    /// statement about one number rather than a coincidence between two.
    static let version = "0.1.0"

    /// A small fixed number of beats, then silence. Fixed and small because the point is to prove
    /// events flow at all; a stream would prove the same thing and hide a leak while doing it.
    static let heartbeatCount = 3
    static let heartbeatIntervalSeconds = 0.25

    private static let buildConfiguration: String = {
        #if DEBUG
        return "Debug"
        #else
        return "Release"
        #endif
    }()

    /// The hardware identifier ("iPad13,4") — `UIDevice.model` only ever says "iPad".
    private static func hardwareIdentifier() -> String {
        var info = utsname()
        uname(&info)
        // Copied out of `info` first: reading the tuple in place while `info` is still mutable is
        // an overlapping access, and the compiler refuses it.
        let machine = info.machine
        return withUnsafeBytes(of: machine) { bytes in
            String(decoding: bytes.prefix { $0 != 0 }, as: UTF8.self)
        }
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    @objc func echo(_ call: CAPPluginCall) {
        // A missing argument is rejected rather than defaulted. The whole value of this method is
        // that it reports what actually crossed, and a silently-substituted zero would report a
        // successful round trip on a bridge that dropped the payload.
        guard let sentAt = call.getDouble("sentAt") else {
            call.reject("sentAt is required (milliseconds since the epoch, from the web layer)")
            return
        }

        // UIDevice is main-thread work; Capacitor dispatches plugin calls off the main queue.
        DispatchQueue.main.async { [weak self] in
            let device = UIDevice.current
            call.resolve([
                "sentAt": sentAt,
                "receivedAt": Self.iso8601.string(from: Date()),
                "device": [
                    "model": device.model,
                    "hardware": Self.hardwareIdentifier(),
                    "systemVersion": device.systemVersion
                ],
                "plugin": [
                    "version": Self.version,
                    "buildConfiguration": Self.buildConfiguration
                ]
            ])
            self?.startHeartbeat()
        }
    }

    /**
     Hold the screen awake for the visit — the native mechanism, because the web one is not
     available here.

     ⚑ Field run, 2026-08-15: the iPad was set down on the camera screen for 45 minutes and had
     gone to sleep when the owner came back, taking the thermal walk with it. `useWakeLock` asks
     for `navigator.wakeLock`, which is a **Safari** API; a Capacitor app is a `WKWebView`, where
     it is simply absent — so the hook's own "not supported" branch was the true one and the
     whole feature was a banner nobody was in the room to read.

     `isIdleTimerDisabled` is the mechanism that actually exists in an app. It needs no user
     gesture (the web API does, which had already cost a field run), it is not refused under Low
     Power Mode, and it is not released behind our back — three failure modes that between them
     account for every wake-lock defect this project has logged.

     The **resolved value is read back off `UIApplication`** rather than echoing the argument, so
     "held" is a statement about the system's state and not about our intention.
     */
    @objc func setIdleTimerDisabled(_ call: CAPPluginCall) {
        guard let disabled = call.getBool("disabled") else {
            call.reject("disabled is required (true to hold the screen awake)")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = disabled
            call.resolve(["disabled": UIApplication.shared.isIdleTimerDisabled])
        }
    }

    private func startHeartbeat() {
        for beat in 1...Self.heartbeatCount {
            let delay = Self.heartbeatIntervalSeconds * Double(beat)
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.notifyListeners("heartbeat", data: [
                    "beat": beat,
                    "of": Self.heartbeatCount,
                    "at": Self.iso8601.string(from: Date())
                ])
            }
        }
    }
}
