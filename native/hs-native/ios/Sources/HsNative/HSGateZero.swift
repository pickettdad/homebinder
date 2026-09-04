import ARKit
import Foundation
import UIKit

/**
 **Gate 0 — is ARKit on this OS usable at all?**

 From the consolidated research response, 2026-09-04, and it is the cheapest kill in the plan:
 *bare `ARWorldTrackingConfiguration`, nothing else, walk a real room for ten minutes returning to a
 rigid reference, and fail if the origin has moved more than 10 cm.* ⚑ **If it fails, the answer is
 the OS or the device, not the architecture** — and nothing gets built.

 It exists because the response's top-ranked risk is a claim about the world we cannot check from a
 desk: an iPadOS 26.4+ world-tracking drift regression on LiDAR devices. ⛑ **Ten minutes on the
 actual iPad settles it better than any citation could**, and our own data cannot distinguish that
 regression from our own duty-cycle failure because both produce *good standing still, error with
 travel*.

 ## What it does NOT do, deliberately

 **No plane detection, no scene reconstruction, no frame semantics, no RoomPlan, no high-resolution
 format, no photography.** *The point is to test the platform stripped of us.* Every one of those is
 a thing we might be blamed for, so none of them is present.

 ## How a return to the reference is detected

 ⚑ **Nothing is pressed.** The operator rests the iPad on the same rigid spot; that shows up as a
 run of near-identical poses and is found in the analysis. *A probe that needs a button needs a
 hand, and the hand is what we are measuring.*

 ## The free measurement beside it

 **The origin anchor's own transform is logged every sample.** An `ARAnchor` moves only when ARKit
 revises its map — so a transform that never changes across ten minutes is a session that never
 corrected itself, which is the thing our production build could never observe.

 And the video-format table is dumped at the start: *which formats carry
 `isRecommendedForHighResolutionFrameCapturing`* is the first check of the response's Gate 1, and it
 costs nothing to answer here.
 */
@available(iOS 16.0, *)
final class HSGateZero: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var originAnchor: ARAnchor?
    private var rows: [String] = []
    private var started = Date()
    private var timer: Timer?
    private let runFor: TimeInterval = 11 * 60

    func run(completion: @escaping ([String: Any]) -> Void) {
        var head: [String] = []
        func say(_ s: String) { print("HS-GATE0 \(s)"); head.append(s) }

        say("device \(UIDevice.current.model) iPadOS \(UIDevice.current.systemVersion)")
        /* ⚑ Gate 1's minutes 0–5, answered here for free: the response asks whether ANY of the
           offered formats is recommended for high-resolution capture. It is a static enumeration
           and needs no walking. */
        let formats = ARWorldTrackingConfiguration.supportedVideoFormats
        var recommended = 0
        for f in formats where f.isRecommendedForHighResolutionFrameCapturing { recommended += 1 }
        say("formats \(formats.count), recommendedForHighResFrameCapturing \(recommended)")
        for f in formats where f.isRecommendedForHighResolutionFrameCapturing {
            say("  hi-res-capable \(Int(f.imageResolution.width))x\(Int(f.imageResolution.height))@\(f.framesPerSecond) \(f.captureDeviceType.rawValue)")
        }

        /* ⛑ **Stock. Nothing of ours.** No plane detection, no reconstruction, no frame semantics,
           and the DEFAULT video format — deliberately not the high-resolution one, because this
           gate is about the platform and not about our configuration. */
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = []
        config.environmentTexturing = .none
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        started = Date()

        let anchor = ARAnchor(name: "gate0-origin", transform: matrix_identity_float4x4)
        session.add(anchor: anchor)
        originAnchor = anchor
        say("running — walk the room, return the iPad to the same rigid spot every ~5 minutes and rest it there for 10 seconds")
        rows = head.map { "# \($0)" }
        rows.append("t,px,py,pz,tracking,mapping,features,ax,ay,az")
        flush()

        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] t in
            guard let self else { return }
            self.sample()
            if Date().timeIntervalSince(self.started) > self.runFor {
                t.invalidate()
                self.session.pause()
                print("HS-GATE0 done — \(self.rows.count) samples")
                completion(["samples": self.rows.count])
            }
        }
    }

    private func sample() {
        guard let f = session.currentFrame else { return }
        let p = f.camera.transform.columns.3
        let map: String
        switch f.worldMappingStatus {
        case .notAvailable: map = "notAvailable"
        case .limited: map = "limited"
        case .extending: map = "extending"
        case .mapped: map = "mapped"
        @unknown default: map = "unknown"
        }
        // ⚑ The anchor as ARKit currently believes it, not as we created it. A value that never
        // moves is a session that never corrected itself.
        let live = f.anchors.first { $0.identifier == originAnchor?.identifier }
        let a = live?.transform.columns.3 ?? SIMD4<Float>(0, 0, 0, 1)
        rows.append(String(format: "%.2f,%.4f,%.4f,%.4f,%@,%@,%d,%.4f,%.4f,%.4f",
                           Date().timeIntervalSince(started), p.x, p.y, p.z,
                           HSArProbe.describe(f.camera.trackingState), map,
                           f.rawFeaturePoints?.points.count ?? 0, a.x, a.y, a.z))
        // Every sample, for the same reason the zone log flushes every entry: a run that ends badly
        // is the run worth having.
        if rows.count % 10 == 0 { flush() }
    }

    private func flush() {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { return }
        try? rows.joined(separator: "\n").write(
            to: dir.appendingPathComponent("hs-gate0.csv"), atomically: true, encoding: .utf8)
    }
}
