import ARKit
import AVFoundation
import Foundation

/**
 ⚑ **Will ARKit let us lock exposure on the camera it is driving?**

 ⛑ **The whole of the owner's traverse idea turns on this one answer**, and nobody has asked it.

 *His question, 2026-09-06:* **"I am wondering if we add back in position into each frame along a
 trace. We avoided that at first because of the camera handover cost but now things are very
 different… so a pipe running along walls and ceilings could actually be somewhat mapped out?"**

 **He is right that the cost changed.** `captureStill` already proves ARKit delivers high-resolution
 stills *with poses* and no handover at all. A traverse running on ARKit's own frames would give every
 frame a pose and a surface raycast for free, cost no lens handover, and remove the ~5 s tracking
 re-establishment each leg pays on the way back. ⚑ *Every frame posed turns a run trace from a strip
 of pictures into a series of measured points along a pipe — which is what §4.1b's run trace is for.*

 ⛑ **But the traverse's one measured win is an exposure lock**, and it is not a small one:
 `setExposureModeCustom(duration:iso:)` with white balance locked moved **median texture 6.2 → 18.1**
 and **blank-texture verdicts 22 → 0**, with Vision reading brand names at 1.00 confidence. *A trace
 shot on auto-exposure while walking is the near-black legs of 2026-08-19 again.* **Losing the lock to
 gain the pose is not obviously a trade worth making, and it must not be guessed at.**

 ⚠️ **And there is reason to expect a refusal.** `docs/ZOOM-FLOOR-RESULT-2026-09-06.md` found ARKit
 pins the device's zoom range to exactly `[1.0, 1.0]` while world tracking runs — *not merely
 defaults it, pins it.* A framework that takes zoom away may take exposure too.

 **So this probe asks the device rather than the documentation**, exactly as the zoom floor did: it
 runs a real zone-shaped ARKit session, tries every lock the traverse actually uses, reads back what
 was reached, and puts the camera back. **A clean negative is as valuable as a positive** — it retires
 the idea instead of leaving it to be re-argued, and it says so with a number.
 */
@available(iOS 16.0, *)
final class HSExposureLock: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var done: (([String: Any]) -> Void)?
    private var out: [String: Any] = [:]

    func run(_ completion: @escaping ([String: Any]) -> Void) {
        done = completion
        HSZoneLog.record("exposureLockProbe", ["stage": "start"])

        /* The zone's real configuration, because a lock that works under a lighter one proves
           nothing about the session a traverse would actually run inside. */
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
        }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            config.frameSemantics.insert(.sceneDepth)
        }
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])

        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self else { return }
            guard let d = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
                self.out["VERDICT"] = "no configurable device — ARKit does not expose one on this iPad"
                self.finish(); return
            }

            // What the device SAYS it supports while ARKit holds it. Support is not permission, so
            // both are recorded and the attempt below is what settles it.
            self.out["supports.customExposure"] = d.isExposureModeSupported(.custom)
            self.out["supports.lockedExposure"] = d.isExposureModeSupported(.locked)
            self.out["supports.lockedWhiteBalance"] = d.isWhiteBalanceModeSupported(.locked)
            self.out["supports.lockedFocus"] = d.isFocusModeSupported(.locked)
            self.out["supports.torch"] = d.hasTorch
            self.out["before.exposureMode"] = "\(d.exposureMode.rawValue)"
            self.out["before.iso"] = Double(d.iso)
            self.out["before.durationS"] = CMTimeGetSeconds(d.exposureDuration)
            self.out["before.activeFormatFps"] = d.activeVideoMaxFrameDuration.timescale > 0
                ? Double(d.activeVideoMaxFrameDuration.timescale) / Double(max(d.activeVideoMaxFrameDuration.value, 1))
                : -1

            /* ⚑ **The traverse's own values, not gentle ones.** 1/60 s at ISO 400 is inside the
               metered band the traverse actually uses (floored 1/30, capped 1/125). A probe that
               asks for something easier answers an easier question. */
            let wantISO = min(max(400, d.activeFormat.minISO), d.activeFormat.maxISO)
            let wantDur = CMTime(value: 1, timescale: 60)
            do {
                try d.lockForConfiguration()
                if d.isExposureModeSupported(.custom) {
                    d.setExposureModeCustom(duration: wantDur, iso: wantISO) { _ in }
                }
                if d.isWhiteBalanceModeSupported(.locked) { d.whiteBalanceMode = .locked }
                if d.isFocusModeSupported(.locked) { d.focusMode = .locked }
                d.unlockForConfiguration()
                self.out["lock.threw"] = false
            } catch {
                self.out["lock.threw"] = true
                self.out["lock.error"] = error.localizedDescription
            }

            /* ⛑ **Read back after a settle, never immediately.** `setExposureModeCustom` is
               asynchronous, and a value read on the next line is the value we asked for rather than
               the one the device reached — which is the mistake this repo names most often. */
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                let reachedISO = Double(d.iso)
                let reachedDur = CMTimeGetSeconds(d.exposureDuration)
                self.out["after.exposureMode"] = "\(d.exposureMode.rawValue)"
                self.out["after.iso"] = reachedISO
                self.out["after.durationS"] = reachedDur
                self.out["after.whiteBalanceMode"] = "\(d.whiteBalanceMode.rawValue)"
                self.out["after.focusMode"] = "\(d.focusMode.rawValue)"
                self.out["asked.iso"] = Double(wantISO)
                self.out["asked.durationS"] = CMTimeGetSeconds(wantDur)

                let isoHeld = abs(reachedISO - Double(wantISO)) / Double(wantISO) < 0.15
                let durHeld = abs(reachedDur - CMTimeGetSeconds(wantDur)) / CMTimeGetSeconds(wantDur) < 0.25
                let modeHeld = d.exposureMode == .custom || d.exposureMode == .locked
                /* ⚑ One word, computed once. A reader should not have to re-derive the verdict from
                   six numbers and reach a different answer than the next reader. */
                self.out["VERDICT"] = modeHeld && isoHeld && durHeld
                    ? "YES — ARKit permits the exposure lock; a traverse could run on ARKit frames and keep its texture"
                    : "NO — ARKit overrode the lock (mode \(d.exposureMode.rawValue), iso \(Int(reachedISO)) vs \(Int(wantISO)), \(String(format: "%.4f", reachedDur))s vs \(String(format: "%.4f", CMTimeGetSeconds(wantDur)))s)"

                // Put it back. A probe that leaves the camera somewhere else is a probe that changed
                // the thing it measured.
                if let _ = try? d.lockForConfiguration() {
                    if d.isExposureModeSupported(.continuousAutoExposure) { d.exposureMode = .continuousAutoExposure }
                    if d.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) { d.whiteBalanceMode = .continuousAutoWhiteBalance }
                    if d.isFocusModeSupported(.continuousAutoFocus) { d.focusMode = .continuousAutoFocus }
                    d.unlockForConfiguration()
                }
                self.finish()
            }
        }
    }

    private func finish() {
        out["tracking"] = HSArProbe.describe(session.currentFrame?.camera.trackingState ?? .notAvailable)
        HSZoneLog.record("exposureLockProbe", ["stage": "done", "verdict": out["VERDICT"] ?? "?"])
        session.pause()
        if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted]) {
            try? data.write(to: dir.appendingPathComponent("hs-exposure-lock.json"), options: .atomic)
        }
        print("HS-EXPOSURE-LOCK \(out["VERDICT"] ?? "?")")
        done?(out)
        done = nil
    }
}
