import ARKit
import AVFoundation
import Foundation
import UIKit

/**
 The device bench: hold one configuration, sample over time, hand back a JSON.

 ⚑ **A general bench whose first client is the thermal question, not a thermal test.** The same shape
 answers tracking quality against walking speed, relocalisation cost, loop-closure drift, and
 whatever the next unknown turns out to be — and a harness built for one question has to be rebuilt
 for the second.

 **The constraint that shaped every decision below: the measure has to be able to come back
 negative.** Thermal state is a four-value enum and battery moves in whole percents, so a run of
 fixed length reports `nominal, −3%` for every mode and concludes that all of them are survivable.
 That is a verdict formed with nothing present that could refute it — the ninth instance of the
 family that has cost this project eight measures, arriving inside the test built to check the
 architecture. So:

 - **The primary measure is time-to-first-thermal-transition**, and a run ends when the state moves
   or a cap is reached, **whichever happened being recorded**. `nominal` for forty minutes is a
   result with resolution; `nominal` at twenty is a coin that was never flipped.
 - **Every sample carries proof the session was doing work.** ⚑ *A dead session is thermally
   superb* — a run that silently failed at minute three would otherwise read as the best result of
   the day. `frames` is the counter that would visibly stall, and it is on every sample.
 - **Battery is a slope reported with its sample count**, never a headline.
 - **Sampling continues after the run stops**, because the question is not *does twenty minutes cook
   it* but *can a concierge do a whole house* — and recovery between zones is half that answer.
 */
final class HSBench: NSObject, ARSessionDelegate, AVCaptureVideoDataOutputSampleBufferDelegate {

    /// What the bench is holding. ⚑ `roomPlan` is deliberately absent: RoomPlan is not built, and a
    /// mode that silently ran something else would be worse than a mode that is missing.
    enum Mode: String {
        case control      // today's camera path — the run that makes the others readable
        case mesh         // world tracking + scene reconstruction
        case lowPower     // world tracking, no mesh, no planes, 30 fps if offered
    }

    private var mode: Mode = .control
    private let arSession = ARSession()
    private var avSession: AVCaptureSession?
    private var timer: DispatchSourceTimer?
    private let queue = DispatchQueue(label: "ca.housesteady.bench")

    private var startedAt = Date()
    private var samples: [[String: Any]] = []
    private var frames = 0
    private var startThermal = ""
    private var capSeconds: Double = 2400
    private var coolSeconds: Double = 600
    private var sampleSeconds: Double = 30
    private var endedBecause = "running"
    private var transitionAt: Double = -1
    private var coolingFrom: Double = -1
    private var startPosition: SIMD3<Float>?
    private var loopClosure: [String: Any]?
    private var conditions: [String: Any] = [:]
    private var onSample: (([String: Any]) -> Void)?

    // MARK: - lifecycle

    func start(mode: Mode, capSeconds: Double, sampleSeconds: Double, coolSeconds: Double,
               conditions: [String: Any], onSample: @escaping ([String: Any]) -> Void) -> [String: Any] {
        self.mode = mode
        self.capSeconds = capSeconds
        self.sampleSeconds = sampleSeconds
        self.coolSeconds = coolSeconds
        self.conditions = conditions
        self.onSample = onSample
        samples = []
        frames = 0
        endedBecause = "running"
        transitionAt = -1
        coolingFrom = -1
        startPosition = nil
        loopClosure = nil

        UIDevice.current.isBatteryMonitoringEnabled = true
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = true }
        startThermal = Self.thermalName()
        startedAt = Date()

        switch mode {
        case .control: startControl()
        case .mesh, .lowPower: startAR(mesh: mode == .mesh)
        }
        scheduleSampling()
        sample()   // t = 0

        return [
            "mode": mode.rawValue,
            "startedAt": ISO8601DateFormatter().string(from: startedAt),
            /* ⚑ Recorded because thermal results are famously sensitive to all of them and the runs
               are compared across days — run A arrives when RoomPlan does. A set of runs whose
               conditions were not written down is a set of runs that cannot be compared. */
            "conditions": self.conditions,
            "startThermal": startThermal,
            "startBattery": Double(UIDevice.current.batteryLevel),
            "startBatteryState": Self.batteryStateName(),
            "screenBrightness": Double(UIScreen.main.brightness),
            "capSeconds": capSeconds,
            "coolSeconds": coolSeconds,
            "sampleSeconds": sampleSeconds
        ]
    }

    func stop() -> [String: Any] {
        timer?.cancel(); timer = nil
        arSession.pause()
        avSession?.stopRunning(); avSession = nil
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
        if endedBecause == "running" { endedBecause = "stopped" }
        return payload()
    }

    private func payload() -> [String: Any] {
        var out: [String: Any] = [
            "mode": mode.rawValue,
            "startedAt": ISO8601DateFormatter().string(from: startedAt),
            "endedAt": ISO8601DateFormatter().string(from: Date()),
            "conditions": conditions,
            "startThermal": startThermal,
            "screenBrightness": Double(UIScreen.main.brightness),
            "capSeconds": capSeconds,
            "coolSeconds": coolSeconds,
            "sampleSeconds": sampleSeconds,
            "samples": samples,
            // ⚑ WHICH of the two ended it. Without this, "held nominal" and "ran out of time" are
            // the same reading, and only one of them is a measurement.
            "endedBecause": endedBecause,
            "secondsToFirstTransition": transitionAt
        ]
        if let loopClosure { out["loopClosure"] = loopClosure }
        return out
    }

    // MARK: - the modes

    private func startAR(mesh: Bool) {
        arSession.delegate = self
        let config = ARWorldTrackingConfiguration()
        if mesh {
            if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
                config.sceneReconstruction = .mesh
            }
            /* ⚑ The video format is chosen for the STILL, not the tracking. `videoFormat` is the
               sensor's whole operating configuration and a still is pulled from that same stream, so
               frame rate and photograph size are one setting rather than two — which is the whole of
               *drop to 30 fps and quarter the photographs* (4032×3024 against 2016×1512, measured). */
            if #available(iOS 16.0, *),
               let hi = ARWorldTrackingConfiguration.recommendedVideoFormatForHighResolutionFrameCapturing {
                config.videoFormat = hi
            }
        } else {
            config.planeDetection = []
            config.sceneReconstruction = []
            config.environmentTexturing = .none
            if let thirty = ARWorldTrackingConfiguration.supportedVideoFormats
                .first(where: { $0.framesPerSecond == 30 }) {
                config.videoFormat = thirty
            }
        }
        arSession.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    /**
     ⚑ The control, and its approximation is stated rather than hidden.

     This is **not** `CameraController` — that needs a web view and a preview layer, and entangling
     the bench with it would make the bench harder to trust than the thing it measures. It is the
     same shape: the wide-angle camera at the photo preset with a video output consuming every frame,
     so the sensor, the ISP and a per-frame callback are all live.

     **The approximation is what the reference number validates.** The baseline is 98 minutes, 100%
     to 85%, `nominal` throughout — 9.2%/hour, torch off, attested by the owner who walked it. If
     this run lands near that, the approximation held and the other runs can be believed. If it does
     not, the harness is what is wrong, and that is worth knowing before three hours are spent.
     */
    private func startControl() {
        let session = AVCaptureSession()
        session.sessionPreset = .photo
        if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
           let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
            session.addInput(input)
        }
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        if session.canAddOutput(output) { session.addOutput(output) }
        avSession = session
        queue.async { session.startRunning() }
    }

    // MARK: - sampling

    private func scheduleSampling() {
        let t = DispatchSource.makeTimerSource(queue: queue)
        t.schedule(deadline: .now() + sampleSeconds, repeating: sampleSeconds)
        t.setEventHandler { [weak self] in self?.sample() }
        t.resume()
        timer = t
    }

    private func sample() {
        let now = Date().timeIntervalSince(startedAt)
        let thermal = Self.thermalName()
        let anchors = (arSession.currentFrame?.anchors ?? []).compactMap { $0 as? ARMeshAnchor }
        var s: [String: Any] = [
            "t": now,
            "battery": Double(UIDevice.current.batteryLevel),
            "batteryState": Self.batteryStateName(),
            "thermal": thermal,
            // ⚑ The proof of work. A stalled run must be impossible to mistake for a cool one, and
            // this is the number that would visibly stop moving if the session died.
            "frames": frames,
            "meshAnchors": anchors.count,
            "meshFaces": anchors.reduce(0) { $0 + $1.geometry.faces.count },
            "cooling": coolingFrom >= 0
        ]
        if let cam = arSession.currentFrame?.camera {
            s["tracking"] = HSArProbe.describe(cam.trackingState)
            let p = cam.transform.columns.3
            s["x"] = Double(p.x); s["y"] = Double(p.y); s["z"] = Double(p.z)
            if startPosition == nil { startPosition = SIMD3<Float>(p.x, p.y, p.z) }
        }
        samples.append(s)
        onSample?(s)

        // ---- the primary measure ----
        if transitionAt < 0, thermal != startThermal {
            transitionAt = now
            endedBecause = "thermal"
            beginCooling()
            return
        }
        if coolingFrom < 0, now >= capSeconds {
            endedBecause = "cap"
            beginCooling()
            return
        }
        if coolingFrom >= 0, now - coolingFrom >= coolSeconds {
            timer?.cancel(); timer = nil
        }
    }

    /**
     ⚑ The load stops; the sampling does not.

     *Does twenty minutes cook it* is not the question. *Can a concierge do five to eight zones over
     two or three hours* is, and **recovery between zones is half of that answer** — a device that
     reaches `fair` in twelve minutes and is back to `nominal` four minutes later is a different
     proposition from one that stays there. It costs nothing to collect and cannot be recovered
     afterwards.
     */
    private func beginCooling() {
        coolingFrom = Date().timeIntervalSince(startedAt)
        arSession.pause()
        avSession?.stopRunning()
    }

    /**
     ⚑ Loop closure — and it is not a thermal question at all.

     The whole architecture rests on positions being trustworthy over the length of a zone. Walk a
     loop, come back to where you started, press the button: the delta between the origin recorded at
     the first sample and the pose now **is** the accumulated drift. If it is worse than about a
     metre at zone length, `marker-accurate` stops being a caveat and becomes a design change.
     */
    func closeLoop() -> [String: Any] {
        guard let start = startPosition, let cam = arSession.currentFrame?.camera else {
            return ["closed": false, "why": "no tracked pose"]
        }
        let p = cam.transform.columns.3
        let now = SIMD3<Float>(p.x, p.y, p.z)
        let out: [String: Any] = [
            "closed": true,
            "t": Date().timeIntervalSince(startedAt),
            "driftMetres": Double(simd_distance(start, now)),
            "tracking": HSArProbe.describe(cam.trackingState),
            "startX": Double(start.x), "startY": Double(start.y), "startZ": Double(start.z),
            "endX": Double(now.x), "endY": Double(now.y), "endZ": Double(now.z)
        ]
        loopClosure = out
        return out
    }

    // MARK: - work counters

    func session(_ session: ARSession, didUpdate frame: ARFrame) { frames += 1 }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) { frames += 1 }

    // MARK: - names

    static func thermalName() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }

    static func batteryStateName() -> String {
        switch UIDevice.current.batteryState {
        case .charging: return "charging"
        case .full: return "full"
        case .unplugged: return "unplugged"
        default: return "unknown"
        }
    }
}
