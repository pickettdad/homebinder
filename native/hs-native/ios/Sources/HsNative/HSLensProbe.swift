import ARKit
import AVFoundation
import Foundation

/**
 Does world tracking offer the ultra-wide lens on THIS device, and does a format change cost the
 world?

 ⛑ **Built because outside research and this device's own enumeration disagree**, and the design
 session named the way a careless answer could arise: a format list read by *resolution* would never
 show the lens, and both sides could be right about different things. The existing enumeration does
 read `captureDeviceType` per format — checked — so this probe exists to settle it by a second,
 differently-shaped route rather than by re-asserting the first.

 **Four questions, and the last two matter whatever the answer to the first:**

 1. Every `supportedVideoFormats` entry printed with its `captureDeviceType`, and the ultra-wide
    count stated as a number rather than left to be scanned for.
 2. What device the session **actually** runs on, read back from
    `configurableCaptureDeviceForPrimaryCamera` — ⚑ *the list says what is offered; this says what
    was taken.*
 3. ⚑ **Does a FORMAT change survive `run(config)` without `.resetTracking`?** A semantic change does
    — measured. A format change swaps the camera intrinsics, which is a different question wearing
    the same API, and if it silently resets the origin then every position taken in that zone before
    the switch is measured against a world that no longer exists.
 4. Whether LiDAR depth is present, since the reported ultra-wide behaviour is that it switches off.

 ⛑ **Nothing here uses `.resetTracking` except the deliberate baseline run.** The research snippet
 does, and it reads as a recipe — correct at session start and fatal mid-zone.
 */
@available(iOS 16.0, *)
final class HSLensProbe: NSObject {
    private let session = ARSession()

    func run(completion: @escaping ([String: Any]) -> Void) {
        var out: [String: Any] = [:]
        var lines: [String] = []
        func say(_ s: String) { NSLog("HS-LENS %@", s); lines.append(s) }

        // ---- 1 · what is offered ----
        let formats = ARWorldTrackingConfiguration.supportedVideoFormats
        out["formatCount"] = formats.count
        var described: [[String: Any]] = []
        for f in formats {
            described.append([
                "device": f.captureDeviceType.rawValue,
                "w": Int(f.imageResolution.width),
                "h": Int(f.imageResolution.height),
                "fps": f.framesPerSecond
            ])
            say("format \(Int(f.imageResolution.width))x\(Int(f.imageResolution.height))@\(f.framesPerSecond) \(f.captureDeviceType.rawValue)")
        }
        out["formats"] = described
        let ultra = formats.filter { $0.captureDeviceType == .builtInUltraWideCamera }
        let dual = formats.filter { $0.captureDeviceType == .builtInDualWideCamera }
        out["ultraWideFormats"] = ultra.count
        out["dualWideFormats"] = dual.count
        // ⚑ Stated as a count, not left to be scanned for: the last time this was read by eye it was
        // very nearly reported backwards off a device-type string that came from a different list.
        say("ULTRA-WIDE FORMATS: \(ultra.count)   DUAL-WIDE FORMATS: \(dual.count)   TOTAL: \(formats.count)")

        // The physical lenses, so "the device has one" and "world tracking offers it" stay separate
        // facts. Conflating them is exactly how the two sides of this disagreement could both be
        // honest.
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera, .builtInDualWideCamera],
            mediaType: .video, position: .back)
        out["physicalLenses"] = discovery.devices.map { $0.deviceType.rawValue }
        say("physical rear lenses: \(discovery.devices.map { $0.deviceType.rawValue })")

        let config = ARWorldTrackingConfiguration()
        if let u = ultra.first {
            config.videoFormat = u
            say("assigned ultra-wide format — running with it")
            out["assignedUltraWide"] = true
        } else {
            say("no ultra-wide format to assign; running default")
            out["assignedUltraWide"] = false
        }
        session.run(config, options: [.resetTracking, .removeExistingAnchors])

        DispatchQueue.global().async { [weak self] in
            guard let self else { return }
            Thread.sleep(forTimeInterval: 4)

            // ---- 2 · what was actually taken ----
            let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera
            out["runningDevice"] = device?.deviceType.rawValue ?? "unknown"
            out["runningFormatDevice"] = self.session.configuration?.videoFormat.captureDeviceType.rawValue ?? "unknown"
            say("RUNNING ON: \(device?.deviceType.rawValue ?? "unknown") / format \(self.session.configuration?.videoFormat.captureDeviceType.rawValue ?? "unknown")")

            // ---- 4 · depth, which the reports say ultra-wide turns off ----
            out["sceneDepthSupported"] = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
            out["hasDepthNow"] = self.session.currentFrame?.sceneDepth != nil
            say("sceneDepth supported \(ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)), present now \(self.session.currentFrame?.sceneDepth != nil)")

            // ---- 3 · does a FORMAT change cost the world? ----
            let before = self.session.currentFrame?.camera.transform.columns.3
            let others = formats.filter { $0.imageResolution != config.videoFormat.imageResolution }
            if let other = others.first {
                let next = ARWorldTrackingConfiguration()
                next.videoFormat = other
                say("switching format to \(Int(other.imageResolution.width))x\(Int(other.imageResolution.height)) WITHOUT resetTracking")
                self.session.run(next)   // ⚑ deliberately no options
                Thread.sleep(forTimeInterval: 4)
                let after = self.session.currentFrame?.camera.transform.columns.3
                if let b = before, let a = after {
                    let jump = simd_distance(SIMD3<Float>(b.x, b.y, b.z), SIMD3<Float>(a.x, a.y, a.z))
                    out["formatSwitchPoseJumpMetres"] = Double(jump)
                    /* ⚑ A jump of metres means the origin was rebuilt and every position taken
                       before the switch is measured against a world that no longer exists. A jump of
                       millimetres means the device simply moved in the hand. */
                    say(String(format: "FORMAT SWITCH pose jump %.4f m — anything near zero means the world survived", jump))
                }
                out["formatSwitchTracking"] = self.session.currentFrame.map { HSArProbe.describe($0.camera.trackingState) } ?? "none"
                say("after switch tracking: \(out["formatSwitchTracking"] ?? "?")")
            } else {
                say("only one resolution offered; format-switch test skipped")
            }

            self.session.pause()
            out["lines"] = lines
            NSLog("HS-LENS RESULT %@", String(describing: out))
            DispatchQueue.main.async { completion(out) }
        }
    }
}
