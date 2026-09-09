import ARKit
import AVFoundation
import Foundation

/**
 ⚑ **Can the camera ARKit is already holding see wider than 1× on its own?**

 ⛑ **Two minutes of measurement against a build, and nobody has ever asked it.** The device *type*
 ARKit configures has been read twice (`HSArProbe`, `HSLensProbe`); its **zoom floor never once.**

 *Why it decides everything downstream.* The room shot needs a wide frame — the desk places objects
 visually from it — and the field's own words are *"it's hard to know what is in the capture if you
 can't see it in the wide view."* Every design on the table pays for that frame with a **camera
 handover**: yield the lens to AVFoundation, take a 0.5× frame, hand it back. The last build that did
 it did not yield deliberately, it **collided** — every room shot in the 2026-09-05 export carries
 `positioned: false, why: "Required sensor failed."` on the wide frame and `position: null` on its
 partner. *Two photographs, no pose, on the one capture the desk places from.*

 ⚑ **But a handover is only necessary if ARKit's own device cannot widen.** On recent iPads the rear
 camera ARKit configures may be a **virtual device** — `.builtInDualWideCamera` and friends — whose
 constituents include the ultra-wide. On such a device `videoZoomFactor` below 1.0 is not a crop; it
 **switches to the ultra-wide constituent**, and `minAvailableVideoZoomFactor` reports the floor.

 **If that floor is below 1.0, the whole problem dissolves:** the viewfinder widens, the capture
 widens, ARKit never lets go of the sensor, and there is no handover, no second session and no
 launch-time pre-build to maintain. *A negative is equally valuable and equally cheap* — it retires
 an option that would otherwise be argued about, and the handover gets built knowing it is necessary.

 ⛑ **Read on a RUNNING session, not at rest.** `configurableCaptureDeviceForPrimaryCamera` answers
 before a session exists, and what it says then is what the device *offers* — not what it offers once
 ARKit has claimed it and pinned a format. **The thing consulted must be the thing that governs**, so
 this reads both and prints them side by side; if they disagree, that disagreement is the finding.
 */
@available(iOS 16.0, *)
final class HSZoomFloor: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var done: (([String: Any]) -> Void)?
    private var out: [String: Any] = [:]

    /// Everything worth knowing about one `AVCaptureDevice`'s reach, read rather than assumed.
    private func describe(_ d: AVCaptureDevice?, _ tag: String) -> [String: Any] {
        guard let d else { return ["\(tag).device": "none"] }
        var row: [String: Any] = [
            "\(tag).deviceType": d.deviceType.rawValue,
            "\(tag).localizedName": d.localizedName,
            "\(tag).minZoom": Double(d.minAvailableVideoZoomFactor),
            "\(tag).maxZoom": Double(d.maxAvailableVideoZoomFactor),
            "\(tag).currentZoom": Double(d.videoZoomFactor),
            /* ⚑ The whole question in one number. Below 1.0 means the device can widen without
               anybody handing the camera anywhere. */
            "\(tag).canWiden": d.minAvailableVideoZoomFactor < 1.0,
        ]
        /* ⛑ A virtual device's constituents are what makes a sub-1.0 floor possible at all — an
           ultra-wide in this list is the mechanism behind the number above, and its absence would
           make a sub-1.0 floor a digital crop, which is not what the room shot needs. */
        let parts = d.constituentDevices.map { $0.deviceType.rawValue }
        row["\(tag).constituents"] = parts.isEmpty ? ["(not a virtual device)"] : parts
        row["\(tag).switchOverZooms"] = d.virtualDeviceSwitchOverVideoZoomFactors.map { Double(truncating: $0) }
        row["\(tag).fov"] = Double(d.activeFormat.videoFieldOfView)
        return row
    }

    func run(_ completion: @escaping ([String: Any]) -> Void) {
        done = completion
        HSZoneLog.record("zoomFloorProbe", ["stage": "start"])

        // 1 · At rest — what the device offers before ARKit claims it.
        let atRest = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera
        out.merge(describe(atRest, "atRest")) { a, _ in a }

        // 2 · What else the hardware has, so a negative can say what it was compared against.
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera,
                          .builtInDualWideCamera, .builtInTripleCamera],
            mediaType: .video, position: .back)
        out["hardware"] = discovery.devices.map {
            "\($0.deviceType.rawValue) min=\($0.minAvailableVideoZoomFactor) fov=\($0.activeFormat.videoFieldOfView)"
        }

        /* 3 · Now under a real session, configured exactly as a zone configures one — the same
           reconstruction, depth and video format, because a format pins the active device and the
           floor is a property of the ACTIVE format. */
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
            let live = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera
            self.out.merge(self.describe(live, "running")) { a, _ in a }

            /* 4 · ⛑ **Ask, do not infer.** A floor below 1.0 is necessary and not sufficient: the
               device must also ACCEPT being set there while ARKit holds it. Attempted for real,
               and put straight back — a probe that leaves the camera somewhere else is a probe that
               changes the thing it measured. */
            if let d = live, d.minAvailableVideoZoomFactor < 1.0 {
                let before = d.videoZoomFactor
                do {
                    try d.lockForConfiguration()
                    d.videoZoomFactor = d.minAvailableVideoZoomFactor
                    let reached = d.videoZoomFactor
                    let fov = d.activeFormat.videoFieldOfView
                    d.videoZoomFactor = before
                    d.unlockForConfiguration()
                    self.out["setZoom.reached"] = Double(reached)
                    self.out["setZoom.fovAtFloor"] = Double(fov)
                    self.out["setZoom.accepted"] = abs(Double(reached - d.minAvailableVideoZoomFactor)) < 0.01
                } catch {
                    self.out["setZoom.error"] = error.localizedDescription
                }
            } else {
                self.out["setZoom.skipped"] = "floor is not below 1.0"
            }

            self.out["tracking"] = HSArProbe.describe(self.session.currentFrame?.camera.trackingState ?? .notAvailable)
            /* ⚑ The verdict, computed once and stated in one word, so a reader does not re-derive it
               from five numbers and reach a different answer than the next reader. */
            let floor = live?.minAvailableVideoZoomFactor ?? 1.0
            let hasUltraWide = (live?.constituentDevices ?? []).contains { $0.deviceType == .builtInUltraWideCamera }
            self.out["VERDICT"] = floor < 1.0 && hasUltraWide
                ? "WIDENS WITHOUT A HANDOVER — floor \(floor), ultra-wide is a constituent"
                : (floor < 1.0
                    ? "floor \(floor) but no ultra-wide constituent — that is a digital crop, not a wider lens"
                    : "NO — floor is \(floor); a handover is required for a wide frame")
            HSZoneLog.record("zoomFloorProbe", ["stage": "done", "verdict": self.out["VERDICT"] ?? "?"])
            self.session.pause()
            self.write()
            self.done?(self.out)
            self.done = nil
        }
    }

    /// ⛑ To a file, because the console has failed twice and cost a walk each time.
    private func write() {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              let data = try? JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted])
        else { return }
        try? data.write(to: dir.appendingPathComponent("hs-zoom-floor.json"), options: .atomic)
        print("HS-ZOOM-FLOOR \(out["VERDICT"] ?? "?")")
    }
}
