import ARKit
import AVFoundation
import Foundation

/**
 A read-only probe that answers the zone-session costing questions on the device.

 ⚑ **This is the instrument, not the feature.** Nothing here is a capture path, nothing it does
 survives the call, and it is reachable only from the dev bench. It exists because four of the
 questions in the proposed zone-long-session architecture cannot be settled by reading Apple's
 documentation — the documentation says what the API accepts, not what the pipeline honours — and
 the project's rule is that a device question gets measured rather than argued. The ARKit
 capability enumeration of 2026-08-18 is the precedent and it was built under the same
 "cost it, do not build it" instruction.

 Four questions, in the order the architecture depends on them:

 1. **Does the plate path survive inside an AR session?** `captureHighResolutionFrame(using:)`
    takes an `AVCapturePhotoSettings`, and `AVCapturePhotoBracketSettings` is a subclass — so the
    type system permits handing the bracket in. Whether the AR pipeline *honours* it is
    undocumented, and it decides whether plates keep bracketing and the torch pair inside a zone.
 2. **What does stepping out to 0.5× and back cost?** Specifically whether the mesh survives the
    session pausing, and whether resuming needs relocalisation or the map simply holds.
 3. **Does a ray from the camera pose into the mesh return the object's surface?** A plate shot's
    pose is *where the concierge stood* — a metre off and on the wrong side — so without this the
    container is placed at the photographer rather than at the thing.
 4. **How long does the session take to become usable?** Charged twice per step-out.

 ⚑ The bracket attempt is deliberately **last**. `AVCapturePhotoOutput` raises an ObjC exception
 rather than returning an error for an unsupported bracket, and Swift cannot catch that. So every
 other answer is logged and returned before it is tried, and each step NSLogs as it happens: if the
 probe dies at that line, the crash IS the answer and the rest of the run is not lost with it.
 */
final class HSArProbe: NSObject, ARSessionDelegate {
    private let session = ARSession()
    /* ⚑ **Built before ARKit ever runs, and this is the experiment.** Run 3 measured
       `AVCaptureDeviceInput(device:)` at 9006 ms while ARKit held the camera — which would make a
       per-shot step-out unaffordable and would decide the architecture on its own. But an input is
       a long-lived object: if it can be made ONCE at launch and kept, the per-shot cost collapses to
       `startRunning`. The two readings are taken in the same run so they are directly comparable. */
    private var prebuiltAv: AVCaptureSession?
    private var steps: [String] = []
    private var result: [String: Any] = [:]
    private var completion: (([String: Any]) -> Void)?
    private let queue = DispatchQueue(label: "ca.housesteady.arprobe")

    private func step(_ message: String) {
        NSLog("HS-AR-PROBE %@", message)
        steps.append(message)
    }

    static func isSupported() -> Bool { ARWorldTrackingConfiguration.isSupported }

    func run(completion: @escaping ([String: Any]) -> Void) {
        self.completion = completion
        guard ARWorldTrackingConfiguration.isSupported else {
            completion(["supported": false, "steps": ["world tracking unsupported"]])
            return
        }
        result["supported"] = true
        session.delegate = self

        let config = ARWorldTrackingConfiguration()
        let meshOK = ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
        result["meshSupported"] = meshOK
        if meshOK { config.sceneReconstruction = .mesh }

        // The format that matters: the architecture wants full-resolution stills taken from inside
        // the session, so the probe runs the format Apple recommends for exactly that.
        if #available(iOS 16.0, *),
           let hiRes = ARWorldTrackingConfiguration.recommendedVideoFormatForHighResolutionFrameCapturing {
            config.videoFormat = hiRes
            result["hiResFormatAvailable"] = true
        } else {
            result["hiResFormatAvailable"] = false
        }
        let f = config.videoFormat
        result["formatWidth"] = Int(f.imageResolution.width)
        result["formatHeight"] = Int(f.imageResolution.height)
        result["formatDevice"] = f.captureDeviceType.rawValue
        result["formatFps"] = f.framesPerSecond
        step("run: mesh=\(meshOK) format=\(Int(f.imageResolution.width))x\(Int(f.imageResolution.height)) device=\(f.captureDeviceType.rawValue)")

        // Build the escape-hatch session FIRST, while nothing holds the camera.
        let preBuildStart = Date()
        let av = AVCaptureSession()
        av.sessionPreset = .photo
        if let d = AVCaptureDevice.default(.builtInUltraWideCamera, for: .video, position: .back),
           let i = try? AVCaptureDeviceInput(device: d), av.canAddInput(i) {
            av.addInput(i)
            let out = AVCapturePhotoOutput()
            if av.canAddOutput(out) { av.addOutput(out) }
            prebuiltAv = av
        }
        result["prebuildMs"] = Int(Date().timeIntervalSince(preBuildStart) * 1000)
        step("prebuild: ultra-wide AV session built in \(result["prebuildMs"] ?? 0) ms, before ARKit started")

        let startedAt = Date()
        session.run(config, options: [.resetTracking, .removeExistingAnchors])

        queue.async { [weak self] in
            guard let self else { return }
            // ---- Q4: how long until the session is usable at all ----
            let normal = self.waitForNormal(timeout: 20)
            self.result["msToFirstNormal"] = normal ? Int(Date().timeIntervalSince(startedAt) * 1000) : -1
            self.step("first normal: \(normal ? "yes" : "TIMED OUT")")
            // Mesh needs the operator to move; give it a fixed window and report what it got.
            Thread.sleep(forTimeInterval: 6)
            let (anchorsA, facesA) = self.meshCount()
            self.result["meshAnchorsBefore"] = anchorsA
            self.result["meshFacesBefore"] = facesA
            self.step("mesh after 6 s: \(anchorsA) anchors, \(facesA) faces")

            // ⚑ Torch FIRST, before any other probe step touches the device. Run 5 read
            // `isTorchActive=false` after the exposure had already been forced to `.custom`, which
            // leaves a confound: a negative measured downstream of an unrelated change is not a
            // clean negative, and the torch decides whether plates work in a dark plant room.
            self.probeTorch()

            // ---- Q3: does a ray from the pose land on the surface in front of the lens? ----
            self.probeRaycast()

            // ---- Q6: the three modes, and whether the low-power one is real ----
            self.probeModes()

            // ---- Q5: the collision nobody named — does the shutter we just shipped survive? ----
            self.probeExposureControl()

            // ---- Q1a: a plain full-resolution still from inside the session ----
            self.probeHiResPlain()

            // ---- Q2: pause, hold the camera elsewhere, resume ----
            self.probeStepOut()

            // ---- Q1c: if the built-in bracket is refused, can one be hand-rolled? ----
            self.probeHandRolledBracket()

            // ---- Q6: does asking for a PHOTO rather than a tracking frame change the pixels? ----
            self.probePhotoQuality()

            // ---- Q7: what a PHOTOGRAPHIC exposure buys, and what it costs tracking ----
            self.probeExposureLadder()

            // ---- Q8: the lamp. The biggest lever in a dim room, and never measured in a zone. ----
            self.probeTorchGain()

            // ---- Q1b: the bracket. LAST, because it may not return. ----
            self.probeBracket()

            self.session.pause()
            self.result["steps"] = self.steps
            let out = self.result
            DispatchQueue.main.async { self.completion?(out) }
        }
    }

    // MARK: - waiting

    private func waitForNormal(timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if case .normal = session.currentFrame?.camera.trackingState { return true }
            Thread.sleep(forTimeInterval: 0.1)
        }
        return false
    }

    private func meshCount() -> (Int, Int) {
        let anchors = (session.currentFrame?.anchors ?? []).compactMap { $0 as? ARMeshAnchor }
        return (anchors.count, anchors.reduce(0) { $0 + $1.geometry.faces.count })
    }

    // MARK: - Q3 · raycast

    /**
     ⚑ **The question this answers is not "does raycasting work", it is "is the container placed at
     the object or at the photographer".** A nameplate is shot from 0.3–1 m, so if a ray forward
     from the pose lands at roughly that distance the container's position is the object's surface;
     if it misses, the position is where somebody stood and the whole anchoring argument fails.

     ⛑ **All three sources on one press, because this probe asked the right question and then
     reported the wrong witness's answer as the finding.** It has written `raycastTarget` since the
     day it was built and nobody ever read it; it said `estimatedPlane` every time, which is ARKit
     stating outright that it *invented* the plane. The field found that four weeks later, in an
     export, from two photographs of a table lamp.

     ⚑ **The disagreement between the sources IS the measurement.** On a flat wall they agree. On
     the objects this app photographs — a valve, a nameplate, a lamp, a water heater — the plane
     finds the background, and `depthVsMeshM` is the number that says whether reconstruction even
     contains the thing. This is off the shutter, so it is free here in a way a per-capture
     cross-check would not be.
     */
    private func probeRaycast() {
        guard let frame = session.currentFrame else {
            step("raycast: no frame")
            return
        }
        let t = frame.camera.transform
        let origin = SIMD3<Float>(t.columns.3.x, t.columns.3.y, t.columns.3.z)
        // -Z is the camera's forward axis in ARKit's convention.
        let direction = -SIMD3<Float>(t.columns.2.x, t.columns.2.y, t.columns.2.z)
        let query = ARRaycastQuery(origin: origin, direction: direction,
                                   allowing: .estimatedPlane, alignment: .any)
        let hits = session.raycast(query)
        result["raycastHits"] = hits.count
        var planeDistance: Float?
        if let first = hits.first {
            let p = first.worldTransform.columns.3
            let d = simd_distance(origin, SIMD3<Float>(p.x, p.y, p.z))
            planeDistance = d
            result["raycastDistance"] = Double(d)
            result["raycastTarget"] = "\(first.target)"
            /* ⚑ `anchor == nil` on an estimated-plane result is ARKit saying the plane was invented
               — `ARRaycastResult.h`: "In case of an estimated plane target, an anchor MAY be
               provided if the ray hit an existing plane." It is the one field that separates a real
               detected surface from a fit to this instant's feature points, and both production
               sites threw it away for four weeks. */
            result["raycastAnchored"] = first.anchor != nil
            step(String(format: "raycast plane: hit at %.2f m, target %@, anchored %@",
                        d, "\(first.target)", first.anchor != nil ? "yes" : "no"))
        } else {
            result["raycastDistance"] = -1
            step("raycast plane: NO HIT")
        }

        // What the capture doors would actually record for this frame — the ladder, unmodified.
        let aim = HSSurface.ahead(of: frame, live: session.currentFrame)
        result["surfaceSource"] = aim.source.rawValue
        result["surfaceDistance"] = aim.source.measured ? Double(aim.distance) : -1
        result["surfaceMs"] = aim.ms
        if let confidence = aim.confidence { result["surfaceConfidence"] = confidence }
        if let spread = aim.spreadM { result["surfaceSpreadM"] = Double(spread) }
        if !aim.depthWhy.isEmpty { result["surfaceDepthWhy"] = aim.depthWhy }
        /* ⛑ A refusal has no distance, so it does not print one. A diagnostic decides whether
           there is anything to say before it says what — `0.00 m` beside a refused surface is a
           number somebody will eventually read as a measurement. */
        step(aim.source.measured
             ? "surface: \(aim.source.rawValue) at \(String(format: "%.2f", aim.distance)) m"
                + " in \(String(format: "%.1f", aim.ms)) ms"
             : "surface: REFUSED — \(aim.depthWhy.isEmpty ? aim.meshWhy : aim.depthWhy)")

        /* ⚑ And the mesh asked SEPARATELY, even when depth already answered — that is the whole
           point of a probe. `depthVsMeshM` is the one number that says whether the reconstruction
           contains the object or only the wall behind it, and no capture can afford to ask it. */
        let mesh = HSSurface.meshOnAxis(origin: origin, direction: direction,
                                        anchors: frame.anchors.compactMap { $0 as? ARMeshAnchor })
        result["meshRayDistance"] = mesh.point != nil ? Double(mesh.t) : -1
        result["meshRayKind"] = mesh.kind ?? ""
        result["meshRayWhy"] = mesh.why
        result["meshRayTriangles"] = mesh.triangles
        if mesh.point != nil {
            if let planeDistance { result["planeVsMeshM"] = Double(abs(planeDistance - mesh.t)) }
            if aim.source.measured, aim.source != .mesh {
                result["depthVsMeshM"] = Double(abs(aim.distance - mesh.t))
            }
            step("raycast mesh: hit at \(String(format: "%.2f", mesh.t)) m"
                 + " (\(mesh.kind ?? "unclassified")) over \(mesh.triangles) triangles")
        } else {
            step("raycast mesh: NO HIT — \(mesh.why)")
        }
    }

    // MARK: - Q6 · the modes, measured rather than quoted

    /**
     ⚑ **Does the low-power configuration actually exist on this device, and does it keep the thing
     it is kept for?**

     The proposed shape runs three modes across a visit: RoomPlan at zone entry, a mesh sweep where
     the room deserves one, and then a stripped-back tracking session whose only job is to hold the
     coordinate space so one frame per object container can carry a position. The third is the one
     that runs for hours, so it is the one that decides whether a two-hour visit is survivable.

     Two things are checked and they are not the same. **Does a 30 fps world-tracking format exist**
     — halving the frame rate halves the sensor and processor work, and a recommendation to use one
     is worthless if the device does not offer it. And **does turning mesh and plane detection off
     keep tracking alive** — because if the coordinate space dies with them, the whole staged design
     collapses into one heavy mode.

     ⚑ **There is deliberately no CPU or power number here.** A first cut measured in-process CPU
     time and returned a *negative* rate for one mode — impossible, and caused by counting only live
     threads — and even corrected it would have been a floor rather than a cost, because ARKit does
     most of its work outside this process on the neural engine and in system daemons. A number that
     cannot be trusted is worse than no number: it would have been quoted. **Per-mode power needs the
     owner walking a real room, one mode per run**, and that is said rather than approximated.
    */
    private func probeModes() {
        // Is there a 30 fps world-tracking format at all?
        let formats = ARWorldTrackingConfiguration.supportedVideoFormats
        let fpsOptions = Set(formats.map { $0.framesPerSecond }).sorted()
        result["formatFpsOptions"] = fpsOptions
        let thirty = formats.first { $0.framesPerSecond == 30 }
        result["has30fpsFormat"] = thirty != nil
        step("modes: world-tracking fps options \(fpsOptions), 30 fps format \(thirty == nil ? "ABSENT" : "present")")

        Thread.sleep(forTimeInterval: 8)
        let (meshAnchorsHeavy, meshFacesHeavy) = meshCount()
        result["thermalMeshOn"] = Self.thermalName()
        step("modes: mesh ON — \(meshAnchorsHeavy) anchors \(meshFacesHeavy) faces, thermal \(Self.thermalName())")

        // Now the stripped-back one, exactly as proposed: no mesh, no plane search, 30 fps if offered.
        let low = ARWorldTrackingConfiguration()
        low.planeDetection = []
        low.sceneReconstruction = []
        low.environmentTexturing = .none
        if let thirty { low.videoFormat = thirty }
        // ⚑ NO `.resetTracking` — the entire point is that the coordinate space survives the change.
        session.run(low)
        Thread.sleep(forTimeInterval: 8)
        let (anchorsLow, facesLow) = meshCount()
        result["thermalLowPower"] = Self.thermalName()
        let st = session.currentFrame?.camera.trackingState
        result["trackingInLowPower"] = st.map { Self.describe($0) } ?? "none"
        // ⚑ The question that matters: did the world survive the downgrade, or did we just reset it?
        result["meshAnchorsAfterDowngrade"] = anchorsLow
        result["meshFacesAfterDowngrade"] = facesLow
        result["lowPowerKeptWorld"] = anchorsLow >= meshAnchorsHeavy && meshAnchorsHeavy > 0
        step("modes: LOW POWER — tracking \(st.map { Self.describe($0) } ?? "none"), mesh \(anchorsLow)/\(facesLow) (was \(meshAnchorsHeavy)/\(meshFacesHeavy)), thermal \(Self.thermalName())")
        // ⚑ Found by accident and it matters: the still resolution follows the VIDEO FORMAT, so a
        // low-power format is not only a frame-rate choice. Recorded here so the next run states it
        // rather than rediscovering it.
        if let f = session.configuration?.videoFormat {
            result["lowPowerFormatWidth"] = Int(f.imageResolution.width)
            result["lowPowerFormatHeight"] = Int(f.imageResolution.height)
        }

        // Put the heavy config back so the later probes measure what they think they measure.
        if let original = session.configuration { session.run(original) }
        else if let c = session.configuration { session.run(c) }
        Thread.sleep(forTimeInterval: 2)
    }

    static func thermalName() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }

    // MARK: - Q5 · exposure control inside the session

    /**
     ⚑ **The collision nobody has named, and it would undo the fix that shipped this morning.**

     ARKit runs the camera for tracking, and tracking wants a bright, low-noise, well-exposed frame
     at 60 Hz — it does not care whether the concierge is walking. The traverse's whole smear
     problem was an exposure chosen for a person standing still, and it was fixed by metering the
     room and taking the fastest shutter it affords. **Under ARKit that fix does not exist**, unless
     the device is still settable while the session owns it.

     So three things are recorded, and the first is the one that decides it:
     - **what shutter ARKit runs at unprompted.** If it is already 1/60 or faster the problem never
       arises and the rest is moot.
     - whether `configurableCaptureDeviceForPrimaryCamera` actually hands the device back.
     - whether **tracking survives** a custom exposure being forced on it — the same class of
       collision as `isAutoFocusEnabled` against the traverse's focus lock, and equally undocumented.
    */
    private func probeExposureControl() {
        guard #available(iOS 16.0, *),
              let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
            step("exposure: no configurable device on this OS/config")
            result["exposureConfigurable"] = false
            return
        }
        result["exposureConfigurable"] = true
        let nativeDuration = CMTimeGetSeconds(device.exposureDuration)
        result["arNativeShutter"] = nativeDuration > 0 ? 1 / nativeDuration : 0
        result["arNativeISO"] = Double(device.iso)
        result["arFormatMaxISO"] = Double(device.activeFormat.maxISO)
        step(String(format: "exposure: ARKit runs at 1/%.0f s ISO %.0f (format maxISO %.0f)",
                    nativeDuration > 0 ? 1 / nativeDuration : 0, device.iso, device.activeFormat.maxISO))

        // Now force the traverse's own choice on it and see whether tracking minds.
        guard device.isExposureModeSupported(AVCaptureDevice.ExposureMode.custom) else {
            step("exposure: .custom NOT supported inside the session")
            result["exposureCustomSupported"] = false
            return
        }
        result["exposureCustomSupported"] = true
        do {
            try device.lockForConfiguration()
            let light = nativeDuration * Double(device.iso)
            let target = 1.0 / 60.0
            let iso = min(max(Float(light / target), device.activeFormat.minISO), device.activeFormat.maxISO)
            device.setExposureModeCustom(duration: CMTime(seconds: target, preferredTimescale: 1_000_000), iso: iso)
            device.unlockForConfiguration()
            step(String(format: "exposure: forced 1/60 @ ISO %.0f", iso))
        } catch {
            step("exposure: lockForConfiguration FAILED — \(error.localizedDescription)")
            result["exposureLockFailed"] = true
            return
        }
        Thread.sleep(forTimeInterval: 3)
        // ⚑ Read off the FRAME, not the device: the device reports what it was told, the frame
        // reports what the pipeline actually used, and only the second one is evidence.
        let held = session.currentFrame?.camera.exposureDuration ?? 0
        result["shutterAfterForcing"] = held > 0 ? 1 / held : 0
        let state = session.currentFrame?.camera.trackingState
        result["trackingAfterForcedExposure"] = state.map { Self.describe($0) } ?? "none"
        if case .normal = state { result["trackingSurvivedExposure"] = true }
        else { result["trackingSurvivedExposure"] = false }
        step("exposure: after forcing, tracking is \(state.map { Self.describe($0) } ?? "none"), frame shutter 1/\(Int(held > 0 ? 1 / held : 0))")
    }

    // MARK: - Q1 · stills from inside the session

    private func probeHiResPlain() {
        guard #available(iOS 16.0, *) else {
            step("hi-res plain: captureHighResolutionFrame needs iOS 16")
            return
        }
        let started = Date()
        let sem = DispatchSemaphore(value: 0)
        step("hi-res plain: requesting")
        session.captureHighResolutionFrame { [weak self] frame, error in
            guard let self else { sem.signal(); return }
            if let frame {
                let w = CVPixelBufferGetWidth(frame.capturedImage)
                let h = CVPixelBufferGetHeight(frame.capturedImage)
                self.result["hiResWidth"] = w
                self.result["hiResHeight"] = h
                self.result["hiResMs"] = Int(Date().timeIntervalSince(started) * 1000)
                self.step("hi-res plain: \(w)x\(h) in \(Int(Date().timeIntervalSince(started) * 1000)) ms")
            } else {
                self.result["hiResError"] = error?.localizedDescription ?? "unknown"
                self.step("hi-res plain: FAILED — \(error?.localizedDescription ?? "unknown")")
            }
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 10)
    }

    /**
     **The two statistics that separate a soft photograph from a sharp one**, computed on the Y
     plane so no CoreImage hop is needed and no colour interpretation can confound them.

     ⚑ *Both, never one.* Scoring 2026-09-07's field captures on the Mac showed why: the soft
     object photographs were **less** noisy than the sharp reference frame by a whole-frame measure,
     because half of each frame was bright smooth wall. **Texture alone would have said the soft
     ones were fine.** Detail and noise move together under multi-frame fusion — that is the whole
     claim being tested — so a single number cannot say which moved.
     */
    private func planeStats(_ buffer: CVPixelBuffer) -> [String: Any] {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let planes = CVPixelBufferGetPlaneCount(buffer)
        guard planes > 0, let base = CVPixelBufferGetBaseAddressOfPlane(buffer, 0) else { return [:] }
        let w = CVPixelBufferGetWidthOfPlane(buffer, 0)
        let h = CVPixelBufferGetHeightOfPlane(buffer, 0)
        let stride = CVPixelBufferGetBytesPerRowOfPlane(buffer, 0)
        let px = base.assumingMemoryBound(to: UInt8.self)
        func at(_ x: Int, _ y: Int) -> Double { Double(px[y * stride + x]) }

        var lapSum = 0.0, lapSq = 0.0, nSum = 0.0, lum = 0.0, n = 0.0
        var darkLum = 0.0, darkNoise = 0.0, darkN = 0.0
        var y = 1
        while y < h - 1 {
            var x = 1
            while x < w - 1 {
                let c = at(x, y)
                let lap = abs(4 * c - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1))
                lapSum += lap; lapSq += lap * lap
                /* ⛑ Immerkaer's kernel: it annihilates smooth AND linear structure, so what
                   survives is overwhelmingly sensor noise rather than scene detail. That is what
                   makes it separable from the Laplacian above, which answers to both. */
                let nz = abs(4 * c - 2 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1))
                             + at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1))
                nSum += nz
                lum += c; n += 1
                // ⚑ The shadows, apart. That is where the field softness actually lives — measured
                // shadow SNR 18.5 on the owner's captures against 41.5 on a well-lit frame.
                if c < 48 { darkLum += c; darkNoise += nz; darkN += 1 }
                x += 2
            }
            y += 2
        }
        guard n > 0 else { return [:] }
        let mean = lapSum / n
        let sigma = (nSum / n) * 1.2533 / 6.0
        var out: [String: Any] = [
            "w": w, "h": h,
            "texture": (lapSq / n - mean * mean).squareRoot(),
            "noise": sigma,
            "meanLuma": lum / n,
            "format": String(format: "%c%c%c%c",
                             (CVPixelBufferGetPixelFormatType(buffer) >> 24) & 0xff,
                             (CVPixelBufferGetPixelFormatType(buffer) >> 16) & 0xff,
                             (CVPixelBufferGetPixelFormatType(buffer) >> 8) & 0xff,
                             CVPixelBufferGetPixelFormatType(buffer) & 0xff),
            // §1d: are the colour attachments even there to be propagated?
            "hasYCbCrMatrix": CVBufferGetAttachment(buffer, kCVImageBufferYCbCrMatrixKey, nil) != nil,
            "hasPrimaries": CVBufferGetAttachment(buffer, kCVImageBufferColorPrimariesKey, nil) != nil,
        ]
        if darkN > 0 {
            out["darkMeanLuma"] = darkLum / darkN
            out["darkNoise"] = (darkNoise / darkN) * 1.2533 / 6.0
            out["shadowSNR"] = (darkLum / darkN) / max(1e-9, (darkNoise / darkN) * 1.2533 / 6.0)
            out["darkShare"] = darkN / n
        }
        return out
    }

    /**
     ⚑ **Does asking ARKit for a PHOTOGRAPH rather than a tracking frame change the pixels?**

     The owner reports in-zone captures are soft. The tempting answer was *"ARKit skips the photo
     pipeline; `photoQualityPrioritization = .quality` will fuse several exposures and fix it."*
     **Three things say do not ship that on an argument:**

     1. ⚠️ **It may throw rather than refuse.** `AVCapturePhotoOutput` raises
        `NSInvalidArgumentException` when the requested prioritisation exceeds the output's
        `maxPhotoQualityPrioritization`, whose default is `.balanced` — and **ARKit owns that output
        and never exposes it**, so we cannot raise the cap. An uncatchable exception is a crash in a
        mechanical room. *This probe is where it is allowed to happen, on a desk.*
     2. ⚠️ **It is documented to override a locked exposure** — *"to ensure ISO and exposureDuration
        are honored while in Custom or Locked, you must set photoQualityPrioritization to Speed."*
        The traverse's lock is its one measured win (median texture 6.2 → 18.1). **Buying sharpness
        with the exposure lock would be a bad trade made silently.**
     3. ⛑ **Our own A/B argues the other way.** `PLATE-AB-RESULT-2026-09-04`: the settings-less
        ARKit path beat an AVFoundation path that already had `.quality` set, reading the serial
        3-of-3 against 0-of-3.

     **So the probe reads the defaults first — which settles (1) without risking anything — and only
     then takes the two photographs, same scene, seconds apart, and measures both.**
     */
    private func probePhotoQuality() {
        guard #available(iOS 26.0, *) else {
            step("photoQuality: needs iOS 26 — unavailable here")
            result["photoQualityAvailable"] = false
            return
        }
        result["photoQualityAvailable"] = true

        /*
         ⚠️ **The session is re-run on the ZONE's own format first, and the first cut of this probe
         is why.**

         It read `session.configuration?.videoFormat` as it found it — after `probeStepOut` had
         paused, handed the camera away and resumed — and measured a **2016×1512** still on a format
         reporting `isRecommendedForHighResolutionFrameCapturing == false`. **That is not the path
         the product takes.** `HSZoneSession.stillFormat()` filters to recommended formats and
         prefers 4:3, and a refusal measured on a format the zone never uses would have been
         reported as a refusal of the feature.

         ⛑ *Same class as the covered-lens anchor in `TRAVERSE-SOURCE-RESULT`: the comparison is
         only worth something when both sides are shown the same thing.* Asking the session to be in
         a known state costs one `run` and removes the confound entirely.
         */
        let config = ARWorldTrackingConfiguration()
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
        }
        if let want = HSZoneSession.stillFormat() { config.videoFormat = want }
        session.run(config, options: [])
        _ = waitForNormal(timeout: 8)

        guard let fmt = session.configuration?.videoFormat else {
            step("photoQuality: no videoFormat after run")
            return
        }
        result["pqFormat"] = "\(Int(fmt.imageResolution.width))x\(Int(fmt.imageResolution.height))"
        result["pqFormatRecommended"] = fmt.isRecommendedForHighResolutionFrameCapturing
        result["pqFormatColorSpace"] = fmt.defaultColorSpace.rawValue

        /* ⚑ **The reading that settles whether the change is even safe**, taken before anything is
           attempted. `AVCapturePhotoOutput` is documented to RAISE when the requested prioritisation
           exceeds the output's cap, and ARKit owns that output and never exposes it — so the cap
           cannot be read directly and the default is the only evidence available without risking
           the app. */
        let base = fmt.defaultPhotoSettings
        result["pqDefaultPrioritization"] = base.photoQualityPrioritization.rawValue
        result["pqDefaultMaxDims"] =
            "\(base.maxPhotoDimensions.width)x\(base.maxPhotoDimensions.height)"
        step("photoQuality: format \(Int(fmt.imageResolution.width))x\(Int(fmt.imageResolution.height)) "
             + "recommended=\(fmt.isRecommendedForHighResolutionFrameCapturing) "
             + "default=\(base.photoQualityPrioritization.rawValue) "
             + "maxDims \(base.maxPhotoDimensions.width)x\(base.maxPhotoDimensions.height)")

        /* ⚑ **All three rungs, not just the one being hoped for.** A refusal of `.quality` alone
           cannot tell *"ARKit will not process a still"* from *"ARKit will not go that far"* — and
           those have different consequences: the first closes the question, the second leaves a
           middle setting on the table. **`.speed` is included as the control**, because it is
           ARKit's own default and must succeed; if it does not, the instrument is broken rather
           than the feature refused. */
        let rungs: [(String, AVCapturePhotoOutput.QualityPrioritization)] =
            [("speed", .speed), ("balanced", .balanced), ("quality", .quality)]
        for (label, prioritisation) in rungs {
            /* ⛑ **A fresh settings object every time, never a reused one.** `AVCapturePhotoOutput`
               raises if a `uniqueID` is seen twice — *"it is illegal to re-use settings"* — the kind
               of rule that survives a probe taking three photographs and crashes a walk taking two
               hundred. `defaultPhotoSettings` is documented to hand back a new instance per get. */
            guard let settings = session.configuration?.videoFormat.defaultPhotoSettings else { continue }
            settings.photoQualityPrioritization = prioritisation
            step("photoQuality[\(label)]: requesting \(prioritisation.rawValue) — if the log stops here, it raised")
            let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera
            let sem = DispatchSemaphore(value: 0)
            let started = Date()
            session.captureHighResolutionFrame(using: settings) { [weak self] frame, error in
                guard let self else { sem.signal(); return }
                var row: [String: Any] = [
                    "ms": Date().timeIntervalSince(started) * 1000,
                    "asked": prioritisation.rawValue,
                ]
                if let f = frame {
                    row.merge(self.planeStats(f.capturedImage)) { a, _ in a }
                    // ⚑ The real ISO off the device, not `exposureOffset` — the first cut logged an
                    // EV bias under the name `iso`, which is a wrong number wearing a right label.
                    row["iso"] = device?.iso ?? -1
                    row["shutter"] = CMTimeGetSeconds(device?.exposureDuration ?? .zero)
                } else {
                    row["error"] = error?.localizedDescription ?? "no frame"
                    row["errorCode"] = (error as NSError?)?.code ?? -1
                }
                self.result["pq_\(label)"] = row
                self.step("photoQuality[\(label)]: \(row)")
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 12)
            // Let the meter settle so the next rung is not measuring the last one's recovery.
            Thread.sleep(forTimeInterval: 1.5)
        }
    }

    /**
     ⚑ **What a photographic exposure buys the photograph, and what it costs the tracking.**

     `PHOTO-SETTINGS-RESULT-2026-09-07` closed the pipeline route: `.quality` is refused and
     `.balanced` moves nothing. **What that run did establish is that exposure is the variable** —
     ISO 722 at 1/60 with 43% of the frame in shadow, shadow SNR 15.4 against 41.5 on a lit frame.

     ⛑ **ARKit meters for a 60 Hz tracking stream**, so it buys short exposures with gain: a dropped
     frame costs it tracking, and noise does not. **A photograph is not a tracking frame, and the
     concierge is standing still when taking one.** The traverse already exploits that asymmetry and
     banked a measured median texture 6.2 → 18.1. The object capture exploits nothing.

     ⚠️ **Both halves, in one run, and the second half is the one that gets forgotten.**
     `EXPOSURE-LOCK-RESULT`'s first cut proved the lock *takes* and never asked what it cost ARKit's
     tracking — and ARKit extracts its features from the very stream the lock is changing. *A long
     exposure in a dim room could starve VIO during the one act where the camera is moving.* So each
     rung records `rawFeaturePoints` and the tracking state beside the image statistics, and a rung
     that wins on shadow SNR while halving the feature count has not won.

     **The ladder trades gain for time at constant exposure**, so a rung that improves the picture
     improves it by collecting more light rather than by being brighter — which is the only way
     shadow noise actually falls.
     */
    private func probeExposureLadder() {
        guard #available(iOS 16.0, *) else {
            step("ladder: in-session capture and device access need iOS 16")
            result["ladderAvailable"] = false
            return
        }
        guard let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
            step("ladder: ARKit handed back no configurable device")
            result["ladderAvailable"] = false
            return
        }
        result["ladderAvailable"] = true
        let fmt = device.activeFormat
        let minISO = fmt.minISO, maxISO = fmt.maxISO
        let minDur = CMTimeGetSeconds(fmt.minExposureDuration)
        let maxDur = CMTimeGetSeconds(fmt.maxExposureDuration)
        result["ladderISORange"] = "\(minISO)…\(maxISO)"
        result["ladderDurationRange"] = "\(minDur)…\(maxDur)"
        step("ladder: iso \(minISO)…\(maxISO), duration \(minDur)…\(maxDur)")

        /* ⛑ **`auto` first and last would be better still, but the scene must not move**, and this
           already asks the owner to hold one aim for a minute. The control runs first; a rung that
           beats it is compared against a reading taken seconds earlier on the same frame. */
        let rungs: [(String, Double?, Float?)] = [
            ("auto", nil, nil),
            ("t60_iso400", 1.0 / 60, 400),   // the traverse's own setting, proven to cost tracking nothing
            ("t30_iso200", 1.0 / 30, 200),
            ("t15_iso100", 1.0 / 15, 100),
            ("t8_iso50",   1.0 / 8,  50),
        ]
        for (label, dur, iso) in rungs {
            var applied: [String: Any] = [:]
            do {
                try device.lockForConfiguration()
                if let dur, let iso {
                    let d = CMTime(seconds: min(max(dur, minDur), maxDur), preferredTimescale: 1_000_000)
                    let i = min(max(iso, minISO), maxISO)
                    device.setExposureModeCustom(duration: d, iso: i, completionHandler: nil)
                    applied["askedShutter"] = CMTimeGetSeconds(d)
                    applied["askedISO"] = i
                } else if device.isExposureModeSupported(.continuousAutoExposure) {
                    device.exposureMode = .continuousAutoExposure
                }
                device.unlockForConfiguration()
            } catch {
                applied["lockFailed"] = true
            }
            // Let the sensor actually reach what it was told, rather than measuring the transition.
            Thread.sleep(forTimeInterval: 1.2)

            /* ⚑ The cost half. Sampled as a median of several rather than one reading, because one
               frame pointed at a blank patch must not decide the answer — `EXPOSURE-LOCK-RESULT`'s
               correction, applied here from the start rather than after a re-run. */
            var features: [Int] = []
            var states: Set<String> = []
            for _ in 0..<5 {
                if let f = session.currentFrame {
                    features.append(f.rawFeaturePoints?.points.count ?? 0)
                    states.insert(Self.describe(f.camera.trackingState))
                }
                Thread.sleep(forTimeInterval: 0.2)
            }
            let sorted = features.sorted()
            applied["featuresMedian"] = sorted.isEmpty ? -1 : sorted[sorted.count / 2]
            applied["tracking"] = states.sorted().joined(separator: "|")
            applied["reachedISO"] = device.iso
            applied["reachedShutter"] = CMTimeGetSeconds(device.exposureDuration)

            let sem = DispatchSemaphore(value: 0)
            session.captureHighResolutionFrame { [weak self] frame, error in
                guard let self else { sem.signal(); return }
                if let f = frame {
                    applied.merge(self.planeStats(f.capturedImage)) { a, _ in a }
                } else {
                    applied["error"] = error?.localizedDescription ?? "no frame"
                }
                self.result["ladder_\(label)"] = applied
                self.step("ladder[\(label)]: \(applied)")
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 12)
        }

        /* ⚠️ **Handed back, always.** A custom exposure left on ARKit's device would outlive this
           probe as a setting nobody chose — the one-ended-operation class applied to a device, and
           `restoreContinuousModes` exists in the plugin for exactly this reason. */
        if let _ = try? device.lockForConfiguration() {
            if device.isExposureModeSupported(.continuousAutoExposure) {
                device.exposureMode = .continuousAutoExposure
            }
            device.unlockForConfiguration()
        }
    }


    /**
     ⚑ **The torch, in the one condition it exists for — and nothing has ever measured it here.**

     Every route to a better photograph tried so far has been about *processing the light that
     arrived*: fusion (refused), a longer exposure (worth ~27% shadow SNR, `ladder`), a better
     encode (cannot move sharpness). **This is the only lever that changes how much light arrives**,
     and in an unlit corner that is not a percentage difference.

     ⛑ **The device is reachable mid-session and this is measured, not argued** — `HSPlateAB` lights
     a plate through `configurableCaptureDeviceForPrimaryCamera` while ARKit drives it, and
     `HSZoneSession` reads `isTorchActive` off the same handle for every filed still.

     ⚠️ **Off, on, off — and the second `off` is the point.** A single before/after pair cannot
     separate *the torch helped* from *the meter drifted over eight seconds*, and this probe has
     already been burned once by comparing two windows that were not the same scene. The closing
     control returns to the opening condition; if it does not match the opener, the run is telling
     us the scene moved and the middle reading means nothing.
     */
    private func probeTorchGain() {
        guard #available(iOS 16.0, *) else { result["torchAvailable"] = false; return }
        guard let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
            step("torch: no configurable device"); result["torchAvailable"] = false; return
        }
        guard device.hasTorch else {
            step("torch: device reports no torch"); result["torchAvailable"] = false; return
        }
        result["torchAvailable"] = true

        func shoot(_ label: String, lit: Bool) {
            do {
                try device.lockForConfiguration()
                if lit { try? device.setTorchModeOn(level: 1.0) } else { device.torchMode = .off }
                device.unlockForConfiguration()
            } catch { step("torch[\(label)]: lockForConfiguration threw") }
            // The lamp takes ~6 ms (measured 2026-08-28) but the METER takes far longer to answer it.
            Thread.sleep(forTimeInterval: 1.5)
            var row: [String: Any] = ["lit": lit, "torchActive": device.isTorchActive,
                                      "iso": device.iso,
                                      "shutter": CMTimeGetSeconds(device.exposureDuration)]
            var features: [Int] = []
            for _ in 0..<5 {
                if let f = session.currentFrame { features.append(f.rawFeaturePoints?.points.count ?? 0) }
                Thread.sleep(forTimeInterval: 0.15)
            }
            let sorted = features.sorted()
            row["featuresMedian"] = sorted.isEmpty ? -1 : sorted[sorted.count / 2]
            let sem = DispatchSemaphore(value: 0)
            session.captureHighResolutionFrame { [weak self] frame, error in
                guard let self else { sem.signal(); return }
                if let f = frame { row.merge(self.planeStats(f.capturedImage)) { a, _ in a } }
                else { row["error"] = error?.localizedDescription ?? "no frame" }
                self.result["torch_\(label)"] = row
                self.step("torch[\(label)]: \(row)")
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 12)
        }

        shoot("offBefore", lit: false)
        shoot("on", lit: true)
        shoot("offAfter", lit: false)

        // ⛑ Handed back. A lamp left burning is a setting nobody chose, and it is the owner's
        // battery — the same one-ended-operation class the exposure ladder closes above.
        if let _ = try? device.lockForConfiguration() {
            device.torchMode = .off
            device.unlockForConfiguration()
        }
    }

    private func probeBracket() {
        /* ⚑ **`defaultPhotoSettings` and `captureHighResolutionFrame(using:)` are iOS 26.0+**, which
           is itself part of the answer: the bracket-capable variant of in-session capture is brand
           new. This iPad runs iPadOS 26.5 so it is available here, but any plan that depends on it
           is depending on a one-release-old API. */
        guard #available(iOS 26.0, *) else {
            step("bracket: captureHighResolutionFrame(using:) needs iOS 26 — unavailable here")
            result["bracketAttempted"] = false
            result["bracketNeedsIOS26"] = true
            return
        }
        guard let base = session.configuration?.videoFormat.defaultPhotoSettings else {
            step("bracket: no defaultPhotoSettings on the video format")
            result["bracketAttempted"] = false
            return
        }
        result["bracketAttempted"] = true
        // Same shape as the plate path: three exposures around nominal.
        let biases: [Float] = [-1, 0, 1]
        let bracketed = biases.map {
            AVCaptureAutoExposureBracketedStillImageSettings.autoExposureSettings(exposureTargetBias: $0)
        }
        step("bracket: defaultPhotoSettings.format = \(base.format ?? [:])")

        /* ⚑ **Two attempts, because one attempt cannot tell a refused BRACKET from a refused
           FORMAT** — and reporting "bracketing is impossible" on the strength of a format I chose
           badly would be exactly the confident-answer-without-evidence failure this project keeps
           paying for. Attempt A uses whatever the format hands back; attempt B forces JPEG, which
           is what the plate path actually asks for. If both fail the same way, it is the bracket. */
        let attempts: [(String, [String: Any])] = [
            ("asFormat", base.format as? [String: Any] ?? [:]),
            ("jpeg", [AVVideoCodecKey: AVVideoCodecType.jpeg])
        ]
        for (label, fmt) in attempts {
            Thread.sleep(forTimeInterval: 1)   // no capture in flight; rules out the busy error
            let settings = AVCapturePhotoBracketSettings(
                rawPixelFormatType: 0, processedFormat: fmt, bracketedSettings: bracketed)
            // ⚑ If the pipeline refuses by RAISING rather than returning, it dies on the next line
            // and everything above is already logged. That is why this is last.
            step("bracket[\(label)]: calling captureHighResolutionFrame(using:) — if the log stops here, it throws")
            let started = Date()
            let sem = DispatchSemaphore(value: 0)
            var delivered = 0
            session.captureHighResolutionFrame(using: settings) { [weak self] frame, error in
                guard let self else { sem.signal(); return }
                if frame != nil { delivered += 1 }
                self.result["bracket_\(label)_ok"] = frame != nil
                self.result["bracket_\(label)_ms"] = Int(Date().timeIntervalSince(started) * 1000)
                if let error { self.result["bracket_\(label)_error"] = error.localizedDescription }
                self.step("bracket[\(label)]: returned \(frame != nil ? "a frame" : "nil") \(error.map { "— \($0.localizedDescription)" } ?? "")")
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 12)
            // ⚑ The number that decides it: a bracket that is HONOURED delivers three. A bracket
            // silently collapsed to a single exposure delivers one and looks like success.
            result["bracket_\(label)_frames"] = delivered
            step("bracket[\(label)]: \(delivered) frame(s) — three means honoured, one means collapsed")
        }

        /* ⚑ **The control that the first run got wrong, and the correction matters.** Run 2 showed
           the bracket failing AND a hand-rolled plain `AVCapturePhotoSettings` failing — which
           proves nothing about brackets, only that something about custom settings was refused.
           Apple's instruction is specific: *obtain a `defaultPhotoSettings` object from the video
           format and modify it.* So the control is `defaultPhotoSettings` passed straight back,
           unmodified. If that succeeds and the bracket fails, the bracket is what was refused; if
           both fail, the `using:` variant itself is unusable here and the bracket is untested. */
        guard let control = session.configuration?.videoFormat.defaultPhotoSettings else { return }
        Thread.sleep(forTimeInterval: 1)
        let sem2 = DispatchSemaphore(value: 0)
        step("control: defaultPhotoSettings passed back UNMODIFIED")
        session.captureHighResolutionFrame(using: control) { [weak self] frame, error in
            self?.result["defaultSettingsOk"] = frame != nil
            if let error { self?.result["defaultSettingsError"] = error.localizedDescription }
            self?.step("control: \(frame != nil ? "SUCCEEDED" : "failed") \(error.map { "— \($0.localizedDescription)" } ?? "")")
            sem2.signal()
        }
        _ = sem2.wait(timeout: .now() + 12)

        // And the same call with NO settings, again, so the two variants are compared back to back
        // rather than across a minute of other work.
        Thread.sleep(forTimeInterval: 1)
        let sem3 = DispatchSemaphore(value: 0)
        step("control: captureHighResolutionFrame with NO settings, back to back")
        session.captureHighResolutionFrame { [weak self] frame, error in
            self?.result["noSettingsOkLate"] = frame != nil
            self?.step("control: no-settings \(frame != nil ? "SUCCEEDED" : "failed") \(error.map { "— \($0.localizedDescription)" } ?? "")")
            sem3.signal()
        }
        _ = sem3.wait(timeout: .now() + 12)
    }

    // MARK: - Q1d · the torch, measured before anything else touches the device

    private func probeTorch() {
        guard #available(iOS 16.0, *),
              let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
            step("torch: no configurable device")
            return
        }
        result["torchHardware"] = device.hasTorch
        result["torchAvailableNow"] = device.isTorchAvailable
        step("torch: hasTorch=\(device.hasTorch) isTorchAvailable=\(device.isTorchAvailable)")
        guard device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            // Both routes, because they are not the same call and one may be honoured where the
            // other is not.
            try? device.setTorchModeOn(level: 1.0)
            device.torchMode = .on
            device.unlockForConfiguration()
        } catch {
            step("torch: lock refused — \(error.localizedDescription)")
            result["torchLockRefused"] = true
            return
        }
        Thread.sleep(forTimeInterval: 1.0)
        result["torchLitEarly"] = device.isTorchActive
        result["torchLevel"] = Double(device.torchLevel)
        let track = session.currentFrame?.camera.trackingState
        result["trackingWithTorch"] = track.map { Self.describe($0) } ?? "none"
        step("torch: isTorchActive=\(device.isTorchActive) level=\(device.torchLevel) tracking=\(track.map { Self.describe($0) } ?? "none")")
        if (try? device.lockForConfiguration()) != nil {
            device.torchMode = .off
            device.unlockForConfiguration()
        }
    }

    // MARK: - Q1c · a bracket built by hand, and the torch

    /**
     ⚑ **The workaround for the one thing the AR session genuinely refuses.**

     `AVCapturePhotoBracketSettings` is rejected inside a session — measured, with controls. But two
     other things are true and they compose: custom photo settings ARE accepted, and
     `configurableCaptureDeviceForPrimaryCamera` hands back a settable `AVCaptureDevice`. So a
     bracket can be assembled the long way: set the exposure, take a frame, set it again, take
     another. Three calls instead of one.

     What that costs is **time and hand-hold**: Apple's bracket is one shutter action, and this is
     three, so the frames are tens of milliseconds apart rather than simultaneous. For a nameplate
     on a stationary tank that is fine. For anything moving it is not, and nothing in a mechanical
     room moves.

     The torch is tested in the same pass because the plate path's whole doctrine — the unlit
     companion frame — depends on being able to turn it on and off between frames.
    */
    private func probeHandRolledBracket() {
        guard #available(iOS 16.0, *),
              let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
            step("hand-bracket: no configurable device")
            return
        }
        // The torch first: it is one line and the companion-frame doctrine turns on it.
        result["torchAvailableInSession"] = device.hasTorch
        if device.hasTorch, (try? device.lockForConfiguration()) != nil {
            device.torchMode = .on
            device.unlockForConfiguration()
            Thread.sleep(forTimeInterval: 0.6)
            result["torchLitInSession"] = device.isTorchActive
            step("torch: asked for on, isTorchActive=\(device.isTorchActive)")
            if (try? device.lockForConfiguration()) != nil {
                device.torchMode = .off
                device.unlockForConfiguration()
            }
        } else {
            step("torch: unavailable or lock refused")
        }

        let base = CMTimeGetSeconds(device.exposureDuration)
        let baseISO = device.iso
        guard base > 0, device.isExposureModeSupported(AVCaptureDevice.ExposureMode.custom) else {
            step("hand-bracket: custom exposure unavailable")
            return
        }
        var sizes: [String] = []
        var isos: [Double] = []
        // -1, 0, +1 stops, applied to ISO so the shutter — and therefore the motion blur — is
        // identical across the three. That is what a bracket is FOR on a plate.
        for stops in [-1.0, 0.0, 1.0] {
            let want = Float(Double(baseISO) * pow(2.0, stops))
            let iso = min(max(want, device.activeFormat.minISO), device.activeFormat.maxISO)
            if (try? device.lockForConfiguration()) != nil {
                device.setExposureModeCustom(duration: device.exposureDuration, iso: iso)
                device.unlockForConfiguration()
            }
            Thread.sleep(forTimeInterval: 0.4)
            isos.append(Double(device.iso))
            let sem = DispatchSemaphore(value: 0)
            session.captureHighResolutionFrame { frame, _ in
                if let frame {
                    sizes.append("\(CVPixelBufferGetWidth(frame.capturedImage))x\(CVPixelBufferGetHeight(frame.capturedImage))")
                }
                sem.signal()
            }
            _ = sem.wait(timeout: .now() + 10)
        }
        result["handBracketFrames"] = sizes.count
        result["handBracketISOs"] = isos
        // ⚑ Three DISTINCT ISOs is the evidence. Three frames at one ISO would be three copies of
        // the same exposure and would look like a bracket while being nothing of the kind.
        result["handBracketDistinctISOs"] = Set(isos.map { Int($0) }).count
        step("hand-bracket: \(sizes.count) frames at ISOs \(isos.map { Int($0) }) — \(Set(isos.map { Int($0) }).count) distinct")
        if (try? device.lockForConfiguration()) != nil {
            device.exposureMode = .continuousAutoExposure
            device.unlockForConfiguration()
        }
    }

    // MARK: - Q2 · stepping out to the wide lens and back

    /**
     The round trip the architecture pays for every establishing shot that cannot be framed at 1×:
     pause the session, take the camera with AVFoundation, give it back, resume.

     ⚑ Two things are being measured and they are not the same. **Time** is the concierge's cost.
     **Whether the mesh and the world origin survive** is the architecture's cost — if they do not,
     an establishing shot silently resets the room's coordinate space and every position taken
     afterwards is in a different frame from every position taken before.
     */
    private func probeStepOut() {
        let (anchorsBefore, facesBefore) = meshCount()
        let originBefore = session.currentFrame?.camera.transform.columns.3
        let started = Date()
        step("step-out: pausing session")
        session.pause()
        result["stepOutPauseMs"] = Int(Date().timeIntervalSince(started) * 1000)

        /* ⚑ Timed in four parts, because the total is useless for deciding anything. Only ONE of
           these is unavoidable per shot: an implementation builds the session and the input once and
           keeps them. If the expensive part turns out to be construction, a per-shot step-out is
           cheap and the architecture changes shape. */
        let t1 = Date()
        let av = AVCaptureSession()
        av.sessionPreset = .photo
        let device = AVCaptureDevice.default(.builtInUltraWideCamera, for: .video, position: .back)
        result["stepOutDiscoverMs"] = Int(Date().timeIntervalSince(t1) * 1000)
        let t2 = Date()
        if let device, let input = try? AVCaptureDeviceInput(device: device), av.canAddInput(input) {
            av.addInput(input)
            result["stepOutLens"] = "builtInUltraWideCamera"
        } else {
            result["stepOutLens"] = "unavailable"
            step("step-out: NO ultra-wide input")
        }
        result["stepOutInputMs"] = Int(Date().timeIntervalSince(t2) * 1000)
        step("step-out: pause \(result["stepOutPauseMs"] ?? 0) ms, discover \(result["stepOutDiscoverMs"] ?? 0) ms, input \(result["stepOutInputMs"] ?? 0) ms")
        // ⚑ Two clocks, because they are two different costs. Building the session is work an
        // implementation could do once; ACQUIRING THE CAMERA from ARKit cannot be pre-paid, and it
        // is the number that decides whether a per-shot step-out is affordable.
        let acquireFrom = Date()
        av.startRunning()
        result["stepOutAcquireMs"] = Int(Date().timeIntervalSince(acquireFrom) * 1000)
        step("step-out: AV running at \(result["stepOutLens"] ?? "?") — startRunning \(result["stepOutAcquireMs"] ?? 0) ms")
        Thread.sleep(forTimeInterval: 1.5)   // the shot itself
        av.stopRunning()
        step("step-out: AV session stopped")

        // Resume WITHOUT resetTracking or removeExistingAnchors — the whole question is whether
        // that is enough to keep one coordinate space.
        guard let config = session.configuration else { return }
        let resumeFrom = Date()
        session.run(config)
        let backNormal = waitForNormal(timeout: 20)
        result["stepOutResumeMs"] = Int(Date().timeIntervalSince(resumeFrom) * 1000)
        let total = Int(Date().timeIntervalSince(started) * 1000)
        result["stepOutTotalMs"] = total
        result["stepOutRecovered"] = backNormal
        let (anchorsAfter, facesAfter) = meshCount()
        result["meshAnchorsAfter"] = anchorsAfter
        result["meshFacesAfter"] = facesAfter
        result["meshSurvived"] = anchorsAfter >= anchorsBefore && anchorsBefore > 0
        if let a = originBefore, let b = session.currentFrame?.camera.transform.columns.3 {
            // Not a proof of a shared origin, but a jump of metres would disprove one.
            result["poseJumpMetres"] = Double(simd_distance(SIMD3<Float>(a.x, a.y, a.z),
                                                           SIMD3<Float>(b.x, b.y, b.z)))
        }
        step("step-out: \(total) ms total, recovered=\(backNormal), mesh \(anchorsBefore)/\(facesBefore) -> \(anchorsAfter)/\(facesAfter)")

        // ---- the same round trip again, with the PRE-BUILT session ----
        guard let pre = prebuiltAv else {
            step("step-out(prebuilt): no prebuilt session")
            return
        }
        let (aBefore, fBefore) = meshCount()
        let t = Date()
        session.pause()
        let acq = Date()
        pre.startRunning()
        result["reuseAcquireMs"] = Int(Date().timeIntervalSince(acq) * 1000)
        Thread.sleep(forTimeInterval: 1.5)
        pre.stopRunning()
        let res = Date()
        session.run(config)
        let ok = waitForNormal(timeout: 20)
        result["reuseResumeMs"] = Int(Date().timeIntervalSince(res) * 1000)
        let reuseTotal = Int(Date().timeIntervalSince(t) * 1000)
        result["reuseTotalMs"] = reuseTotal
        result["reuseRecovered"] = ok
        let (aAfter, fAfter) = meshCount()
        result["reuseMeshSurvived"] = aAfter >= aBefore && aBefore > 0
        // ⚑ The number the architecture turns on: total MINUS the 1.5 s the shot itself takes.
        result["reuseOverheadMs"] = reuseTotal - 1500
        step("step-out(prebuilt): total \(reuseTotal) ms — acquire \(result["reuseAcquireMs"] ?? 0), resume \(result["reuseResumeMs"] ?? 0), overhead \(reuseTotal - 1500) ms, recovered=\(ok), mesh \(aBefore)/\(fBefore) -> \(aAfter)/\(fAfter)")
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didFailWithError error: Error) {
        step("session FAILED: \(error.localizedDescription)")
        result["sessionError"] = error.localizedDescription
    }

    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        step("tracking -> \(Self.describe(camera.trackingState))")
        // ⚑ Recorded because it is the one thing that distinguishes "the map held" from "the map
        // was rebuilt and everything before it is in a different coordinate space".
        if case .limited(.relocalizing) = camera.trackingState { result["sawRelocalizing"] = true }
    }

    static func describe(_ state: ARCamera.TrackingState) -> String {
        switch state {
        case .notAvailable: return "notAvailable"
        case .normal: return "normal"
        case .limited(let reason):
            switch reason {
            case .initializing: return "limited(initializing)"
            case .relocalizing: return "limited(relocalizing)"
            case .excessiveMotion: return "limited(excessiveMotion)"
            case .insufficientFeatures: return "limited(insufficientFeatures)"
            @unknown default: return "limited(unknown)"
            }
        @unknown default: return "unknown"
        }
    }
}
