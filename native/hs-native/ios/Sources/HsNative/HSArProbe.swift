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
        if let first = hits.first {
            let p = first.worldTransform.columns.3
            let d = simd_distance(origin, SIMD3<Float>(p.x, p.y, p.z))
            result["raycastDistance"] = Double(d)
            result["raycastTarget"] = "\(first.target)"
            step(String(format: "raycast: hit at %.2f m, target %@", d, "\(first.target)"))
        } else {
            result["raycastDistance"] = -1
            step("raycast: NO HIT")
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
