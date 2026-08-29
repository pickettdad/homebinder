import ARKit
import AVFoundation
import Foundation

/**
 Item 2 of the running list, both probes, in one session because they need the same one.

 ## Probe A — can Text mode be flown while ARKit holds the lens?

 ⚑ **The question is NOT whether the capabilities are supported.** `configurableCaptureDeviceForPrimaryCamera`
 hands back a real `AVCaptureDevice` and every `isXSupported` on it will almost certainly say yes,
 because they are facts about the hardware. **The question is whether a setting STICKS**, because
 ARKit is running its own auto-exposure and auto-focus on that same device, every frame, for its own
 purposes — and a value that is accepted and then quietly reasserted a second later is the worst
 possible answer: it tests green and fails in the field.

 ⛑ **So every capability is measured three times: supported, took, and still-holding two seconds
 later.** *The thing consulted must be the thing that governs* — this repo's most expensive recurring
 defect, and reading back once immediately after writing is exactly the shape that misses it.

 Text mode's actual requirements, from `ModeGoal.of(.text)`:
 close focus (`autoFocusRangeRestriction = .near`), a focus point, spot metering
 (`exposurePointOfInterest`), continuous AE, and a torch that can be turned on and off for the pair.

 ## Probe B — what does a format change cost in TIME?

 `HSLensProbe` measured the pose jump (15 mm — the world survives). ⚑ **Nobody has measured the
 wait.** If a format change costs two seconds of untracked frames, then decision one — ARKit holding
 the camera for a whole zone, swapping format per capture mode — is paying that on every mode
 change, and a concierge feels it.

 Measured as three round trips rather than one: **a first switch is a cold start and a single
 number cannot tell the two apart.** Reported individually, never averaged into one figure that
 hides the shape.

 ⛑ Nothing here uses `.resetTracking` after the baseline run: it destroys the origin every position
 in a zone is measured against.
 */
@available(iOS 16.0, *)
final class HSControlProbe: NSObject {
    private let session = ARSession()

    /// ⚑ Written after **every** line, not at the end. A probe that only writes its result on
    /// completion has nothing to show for a run that hung — which is the run you most want to read.
    private static func flush(_ lines: [String]) {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        else { return }
        try? lines.joined(separator: "\n").write(
            to: dir.appendingPathComponent("hs-control-probe.txt"), atomically: true, encoding: .utf8)
    }

    /// One capability, asked the three ways that matter.
    private struct Verdict {
        let name: String
        var supported: Bool
        var wrote = false
        var tookImmediately = false
        var heldAfterSettle = false
        var note = ""

        var dict: [String: Any] {
            ["capability": name, "supported": supported, "wrote": wrote,
             "tookImmediately": tookImmediately, "heldAfterSettle": heldAfterSettle, "note": note]
        }
        /// ⚑ The only line that matters, and it is not `supported`.
        var usable: Bool { supported && wrote && tookImmediately && heldAfterSettle }
    }

    func run(completion: @escaping ([String: Any]) -> Void) {
        var out: [String: Any] = [:]
        var lines: [String] = []
        /* ⛑ **`print`, not only `NSLog`** — and that is a finding this probe paid for before it
           measured anything. On modern iOS `NSLog` goes to the unified log and **not** to the
           stream `devicectl … --console` captures, so the first run of this probe produced exactly
           zero lines on a device that had run it correctly. Same class as `idevicesyslog`, which
           was chased for an afternoon for the same reason. `print` reaches stdout, which the
           console does capture; the file below is the belt for the braces. */
        func say(_ s: String) {
            print("HS-CTRL \(s)")
            NSLog("HS-CTRL %@", s)
            lines.append(s)
            Self.flush(lines)
        }

        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        say("session started; settling")

        DispatchQueue.global().async { [weak self] in
            guard let self else { return }
            Thread.sleep(forTimeInterval: 3)

            // ================= PROBE A =================
            guard let device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera else {
                say("NO CONFIGURABLE DEVICE — every Text-mode control is unavailable under ARKit")
                out["configurableDevice"] = false
                out["lines"] = lines
                self.session.pause()
                DispatchQueue.main.async { completion(out) }
                return
            }
            out["configurableDevice"] = true
            out["deviceType"] = device.deviceType.rawValue
            say("configurable device: \(device.deviceType.rawValue)")

            var verdicts: [Verdict] = []

            // --- close focus: the restriction, the mode and the point ---
            var focusRange = Verdict(name: "autoFocusRangeRestriction=.near",
                                     supported: device.isAutoFocusRangeRestrictionSupported)
            var focusPoint = Verdict(name: "focusPointOfInterest",
                                     supported: device.isFocusPointOfInterestSupported)
            var focusMode = Verdict(name: "focusMode=.continuousAutoFocus",
                                    supported: device.isFocusModeSupported(.continuousAutoFocus))
            var meter = Verdict(name: "exposurePointOfInterest (spot metering)",
                                supported: device.isExposurePointOfInterestSupported)
            var autoExposure = Verdict(name: "exposureMode=.continuousAutoExposure",
                                       supported: device.isExposureModeSupported(.continuousAutoExposure))
            var torch = Verdict(name: "torch on/off (the pair)", supported: device.hasTorch && device.isTorchModeSupported(.on))

            var torchAskedAt = CACurrentMediaTime()
            let point = CGPoint(x: 0.4, y: 0.6)   // deliberately NOT centre: centre is also the default,
                                                  // so writing it proves nothing about whether it took.

            do {
                try device.lockForConfiguration()
                out["lockForConfiguration"] = true
                if focusRange.supported { device.autoFocusRangeRestriction = .near; focusRange.wrote = true }
                if focusMode.supported { device.focusMode = .continuousAutoFocus; focusMode.wrote = true }
                if focusPoint.supported { device.focusPointOfInterest = point; focusPoint.wrote = true }
                if meter.supported { device.exposurePointOfInterest = point; meter.wrote = true }
                if autoExposure.supported { device.exposureMode = .continuousAutoExposure; autoExposure.wrote = true }
                if torch.supported {
                    try? device.setTorchModeOn(level: 1.0)
                    torch.wrote = true
                }
                torchAskedAt = CACurrentMediaTime()
                device.unlockForConfiguration()
            } catch {
                out["lockForConfiguration"] = false
                out["lockError"] = error.localizedDescription
                say("LOCK REFUSED: \(error.localizedDescription) — nothing below can be set at all")
            }

            // --- read back immediately ---
            let near = { (a: CGPoint, b: CGPoint) in abs(a.x - b.x) < 0.02 && abs(a.y - b.y) < 0.02 }
            focusRange.tookImmediately = device.autoFocusRangeRestriction == .near
            focusMode.tookImmediately = device.focusMode == .continuousAutoFocus
            focusPoint.tookImmediately = near(device.focusPointOfInterest, point)
            meter.tookImmediately = near(device.exposurePointOfInterest, point)
            autoExposure.tookImmediately = device.exposureMode == .continuousAutoExposure
            /*
             ⚑ **The torch is a latency, not a yes/no, and two runs of this probe proved it.**

             Run 1 read `isTorchActive == true` on the line after the write. Run 2 read `false`, and
             `true` 2.5 s later — same device, same code, same room. ⛑ **A control whose answer
             changes between runs is one nobody has measured**, and asking it as a boolean would
             have shipped whichever run happened to be read last.

             It matters concretely: the torch pair takes an unlit frame and a lit one, and
             `torchPairSettleSeconds` (0.45 s) is the whole budget between them. If the lamp needs
             longer than that to come up under ARKit, the lit frame of every pair is taken while the
             torch is still rising — which looks like a dim photograph, not like a bug.
            */
            var torchOnMs: Double? = nil
            if torch.supported {
                let deadline = CACurrentMediaTime() + 4.0
                while CACurrentMediaTime() < deadline {
                    if device.isTorchActive { torchOnMs = (CACurrentMediaTime() - torchAskedAt) * 1000; break }
                    Thread.sleep(forTimeInterval: 0.005)
                }
            }
            out["torchOnLatencyMs"] = torchOnMs as Any
            say("torch reached active in \(torchOnMs.map { String(format: "%.0f ms", $0) } ?? "NEVER (4 s)")")
            torch.tookImmediately = torchOnMs != nil
            torch.note = "latencyMs \(torchOnMs.map { String(format: "%.0f", $0) } ?? "never")"
            say("immediate: focusRange \(focusRange.tookImmediately) focusPoint \(focusPoint.tookImmediately) meter \(meter.tookImmediately) AE \(autoExposure.tookImmediately) torch \(torch.tookImmediately)")

            /* ⚑ **The load-bearing wait.** ARKit re-drives exposure and focus continuously; a value
               that survives the write and not the next two seconds is a setting the field cannot
               use, and it is indistinguishable from a working one if you only read back once. */
            Thread.sleep(forTimeInterval: 2.5)
            focusRange.heldAfterSettle = device.autoFocusRangeRestriction == .near
            focusMode.heldAfterSettle = device.focusMode == .continuousAutoFocus
            focusPoint.heldAfterSettle = near(device.focusPointOfInterest, point)
            meter.heldAfterSettle = near(device.exposurePointOfInterest, point)
            autoExposure.heldAfterSettle = device.exposureMode == .continuousAutoExposure
            torch.heldAfterSettle = device.isTorchActive
            torch.note += ", torchLevel \(device.torchLevel), isTorchAvailable \(device.isTorchAvailable)"
            say("after 2.5s: focusRange \(focusRange.heldAfterSettle) focusPoint \(focusPoint.heldAfterSettle) meter \(meter.heldAfterSettle) AE \(autoExposure.heldAfterSettle) torch \(torch.heldAfterSettle)")

            // Torch back off, and reported — a probe that leaves the lamp on is a probe that
            // changed the thing it measured for whatever runs next.
            if torch.supported, (try? device.lockForConfiguration()) != nil {
                device.torchMode = .off
                device.unlockForConfiguration()
                // ⚑ Both ends. The reordered pair turns the lamp OFF for the unlit frame first, so
                // the off-latency is the one it actually waits on.
                let offAsked = CACurrentMediaTime()
                var offMs: Double? = nil
                let offDeadline = offAsked + 4.0
                while CACurrentMediaTime() < offDeadline {
                    if !device.isTorchActive { offMs = (CACurrentMediaTime() - offAsked) * 1000; break }
                    Thread.sleep(forTimeInterval: 0.005)
                }
                out["torchOffLatencyMs"] = offMs as Any
                say("torch reached off in \(offMs.map { String(format: "%.0f ms", $0) } ?? "NEVER (4 s)")")
            }
            out["torchOffAfterProbe"] = !device.isTorchActive

            verdicts = [focusRange, focusMode, focusPoint, meter, autoExposure, torch]
            out["controls"] = verdicts.map { $0.dict }
            let unusable = verdicts.filter { !$0.usable }.map { $0.name }
            out["unusableUnderArkit"] = unusable
            /* ⛑ **A verdict before the prose** — the named class of 2026-08-12. If every control
               holds there is nothing to attribute and the list of what failed is the answer. */
            out["textModeFlyableUnderArkit"] = unusable.isEmpty
            say(unusable.isEmpty
                ? "TEXT MODE IS FLYABLE UNDER ARKIT — all six controls took and held"
                : "TEXT MODE NOT FLYABLE UNDER ARKIT — these did not hold: \(unusable.joined(separator: ", "))")

            // ================= PROBE B =================
            let formats = ARWorldTrackingConfiguration.supportedVideoFormats
            let sizes = Array(Set(formats.map { "\(Int($0.imageResolution.width))x\(Int($0.imageResolution.height))" }))
            say("formats offered: \(formats.count), distinct resolutions: \(sizes.count)")

            var distinct: [ARConfiguration.VideoFormat] = []
            for f in formats where !distinct.contains(where: { $0.imageResolution == f.imageResolution }) {
                distinct.append(f)
            }
            guard distinct.count >= 2 else {
                say("only one resolution offered — format-change timing cannot be measured on this device")
                out["formatSwitchMeasurable"] = false
                out["lines"] = lines
                self.session.pause()
                say("RESULT \(out)")
                DispatchQueue.main.async { completion(out) }
                return
            }
            out["formatSwitchMeasurable"] = true

            /*
             ⛑ **The first cut of this measured nothing, and it is worth recording why.**

             It waited for a frame whose `timestamp` was newer than the one sampled before the
             switch — and `session.run(config)` is asynchronous, so the very next frame off the old
             format satisfies that. It reported 13 ms twice, which is the poll interval, and 1566 ms
             once. **Three numbers, one instrument, and the disagreement was the instrument.**

             ⚑ Worse, the first trip switched to the format that was **already running**. A no-op
             switch timed at 13 ms and read as a fast switch.

             Both are the same defect this repo keeps naming: *the thing consulted was not the thing
             that governs.* A frame is evidence of the new format only when its **resolution is the
             new format's** — so that is what is waited for, and a trip whose target is already live
             is skipped and said to be skipped rather than counted.
            */
            let startResolution = self.session.currentFrame?.camera.imageResolution
            say("starting resolution: \(startResolution.map { "\(Int($0.width))x\(Int($0.height))" } ?? "unknown")")

            var trips: [[String: Any]] = []
            for i in 0..<6 {
                let target = distinct[i % distinct.count]
                let live = self.session.currentFrame?.camera.imageResolution
                guard live != target.imageResolution else {
                    say("trip \(i + 1) → \(Int(target.imageResolution.width))x\(Int(target.imageResolution.height)): SKIPPED, already live")
                    trips.append(["trip": i + 1, "skipped": "already live",
                                  "resolution": "\(Int(target.imageResolution.width))x\(Int(target.imageResolution.height))"])
                    continue
                }
                let beforePos = self.session.currentFrame?.camera.transform.columns.3

                let next = ARWorldTrackingConfiguration()
                next.planeDetection = [.horizontal, .vertical]
                next.videoFormat = target
                let started = CACurrentMediaTime()
                self.session.run(next)      // ⚑ deliberately no options — the origin must survive

                /* Three different waits. Conflating them is how a number like this becomes
                   useless: a frame ARRIVING at the new resolution is not the same as the world
                   being usable again, and neither is the same as the old format stopping. */
                var newFormatMs: Double? = nil
                var trackedMs: Double? = nil
                let deadline = started + 8.0
                while CACurrentMediaTime() < deadline {
                    if let f = self.session.currentFrame, f.camera.imageResolution == target.imageResolution {
                        if newFormatMs == nil { newFormatMs = (CACurrentMediaTime() - started) * 1000 }
                        if case .normal = f.camera.trackingState {
                            trackedMs = (CACurrentMediaTime() - started) * 1000
                            break
                        }
                    }
                    Thread.sleep(forTimeInterval: 0.005)
                }
                let afterPos = self.session.currentFrame?.camera.transform.columns.3
                var jump: Double? = nil
                if let b = beforePos, let a = afterPos {
                    jump = Double(simd_distance(SIMD3<Float>(b.x, b.y, b.z), SIMD3<Float>(a.x, a.y, a.z)))
                }
                trips.append([
                    "trip": i + 1,
                    "from": live.map { "\(Int($0.width))x\(Int($0.height))" } as Any,
                    "to": "\(Int(target.imageResolution.width))x\(Int(target.imageResolution.height))@\(target.framesPerSecond)",
                    "firstFrameAtNewResolutionMs": newFormatMs as Any,
                    "trackingNormalMs": trackedMs as Any,
                    "poseJumpMetres": jump as Any,
                    "tracking": self.session.currentFrame.map { HSArProbe.describe($0.camera.trackingState) } ?? "none"
                ])
                say(String(format: "trip %d %@ → %@: new resolution live at %@ ms, tracking normal %@ ms, pose jump %@ m",
                           i + 1,
                           live.map { "\(Int($0.width))x\(Int($0.height))" } ?? "?",
                           "\(Int(target.imageResolution.width))x\(Int(target.imageResolution.height))",
                           newFormatMs.map { String(format: "%.0f", $0) } ?? "NEVER",
                           trackedMs.map { String(format: "%.0f", $0) } ?? "NEVER",
                           jump.map { String(format: "%.4f", $0) } ?? "?"))
                Thread.sleep(forTimeInterval: 1.5)
            }
            out["formatSwitchTrips"] = trips

            self.session.pause()
            out["lines"] = lines
            say("RESULT \(out)")
            DispatchQueue.main.async { completion(out) }
        }
    }
}
