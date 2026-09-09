import ARKit
import AVFoundation
import CoreImage
import Foundation

/**
 ⚑ **What does a shutter at traverse cadence cost ARKit's tracking — and does the texture gate
 transfer to ARKit's pixels?**

 ⛑ **Rewritten 2026-09-07 after four adversarial lenses returned six high findings on the first cut.
 Every one would have cost a walk, and two of them made the probe unable to answer its own question.
 They are recorded here because a probe's failures are the probe's design.**

 ### The first cut manufactured the effect it was hunting

 It computed texture on `frame.capturedImage` **inside the capture completion, on the main thread** —
 the exact pattern whose field signature is already in `HSZoneSession`: *the preview froze on the
 first photograph of a zone while the shutter still fired, because a completion held a pooled buffer
 for as long as an encode took.* ⚠️ **And it ran only in the shutter windows, scaling with cadence
 exactly as a real shutter cost would** — indistinguishable from the answer. *A 12 MP render at 2 Hz
 costing 40 ms is 8% of the main thread: the same order as the 8–10% this probe exists to detect.*
 **Pixels are copied out and released now, texture runs on a background queue, and the instrument
 times itself** so a reader can see whether it is a rounding error or a rival explanation.

 ### And it could not answer the texture question at all

 The gate it is calibrating — `traverseKeepTexture = 5.0` — was cut against the **AVFoundation
 `.photo` stream**. Both arms of the first cut were ARKit. ⛑ *It compared ARKit's still against
 ARKit's stream, which is a real question and not this one.* **The anchor is a covered lens**: the
 AVFoundation blank-first calibration is on record at **1.83 / 1.88**, and a covered lens is the one
 scene both pipelines can be shown identically. *Scene-free by construction* — which is what the
 first cut's ratio was not, dividing sixty seconds of one walk by thirty seconds of another.

 ### Three more, each fixed here

 - **The capture error was discarded**, so a shutter that never fired would read as a free shutter —
   cadence achieved, latency low, fps flat. Errors are counted and **the verdict is gated on them**.
 - **The comment claiming `stillFormat()` is private was false.** It is `static` on an internal class
   in this module. So the probe ran the *default* video format, and would have either errored on
   every capture or returned a stream-resolution frame — a ratio of ≈1.00 reported as *"texture
   transfers"* when nothing was compared.
 - **Window order was fixed and single-pass**, confounding cadence with thermal rise, map growth and
   which room the walk had reached. **Baseline runs again at the end**, and a drift between the two
   baselines is the confound measuring itself.
 */
@available(iOS 17.0, *)
final class HSTraverseSource: NSObject, ARSessionDelegate {
    private let session = ARSession()
    private var done: (([String: Any]) -> Void)?
    private var out: [String: Any] = [:]

    /// ⛑ Texture never runs on main. See the header — the first cut's own render was a rival
    /// explanation for the number it reported.
    private let work = DispatchQueue(label: "hs.traverse.source", qos: .utility)
    private let ctx = CIContext(options: [.useSoftwareRenderer: false])

    private var frames = 0
    private var shots: [Double] = []
    private var shotFailures = 0
    private var firstError: String?
    private var streamTexture: [Double] = []
    private var stillTexture: [Double] = []
    private var states: [String] = []
    private var instrumentMs = 0.0
    private var inFlight = false
    private var busyRefusals = 0

    // MARK: frames

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        frames += 1
        guard frames % 15 == 0 else { return }
        states.append(HSArProbe.describe(frame.camera.trackingState))
        /* ⚑ Copy, then release, then measure elsewhere. The buffer belongs to ARKit's pool and
           holding one past this callback stops the session delivering. */
        if let copy = Self.copy(frame.capturedImage) {
            work.async { [weak self] in
                guard let self else { return }
                let t0 = CACurrentMediaTime()
                let t = self.texture(of: copy)
                let cost = (CACurrentMediaTime() - t0) * 1000
                DispatchQueue.main.async {
                    self.instrumentMs += cost
                    if let t { self.streamTexture.append(t) }
                }
            }
        }
    }

    /// The same plane-wise copy `HSZoneSession` uses, for the same reason.
    private static func copy(_ src: CVPixelBuffer) -> CVPixelBuffer? {
        var out: CVPixelBuffer?
        let w = CVPixelBufferGetWidth(src), h = CVPixelBufferGetHeight(src)
        guard CVPixelBufferCreate(nil, w, h, CVPixelBufferGetPixelFormatType(src),
                                  [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary] as CFDictionary,
                                  &out) == kCVReturnSuccess, let dst = out else { return nil }
        CVPixelBufferLockBaseAddress(src, .readOnly); CVPixelBufferLockBaseAddress(dst, [])
        defer { CVPixelBufferUnlockBaseAddress(dst, []); CVPixelBufferUnlockBaseAddress(src, .readOnly) }
        let planes = CVPixelBufferGetPlaneCount(src)
        if planes == 0 {
            guard let a = CVPixelBufferGetBaseAddress(src), let b = CVPixelBufferGetBaseAddress(dst) else { return nil }
            memcpy(b, a, CVPixelBufferGetDataSize(src)); return dst
        }
        for i in 0..<planes {
            guard let a = CVPixelBufferGetBaseAddressOfPlane(src, i),
                  let b = CVPixelBufferGetBaseAddressOfPlane(dst, i) else { return nil }
            let rows = CVPixelBufferGetHeightOfPlane(src, i)
            let ss = CVPixelBufferGetBytesPerRowOfPlane(src, i), ds = CVPixelBufferGetBytesPerRowOfPlane(dst, i)
            if ss == ds { memcpy(b, a, rows * ss) }
            else { for r in 0..<rows { memcpy(b.advanced(by: r * ds), a.advanced(by: r * ss), min(ss, ds)) } }
        }
        return dst
    }

    /**
     ⛑ **The traverse's own measure, recomputed rather than shared — and that is the point.**

     `textureScore` is private to `CameraController` and reads BGRA; ARKit hands out bi-planar YCbCr.
     ⚑ *The whole question is whether the number means the same thing on a different pipeline, and a
     probe that could only run on one of them could not ask it.* Variance of the Laplacian over luma,
     at the same 384-wide working width, with the same every-other-pixel stride.
     */
    private func texture(of buffer: CVPixelBuffer) -> Double? {
        let ci = CIImage(cvPixelBuffer: buffer)
        guard ci.extent.width > 0 else { return nil }
        // ⚠️ Not guarded to <= 1: a frame narrower than 384 must still be measured, upscaled, or the
        // arm silently returns nothing and the median reads -1 as though the scene were blank.
        let scale = 384.0 / ci.extent.width
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
                let lap = abs(4 * Double(px[y * w + x]) - Double(px[y * w + x - 1]) - Double(px[y * w + x + 1])
                              - Double(px[(y - 1) * w + x]) - Double(px[(y + 1) * w + x]))
                sum += lap; sumSq += lap * lap; n += 1
            }
        }
        guard n > 0 else { return nil }
        let mean = sum / n
        return sqrt(max(0, sumSq / n - mean * mean))
    }

    private func median(_ xs: [Double]) -> Double {
        let v = xs.sorted(); return v.isEmpty ? -1 : v[v.count / 2]
    }

    // MARK: windows

    private func window(_ name: String, hz: Double, seconds: Double, _ next: @escaping () -> Void) {
        // ⚑ stillTexture reset too. The first cut did not, so its ratio divided sixty seconds of one
        // walk by thirty of another — the exposure probe's original failure with a longer baseline.
        frames = 0; states = []; streamTexture = []; stillTexture = []
        shots = []; shotFailures = 0; instrumentMs = 0; busyRefusals = 0
        let began = CACurrentMediaTime()
        HSZoneLog.record("traverseSource", ["window": name, "hz": hz])

        var timer: Timer?
        if hz > 0 {
            timer = Timer.scheduledTimer(withTimeInterval: 1.0 / hz, repeats: true) { [weak self] _ in
                guard let self else { return }
                guard !self.inFlight else { self.busyRefusals += 1; return }
                self.inFlight = true
                let t0 = CACurrentMediaTime()
                self.session.captureHighResolutionFrame { frame, error in
                    self.shots.append((CACurrentMediaTime() - t0) * 1000)
                    /* ⛑ **The error is kept.** Discarded, a shutter that never fires reads as a free
                       shutter: cadence achieved, latency low, frame rate untouched — because nothing
                       was ever captured. */
                    if let error {
                        self.shotFailures += 1
                        if self.firstError == nil { self.firstError = error.localizedDescription }
                    }
                    if let f = frame, let copy = Self.copy(f.capturedImage) {
                        let res = f.camera.imageResolution
                        self.work.async {
                            let t = self.texture(of: copy)
                            DispatchQueue.main.async {
                                if let t { self.stillTexture.append(t) }
                                self.out["still.resolution"] = "\(Int(res.width))x\(Int(res.height))"
                            }
                        }
                    }
                    self.inFlight = false
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
            timer?.invalidate()
            let elapsed = CACurrentMediaTime() - began
            self.out["\(name).fps"] = Double(self.frames) / elapsed
            self.out["\(name).shots"] = self.shots.count
            self.out["\(name).shotFailures"] = self.shotFailures
            self.out["\(name).shotMsP50"] = self.median(self.shots)
            self.out["\(name).busyRefusals"] = self.busyRefusals
            self.out["\(name).streamTextureMedian"] = self.median(self.streamTexture)
            self.out["\(name).stillTextureMedian"] = self.median(self.stillTexture)
            // ⚑ The instrument's own cost, so it can be ruled out as a rival explanation rather than
            // assumed away — the first cut's whole undoing.
            self.out["\(name).instrumentMs"] = self.instrumentMs
            self.out["\(name).tracking"] = Array(Set(self.states)).sorted()
            self.out["\(name).thermal"] = HSZoneLog.thermalWord()
            next()
        }
    }

    func run(_ completion: @escaping ([String: Any]) -> Void) {
        done = completion
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) { config.sceneReconstruction = .mesh }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) { config.frameSemantics.insert(.sceneDepth) }
        /* ⛑ **The traverse's own format.** The first cut left the default and said `stillFormat()` was
           private; it is `static` on an internal class in this module. On the default format the
           capture either errors on every request or returns a stream-resolution frame — and a
           still-over-stream ratio of ≈1.00 would have read as *"texture transfers"*. */
        config.videoFormat = HSZoneSession.stillFormat() ?? config.videoFormat
        out["videoFormat"] = "\(Int(config.videoFormat.imageResolution.width))x\(Int(config.videoFormat.imageResolution.height))@\(config.videoFormat.framesPerSecond)"
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])

        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self else { return }
            /* ⚑ **The blank anchor first, and it is what makes the texture question answerable.**
               A covered lens is the one scene both pipelines can be shown identically; AVFoundation's
               reading of it is on record at 1.83 / 1.88. Everything else is scene-dependent, and
               texture is the most scene-dependent quantity in this codebase. */
            HSZoneLog.record("traverseSource", ["cue": "COVER THE LENS"])
            self.window("blank", hz: 0, seconds: 6) {
                HSZoneLog.record("traverseSource", ["cue": "UNCOVER AND WALK"])
                self.window("baseline", hz: 0, seconds: 25) {
                    self.window("hz1", hz: 1, seconds: 25) {
                        self.window("hz2", hz: 2, seconds: 25) {
                            /* ⛑ Baseline again. Single-pass order confounds cadence with thermal
                               rise, map growth and which room the walk has reached; a drift between
                               the two baselines is the confound measuring itself. */
                            self.window("baseline2", hz: 0, seconds: 25) { self.finish() }
                        }
                    }
                }
            }
        }
    }

    private func finish() {
        let b1 = out["baseline.fps"] as? Double ?? 0
        let b2 = out["baseline2.fps"] as? Double ?? 0
        let a1 = out["hz1.fps"] as? Double ?? 0
        let a2 = out["hz2.fps"] as? Double ?? 0
        let fail = (out["hz1.shotFailures"] as? Int ?? 0) + (out["hz2.shotFailures"] as? Int ?? 0)
        let blank = out["blank.streamTextureMedian"] as? Double ?? -1
        // ⚑ Against AVFoundation's own blank-first reading, HSCameraPlugin's calibration set: 1.83/1.88.
        let pipelineScale = blank > 0 ? blank / 1.855 : -1
        out["blank.avReference"] = 1.855
        out["textureScale.arkitOverAv"] = pipelineScale
        out["suggestedKeepTexture"] = pipelineScale > 0 ? 5.0 * pipelineScale : -1
        // Within one window, both arms from the same 25 seconds of the same walk.
        if let s = out["hz1.stillTextureMedian"] as? Double, let t = out["hz1.streamTextureMedian"] as? Double, t > 0, s > 0 {
            out["textureRatio.stillOverStream.hz1"] = s / t
        }
        out["baselineDrift"] = b1 > 0 ? (b2 - b1) / b1 : -1

        /* ⛑ **Gated on whether the shutter actually fired.** An affordability number computed over
           captures that did not happen is the cleanest possible wrong answer. */
        out["VERDICT"] = fail > 0
            ? "INVALID — \(fail) capture failures (\(firstError ?? "no reason recorded")); the fps numbers describe a shutter that did not fire"
            : String(format: "fps %.1f → %.1f at 1 Hz → %.1f at 2 Hz (baseline again %.1f, drift %+.1f%%) · blank %.2f vs AV 1.855 = pipeline ×%.2f, so keepTexture ≈ %.1f",
                     b1, a1, a2, b2, (out["baselineDrift"] as? Double ?? 0) * 100,
                     blank, pipelineScale, (out["suggestedKeepTexture"] as? Double ?? -1))
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
