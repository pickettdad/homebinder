import ARKit
import AVFoundation
import CoreImage
import Foundation

/**
 ⚑ **What does a shutter at traverse cadence cost ARKit's tracking — and does texture read the same
 on ARKit's frames as on AVFoundation's?**

 ⛑ **Two questions in one tethered walk, because both are unmeasured and both can sink the posed
 traverse at step 5 rather than here.**

 **The first, and the repo already believes an answer it has not earned.** Gate 1 recorded a flat
 **30.0 fps across 45 minutes** — at **one high-resolution capture every fifteen seconds**. A 100 ms
 interruption there is 0.67% of the frame budget and averages clean away. ⚠️ **At the ~1 Hz a posed
 traverse wants it is 8–10%**, and `HSZoneSession`'s own comment asserting that
 `captureHighResolutionFrame` is "delivered out of band, the tracking stream is never interrupted"
 is that measurement extrapolated **fifteenfold**. *An assumption wearing a measurement's clothes.*

 **The second is the quiet one.** `traverseKeepTexture` and `traverseMinimumTexture` are both **5.0**,
 calibrated blank-first against the `.photo`-preset AVFoundation stream — variance of the Laplacian on
 a 384-wide downscale of a **3680×2760 BGRA** frame. Under ARKit the same downscale comes from a
 **1920×1440 YCbCr** frame through a different image pipeline. ⛑ **If the threshold is not
 re-measured, the failure is invisible**: frames are kept or discarded at a rate nobody can attribute,
 and under a posed traverse a discard is *a missing vertex in the pipe line.*

 **Three windows, thirty seconds each, one continuous walk.** Baseline with no shutter, then 1 Hz,
 then 2 Hz. ⚑ *Windows rather than separate runs, for the reason the exposure probe settled: two
 separate walks differ in path, light and aim, and every difference lands in the answer.*

 **Deliberately measures, changes nothing, and touches no product code.**
 */
@available(iOS 16.0, *)
final class HSTraverseSource: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var done: (([String: Any]) -> Void)?
    private var out: [String: Any] = [:]

    private var frames = 0
    private var shots: [Double] = []
    private var streamTexture: [Double] = []
    private var stillTexture: [Double] = []
    private var states: [String] = []
    private var inFlight = false
    private var busyRefusals = 0
    private let ctx = CIContext(options: [.useSoftwareRenderer: false])

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        frames += 1
        // ⚑ Sampled, not every frame: this probe must not become the load it is measuring.
        if frames % 15 == 0 {
            states.append(HSArProbe.describe(frame.camera.trackingState))
            if let t = self.texture(of: frame.capturedImage) { self.streamTexture.append(t) }
        }
    }

    /**
     ⛑ **The same measure the traverse gates on, recomputed here rather than shared.**

     `textureScore` is private to `CameraController` and reads a BGRA buffer; ARKit hands out
     bi-planar YCbCr. ⚑ *Reimplementing it is the wrong instinct in general and the right one here* —
     the whole question is whether the number means the same thing on a different pipeline, and a
     probe that could only run on one of the two pipelines could not ask it. Variance of the
     Laplacian over the luma plane, on the same 384-wide working width the traverse uses.
     */
    private func texture(of buffer: CVPixelBuffer) -> Double? {
        let ci = CIImage(cvPixelBuffer: buffer)
        let scale = 384.0 / ci.extent.width
        guard scale > 0, scale <= 1 else { return nil }
        let small = ci.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cg = ctx.createCGImage(small, from: small.extent) else { return nil }
        let w = cg.width, h = cg.height
        guard w > 2, h > 2 else { return nil }
        var px = [UInt8](repeating: 0, count: w * h)
        guard let gray = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8,
                                   bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(),
                                   bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
        gray.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        var sum = 0.0, sumSq = 0.0, n = 0.0
        for y in stride(from: 1, to: h - 1, by: 2) {
            for x in stride(from: 1, to: w - 1, by: 2) {
                let c = Double(px[y * w + x])
                let lap = abs(4 * c - Double(px[y * w + x - 1]) - Double(px[y * w + x + 1])
                              - Double(px[(y - 1) * w + x]) - Double(px[(y + 1) * w + x]))
                sum += lap; sumSq += lap * lap; n += 1
            }
        }
        guard n > 0 else { return nil }
        let mean = sum / n
        return sqrt(max(0, sumSq / n - mean * mean))
    }

    private func median(_ xs: [Double]) -> Double {
        let v = xs.sorted()
        return v.isEmpty ? -1 : v[v.count / 2]
    }

    /// One window: reset the counters, fire the shutter at `hz` for `seconds`, then bank the numbers.
    private func window(_ name: String, hz: Double, seconds: Double, _ next: @escaping () -> Void) {
        frames = 0; states = []; streamTexture = []; shots = []
        let began = CACurrentMediaTime()
        HSZoneLog.record("traverseSource", ["window": name, "hz": hz])

        var timer: Timer?
        if hz > 0 {
            timer = Timer.scheduledTimer(withTimeInterval: 1.0 / hz, repeats: true) { [weak self] _ in
                guard let self else { return }
                /* ⛑ **Drop, never queue** — and count the drop. `captureHighResolutionFrame` raises
                   error 106 while one is in flight, and a probe that silently swallowed that would
                   report a cadence it never achieved. */
                guard !self.inFlight else { self.busyRefusals += 1; return }
                self.inFlight = true
                let t0 = CACurrentMediaTime()
                self.session.captureHighResolutionFrame { frame, _ in
                    self.shots.append((CACurrentMediaTime() - t0) * 1000)
                    if let f = frame {
                        // ⚑ The still's OWN pixels, so the two textures are the two candidate sources
                        // for the same decision rather than the same source measured twice.
                        if let t = self.texture(of: f.capturedImage) { self.stillTexture.append(t) }
                        self.out["still.resolution"] =
                            "\(Int(f.camera.imageResolution.width))x\(Int(f.camera.imageResolution.height))"
                    }
                    self.inFlight = false
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
            timer?.invalidate()
            let elapsed = CACurrentMediaTime() - began
            self.out["\(name).fps"] = Double(self.frames) / elapsed
            self.out["\(name).frames"] = self.frames
            self.out["\(name).shots"] = self.shots.count
            self.out["\(name).shotMsP50"] = self.median(self.shots)
            self.out["\(name).shotMsMax"] = self.shots.max() ?? -1
            self.out["\(name).busyRefusals"] = self.busyRefusals
            self.out["\(name).streamTextureMedian"] = self.median(self.streamTexture)
            self.out["\(name).tracking"] = Array(Set(self.states)).sorted()
            self.out["\(name).thermal"] = HSZoneLog.thermalWord()
            self.busyRefusals = 0
            next()
        }
    }

    func run(_ completion: @escaping ([String: Any]) -> Void) {
        done = completion
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) { config.sceneReconstruction = .mesh }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) { config.frameSemantics.insert(.sceneDepth) }
        /* ⚑ `stillFormat()`'s own choice would be ideal; it is private to HSZoneSession, so the
           default is used and the achieved format is RECORDED rather than assumed. */
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        out["videoFormat"] = "\(Int(config.videoFormat.imageResolution.width))x\(Int(config.videoFormat.imageResolution.height))@\(config.videoFormat.framesPerSecond)"

        // Four seconds to settle, then three thirty-second windows of one continuous walk.
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self else { return }
            self.window("baseline", hz: 0, seconds: 30) {
                self.window("hz1", hz: 1, seconds: 30) {
                    self.window("hz2", hz: 2, seconds: 30) {
                        self.finish()
                    }
                }
            }
        }
    }

    private func finish() {
        out["still.textureMedian"] = median(stillTexture)
        /*
         ⛑ **The verdict computed once, in two clauses, because there are two questions.**

         *Cost*: a delivered rate that holds within a frame of baseline means the shutter is
         affordable at that cadence. **A collapse changes the whole ruling here rather than at step 5**
         — the picture would have to come from the stream at 2.8 MP, a 3.6× resolution loss the desk
         pays for.

         *Texture*: the two medians are the same scene through two pipelines. **If they differ, the
         5.0 threshold does not transfer**, and the number to carry forward is the ratio.
         */
        let base = out["baseline.fps"] as? Double ?? 0
        let at1 = out["hz1.fps"] as? Double ?? 0
        let at2 = out["hz2.fps"] as? Double ?? 0
        let streamT = out["baseline.streamTextureMedian"] as? Double ?? -1
        let stillT = out["still.textureMedian"] as? Double ?? -1
        let ratio = (streamT > 0 && stillT > 0) ? stillT / streamT : -1
        out["textureRatio.stillOverStream"] = ratio
        out["VERDICT"] = String(
            format: "fps %.1f baseline → %.1f at 1 Hz → %.1f at 2 Hz · texture stream %.1f vs still %.1f (×%.2f)",
            base, at1, at2, streamT, stillT, ratio)
        HSZoneLog.record("traverseSource", ["stage": "done", "verdict": out["VERDICT"] ?? "?"])
        session.pause()
        if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted]) {
            try? data.write(to: dir.appendingPathComponent("hs-traverse-source.json"), options: .atomic)
        }
        print("HS-TRAVERSE-SOURCE \(out["VERDICT"] ?? "?")")
        done?(out)
        done = nil
    }
}
