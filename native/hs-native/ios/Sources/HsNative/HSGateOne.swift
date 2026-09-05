import ARKit
import AVFoundation
import Foundation
import UIKit

/**
 **Gate 1 — does the production configuration hold for a room?**

 From the consolidated research response, 2026-09-04. Gate 0 cleared the platform: bare ARKit
 returned to **4.5 cm** after eleven minutes, reached `mapped`, and revised its own origin anchor.
 ⚑ **This gate asks the different question: does it still hold with our load on it** — scene
 reconstruction running, a high-resolution format, and a 12 MP still taken *through* the tracking
 session every fifteen seconds for forty-five minutes.

 ## ⛑ A probe, not a rewrite of the capture path — and that is the response's own instruction

 *"Nothing in the production codebase changes before Gate 1 passes."* The shipping app is untouched.
 **We do not rebuild the thing we are trying to measure before the measurement.**

 ## What is deliberately absent

 **RoomPlan.** The response ranks RoomPlan-on-a-custom-session as risk #6, and it is a second
 integration with its own failure modes. ⚑ *The question here is whether continuous tracking plus
 in-session stills holds for forty-five minutes.* Adding RoomPlan adds a variable to a test whose
 whole value is isolating one. **A deliberate slow walk for the first ninety seconds substitutes for
 the anchor walk**, and RoomPlan joins in Gate 1b.

 ## Why the shutter is on a timer

 ⚑ **A button would measure the operator.** A fifteen-second cadence gives an even sample, misses
 nothing, and lets the person concentrate on walking like they are working — which is the load being
 tested. 180 captures in forty-five minutes, against a real room's ~400.

 ## The number this exists to produce

 **Maximum 3D closure error at any return to a rigid reference, through minute 45.** Rests are found
 in the analysis as runs of near-identical poses; nothing is pressed. ⛑ *≤5 cm proceed · 5–10 cm
 viable · 10–15 cm investigate · >15 cm dead. Engineering go/no-go is 10 cm.*
 */
@available(iOS 16.0, *)
final class HSGateOne: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var origin: ARAnchor?
    private var rows: [String] = []
    private var caps: [String] = []
    private var started = Date()
    private var sampler: Timer?
    private var shutter: Timer?
    private var health: Timer?
    private var inFlight = false
    private var shotIndex = 0
    private var frameStamps: [TimeInterval] = []
    private let runFor: TimeInterval = 46 * 60
    private let shutterEvery: TimeInterval = 15

    func run(completion: @escaping ([String: Any]) -> Void) {
        var head: [String] = []
        func say(_ s: String) { print("HS-GATE1 \(s)"); head.append(s) }
        say("device \(UIDevice.current.model) iPadOS \(UIDevice.current.systemVersion)")

        let config = ARWorldTrackingConfiguration()
        /* ⚑ **The production load, which is the point.** Reconstruction on — the mesh is a
           deliverable and the ray depends on it. Planes on, because the ray-cast fallback uses them
           and the shipping build has them. */
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
            say("sceneReconstruction .mesh")
        } else { say("SCENE RECONSTRUCTION UNSUPPORTED") }
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .none
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            config.frameSemantics.insert(.sceneDepth)
        }
        /* ⛑ **The lowest frame rate among the high-res-capable formats**, per the response: do not
           choose 4K streaming because it exists. Gate 0 measured 7 of this device's 13 formats as
           recommended for high-resolution capture. */
        /* ⛑ **4:3 FIRST, and this is a finding from the first Gate 1 run.**

           "Lowest fps among the high-res-capable formats" selected **3840×2160@24** — a 16:9
           streaming format — and the high-resolution still **inherited its aspect ratio**: every
           one of 179 captures came back **4224×2376 (10.0 MP)** rather than 4032×3024 (12.2 MP).
           ⚑ *The response's Gate 1 says "kill if not 12 MP", and this would have failed that check
           — for a reason that is our configuration and not the platform.*

           So: prefer a **4:3** high-res-capable format, then the lowest frame rate within it. On
           this device that is 1920×1440@30. */
        let capable = ARWorldTrackingConfiguration.supportedVideoFormats
            .filter { $0.isRecommendedForHighResolutionFrameCapturing }
        let fourThree = capable.filter {
            abs($0.imageResolution.width / $0.imageResolution.height - 4.0 / 3.0) < 0.02
        }
        let hi = (fourThree.isEmpty ? capable : fourThree).min { $0.framesPerSecond < $1.framesPerSecond }
        if let hi {
            config.videoFormat = hi
            say("format \(Int(hi.imageResolution.width))x\(Int(hi.imageResolution.height))@\(hi.framesPerSecond)")
        } else { say("NO HIGH-RES-CAPABLE FORMAT — this gate cannot run properly") }

        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        started = Date()
        let a = ARAnchor(name: "gate1-origin", transform: matrix_identity_float4x4)
        session.add(anchor: a); origin = a

        rows = head.map { "# \($0)" }
        rows.append("t,px,py,pz,tracking,mapping,features,ax,ay,az,fps,thermal,battery")
        caps = ["shot,t,latencyMs,px,py,pz,tracking,mapping,features,w,h,hitX,hitY,hitZ,hitDist,hitFrom,bytes"]
        say("running 46 min — walk the room slowly for the first 90 s, then work it normally.")
        say("rest the iPad on the SAME rigid spot for 15 s every ~5 min. Nothing to press.")
        flush()

        sampler = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] t in
            guard let self else { return }
            self.sample()
            if Date().timeIntervalSince(self.started) > self.runFor {
                t.invalidate(); self.shutter?.invalidate(); self.health?.invalidate()
                self.session.pause(); self.flush()
                print("HS-GATE1 done — \(self.rows.count) samples, \(self.shotIndex) captures")
                completion(["samples": self.rows.count, "captures": self.shotIndex])
            }
        }
        // ⚑ First shutter after the 90 s walk, so the map exists before anything is measured against it.
        shutter = Timer.scheduledTimer(withTimeInterval: shutterEvery, repeats: true) { [weak self] _ in
            guard let self, Date().timeIntervalSince(self.started) > 90 else { return }
            self.shoot()
        }
        health = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            guard let self else { return }
            print("HS-GATE1 \(Int(Date().timeIntervalSince(self.started)))s thermal=\(self.thermalWord()) battery=\(Int(UIDevice.current.batteryLevel*100))% shots=\(self.shotIndex) fps=\(String(format: "%.1f", self.fps()))")
        }
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    /**
     One 12 MP still, taken **through the tracking session**.

     ⛑ **The pose is the returned frame's own `camera.transform`, recorded and never rewritten.**
     That is the measurement contract the research settled on: capture-time pose is the record, and
     an anchor's later correction is telemetry about the walk, never a revision of a photograph.
     */
    private func shoot() {
        // One request at a time — `ARErrorCodeHighResolutionFrameCaptureInProgress` is 106, and a
        // burst that queues is the honest behaviour rather than a dropped frame.
        guard !inFlight else { return }
        inFlight = true
        let asked = CACurrentMediaTime()
        let idx = shotIndex; shotIndex += 1
        session.captureHighResolutionFrame { [weak self] frame, error in
            guard let self else { return }
            defer { self.inFlight = false }
            let ms = (CACurrentMediaTime() - asked) * 1000
            guard let f = frame, error == nil else {
                self.caps.append("\(idx),\(String(format: "%.1f", Date().timeIntervalSince(self.started))),\(String(format: "%.0f", ms)),,,,ERROR,\(error?.localizedDescription ?? "nil"),,,,,,,,")
                return
            }
            let p = f.camera.transform.columns.3
            let w = CVPixelBufferGetWidth(f.capturedImage), h = CVPixelBufferGetHeight(f.capturedImage)
            /* ⚑ On-axis ray from THIS frame's own transform — immune to the intrinsics
               misregistration the response flags at risk #9, because the optical axis is the one
               ray that needs no pixel mapping. */
            let t = f.camera.transform
            let dir = SIMD3<Float>(-t.columns.2.x, -t.columns.2.y, -t.columns.2.z)
            var hit = ""; var from = "none"
            if let r = self.session.raycast(ARRaycastQuery(origin: SIMD3<Float>(p.x, p.y, p.z),
                                                           direction: dir,
                                                           allowing: .estimatedPlane,
                                                           alignment: .any)).first {
                let q = r.worldTransform.columns.3
                let d = simd_distance(SIMD3<Float>(p.x, p.y, p.z), SIMD3<Float>(q.x, q.y, q.z))
                hit = String(format: "%.4f,%.4f,%.4f,%.3f", q.x, q.y, q.z, d); from = "raycast"
            } else { hit = ",,," }
            // Every 20th image kept, so photograph quality can be judged without shipping 540 MB.
            var bytes = 0
            if idx % 20 == 0, let jpeg = self.jpeg(f.capturedImage) {
                bytes = jpeg.count
                if let dir2 = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                    try? jpeg.write(to: dir2.appendingPathComponent("hs-gate1-\(idx).jpg"))
                }
            }
            self.caps.append("\(idx),\(String(format: "%.1f", Date().timeIntervalSince(self.started))),\(String(format: "%.0f", ms)),"
                + String(format: "%.4f,%.4f,%.4f,", p.x, p.y, p.z)
                + "\(HSArProbe.describe(f.camera.trackingState)),\(self.mappingWord(f)),\(f.rawFeaturePoints?.points.count ?? 0),\(w),\(h),\(hit),\(from),\(bytes)")
            self.flush()
        }
    }

    private func jpeg(_ buffer: CVPixelBuffer) -> Data? {
        let ci = CIImage(cvPixelBuffer: buffer)
        let ctx = CIContext()
        return ctx.jpegRepresentation(of: ci, colorSpace: CGColorSpaceCreateDeviceRGB(),
                                      options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9])
    }

    private func mappingWord(_ f: ARFrame) -> String {
        switch f.worldMappingStatus {
        case .notAvailable: return "notAvailable"
        case .limited: return "limited"
        case .extending: return "extending"
        case .mapped: return "mapped"
        @unknown default: return "unknown"
        }
    }

    private func thermalWord() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"; case .fair: return "fair"
        case .serious: return "serious"; case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }

    /// ⚑ Delivered frame rate — the response's risk #2 says silent thermal throttling shows here
    /// first, before any error is raised and before poses visibly degrade.
    private func fps() -> Double {
        guard frameStamps.count > 1, let a = frameStamps.first, let b = frameStamps.last, b > a else { return 0 }
        return Double(frameStamps.count - 1) / (b - a)
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        frameStamps.append(frame.timestamp)
        if frameStamps.count > 120 { frameStamps.removeFirst(frameStamps.count - 120) }
    }

    private func sample() {
        guard let f = session.currentFrame else { return }
        let p = f.camera.transform.columns.3
        let live = f.anchors.first { $0.identifier == origin?.identifier }
        let a = live?.transform.columns.3 ?? SIMD4<Float>(0, 0, 0, 1)
        rows.append(String(format: "%.2f,%.4f,%.4f,%.4f,%@,%@,%d,%.4f,%.4f,%.4f,%.1f,%@,%d",
                           Date().timeIntervalSince(started), p.x, p.y, p.z,
                           HSArProbe.describe(f.camera.trackingState), mappingWord(f),
                           f.rawFeaturePoints?.points.count ?? 0, a.x, a.y, a.z,
                           fps(), thermalWord(), Int(UIDevice.current.batteryLevel * 100)))
        if rows.count % 20 == 0 { flush() }
    }

    private func flush() {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { return }
        try? rows.joined(separator: "\n").write(to: dir.appendingPathComponent("hs-gate1.csv"),
                                                atomically: true, encoding: .utf8)
        try? caps.joined(separator: "\n").write(to: dir.appendingPathComponent("hs-gate1-caps.csv"),
                                                atomically: true, encoding: .utf8)
    }
}
