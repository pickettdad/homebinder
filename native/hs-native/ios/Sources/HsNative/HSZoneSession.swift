import ARKit
// ⚑ Explicit, as in every sibling that touches the AR primary camera (`HSArProbe`, `HSPlateAB`,
// `HSControlProbe`, `HSLensProbe`): `configurableCaptureDeviceForPrimaryCamera` hands back an
// `AVCaptureDevice`, and reading a member of it needs this module in scope rather than assumed
// out of ARKit's own imports.
import AVFoundation
import Foundation
import RoomPlan
import simd

/**
 The zone session — three bounded modes over one coordinate space.

 ⚑ **The design decision this file makes, stated once: the `ARSession` object lives for the length of
 the zone; the WORK is bounded per mode.** Those sound contradictory and they are not, and the
 difference is the whole architecture:

 - **A configuration is what costs.** RoomPlan's plane and structure work, scene reconstruction's
   mesh accumulation — those run for a bounded job and then stop.
 - **A session object is what remembers.** It holds the world origin every capture in the zone is
   positioned against. Paused, it costs nothing: measured on device — mesh byte-identical across a
   pause, origin moved 0.00003 m, resume 0 ms.

 So nothing holds world tracking across a two-to-three hour visit, and every capture in a zone still
 lands in one coordinate space. **Tear the session down between modes instead and the zone has three
 unrelated coordinate spaces**, which makes *at least one frame per container carries a position*
 meaningless the moment a second container is opened.

 Apple's multi-room flow is the same shape and is why `RoomCaptureSession(arSession:)` and
 `stop(pauseARSession: false)` both exist.

 **The three modes:**

 | mode | job | ends |
 |---|---|---|
 | `roomplan` | the floorplan — walls, doors, windows, dimensions | when the plan is good |
 | `mesh` | surfaces and extents, where distances will matter | when the concierge says so |
 | `positioning` | stripped world tracking, awake only to take a position | paused between containers |

 ⛑ **And the wall: a container whose anchor frame was taken while paused is unpositioned forever, and
 nothing downstream can tell.** It does not arrive wrong, it arrives *absent*, and an absence looks
 exactly like a container nobody positioned on purpose. `position()` refuses rather than guessing.
 */
/**
 ⚑ **iOS 17, and the reason is the architecture rather than RoomPlan.**

 RoomPlan itself is iOS 16. But `RoomCaptureSession(arSession:)` and `stop(pauseARSession:)` — the
 two calls that let the floorplan run over the zone's own session and hand it back alive — are
 **iOS 17**. Without them RoomPlan owns a private session, the plan lands in its own coordinate
 space, and every position taken afterwards is measured against a different origin. **That is not a
 lesser version of this design, it is a different one**, so the plugin refuses on an older OS rather
 than quietly shipping two thirds of it.
*/
@available(iOS 17.0, *)
final class HSZoneSession: NSObject, ARSessionDelegate {

    enum Mode: String {
        case roomplan
        case mesh
        case positioning
    }

    /// One per zone. Everything in the zone is positioned against this object's origin.
    private let session = ARSession()
    private var roomCapture: RoomCaptureSession?
    /**
     ⛑ **The stopped scan, held until it has delivered — because `stop()` is not the end of it.**

     ⚑ *Field 2026-09-05, and it is intermittent by construction, which is why it took two walks.*
     `stopRoomCapture` set `roomCapture = nil` on the line after `stop()`. **`stop()` is asynchronous
     — RoomPlan keeps processing and then calls `didEndWith`** — so dropping the only strong reference
     to the session immediately leaves whether that callback ever arrives up to whatever else happens
     to retain it.

     The log shows both outcomes an hour apart with identical user actions: one scan went
     `roomPlanStopping` → `roomDidEnd` in **10 ms**, and the other went `roomPlanStopping` → *nothing
     at all*, thirty seconds to the backstop, **four walls and three doors scanned and discarded.**

     **Same class as every other one-ended operation in this file:** the stop was accounted for and
     the delivery was not. Cleared in `deliverRoom`, which is the moment the scan is genuinely over.
     */
    private var retiringRoomCapture: RoomCaptureSession?
    private var capturedRoom: CapturedRoom?
    private var roomError: String?
    /// ⛑ The completion the fixed 2.5-second wait was standing in for. See `stopRoomPlan`.
    private var roomWaiter: (([String: Any]) -> Void)?
    /// Live scan feedback — RoomPlan reports both and the first cut ignored both.
    private var roomProgress: [String: Any] = [:]

    /**
     ⚑ **How many times ARKit has re-established tracking since this zone opened.**

     The 2026-08-30 export showed mechanical-room poses walking **3 m below the floor** over 42
     minutes, in discrete 0.4–0.7 m steps. The device log across that walk records
     `limited(initializing)` **109 times and `limited(relocalizing)` zero times** — so every wake
     re-establishes tracking from scratch rather than matching the map it already had, and each
     re-establishment re-derives the device pose with no correspondence to the last one.

     ⛑ **A pose at minute 40 is not the same measurement as a pose at minute 2, and nothing in the
     export said so.** This is the count that says it.
    */
    /**
     ⛑ **The streaming format decides the still's aspect ratio, and that is a measured finding.**

     `recommendedVideoFormatForHighResolutionFrameCapturing` returned a **16:9** format on this
     device, and every one of 179 high-resolution captures came back **4224×2376 — 10.0 MP** rather
     than 4032×3024. *Choose the streaming format for the photograph you want, not for the frame
     rate you like.* 4:3 first, then the lowest frame rate within it.
     */
    static func stillFormat() -> ARConfiguration.VideoFormat? {
        let capable = ARWorldTrackingConfiguration.supportedVideoFormats
            .filter { $0.isRecommendedForHighResolutionFrameCapturing }
        let fourThree = capable.filter {
            abs($0.imageResolution.width / $0.imageResolution.height - 4.0 / 3.0) < 0.02
        }
        return (fourThree.isEmpty ? capable : fourThree).min { $0.framesPerSecond < $1.framesPerSecond }
    }

    private(set) var reinitCount = 0
    /// Seconds since the last re-establishment — the other half of *how old is this frame's frame*.
    private var lastInitAt = Date()

    private(set) var zoneId: String = ""
    private(set) var mode: Mode?
    private(set) var paused = false
    private var startedAt = Date()
    private var modeStartedAt = Date()
    private var mapSaves = 0
    private var lastMapSave: Date?
    private var mapURL: URL?
    /// ⚑ Recorded per mode so the answer to *did enabling reconstruction backfill or accumulate
    /// forward* comes out of an ordinary zone rather than a special run — see `meshMarks`.
    private var meshMarks: [[String: Any]] = []
    private var onEvent: (([String: Any]) -> Void)?
    /* ⚑ The lens has one owner. These hand it over and take it back — see `CameraController
       .yieldCamera`. Running ARKit on top of a live AVCaptureSession does not degrade: ARKit is
       refused with `sensorFailed` and the preview freezes. */
    var needCamera: (() -> Void)?
    var releaseCamera: (() -> Void)?
    /// Where to put ARKit's own preview while a scan runs, and how to take it away again.
    var showArPreview: ((ARSession) -> Void)?
    /// ⚑ The preview is fed from here because this is where the frames already arrive — see
    /// `attachArPreview`. Throttled: a scan does not need sixty drawn frames a second.
    /**
     ⛑ **Deliberately NOT an `ARFrame`, and that is the whole bug it was written with.**

     ARKit delivers frames from a small fixed pool. **Holding an `ARFrame` past the delegate
     callback stops ARKit delivering new ones** — Apple documents it, and the field found the exact
     signature: the preview froze on one image while *the shutter still fired, containers still
     opened and deletes still worked.* ⚑ *The app was never blocked; the frame supply was.*

     So the pieces travel and the frame does not: a **copy** of the pixels, the mesh anchors (their
     own objects, safe to keep) and the camera snapshot the projection needs.
     */
    var onPreviewFrame: ((CVPixelBuffer, [ARMeshAnchor], ARCamera) -> Void)?
    private var lastPreviewAt = Date.distantPast
    private var lastPlanAt = Date.distantPast
    var hideArPreview: (() -> Void)?
    /**
     ⚑ **ARKit's frames, handed to the one analysis pipeline the app has.**

     Live text recognition and the motion window were fed by the `AVCaptureSession`. ⛑ **The moment
     this session began holding the camera for the life of a zone, that made nameplate auto-capture
     dead inside every room** — no text, no stability signal, no shutter — and the field found it
     the same evening.

     *A second source of frames, never a second implementation.* The thresholds, the character
     floor, the marginal verdict and the emitted payload stay in one place, because **two
     implementations of "is this plate readable" is a defect this project has already paid for
     twice.**
     */
    var onAnalysisFrame: ((CVPixelBuffer) -> Void)?

    /**
     ⚑ **A copy, because the original belongs to ARKit's frame pool.**

     A `CVPixelBuffer` handed out of `didUpdate` and retained across a queue hop keeps a slot in that
     pool occupied, and enough of them stop the session delivering anything. *A ~4 MB memcpy on the
     delegate thread is roughly a millisecond; a starved frame pool is a dead preview.*
     */
    private func copyBuffer(_ src: CVPixelBuffer) -> CVPixelBuffer? {
        var out: CVPixelBuffer?
        let w = CVPixelBufferGetWidth(src), h = CVPixelBufferGetHeight(src)
        let attrs: [CFString: Any] = [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
        guard CVPixelBufferCreate(nil, w, h, CVPixelBufferGetPixelFormatType(src),
                                  attrs as CFDictionary, &out) == kCVReturnSuccess,
              let dst = out else { return nil }
        CVPixelBufferLockBaseAddress(src, .readOnly)
        CVPixelBufferLockBaseAddress(dst, [])
        defer {
            CVPixelBufferUnlockBaseAddress(dst, [])
            CVPixelBufferUnlockBaseAddress(src, .readOnly)
        }
        // Plane by plane: ARKit's capture buffer is bi-planar YCbCr, and a single memcpy of the
        // base address would copy one plane and leave the picture greyscale.
        let planes = CVPixelBufferGetPlaneCount(src)
        if planes == 0 {
            guard let a = CVPixelBufferGetBaseAddress(src), let b = CVPixelBufferGetBaseAddress(dst) else { return nil }
            memcpy(b, a, CVPixelBufferGetDataSize(src))
            return dst
        }
        for i in 0..<planes {
            guard let a = CVPixelBufferGetBaseAddressOfPlane(src, i),
                  let b = CVPixelBufferGetBaseAddressOfPlane(dst, i) else { return nil }
            let rows = CVPixelBufferGetHeightOfPlane(src, i)
            let srcStride = CVPixelBufferGetBytesPerRowOfPlane(src, i)
            let dstStride = CVPixelBufferGetBytesPerRowOfPlane(dst, i)
            if srcStride == dstStride {
                memcpy(b, a, rows * srcStride)
            } else {
                for r in 0..<rows {
                    memcpy(b.advanced(by: r * dstStride), a.advanced(by: r * srcStride), min(srcStride, dstStride))
                }
            }
        }
        return dst
    }

    /// ⚑ A session can DIE. `sensorFailed` is transient often enough that a retry is a real answer,
    /// so this is recorded, reported, and cleared by rebuilding rather than by restarting the app.
    private(set) var failure: String?
    private var everRan = false
    /* ⚑ Positioning is a duty cycle, so `paused` is about the SESSION and `armed` is about intent.
       A concierge who pauses positioning is saying *do not take positions*, which is not the same
       as *the session is asleep* — it is asleep almost all the time by design. Conflating the two
       is what put "pause positioning" on screen while the session was already sleeping. */
    private var armed = true

    var isRunning: Bool { mode != nil }

    /// What `openZone` returns, so re-entering a zone already open answers identically without
    /// rebuilding it.
    func state() -> [String: Any] {
        [
            "zoneId": zoneId,
            "startedAt": ISO8601DateFormatter().string(from: startedAt),
            "mode": mode?.rawValue ?? Mode.positioning.rawValue,
            "unmet": [String](),
            "reused": true,
            /* ⛑ **"Answers identically" has to include the arm state** (audit 2026-09-06). This is the
               REUSE answer, and it left `armed` out — so a concierge who paused positioning, stepped
               back to the zone screen and returned got a strip reset to *offer Pause* over a session
               still refusing every position with `why: "paused"`. ⚑ `anchorAvailability` then told
               them the room could be anchored while nothing in it could: the wall at the top of this
               file, reached through the viewfinder instead of through a capture, and silent both ways. */
            "armed": armed,
            "meshSupported": ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
            "roomPlanSupported": RoomCaptureSession.isSupported
        ]
    }

    // MARK: - opening and closing a zone

    /**
     Open the zone. The session starts in `positioning` — the cheapest mode — because entering a zone
     is not by itself a request for a floorplan, and a concierge who opens a zone and photographs one
     thing should not have paid for RoomPlan to find that out.
     */
    func openZone(_ id: String, onEvent: @escaping ([String: Any]) -> Void) -> [String: Any] {
        self.zoneId = id
        reinitCount = 0
        lastInitAt = Date()
        self.onEvent = onEvent
        startedAt = Date()
        mapSaves = 0
        meshMarks = []
        session.delegate = self
        mapURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("hs-zone-\(id)-\(Int(startedAt.timeIntervalSince1970)).worldmap")
        /* ⚑ **Opening a zone does not start ARKit.** The camera belongs to the capture session
           until something actually needs a pose, and positioning is *awake for the instant a
           position is taken, paused between containers*. Starting here would take the lens for the
           whole zone and give back exactly the failure this replaced. */
        mode = .positioning
        paused = true
        armed = true
        failure = nil
        HSZoneLog.record("openZone", ["zone": id, "mesh": ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh), "roomPlan": RoomCaptureSession.isSupported])
        return [
            "zoneId": id,
            "startedAt": ISO8601DateFormatter().string(from: startedAt),
            "mode": Mode.positioning.rawValue,
            "unmet": [String](),
            /* Read off the variable rather than written `true`, so this answer and `state()`'s reuse
               answer cannot drift apart — which is the defect above with the sides swapped. */
            "armed": armed,
            "meshSupported": ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
            "roomPlanSupported": RoomCaptureSession.isSupported
        ]
    }

    func closeZone() -> [String: Any] {
        stopRoomCapture(keepSession: false)
        hideArPreview?()
        session.pause()
        releaseCamera?()
        let out: [String: Any] = [
            "zoneId": zoneId,
            "endedAt": ISO8601DateFormatter().string(from: Date()),
            "seconds": Date().timeIntervalSince(startedAt),
            "mapSaves": mapSaves,
            "meshMarks": meshMarks,
            "worldMapPath": mapURL?.path ?? ""
        ]
        mode = nil
        return out
    }

    // MARK: - modes

    /**
     Switch the zone's configuration without costing the world.

     ⚑ **`run(config)` with no options keeps the origin and the anchors** — measured, and it is the
     mechanism the whole mode design rests on. `.resetTracking` would give the zone a new origin and
     silently re-base every position taken after it against a different one.
     */
    /**
     ⛑ **Which world origin a pose was measured from — the one fact that decides whether two
     measurements in a room may be compared at all.**

     ⚑ *Field question 2026-09-05, and it is the process question:* **"floorplan positioning is needed
     to line up with captures, because the desk uses both to place object containers."** They do line
     up — `run(config, options: [])` keeps the origin, so re-entering positioning after RoomPlan
     re-establishes *tracking* and never the *frame*. **But `.resetTracking` does change the frame**,
     and it fires on a session that genuinely died.

     *And that failure is silent in exactly the wrong way:* the poses still look fine, they are still
     metres and millimetres, and they are measured **from somewhere else**. A desk placing a container
     from a floorplan drawn in epoch 0 and a photograph posed in epoch 1 gets a confident wrong answer.

     So the epoch is stamped on the plan, on the mesh and on every pose. ⛑ **Equal epochs mean
     comparable; different epochs mean the desk must not combine them** — an honest orphan rather
     than false continuity, which is this project's standing rule for exactly this shape of problem.
     */
    private var originEpoch = 0
    /**
     ⛑ **A NAME for the origin, because the counter cannot distinguish two of them.**

     ⚑ *Found by the owner's question, 2026-09-06: "I have used the same zone for 2 tests about 25
     minutes apart — has any of the positioning changed during those down times and app rebuilds?"*
     **It had, completely**, and the export could not say so. The manifest shows both runs in one
     zone reporting `originEpoch: 1`, each with `reinits: 1`, `sinceInitSec: 1.4` and a pose within
     a millimetre of `(0,0,0)` — *two fresh origins wearing the same number.*

     **`originEpoch` is a per-process counter.** A new launch starts it again, so the first origin of
     every run is epoch 1 — and equal epochs are exactly what the desk is told means *comparable*.
     ⚠️ **That is the false-continuity failure this field was built to prevent, committed by the
     instrument itself.** *A stale frame silently vouching for a measurement nobody took in it.*

     A uuid is minted wherever the origin is, so **equal ids mean one frame and nothing else does.**
     The counter stays beside it: it is readable, and it still says how many times a run re-based.
     */
    private var originId = UUID().uuidString

    /// What the session is actually configured to do, so `enter` can tell a real change from a
    /// mode label change. Compared by value — two configs that differ in nothing must compare equal.
    private var lastConfigSignature: String?

    private static func signature(of c: ARWorldTrackingConfiguration) -> String {
        let res = c.videoFormat.imageResolution
        return [
            String(c.planeDetection.rawValue),
            String(c.sceneReconstruction.rawValue),
            String(c.frameSemantics.rawValue),
            String(c.environmentTexturing.rawValue),
            "\(Int(res.width))x\(Int(res.height))@\(c.videoFormat.framesPerSecond)",
        ].joined(separator: "|")
    }

    @discardableResult
    private func enter(_ next: Mode, reset: Bool = false) -> [String] {
        var unmet: [String] = []
        // ⚑ Take the lens BEFORE running. This is the whole bug of 2026-08-21 in one line.
        needCamera?()
        let config = ARWorldTrackingConfiguration()
        switch next {
        case .roomplan:
            // RoomPlan configures the session itself; we only ensure it has one to configure.
            config.planeDetection = [.horizontal, .vertical]
        /*
         ⛑ **Mesh and positioning are ONE configuration, and writing them as two was the cost.**

         The doctrine was already stated below — *"the mode is a UI contract about what the person is
         doing, not a different configuration"* — and the code did not honour it: mesh picked
         `recommendedVideoFormatForHighResolutionFrameCapturing`, positioning picked `stillFormat()`,
         and positioning alone asked for depth. **So every mesh↔positioning switch re-ran the session
         and changed the video format**, which is a measured ~15 mm pose jump plus a second of
         `limited(initializing)` — paid twice in a walk that changed mode twice, for nothing.

         ⚑ *Field question 2026-09-05, and it was the right one:* **"shouldn't reinits be 0?"** The
         first is the session starting and cannot be avoided. **Every one after it now has to earn
         itself**, and only RoomPlan does — it reconfigures the session on its own.
         */
        case .mesh, .positioning:
            /* ⛑ **Plane detection stays ON, and stripping it was a bug I introduced** (zone log,
               2026-08-21: `surface: false` on every position taken).

               ⛑ **The REASON has changed, and the old one must not be re-derived from this
               line.** It read *the ray-cast needs something to hit* — and that is no longer why:
               the surface point is measured depth on the optical axis, falling back to a
               ray/triangle intersection against the mesh (`HSSurface`), and **planes are not
               consulted at all.** Plane detection stays because removing it is a *configuration*
               change, and a configuration change is a session re-run — a measured ~15 mm pose jump
               and a second of `limited(initializing)`, paid to delete something that is merely
               unused. ⚑ *Unused is not harmful, and this file's rule is that a re-run earns itself.*

               What that old reason pointed at is still true and still the point: ⚑ **the difference
               between *where the concierge stood* and *what they were standing in front of***, and
               the second is the one a measurement needs.

               ⛑ **Reconstruction is now ON here, and that reverses the note this comment used to
               carry.** It said reconstruction was *the expensive half and the mesh mode's job* —
               measured on 2026-09-04 and it is not: a full 46-minute run with reconstruction, a
               high-resolution format and a still every fifteen seconds held `thermalState` at
               **`nominal` for all 5,520 samples**, never dropped a frame from 24 fps, and used
               **9% of the battery against the sleeping build's 17%.**

               ⚑ **And a plane is a guess at a surface; the mesh *is* the surface** — the desk's
               own process says so, *"where a mesh covers a confirmed container, prefer it for
               position and extent."* ⛑ *That doctrine sat here for four weeks while both capture
               doors ray-cast at `.estimatedPlane` and nothing ever queried the mesh.* It is executed
               now: `HSSurface` measures depth on the axis first and intersects the mesh where depth
               cannot see, and the reconstruction this configuration accumulates is what the second
               rung reads — as well as the extent `harvestMesh` ships. */
            config.planeDetection = [.horizontal, .vertical]
            if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
                config.sceneReconstruction = .mesh
            } else {
                unmet.append("mesh")
            }
            config.environmentTexturing = .none
            if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
                config.frameSemantics.insert(.sceneDepth)
            }
            config.videoFormat = Self.stillFormat() ?? config.videoFormat
        }
        /* ⚑ A dead session cannot be revived by `run(config)` — that is what made every mode after
           a failure inherit the corpse and need an app restart. If it has failed, the delegate has
           already cleared `everRan`, and the first run after that resets rather than resumes. */
        let mustReset = reset || !everRan || failure != nil
        /*
         ⛑ **A `run()` that changes nothing is not free, so it does not happen.**

         Re-running restarts tracking — the 2026-08-30 walk reached `enter` 111 times and ARKit
         reported `limited(initializing)` on 109 of them — and re-running with a different
         `videoFormat` costs a measured ~15 mm pose jump. ⚑ **Neither is worth paying to arrive at
         the configuration already running.**

         *The signature is compared rather than the mode*, because the mode is a UI contract and the
         session only cares about the config behind it. RoomPlan is excluded at both ends: it
         reconfigures the session itself, so whatever we last set is no longer what is running —
         **the thing consulted would not be the thing that governs.**
         */
        let signature = Self.signature(of: config)
        /* ⚠️ `!paused` is load-bearing: a paused session was genuinely `pause()`d, and skipping the
           run would leave it stopped while this method reported it running. */
        if !mustReset, !paused, next != .roomplan, mode != .roomplan, signature == lastConfigSignature {
            HSZoneLog.record("enterUnchanged", ["mode": next.rawValue, "reinits": reinitCount])
            failure = nil
            mode = next
            modeStartedAt = Date()
            showArPreview?(session)
            return unmet
        }
        failure = nil
        /* ⚑ Counted here, at the one place a session is (re)started. Every entry to this line is a
           re-establishment of tracking — the walk of 2026-08-30 reached this 111 times in five
           zones, and ARKit reported `initializing` on 109 of them and `relocalizing` on none. */
        reinitCount += 1
        // ⚑ Only a RESET changes the frame. A re-init keeps it, which is the whole distinction the
        // desk needs and the one `reinits` alone could never express.
        if mustReset {
            originEpoch += 1
            // ⚑ A new frame is a new name. Minted here and nowhere else, beside the one line that
            // creates the thing it names.
            originId = UUID().uuidString
        }
        lastInitAt = Date()
        HSZoneLog.record("enter", [
            "mode": next.rawValue, "reset": mustReset, "unmet": unmet, "reinits": reinitCount,
            "originEpoch": originEpoch, "originId": originId,
        ])
        session.run(config, options: mustReset ? [.resetTracking, .removeExistingAnchors] : [])
        // ⚑ Cleared for RoomPlan rather than stored: it configures the session behind our back, so a
        // signature written here would describe a config that is about to stop being the live one.
        lastConfigSignature = next == .roomplan ? nil : signature
        everRan = true
        mode = next
        modeStartedAt = Date()
        paused = false
        /*
         ⛑ **The function that TAKES the lens is the function that hands the screen over.**

         ⚑ *Audit 2026-09-06, confirmed high by three independent lenses.* `enter` calls
         `needCamera?()` unconditionally at the top — which stops the capture session — and
         `showArPreview` lived in **five callers**: `setMode` twice, `retry`, `startRoomPlan`, and
         the RoomPlan waiter. **`wake()` was caller six and did not have it.**

         `wake()` is the path `position()` uses, so the ordinary capture door — not mesh, not
         floorplan — took the camera away from AVFoundation on the first photograph and **never put
         anything in its place.** The viewfinder froze on one frame for the rest of the zone while
         the shutter, the containers and the filmstrip all kept working. *It used to be survivable
         because `sleepSession()` handed the lens back within seconds; that function has since been
         deleted for want of a caller.*

         **The rule moves here because a rule kept in N callers holds until somebody writes N+1** —
         which is the same finding as `finishScan`, the roomWaiter, and `reclaimCamera`, and this is
         the fourth time. `attachArPreview` keeps an existing correctly-placed view, so calling it
         here costs a comparison on the paths that already had it.
         */
        showArPreview?(session)
        return unmet
    }

    func setMode(_ next: Mode) -> [String: Any] {
        /*
         ⛑ **A plan still being finalised is not a plan you may run a new configuration over.**

         The 2026-09-05 walk pressed Finish on the floorplan and opened mesh fourteen seconds later
         while delivery was still pending; `enter(.mesh)` re-ran the `ARSession` underneath RoomPlan
         and **the plan was never delivered at all** — 4 walls, 3 doors and 1 window, scanned and
         gone. ⚑ *Nothing said so. The concierge's floorplan simply did not exist.*

         It cannot be silent. The waiter is fired here with what is known, so the loss lands as a
         refusal the export carries rather than as an absence nobody can date.
         */
        if next != .roomplan { supersedeRoomPlan(because: "\(next.rawValue) was opened") }
        if mode == .roomplan, next != .roomplan { stopRoomCapture(keepSession: true) }
        // Leaving a scan mode: give the lens and the screen back before anything else happens.
        if next == .positioning {
            /* ⛑ **Finishing the mesh produced nothing, because nothing filed it.** The anchors
               accumulated inside the session and were thrown away with it — the concierge walked a
               room, pressed Finish and got silence. ⚑ The geometry is the deliverable here exactly
               as the frames are for a traverse, so it comes back on the way out. */
            let harvested = mode == .mesh ? harvestMesh() : [:]
            hideArPreview?()
            /* ⛑ **No sleep on the way out of a scan mode either.** Leaving mesh or RoomPlan used to
               hand the lens back and pause; positioning is now the same continuously-mapped session
               those modes were, minus the concierge deliberately scanning. *The mode is a UI
               contract about what the person is doing, not a different configuration.* */
            let unmet = enter(.positioning)
            showArPreview?(session)
            var out: [String: Any] = ["mode": next.rawValue, "unmet": unmet, "paused": false]
            if !harvested.isEmpty { out["mesh"] = harvested }
            return out
        }
        // ⚑ Marked on the way in and again on the way out, so the open question — does enabling
        // reconstruction backfill or only accumulate forward? — is answered by ordinary zones.
        if next == .mesh { meshMarks.append(mark("mesh-on")) }
        if mode == .mesh, next != .mesh { meshMarks.append(mark("mesh-off")) }
        let unmet = enter(next)
        /* ⚑ **The preview comes from ARKit in every mode now, because ARKit holds the lens in every
           mode now.** It used to be mesh-only: positioning slept and handed the camera back, so the
           AVFoundation preview drew the viewfinder. A continuously-mapped session cannot give the
           lens back, so the frames a person sees have to be the frames the tracker is using —
           *which is also the honest arrangement: the viewfinder now shows what the pose is measured
           from.* */
        showArPreview?(session)
        return ["mode": next.rawValue, "unmet": unmet, "paused": false, "failed": failure ?? ""]
    }

    /**
     The mesh as data, not as a session that ended.

     ⚑ **Vertices and faces per anchor, with each anchor's transform**, so the desk can measure
     against it — clearance in front of the furnace is a ray-cast, ceiling height is straight up, and
     neither is answerable from a count. ⛑ **And the extent is reported as the extent of what was
     WALKED**, never as the extent of the room: a mesh hole reads *unknown*, never *nothing there*.
     */
    private func harvestMesh() -> [String: Any] {
        let anchors = (session.currentFrame?.anchors ?? []).compactMap { $0 as? ARMeshAnchor }
        HSZoneLog.record("harvestMesh", ["anchors": anchors.count])
        /* ⛑ **The mesh names its own zone.** Every floorplan payload carries `zoneId` and both
           meshes of the 2026-08-30 walk carried `""` — so a mesh read on its own could not say which
           room it was of. The manifest's `owner.zoneId` recovers it, but *a payload that cannot
           identify itself is one join away from being anonymous*, and the doc's own example shows
           the field populated. Two rooms were meshed on that walk; the difference between them is
           the entire question the desk is asking. */
        guard !anchors.isEmpty else {
            return ["anchors": 0, "faces": 0, "zoneId": zoneId, "originEpoch": originEpoch, "originId": originId,
                    "why": "nothing was meshed"]
        }
        var minP = SIMD3<Float>(repeating: .greatestFiniteMagnitude)
        var maxP = SIMD3<Float>(repeating: -.greatestFiniteMagnitude)
        var faces = 0
        var pieces: [[String: Any]] = []
        for a in anchors {
            faces += a.geometry.faces.count
            let t = a.transform.columns.3
            /*
             ⛑ **The geometry itself, not a count of it** (owner ruling 2026-09-01).

             `vertices: 14712` was a **count** shipped where the desk needed a **list**. The kitchen
             mesh was 8,545 bytes declaring 74,494 vertices and 133,838 faces; the mechanical room
             7,813 bytes declaring 150,832 and 262,642. ⚑ *A mesh that ships no vertices is a
             receipt for a mesh.*

             **All mesh processing is desk work** — Discovery is capture-only and the field app never
             edits a floorplan from a mesh — so the shape has to leave the device or the ruling
             cannot be executed at all. Roughly 0.9 MB and 1.6 MB against an export already carrying
             1.4 GB: **0.2% for the only thing in the file that describes a surface.**

             Vertices are read through the buffer's own stride and offset rather than assumed
             contiguous — `MTLBuffer` layout is ARKit's to change, and reading it as a packed
             `SIMD3<Float>` array is the kind of assumption that works until an OS release.
            */
            var verts: [Double] = []
            let vb = a.geometry.vertices
            verts.reserveCapacity(vb.count * 3)
            for i in 0..<vb.count {
                let p = vb.buffer.contents()
                    .advanced(by: vb.offset + vb.stride * i)
                    .assumingMemoryBound(to: (Float, Float, Float).self).pointee
                verts.append(Double(p.0)); verts.append(Double(p.1)); verts.append(Double(p.2))
                /* ⛑ **`walkedExtent` used to be the extent of anchor CENTRES**, so it measured the
                   spread of ~1 m³ block origins and understated the real volume by roughly half a
                   block on every face — while being compared, in a design review, against floorplan
                   wall extents as though the two were the same measurement. *A number named for one
                   thing and computed from another is worse than a missing number.* It is now the
                   extent of the actual geometry, in world space. */
                let w = a.transform * SIMD4<Float>(p.0, p.1, p.2, 1)
                let wp = SIMD3<Float>(w.x, w.y, w.z)
                minP = simd_min(minP, wp)
                maxP = simd_max(maxP, wp)
            }
            /* Face indices, flattened. `indexCountPerPrimitive` is 3 for a triangle mesh and is
               read rather than assumed, for the same reason. */
            var idx: [Int] = []
            let fb = a.geometry.faces
            let perFace = fb.indexCountPerPrimitive
            idx.reserveCapacity(fb.count * perFace)
            /*
             ⛑ **`bytesPerIndex` is read here AND honoured — it used to be read and ignored.**

             The line advanced by `fb.bytesPerIndex` and then read `UInt32` unconditionally. On a
             16-bit buffer that walks 2 bytes and reads 4, so every index but the first is two halves
             of two different numbers: ⚑ **not a crash and not an error — a room made of the wrong
             triangles**, in the one payload the desk reconstructs geometry from.

             *The comment two lines above already stated the rule* — `indexCountPerPrimitive` "is read
             rather than assumed, for the same reason" — and then the next statement broke it. Three
             readers of this buffer exist (`renderArPreview`, `HSSurface`, here); the other two branch
             correctly, and **the one that got it wrong is the one that writes the export.**

             *It has not bitten yet because ARKit ships 32-bit indices today.* That is precisely the
             "works until an OS release" hazard the sibling comment names.
             */
            let indexBase = fb.buffer.contents()
            let indexWidth = fb.bytesPerIndex
            for i in 0..<(fb.count * perFace) {
                let p = indexBase.advanced(by: i * indexWidth)
                idx.append(indexWidth == 2
                    ? Int(p.assumingMemoryBound(to: UInt16.self).pointee)
                    : Int(p.assumingMemoryBound(to: UInt32.self).pointee))
            }
            pieces.append([
                "id": a.identifier.uuidString,
                // ⚑ Kept as counts BESIDE the arrays, not replaced by them: a reader can check the
                // array it received against the number the device meant to send.
                "vertexCount": vb.count,
                "faceCount": fb.count,
                "indicesPerFace": perFace,
                /* Flat `[x,y,z,x,y,z,…]` in the anchor's LOCAL frame — `transform` places it.
                   Flat rather than nested triples because 150,000 three-element arrays is JSON
                   overhead three times the size of the numbers. */
                "vertices": verts,
                "faces": idx,
                "x": Double(t.x), "y": Double(t.y), "z": Double(t.z),
                "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(a.transform[c][r]) } }
            ])
        }
        return [
            "anchors": anchors.count,
            "faces": faces,
            // ⛑ Same frame question as the plan: geometry and poses combine only within one epoch.
            "originEpoch": originEpoch, "originId": originId,
            // ⚑ Two rooms were meshed on the 2026-08-30 walk and neither payload could say which
            // it was. See the guard above.
            "zoneId": zoneId,
            "pieces": pieces,
            // The volume somebody walked, which is the honest name for it.
            "walkedExtent": [
                "minX": Double(minP.x), "minY": Double(minP.y), "minZ": Double(minP.z),
                "maxX": Double(maxP.x), "maxY": Double(maxP.y), "maxZ": Double(maxP.z)
            ]
        ]
    }

    private func mark(_ what: String) -> [String: Any] {
        let anchors = (session.currentFrame?.anchors ?? []).compactMap { $0 as? ARMeshAnchor }
        return [
            "what": what,
            "t": Date().timeIntervalSince(startedAt),
            "anchors": anchors.count,
            "faces": anchors.reduce(0) { $0 + $1.geometry.faces.count }
        ]
    }

    // MARK: - the duty cycle

    /**
     ⚑ **Pause is what makes three bounded modes affordable, and it is free.** Measured: mesh comes
     back byte-identical, the origin moves 0.00003 m, resume costs 0 ms. The camera stops, the neural
     engine stops, and the zone's coordinate space survives untouched.
     */
    func pause() -> [String: Any] {
        guard mode != nil else { return ["paused": false, "why": "no zone open"] }
        // Save before going quiet: this is the natural moment, and a crash while paused should cost
        // nothing at all.
        /*
         ⛑ **Timed and LEFT IN PLACE — the step-out's nine seconds is measured across a window that
         contains all of this and logged none of it.**

         `roomShotStepOut → cameraReclaimed` spans a world-map save, an `ARSession.pause()`, a preview
         teardown and the whole of `reclaimCamera`. With one row at each end **every one of them is a
         suspect**, and the field's 9.00 s could belong to any.

         ⚑ *`saveWorldMap` is the only thing in that window whose behaviour depends on elapsed time.*
         It is gated at one save per 120 s, and in `.positioning` the per-frame saver never fires — so
         a step-out at t=16 extracts a map and a step-out at t=54 is refused, **which is exactly the
         first-slow / second-fast shape the field reported.** `getCurrentWorldMap` returns as soon as
         it is enqueued, but the `session.pause()` on the next line — and therefore ARKit's release of
         the camera — may queue behind the extraction. That is a mechanism, not a measurement, which is
         the whole reason for these two clocks.

         ⛑ **Measured, not removed.** The map is the zone's insurance against losing its coordinate
         space to a crash. It has no reader today — `worldMapPath` and `zoneMapSaved` appear nowhere in
         `src/` or `tests/` — but *insurance nobody has cashed is not insurance nobody needs*, and
         **deleting a save to test a hypothesis spends the world to buy a number.** `mapRequested` plus
         `arPauseMs` settles it on this device in one walk, and *then* the save can move to a moment
         nobody is waiting on.
        */
        let mapFrom = CACurrentMediaTime()
        // ⚑ The RETURN, not the call: the 120-second gate is the variable, and a row that only said
        // "called" would read identically on the slow step-out and the fast one.
        let mapRequested = saveWorldMap()
        let mapMs = (CACurrentMediaTime() - mapFrom) * 1000
        let arFrom = CACurrentMediaTime()
        session.pause()
        HSZoneLog.record("zonePaused", [
            "mapRequested": mapRequested,
            "mapMs": mapMs,
            "arPauseMs": (CACurrentMediaTime() - arFrom) * 1000,
        ])
        paused = true
        armed = false
        /*
         ⛑ **The screen goes back with the lens, and it did not.**

         ⚑ *Audit 2026-09-06.* `releaseCamera?()` restarts the capture session and re-attaches ITS
         preview — underneath ARKit's, which is still in the hierarchy showing **the last frame
         before the session paused.** A frozen picture over a live one is worse than a black screen:
         it looks like a working viewfinder aimed at the wrong thing. **Every other exit from a mode
         hides it — `closeZone` and `setMode` both do; pause was the one that did not.**
         */
        hideArPreview?()
        // Give the lens back the instant we stop needing it — the capture session is what the
        // concierge is looking through.
        releaseCamera?()
        return ["paused": true, "mode": mode?.rawValue ?? ""]
    }

    /**
     ⛑ **Resume ARMS positioning; it does not start ARKit.**
     *
     * The first cut called `enter(mode)` here, which took the lens and never gave it back — so
     * resuming froze the viewfinder and the app reported the capture session not running. **That is
     * the same ownership bug as the original one, wearing a button.**
     *
     * Positioning is a burst: `position()` wakes the session, reads a pose and sleeps. So resuming
     * means *stop refusing* — the next capture will wake it — and nothing more.
     */
    func resume() -> [String: Any] {
        guard let mode else { return ["paused": true, "why": "no zone open"] }
        armed = true
        return ["paused": false, "mode": mode.rawValue, "armed": true]
    }

    // MARK: - taking a photograph THROUGH the tracking session

    private var stillInFlight = false
    private let encodeQueue = DispatchQueue(label: "hs.zone.encode", qos: .userInitiated)

    /**
     **A 12 MP still taken through the tracking session, with the pose of the frame it came from.**

     ⚑ **This is the whole architecture in one method.** ARKit and an `AVCaptureSession` cannot share
     the rear camera, so every photograph used to be a handover: stop the photo session, wake ARKit,
     read a pose, sleep ARKit, restart the photo session, take the picture. **6.3 s per photograph,
     of which 4.9 s was ARKit re-establishing tracking — and the pose it produced was dead-reckoned
     because the session was never awake long enough to build a map.**

     `captureHighResolutionFrame` is delivered **out-of-band**: the tracking stream is not
     interrupted, the returned `ARFrame` carries the native full-resolution still **and the camera
     transform of the instant it was taken.** Measured on device 2026-09-04: **p50 78 ms, p95 278 ms**,
     4032×3024, and on the hardest plate in the house it read a serial the AVFoundation path dropped
     the first character of, three times out of three.

     ⛑ **The pose is the returned frame's own `camera.transform`, written once and never rewritten.**
     That is the measurement contract: an anchor's later correction is telemetry about the walk, never
     a revision of a photograph.

     **The shutter refuses rather than producing a pose nobody can use.** Under the sleeping build a
     tracking check was a restatement of a filter; here it means something, because tracking can
     genuinely be limited while the session runs.
     */
    func captureStill(text wantsText: Bool, completion: @escaping ([String: Any]) -> Void) {
        guard mode != nil else { completion(["ok": false, "why": "no zone open"]); return }
        if let failure { completion(["ok": false, "why": failure]); return }
        /* ⛑ One request at a time — `ARErrorCodeHighResolutionFrameCaptureInProgress` is 106, and a
           burst that queues is honest where a dropped frame is not. */
        guard !stillInFlight else { completion(["ok": false, "why": "a capture is already in flight"]); return }

        /*
         ⛑ **A paused session is refused HERE, so no caller can read a frame out of one.**

         ⚑ *Confirmed by five independent review lenses, 2026-09-06, against the room shot's
         step-out.* `resume()` sets `armed = true` and nothing else — **it does not restart ARKit** —
         and the only `wake()` in this file is `position()`'s. So a caller that paused, resumed and
         then asked for a still got one of two wrong answers: **nil `currentFrame` on a zone whose
         ARKit had never run**, or, worse, **the retained pre-pause frame, which still reports
         `.normal`** — this file's own measured finding at `waitForTrackedFrame` — so both guards
         below would pass and a pose from before the concierge moved would be stated as confidently
         as a real one.

         **The guard belongs on the value, not in the callers.** `waitForTrackedFrame` already
         carries the `timestamp > stale` requirement for exactly this reason; `captureStill` had no
         equivalent because until the step-out it was only ever called on a continuously-running
         session. *That assumption is now false and this is where it stops being assumed.*
         */
        guard !paused else {
            completion(["ok": false, "why": "positioning is paused", "recoverable": true]); return
        }
        guard let live = session.currentFrame else {
            completion(["ok": false, "why": "no frame yet"]); return
        }
        guard case .normal = live.camera.trackingState else {
            completion(["ok": false, "why": "tracking \(HSArProbe.describe(live.camera.trackingState))",
                        "recoverable": true]); return
        }

        stillInFlight = true
        let asked = CACurrentMediaTime()
        session.captureHighResolutionFrame { [weak self] frame, error in
            guard let self else { return }
            defer { self.stillInFlight = false }
            let ms = (CACurrentMediaTime() - asked) * 1000
            guard let f = frame, error == nil else {
                completion(["ok": false, "why": error?.localizedDescription ?? "capture failed",
                            "recoverable": true])
                return
            }
            let t = f.camera.transform
            let p = t.columns.3
            let mapping = self.mappingWord(f)
            let tracking = HSArProbe.describe(f.camera.trackingState)

            /*
             ⛑ **The lamp is asked; it used to be asserted.** This entry hard-coded `"torch": false`,
             so a still taken with the torch lit was filed as an unlit frame — and *labelled* one:
             `storedFrameLabel` prints "no torch" straight off this field. **Nothing downstream can
             recover it from the pixels**, so a wrong value here is permanent, and it is the lighting
             provenance of the photograph the desk is about to judge.

             ⚑ *A zone does not keep the torch off, and that is the whole of the defect.* The capture
             session stops when the zone takes the lens, but `CameraController` keeps evaluating the
             torch on its five-second status timer, and the torch button is live in a zone and still
             reaches `adjust` — which needs the controller, not a running session. Both write the
             SAME `AVCaptureDevice` ARKit is driving: `HSPlateAB` lights a plate through this very
             accessor mid-session, so this is measured rather than argued.

             The lamp, not `CameraController.torchOn` — that is only what was last *written*, and
             `HSControlProbe` measured a write `isTorchActive` had not caught up with on the next
             line. And read at delivery rather than stamped at request the way the torch pair stamps
             `torchForRequest`: the pair stamps because it toggles the lamp between two queued
             requests, and here there is one frame, no toggle in flight, and an exposure that happens
             *after* the request — so delivery is the nearer instant. `nil` is the one unreadable
             state, ARKit declining to hand its primary camera back for configuration, and every
             probe in this package that has asked has been handed a device on this iPad.
             */
            let torchLit = ARWorldTrackingConfiguration
                .configurableCaptureDeviceForPrimaryCamera?.isTorchActive ?? false

            /* ⚑ What the lens was aimed at, from THIS frame — and `HSSurface` is the one place
               that decides, which is why the ray that used to be written out here is gone. The
               optical axis is still the ray, and still for the reason it always was: it needs no
               pixel-to-sensor mapping, so it is immune to the intrinsics misregistration reported
               between the stream and the high-resolution frame on some iPad generations.

               ⛑ The answer is a plain value with no ARKit object inside it, so it can cross the
               encode hop below — this closure has already been taught once what holding ARKit's own
               objects costs. */
            let aim = HSSurface.ahead(of: f, live: self.session.currentFrame)

            var position: [String: Any] = [
                "positioned": true, "zoneId": self.zoneId, "tracking": tracking,
                "at": ISO8601DateFormatter().string(from: Date()),
                "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
                "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(t[c][r]) } },
                "mapping": mapping, "reinits": self.reinitCount, "originEpoch": self.originEpoch,
                "originId": self.originId,
                "sinceInitSec": Date().timeIntervalSince(self.lastInitAt),
                "featurePoints": f.rawFeaturePoints?.points.count ?? 0,
                /* ⚑ The camera model of the photograph itself, not of the tracking stream — the two
                   can differ, and placing a marker on this image needs THIS one. */
                "intrinsics": (0..<3).flatMap { r in (0..<3).map { c in Double(f.camera.intrinsics[c][r]) } },
                "imageWidth": Int(f.camera.imageResolution.width),
                "imageHeight": Int(f.camera.imageResolution.height),
                /* ⛑ **The still came out of the tracking session, so the matrix DOES describe it.**
                   This is the case `projection` was built for and it is now the ordinary one. */
                "projection": ["projectable": true],
            ]
            if let payload = aim.payload { position["surface"] = payload }

            /*
             ⛑ **The pixels are copied out and the frame is released BEFORE the hop, and that
             ordering is the whole fix.**

             ⚑ *The field signature was unmistakable:* the screen froze on the **first** photograph of
             a zone while the shutter still fired, containers still opened and deletes still worked.
             **Nothing was blocked — ARKit had simply stopped producing frames**, because this closure
             held one of its pooled buffers for as long as a 12 MP JPEG encode *and* an OCR pass took.
             The old camera's buffers could be held like this; ARKit's cannot.

             *A ~35 MB memcpy costs a handful of milliseconds against a 78 ms shutter. A starved frame
             pool costs the viewfinder for the rest of the zone.*
             */
            let w = Int(f.camera.imageResolution.width), h = Int(f.camera.imageResolution.height)
            guard let pixels = self.copyBuffer(f.capturedImage) else {
                completion(["ok": false, "why": "could not copy the frame"]); return
            }
            self.encodeQueue.async {
                let ci = CIImage(cvPixelBuffer: pixels)
                guard let jpeg = CIContext().jpegRepresentation(
                    of: ci, colorSpace: CGColorSpaceCreateDeviceRGB(),
                    options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.95]
                ) else {
                    DispatchQueue.main.async { completion(["ok": false, "why": "could not encode the frame"]) }
                    return
                }
                let name = "hs-zone-still-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
                guard (try? jpeg.write(to: url, options: .atomic)) != nil else {
                    DispatchQueue.main.async { completion(["ok": false, "why": "could not write the frame"]) }
                    return
                }
                var entry: [String: Any] = [
                    "path": url.path, "bytes": jpeg.count, "index": 0,
                    "exifOrientation": CameraController.exifOrientation(of: jpeg),
                    // `lens` stays a constant and is not the same kind of claim: world tracking is
                    // offered only the wide-angle device on this iPad (`HSLensProbe`, 2026-08-24),
                    // which is why `emitStatus` reports `normal` for the whole of a zone.
                    "torch": torchLit, "lens": "normal",
                ]
                if wantsText, let read = CameraController.readAccurately(jpeg: jpeg) { entry["ocr"] = read }
                /* ⛑ **The old row carried `"surface": <bool>` and nothing else**, which is how
                   a 96% hit rate read as validation while measuring how reliably a plane could be
                   invented. What answered, how far, how sure, and what it cost — or, on a refusal,
                   which rung refused and why. */
                var row: [String: Any] = [
                    "ms": ms, "bytes": jpeg.count, "mapping": mapping, "tracking": tracking,
                    "w": w, "h": h,
                ]
                for (key, value) in aim.log { row[key] = value }
                HSZoneLog.record("stillThroughArkit", row)
                DispatchQueue.main.async {
                    completion([
                        "ok": true, "latencyMs": ms, "frames": [entry],
                        "position": position, "mode": self.mode?.rawValue ?? "positioning",
                    ])
                }
            }
        }
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

    // MARK: - taking a position

    /**
     A measured position, or an honest refusal.

     ⛑ **The wall.** A container whose anchor frame was taken while the session was paused is
     unpositioned forever and nothing downstream can tell — it arrives absent, and an absence is
     indistinguishable from a container nobody positioned on purpose. So this refuses, loudly, rather
     than handing back the last pose it happened to be holding.

     ⚑ **And `tracking` travels with the pose.** ARKit says when it does not know — `normal`,
     `limited(reason)`, `notAvailable` — and every measure built in the traverse track had honesty
     bolted on afterwards at the cost of a round each. Here it comes free and it ships from day one.

     **The pose is where the concierge STOOD, not where the object is** — marker-accurate, and
     `surface` carries the **measured** point in front of the lens when there is one, so the desk has
     both and can tell them apart. *2.3 m from the panel* is defensible; *2,438 mm* is not.
     */
    func position() -> [String: Any] {
        guard mode != nil else { return ["positioned": false, "why": "no zone open"] }
        if let failure { return ["positioned": false, "why": failure, "recoverable": true] }
        guard armed else { return ["positioned": false, "why": "paused"] }
        /* ⚑ **The burst.** Positioning is awake for the instant a position is taken and asleep
           between containers, so the pose is fetched by waking the session, reading it, and going
           back to sleep — never by holding the lens across the zone.

           The first wake in a zone has to establish tracking and takes a second or two; every one
           after it resumes into the same world, measured at 0 ms with the mesh byte-identical. That
           asymmetry is why the wait is bounded and reported rather than hidden: a caller that gets
           `settling` back knows to hold still, and one that gets a pose knows it is real. */
        /* ⛑ **The lens goes back on EVERY path out of here, and it did not** (field 2026-08-23:
           the viewfinder freezing after a second shot, with the strip saying *hold still*).

           The success path used to end with `sleepSession()`, deleted 2026-09-05 — see its tombstone below. The failure path — tracking not settled in
           time — returned early and skipped it, so ARKit kept the camera and the capture session
           never restarted. ⚑ **A frozen viewfinder was the app telling the truth about a lens
           nobody had given back.** The log said it in two lines: `cameraYielded` with no
           `cameraReclaimed` after it.

           `defer` rather than a call before each `return`, because the reason this happened is that
           one of four exits was easy to miss, and a fifth exit added later would miss it too. */
        /*
         ⛑ **The session no longer sleeps, and that deletes the defect this whole comment block was
         written about.**

         Positioning was a duty cycle: wake, read a pose, sleep. The 2026-08-30 export showed where
         that ends — poses walking **3 m below the floor** over 42 minutes. The instrumented cause,
         measured 2026-09-02: ARKit awake **~1.4 s per capture against 20–116 s asleep**, roughly
         **2% of the session**, `worldMappingStatus` never past `limited`, **0–9 tracked feature
         points.** ⚑ *It never built a map, so there was no loop closure and every pose was
         dead-reckoned from the one before.* Standing still that is perfect — 5 mm over six minutes.
         Walking, it accumulates.

         **Running continuously, measured over 46 minutes with the full load: 6.0 cm of return-to-
         reference error, and it stops growing** — 3.0 → 4.3 → 4.9 → 5.3 → 5.2 → 4.5 → 4.5 → 6.0.
         *Bounded error rather than drift*, `mapped` for 68% of the session, **median 229 feature
         points**, and ARKit revising its own origin anchor 71 times. **That is loop closure, which
         the sleeping build achieved zero times in its life.**

         *The lens-handover paragraphs this replaced described putting the camera back on every exit
         path. There is no longer an exit path that takes it.*
        */
        let wasAsleep = paused
        if paused { wake() }
        /* A cold wake has to establish tracking from nothing, which the log shows going
           initializing → normal → insufficientFeatures → normal before it settles. Three seconds was
           inside that, so a perfectly healthy wake reported `settling`. A warm one resumes into the
           same world and answers almost at once, so the two waits are not the same wait. */
        guard let frame = waitForTrackedFrame(timeout: wasAsleep ? 8.0 : 3.0) else {
            /*
             ⛑ **The refusal used to say `settling` and nothing else, and that word covered two
             different failures.** `waitForTrackedFrame` only ever returns a `.normal` frame, so the
             `guard case .normal` below is **unreachable** — every tracking-limited condition landed
             here instead, as a bare `settling` indistinguishable from *no new frame arrived at all*.
             The `tracking` member of the refusal variant was a field **no code path could
             populate**. The filter destroyed information on the failure path as well as the success
             one, which is the half the first fix missed.
            */
            let last = session.currentFrame.map { HSArProbe.describe($0.camera.trackingState) }
            return [
                "positioned": false,
                "why": failure ?? (last.map { "tracking \($0)" } ?? "no frame"),
                "tracking": last as Any,
                "recoverable": true,
            ]
        }
        let state = HSArProbe.describe(frame.camera.trackingState)
        /*
         ⛑ **`tracking` is TAUTOLOGICAL and this is the honest instrument beside it.**

         The guard below refuses anything that is not `.normal`, so a *positioned* pose can only
         ever carry `tracking: "normal"` — 109 of 109 across the whole export, which reads as
         reassurance and is a restatement of the filter. **A field with one possible value carries
         no information.** It stays, because its absence would be worse and the binder already
         consumes it, but it can no longer stand alone.

         ⚑ `worldMappingStatus` is ARKit's own answer to the question the desk is actually asking —
         *how much of this room does the session believe it knows* — and unlike `trackingState` it
         is not filtered by anything here. `.limited` or `.notAvailable` on a pose forty minutes
         into a zone is the signal that pose is worth less than an early one.
        */
        let mapping: String
        switch frame.worldMappingStatus {
        case .notAvailable: mapping = "notAvailable"
        case .limited: mapping = "limited"
        case .extending: mapping = "extending"
        case .mapped: mapping = "mapped"
        @unknown default: mapping = "unknown"
        }
        guard case .normal = frame.camera.trackingState else {
            // Not a failure to report later: a pose taken under `limited` is a pose that may be
            // metres out, and the caller has to decide with that in front of them.
            return ["positioned": false, "why": "tracking \(state)", "tracking": state]
        }
        let t = frame.camera.transform
        let p = t.columns.3
        var out: [String: Any] = [
            "positioned": true,
            "zoneId": zoneId,
            "tracking": state,
            // ⚑ The three that let a desk age a pose. See the comments above and on `reinitCount`.
            "mapping": mapping,
            "reinits": reinitCount,
            "originEpoch": originEpoch, "originId": originId,
            "sinceInitSec": Date().timeIntervalSince(lastInitAt),
            "featurePoints": frame.rawFeaturePoints?.points.count ?? 0,
            /*
             ⚑ **The camera model, beside the pose** (design ruling 2026-09-04). Placing a marker on
             a photograph means projecting a 3D point into it, and **the pose gives extrinsics while
             nothing gave intrinsics** — EXIF carries no `FocalPlaneResolution` on these frames.

             ⛑ The alternative the desk would otherwise carry is *a hand-maintained device-to-sensor
             table keyed on the EXIF model string*, which goes stale on every new iPad and produces
             **plausibly-wrong placements rather than errors.** ARKit hands this over free at capture.

             Row-major 3×3: `[fx, 0, cx, 0, fy, cy, 0, 0, 1]`, in pixels of `imageResolution`, which
             is carried beside it because focal length in pixels is meaningless without the frame it
             was measured in.
            */
            "intrinsics": (0..<3).flatMap { r in (0..<3).map { c in Double(frame.camera.intrinsics[c][r]) } },
            "imageWidth": Int(frame.camera.imageResolution.width),
            "imageHeight": Int(frame.camera.imageResolution.height),
            "mode": mode?.rawValue ?? "",
            "at": ISO8601DateFormatter().string(from: Date()),
            "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
            // The full transform, because a pose without an orientation cannot say which way the
            // camera was facing and the desk needs that to ray-cast for itself later.
            "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(t[c][r]) } }
        ]
        /* Where the lens was pointing, measured. Absent is fine and is recorded as absent —
           nothing to measure reads UNKNOWN, never "nothing there", and never a plausible number
           nobody can tell from a measured one.

           ⚑ **The same function the shutter asks**, because the traverse's two leg anchors come
           through this door: a leg anchored by one rule and a photograph anchored by another is two
           coordinate stories in one zone. *And the wrong `allowing:` value got written here twice
           precisely because there were two places to write it.* */
        let aim = HSSurface.ahead(of: frame, live: session.currentFrame)
        if let payload = aim.payload { out["surface"] = payload }
        // The lens goes back in the `defer` above — on this path and on every other.
        var row: [String: Any] = ["ok": true, "tracking": state]
        for (key, value) in aim.log { row[key] = value }
        HSZoneLog.record("position", row)
        return out
    }

    /// Wake positioning just long enough to read a pose. Never used by the scan modes, which hold
    /// the lens for their whole bounded job.
    private func wake() {
        enter(.positioning)
    }

    /*
     ⛑ **DELETED: `sleepSession()`, `sleptAt`, `sleptWhen`, and the two pose keys they fed —
     `resumeJumpM` and `sleepSec`.** Named here because the 2026-09-02 diagnosis still prints those
     columns, and a column that quietly stops appearing invites somebody to put the field back.

     `sleepSession()` was the only thing that ever set the pair, and **nothing has called it since
     positioning stopped being a duty cycle** and the session started running for the life of the
     zone. So every pose written after that shipped both keys as `nil as Any` — *present in the
     payload and structurally absent in every row*, which reads as **no jump** rather than as **not
     measured**. ⚑ Same class as the refusal variant's `tracking` before it was fixed: a field no
     code path could populate. The TypeScript pose type mirrors this payload field for field and
     never declared either key (`src/native/zone.ts`), so the contract had already moved on.

     ⛑ Its own doc comment named `pause()` and `closeZone()` as the callers and **neither was one** —
     both pause the session themselves, and `pause()` also hides the preview, which this never did.
     *A caller list kept in a comment is not a caller list*, and this one kept a dead function
     looking live across two audits.

     ⚑ **And the question it was aimed at is settled, so the instrument is not worth rebuilding.**
     `docs/POSE-DIAGNOSIS-2026-09-02.md` holds its one real reading — 0.24 mm across a 116-second
     sleep — and Gate 1 measured the running session directly: 6.0 cm bounded over 46 minutes.
    */

    /**
     ⚑ **Try to get the session back without touching the camera.**

     A `sensorFailed` while a zone is open is contention that has usually cleared by the time anyone
     reacts, and the only correct response is *ask ARKit again* — never *give the lens to the thing
     that took it.* ⛑ The old handler did the second, which produced the next `sensorFailed`, five
     times in nine minutes.
     */
    /**
     ⛑ **Wake ARKit and WAIT for a frame it stands behind — the step the room shot's far end needs
     and `resume()` deliberately does not do.**

     ⚑ `resume()` means *stop refusing*, by design: the camera is re-taken lazily inside
     `position()`, which is why the traverse keeps its world — every `handLens("zone")` is followed by
     a `takePosition()`. **The room shot substitutes `captureStill`, which has no such path**, so it
     needed this one stated rather than inherited.

     **Bounded, and the timeout is the answer rather than a failure to report later.** `wake()` runs
     `enter(.positioning)`, whose `needCamera?()` stops the capture session synchronously first and
     whose `mustReset` is false — so **the origin and `originEpoch` survive**, which is the whole
     reason a step-out is affordable at all.

     ⚠️ **Blocks. Never call it on the main thread** — `waitForTrackedFrame` sleeps in 50 ms steps.
     */
    func wakeForCapture(timeout: TimeInterval = 8.0) -> Bool {
        guard mode != nil else { return false }
        if paused { wake() }
        return waitForTrackedFrame(timeout: timeout) != nil
    }

    func retry() -> [String: Any] {
        guard let m = mode else { return ["ok": false, "why": "no zone open"] }
        failure = nil
        // ⚑ **No reset.** Preserving the origin is the entire difference between retrying in place
        // and reopening the zone — see `everRan` in `didFailWithError`.
        let unmet = enter(m)
        showArPreview?(session)
        return ["ok": failure == nil, "mode": m.rawValue, "unmet": unmet, "why": failure ?? ""]
    }

    /**
     Wait for a frame ARKit is willing to stand behind, or give up and say so.

     ⚑ **Bounded, and the timeout is a result rather than a failure to report later.** A pose taken
     under `limited` can be metres out, and `settling` is something a concierge can act on in the
     room — *hold still and look at something with detail* — which is the whole reason the refusal
     is worth more than a silent fallback to no position.
     */
    private func waitForTrackedFrame(timeout: TimeInterval) -> ARFrame? {
        // Honour what the caller asked for; a cold wake and a warm one are not the same wait.
        /* ⛑ **A frame NEWER than the one we went to sleep holding** (field 2026-08-23: four
           consecutive captures across two different containers came back with a byte-identical
           transform).

           Positioning sleeps between containers, and `currentFrame` keeps returning the last frame
           from before the pause — which still reports `.normal`, because it did track, a minute ago.
           So the wait returned instantly with a **stale pose**, and every object in the zone was
           filed at the spot where the first one was photographed.

           ⚑ **Nothing about that reads as broken.** `positioned: true`, tracking `normal`, a real
           transform — the failure is that it is the *wrong room position*, stated as confidently as
           the right one. `ARFrame.timestamp` is monotonic, so requiring a newer one is the whole
           fix, and it is the difference between placing six objects and placing one six times. */
        let stale = session.currentFrame?.timestamp ?? 0
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if failure != nil { return nil }
            if let f = session.currentFrame, f.timestamp > stale,
               case .normal = f.camera.trackingState { return f }
            Thread.sleep(forTimeInterval: 0.05)
        }
        return nil
    }

    // MARK: - RoomPlan

    /**
     The floorplan, on the zone's own session.

     ⚑ `RoomCaptureSession(arSession:)` runs RoomPlan over the session we already hold, so the plan
     and every position taken in the zone share one origin. `stop(pauseARSession: false)` is the call
     that matters at the other end: it ends the scan and **hands the session back alive**, which is
     what lets the floorplan be a bounded job without costing the zone its coordinate space.
     */
    /**
     ⛑ **A plan still being finalised is either honoured or recorded — never dropped.**

     Fires the pending waiter with what is known, so an interrupted floorplan lands as a refusal the
     export carries rather than as an absence nobody can date. ⚑ **A function rather than a repeated
     block**, because the same rule written into two call sites has already been missed by a third.
     */
    private func supersedeRoomPlan(because why: String) {
        guard let waiter = roomWaiter else { return }
        roomWaiter = nil
        retiringRoomCapture = nil
        HSZoneLog.record("roomSuperseded", ["because": why])
        waiter(["captured": false, "why": roomError ?? "the floorplan was still finishing when \(why)"])
    }

    func startRoomPlan() -> [String: Any] {
        guard RoomCaptureSession.isSupported else {
            return ["started": false, "why": "RoomPlan unsupported on this device"]
        }
        guard mode != nil else { return ["started": false, "why": "no zone open"] }
        /*
         ⛑ **Another caller of the same rule, and it did not have it** (audit 2026-09-06).

         `setMode` supersedes a `roomWaiter` still waiting; **starting a second scan did not** — so
         pressing Finish, backing out, and starting the floorplan again leaves the first waiter armed
         over a session that has been reconfigured, and its 30-second backstop later reports a
         failure for a scan nobody is running. ⚑ *`capturedRoom = nil` below then discards the first
         plan outright.* This is the third caller of a rule that has now been written twice; it lives
         in `supersedeRoomPlan` so the fourth cannot miss it.
         */
        supersedeRoomPlan(because: "a new floorplan was started")
        capturedRoom = nil
        roomError = nil
        enter(.roomplan)
        // ⚑ ARKit owns the lens for the length of a scan, so the preview has to be ARKit's too —
        // otherwise the screen is the frozen corpse of a capture session that no longer has the
        // camera, which is exactly the black screen seen in the field on 2026-08-21.
        showArPreview?(session)
        let capture = RoomCaptureSession(arSession: session)
        capture.delegate = self
        roomCapture = capture
        capture.run(configuration: RoomCaptureSession.Configuration())
        HSZoneLog.record("roomPlanStarted")
        return ["started": true, "mode": Mode.roomplan.rawValue]
    }

    private func stopRoomCapture(keepSession: Bool) {
        guard let capture = roomCapture else { return }
        // ⚑ Held BEFORE the stop, not after: the callback can arrive on the next runloop turn.
        retiringRoomCapture = capture
        capture.stop(pauseARSession: !keepSession)
        roomCapture = nil
    }

    /// Ends the scan and returns the plan. The session stays alive underneath — see `startRoomPlan`.
    func stopRoomPlan(completion: @escaping ([String: Any]) -> Void) {
        guard roomCapture != nil else {
            completion(["captured": false, "why": "RoomPlan not running"])
            return
        }
        /* ⛑ **This waited a fixed 2.5 seconds and reported whatever had arrived by then.** It
           always reported nothing: `RoomBuilder` post-processes the scan asynchronously and takes
           longer than that, so every finished floorplan came back `captured: false, why: "no room
           returned"` — twice in the field on 2026-08-21, with the geometry arriving moments after
           anybody was still listening.

           ⚑ **A fixed sleep standing in for a completion is a race the happy path loses**, and it
           fails in the direction that looks like the feature not working rather than like a bug.
           The waiter below is resolved by the delegate; the timeout is a backstop that says so. */
        HSZoneLog.record("roomPlanStopping")
        roomWaiter = { [weak self] out in
            guard let self else { return }
            /*
             ⛑ **Back to positioning HERE, on the device, rather than left to whoever called.**

             ⚑ *This line detached the preview and stopped* — so the session went on tracking with
             nothing drawing it, and the field got **a black screen after finishing the floorplan
             that only backing out of the zone could clear** (2026-09-05, and the log is unambiguous:
             `roomDelivered` → `arPreviewDetached` → forty-five seconds of `tracking` and no attach).

             **The caller was supposed to do this and one of the two callers did not.** `finishMesh`
             calls `setZoneModeNative("positioning")`; `finishScan` calls `setZoneMode`, the *React
             state setter one letter away from it* — so the label changed and the device did not.
             ⚑ **A rule that lives in two callers is a rule that holds until somebody adds a third.**
             Leaving a scan mode is a fact the session knows about itself, so it acts on it here and
             no caller can forget.

             The session stays: `stop(pauseARSession: false)` hands the live session back rather than
             ending it, and pausing would throw away the map it just spent ninety seconds building —
             the map every pose afterwards is corrected against. Re-entering positioning keeps that
             map, because `enter` only resets when the session actually died.
             */
            /*
             ⛑ **And only while RoomPlan is still the mode** (audit 2026-09-06).

             ⚑ *`deliverRoom` clears `roomWaiter` on the `RoomBuilder` Task and calls it a runloop
             turn later, on main.* A `setZoneMode("mesh")` arriving in that gap — Capacitor runs
             plugin calls on its own `bridge` queue, so it genuinely can — finds nothing left to
             supersede, `enter(.mesh)` runs, **and then this closure lands on top of it and takes
             the session straight back out of mesh.** The concierge walks the room with the strip
             still saying mesh, presses Finish, and `setMode(.positioning)` finds `mode` already
             `.positioning` — so `harvestMesh` is skipped and the walk is discarded. *That is the
             2026-09-05 symptom exactly — "clicked finish and looked like nothing registered" —
             reached by a second road.*

             ⚑ **The 30-second backstop below cannot cover this one**: it guards the waiter it still
             holds, and this waiter was detached before it ever ran. So the rule lives on the action
             it governs. *Both guards stay, because they decide different things:* the backstop
             decides whether to answer the caller at all; this decides whether to steer the session.
             */
            if self.mode == .roomplan {
                _ = self.enter(.positioning)
                self.showArPreview?(self.session)
            } else {
                // ⚑ Recorded rather than silent — the line that would have named the bug above in
                // a zone log instead of in an audit.
                HSZoneLog.record("roomFinishedElsewhere", ["mode": self.mode?.rawValue ?? "none"])
            }
            completion(out)
        }
        stopRoomCapture(keepSession: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            guard let self, let waiter = self.roomWaiter else { return }
            self.roomWaiter = nil
            /*
             ⛑ **A backstop for a scan nobody is in any more must not reach out and change the mode.**

             ⚑ *Field 2026-09-05, and it is the whole of that walk's confusion.* RoomPlan stopped at
             41 s and never delivered. The concierge moved on to mesh and walked the room — **and at
             71 s this timeout fired and ran `enter(.positioning)`, taking them out of mesh without
             a word.** Pressing Finish a moment later found `mode` already `.positioning`, so
             `harvestMesh` was skipped and the walked mesh was discarded: *"clicked finish and looked
             like nothing registered."*

             **The timeout's job is to stop the caller waiting, not to steer a session that has moved
             on.** The waiter restores positioning because it normally runs while RoomPlan is still
             the mode; thirty seconds later that is no longer a safe assumption.
             */
            if self.mode == .roomplan {
                waiter(["captured": false, "why": self.roomError ?? "the scan did not finish in 30 s"])
            } else {
                HSZoneLog.record("roomTimedOutElsewhere", ["mode": self.mode?.rawValue ?? "none"])
                self.onEvent?([
                    "roomLost": self.roomError ?? "the floorplan did not finish and the room moved on",
                ])
            }
        }
    }

    private func deliverRoom(_ out: [String: Any]) {
        // The scan is genuinely over here — this is the callback the reference was being held for.
        retiringRoomCapture = nil
        HSZoneLog.record("roomDelivered", ["captured": out["captured"] ?? false, "why": out["why"] ?? "", "walls": (out["walls"] as? [[String: Any]])?.count ?? 0])
        guard let waiter = roomWaiter else {
            HSZoneLog.record("roomDeliveredLate", ["note": "nobody was still waiting"])
            return
        }
        roomWaiter = nil
        DispatchQueue.main.async { waiter(out) }
    }

    /**
     The plan as data the desk can use, rather than a file it has to open.

     ⚑ **Every surface carries its dimensions and its transform**, because the window-and-door
     measurement the owner wants comes free with the plan and is worthless if it only exists inside a
     USDZ. `confidence` travels with each one — RoomPlan says how sure it is and dropping that would
     be the same mistake as dropping `trackingState`.
     */
    private static func describe(_ room: CapturedRoom, zoneId: String, originEpoch: Int, originId: String) -> [String: Any] {
        func surfaces(_ list: [CapturedRoom.Surface]) -> [[String: Any]] {
            list.map { s in
                let p = s.transform.columns.3
                return [
                    "id": s.identifier.uuidString,
                    "width": Double(s.dimensions.x),
                    "height": Double(s.dimensions.y),
                    "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
                    "confidence": "\(s.confidence)",
                    "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(s.transform[c][r]) } }
                ]
            }
        }
        let objects: [[String: Any]] = room.objects.map { o in
            let p = o.transform.columns.3
            return [
                "id": o.identifier.uuidString,
                "category": "\(o.category)",
                "width": Double(o.dimensions.x),
                "height": Double(o.dimensions.y),
                "depth": Double(o.dimensions.z),
                "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
                "confidence": "\(o.confidence)"
            ]
        }
        return [
            "captured": true,
            "zoneId": zoneId,
            /* ⛑ **The frame this plan is drawn in.** The desk places containers by combining the
               plan with posed photographs, so the plan must say which origin it belongs to — a plan
               and a pose from different epochs are both correct and not comparable. */
            "originEpoch": originEpoch, "originId": originId,
            "walls": surfaces(room.walls),
            "doors": surfaces(room.doors),
            "windows": surfaces(room.windows),
            "openings": surfaces(room.openings),
            /* ⚑ RoomPlan's object list is reported and is NOT the object container. Its taxonomy has
               no water heater, no softener, no pressure tank — it knows sofas and refrigerators — so
               treating it as an inventory would silently under-count exactly the rooms this service
               exists for. It is context for the desk, nothing more. */
            "roomPlanObjects": objects
        ]
    }

    // MARK: - persistence

    /**
     ⚑ **An app that dies from heat must not take the zone's coordinate space with it.**

     Every capture in the zone inherits its position from this space, so losing it retro-actively
     unpositions work that was correctly captured — a crash should cost the frames since the last
     save and never the zone. Saved on pause, on mode change, and on a floor of two minutes.

     `worldMappingStatus` gates it: Apple is explicit that a map taken before the session has mapped
     enough is unlikely to relocalise, and writing one anyway would produce a file that looks like
     insurance and is not.
     */
    @discardableResult
    func saveWorldMap() -> Bool {
        guard let frame = session.currentFrame, let url = mapURL else { return false }
        switch frame.worldMappingStatus {
        case .mapped, .extending: break
        default: return false
        }
        if let last = lastMapSave, Date().timeIntervalSince(last) < 120 { return false }
        lastMapSave = Date()
        session.getCurrentWorldMap { [weak self] map, _ in
            guard let self, let map else { return }
            guard let data = try? NSKeyedArchiver.archivedData(withRootObject: map,
                                                              requiringSecureCoding: true) else { return }
            try? data.write(to: url, options: .atomic)
            self.mapSaves += 1
            self.onEvent?(["zoneMapSaved": self.mapSaves, "bytes": data.count])
        }
        return true
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        /* ⚑ Every frame, because the pipeline does its own cadence gate — it counts frames and
           analyses every Nth, and it must do that counting once rather than once per source. */
        // ⚑ A COPY. See `copyBuffer` — handing ARKit's own buffer to another queue starves the
        // frame pool, and a starved pool stops the session dead while the rest of the app runs on.
        if onAnalysisFrame != nil, let copied = copyBuffer(frame.capturedImage) {
            onAnalysisFrame?(copied)
        }
        // Cheap, and it is the only thing that runs per frame here.
        if mode == .mesh || mode == .roomplan { saveWorldMap() }
        /* ⛑ **Positioning gets preview frames too, and its absence was the black viewfinder.**

           This gate was written when positioning slept between poses — there was nothing to draw
           because the session was not running, and the AVFoundation preview held the screen. ⚑ The
           session now runs for the life of the zone and the capture session does not, **so the only
           frames in existence are these**, and a mode excluded from the gate is a mode with a black
           screen. *The field spent two smoke tests looking at one.* */
        guard onPreviewFrame != nil else { return }
        // ~20 fps is a live picture to a walking person and a third of the drawing work.
        guard Date().timeIntervalSince(lastPreviewAt) > 0.05 else { return }
        lastPreviewAt = Date()
        // The pixels are copied; the anchors and the camera are their own objects and are safe to
        // carry. **The ARFrame itself never leaves this method.**
        if let copied = copyBuffer(frame.capturedImage) {
            /*
             ⛑ **The overlay is a mesh-mode affordance, so it is gated on the MODE and never on
             whether anchors happen to exist.**

             ⚑ *This is my own regression from the drift fix.* Positioning now runs with
             `sceneReconstruction = .mesh` continuously — mesh helps tracking — so **mesh anchors
             exist in every mode**, and an overlay drawn whenever anchors are present is an overlay
             drawn always. The field read it exactly as it looks: *"went back to photograph this
             room and it was still showing the mesh overlay."*

             **A gold film over the viewfinder means *this surface is captured*. In a mode that is
             not capturing surfaces it means nothing, and a signal that means nothing is one that
             gets read as the mode it belongs to.**
             */
            let overlay = mode == .mesh ? frame.anchors.compactMap { $0 as? ARMeshAnchor } : []
            onPreviewFrame?(copied, overlay, frame.camera)
        }
    }

    /**
     ⛑ **A session that dies must say so, and must be recoverable without an app restart.**

     Before this, a failure fell through silently: positioning became a plain viewfinder, every mode
     entered afterwards inherited the corpse, and only relaunching cleared it. ⚑ **That is a silent
     fallback to no-position capture — the exact thing the shutter's refusal exists to prevent,
     happening one layer above it.**

     So the failure is held, reported, and `everRan` is cleared so the next entry REBUILDS rather
     than calling `run` on a corpse. And the lens goes back, because a dead AR session holding the
     camera is the worst of both.
     */
    func session(_ session: ARSession, didFailWithError error: Error) {
        HSZoneLog.record("sessionFailed", ["error": error.localizedDescription])
        failure = error.localizedDescription
        /*
         ⛑ **Contention is not a dead session, and clearing this flag treated them as the same.**

         `everRan = false` forces the next `enter` to run with `.resetTracking`, **which mints a new
         world origin** — so every pose already taken in the room is silently re-based against a
         different one. ⚑ *That is the drift failure this whole rebuild exists to remove, arriving
         through the recovery path.* The 2026-09-05 log shows six re-inits in ninety seconds, each
         one a new origin, each one triggered by a `sensorFailed` that was itself avoidable.

         **`sensorFailed` means something else took the lens for a moment.** The map is intact and
         ARKit can relocalize into it — and if it cannot, tracking says `limited(relocalizing)`,
         which is an honest state a concierge can act on. *Any other error is a session that really
         is gone, and there a fresh origin is the truthful answer rather than a silent one.*
         */
        everRan = (error as NSError).code == ARError.sensorFailed.rawValue
        paused = true
        /*
         ⛑ **The camera is NOT handed back here, and handing it back was a failure LOOP.**

         `sensorFailed` **is** ARKit being refused the camera. This handler answered by calling
         `releaseCamera` — *which starts the capture session that was refusing it* — producing the
         next `sensorFailed`. Five in nine minutes, twice over, with nine-second preset restores and
         a black screen the field could not get out of. ⚑ **And a session carrying a `failure`
         refuses `captureStill`, so not one photograph took the new path in either smoke test.**

         **The old design could do this safely because ARKit only ever wanted the lens for a
         second.** It now holds it for the life of the zone, so *releasing on failure is releasing
         to the thing that caused the failure.*

         The lens comes back on `pause` and on `closeZone` — the two moments a person asked for it.
        */
        hideArPreview?()
        onEvent?([
            "zoneFailed": error.localizedDescription,
            // `sensorFailed` is transient often enough that a retry is a real answer, and the
            // caller needs to know which kind of dead this is.
            "recoverable": (error as NSError).code == ARError.sensorFailed.rawValue
        ])
    }

    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        HSZoneLog.record("tracking", ["state": HSArProbe.describe(camera.trackingState)])
        onEvent?(["tracking": HSArProbe.describe(camera.trackingState)])
    }
}

@available(iOS 17.0, *)
extension HSZoneSession: RoomCaptureSessionDelegate {
    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        /* ⛑ **Both ends of the build recorded, because the 2026-09-05 walk lost a plan between
           them and the log could not say where.** `roomPlanStopping` was the last RoomPlan line
           ever written: 4 walls, 3 doors and 1 window scanned, then nothing. ⚑ *A delegate that
           never fires and a builder that never returns are indistinguishable without these two
           lines*, and they are the difference between a diagnosis and another walk. */
        HSZoneLog.record("roomDidEnd", ["error": error?.localizedDescription ?? ""])
        if let error {
            roomError = error.localizedDescription
            deliverRoom(["captured": false, "why": error.localizedDescription])
            return
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                HSZoneLog.record("roomBuilding")
                let room = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                HSZoneLog.record("roomBuilt", ["walls": room.walls.count])
                self.capturedRoom = room
                self.deliverRoom(Self.describe(room, zoneId: self.zoneId, originEpoch: self.originEpoch, originId: self.originId))
            } catch {
                self.roomError = error.localizedDescription
                self.deliverRoom(["captured": false, "why": error.localizedDescription])
            }
        }
    }

    /**
     ⛑ **Live feedback, because a scan that looks like an ordinary viewfinder gives none.**

     RoomPlan reports what it has found and what the person should do about it, and the first cut
     ignored both — so the concierge saw a normal-looking picture, walked, pressed Finish, and had
     no way to know whether anything had been happening. ⚑ *Apple's coaching text is the only thing
     in this app that knows the scan is going badly*, and passing it through costs nothing.
     */
    func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        roomProgress = [
            "walls": room.walls.count,
            "doors": room.doors.count,
            "windows": room.windows.count,
            "openings": room.openings.count
        ]
        HSZoneLog.record("roomProgress", roomProgress)
        onEvent?(["roomProgress": roomProgress])

        /* ⚑ **The geometry, live, and not only the counts.**
         *
         * A count going 4 → 5 cannot show a missed wall; an outline with a gap in it can, and the
         * concierge is still standing in the room where that is three steps to fix. The same
         * description the finished plan uses is sent while the scan runs, so one drawing serves
         * both — the live one being the only version that can still change anything.
         *
         * ⛑ Throttled to twice a second: `didUpdate` fires far faster than a person can look, and a
         * full room description at that rate is work spent redrawing a picture nobody read. */
        guard Date().timeIntervalSince(lastPlanAt) > 0.5 else { return }
        lastPlanAt = Date()
        onEvent?(["roomShape": Self.describe(room, zoneId: zoneId, originEpoch: originEpoch, originId: originId)])
    }

    func captureSession(_ session: RoomCaptureSession,
                        didProvide instruction: RoomCaptureSession.Instruction) {
        HSZoneLog.record("roomInstruction", ["text": "\(instruction)"])
        onEvent?(["roomInstruction": "\(instruction)"])
    }
}

/**
 ⚑ **What the lens was aimed at — measured, and the record says by what. One place, both doors.**

 ⛑ *Field 2026-09-06, zone "Bedroom 4", and the arithmetic is the whole finding.* Two photographs of
 one table lamp, two minutes apart, one unbroken session, the same `originEpoch`:

 ```
 camera moved   dx=+0.352  dy=-0.658  dz=+0.195   0.771 m
 surface moved  dx=+0.537  dy=-0.683  dz=+0.253   0.905 m
 per-axis ratio surface/camera:  x 1.53   y 1.04   z 1.30
 ```

 **All near 1, none near 0.** A ray ending on the same physical object barely moves when the observer
 does — the ratio would be ~0. **The surface was tracking the observer**, and the standoff the desk
 ranks on barely changed: 0.867 → 0.936 m.

 Both capture doors asked for `allowing: .estimatedPlane`, which does not *hit* anything: ARKit fits
 a plane to the feature points **around this ray at this instant**, so the answer is a function of
 where somebody stood. A lamp is ~0.15 m across; the fit found the big background behind it. ⚑ **And
 that generalises to everything this app photographs — a valve, a nameplate, a shutoff, a water
 heater. Planes miss precisely the objects that matter.**

 ⚑ **No `allowing:` value fixes it, because it is the type.** `ARRaycastTarget` declares exactly
 three cases and all three are planes (`ARRaycastQuery.h`): existing-plane-geometry,
 existing-plane-infinite, estimated-plane. There is no mesh target and no depth target. So this file
 asks the two instruments that *measure* a surface instead, **in the order of what can contain the
 object**:

 | rung | what it is | when it answers |
 |---|---|---|
 | `sceneDepth` | the LiDAR's own distance at the pixel on the optical axis | almost always |
 | `mesh` | nearest triangle of the reconstructed scene along the same ray | where depth cannot see |
 | *(refused)* | — | glass, mirrors, chrome, past reach, a mesh with a hole on the axis |

 ⚑ **Depth first, because it measures the nearest thing at that pixel whether or not reconstruction
 kept it.** ARKit's mesh is coarse on thin geometry: the lamp may not be in it at all, and then the
 nearest triangle on the axis is *the wall behind the lamp* — stable, joinable, diagnosable, and
 still not the lamp. **Nearest surface along the ray is the requirement**; the mesh answers *nearest
 reconstructed surface*, which is a different question that happens to agree in most rooms. The mesh
 rung therefore runs **only where depth refused**, so a mistake in it can only reach captures that
 would otherwise carry no surface at all.

 ⛑ **And a guess is not reported at all.** The desk places with no human in the loop and ranks
 candidate frames by `surface.distance`, closest wins — so a plausible number under that key is a
 confident wrong placement nobody downstream catches, and a label beside it is a label a reader can
 forget. Absent already reads *unknown, never nothing there*, and every consumer treats the field as
 optional. **An honest orphan beats false continuity.** The refusal names itself in the zone log,
 which is where a diagnosis belongs and where a bare `surface: true/false` could never carry one.
 */
enum HSSurface {

    /// ⛑ Past this the ray has gone through a doorway or a hole in the mesh, and either way it is
    /// not the thing being photographed. The design's own plausibility bound, applied to every rung
    /// so one source cannot answer where another would be refused.
    static let reach: Float = 8
    /// Nearer than this is a hand, a sleeve or the concierge's own arm — LiDAR sees them and the
    /// mesh sometimes reconstructs them. Never the subject.
    static let near: Float = 0.05
    /// A stall guard on the mesh rung, not a filter — and **recorded when it fires**, so a room that
    /// hits it is visible rather than quietly under-searched.
    static let triangleBudget = 400_000

    /// ARKit's own words for a face, in `ARMeshClassification` order (`ARMeshGeometry.h`).
    private static let classes = ["none", "wall", "floor", "ceiling", "table", "seat", "window", "door"]

    /**
     One answer, and **the only thing that decides whether it is fit to export.**

     ⚑ *The refusal lives on the value rather than in the callers.* A rule kept in two callers holds
     until somebody writes the third — the same finding as `finishScan`, the roomWaiter,
     `reclaimCamera` and `showArPreview`, and this is the fifth time this file has paid for it.
     */
    struct Hit {
        enum Source: String {
            /// The still's own depth map.
            case depth = "sceneDepth"
            /// The live frame's depth map, unprojected through **its own** pose and intrinsics.
            case depthStream = "sceneDepth.stream"
            /// A triangle of the reconstructed scene.
            case mesh
            /// Nothing measured. There is no fourth case, and that is the point.
            case none

            var measured: Bool { self != .none }
        }

        var source: Source = .none
        var point: SIMD3<Float>? = nil
        var distance: Float = 0
        // The depth rungs' own witnesses: how sure ARKit was, and whether the sampled patch
        // straddled an edge.
        var confidence: String? = nil
        var spreadM: Float? = nil
        var samples: Int? = nil
        // The mesh rung's: which block stopped the ray, and ARKit's word for the face.
        var anchor: String? = nil
        var kind: String? = nil
        /* ⚑ **Computed either way; spoken only when there is something to say.** A diagnostic
           decides whether there is a problem before it describes one — `summarize()` in
           `src/dev/writeBench.ts` is the worked example, and it is the one that got this wrong
           first. So `surfaceMs` always ships (a measurement stays comparable across runs) and the
           `why` strings ship only on a rung that failed. */
        var depthWhy = ""
        var meshWhy = ""
        var meshFrom: String? = nil
        var triangles = 0
        var budgetHit = false
        var ms: Double = 0

        /**
         The manifest payload — **present only when something measured.**

         ⛑ No estimate, no plane fit, no fallback shape lives under this key. It is read at the desk
         without asking where it came from, so anything admitted here is consumed as a measurement
         by construction.
         */
        var payload: [String: Any]? {
            guard source.measured, let point else { return nil }
            var out: [String: Any] = [
                "x": Double(point.x), "y": Double(point.y), "z": Double(point.z),
                "distance": Double(distance),
                /* ⚑ Which source answered, and it is the field that dates a row. An export from
                   before this change carries the same four numbers from a plane ARKit invented,
                   with no way to tell — and the desk holds exports from both builds. */
                "source": source.rawValue,
            ]
            if let confidence { out["confidence"] = confidence }
            if let spreadM { out["spreadM"] = Double(spreadM) }
            if let samples { out["samples"] = samples }
            // The same `uuidString` `harvestMesh` writes as `pieces[].id`, so a hit joins to the
            // block it hit.
            if let anchor { out["anchor"] = anchor }
            if let kind { out["kind"] = kind }
            return out
        }

        /// What went into the answer, for the zone log.
        var log: [String: Any] {
            // ⛑ A word, never a boolean. `surface: true` was the answer on 96% of frames while every
            // one of them was invented — a log that cannot tell a guess from a measurement cannot
            // report this defect, and for four weeks it did not.
            var out: [String: Any] = ["surface": source.rawValue, "surfaceMs": ms]
            if source.measured {
                out["surfaceM"] = Double(distance)
                if let confidence { out["surfaceConfidence"] = confidence }
                if let spreadM { out["surfaceSpreadM"] = Double(spreadM) }
                if let kind { out["surfaceKind"] = kind }
            }
            if !depthWhy.isEmpty { out["depthWhy"] = depthWhy }
            if !meshWhy.isEmpty { out["meshWhy"] = meshWhy }
            if let meshFrom { out["meshFrom"] = meshFrom }
            if triangles > 0 { out["meshTriangles"] = triangles }
            if budgetHit { out["meshBudgetHit"] = true }
            return out
        }
    }

    /// A depth read on the axis, before it becomes a point.
    struct Depth {
        let metres: Float
        let confidence: String
        let spreadM: Float
        let samples: Int
    }

    /// The mesh rung's answer, hit or miss, with what it cost.
    struct MeshAnswer {
        let point: SIMD3<Float>?
        let t: Float
        let anchor: String?
        let kind: String?
        let why: String
        let triangles: Int
        let budgetHit: Bool
    }

    /**
     **The ladder — the one function both capture doors ask.**

     `live` is the session's current frame, used for two different fallbacks and for nothing else:
     ⚑ **whether the out-of-band still carries a depth map or a mesh anchor list is a device question
     a header cannot answer, and I did not measure it.** Taking an empty answer at face value would
     silently retire `surface` from every photograph — *which is the failure this whole change exists
     to end* — so both fall back and the log says which was used (`sceneDepth.stream`, `meshFrom`).
     One ordinary walk settles it.
     */
    static func ahead(of frame: ARFrame, live: ARFrame?) -> Hit {
        let began = CACurrentMediaTime()
        var hit = Hit()
        var refusals: [String] = []

        let (own, ownWhy) = depthOnAxis(frame)
        if let own {
            hit = fromDepth(own, frame: frame, source: .depth)
        } else {
            refusals.append("still \(ownWhy)")
            /* ⛑ **The live frame's depth is unprojected through the LIVE frame's own pose and its
               own intrinsics**, never the still's. A depth read is camera-relative; run it through a
               different frame's pose and the world point is a measurement of nowhere. The two frames
               are a hand-motion apart, the world point is still the world point of the surface, and
               `source` says which instant it was measured in. */
            if let live, live !== frame {
                let (streamed, streamWhy) = depthOnAxis(live)
                if let streamed {
                    hit = fromDepth(streamed, frame: live, source: .depthStream)
                } else {
                    refusals.append("live \(streamWhy)")
                }
            }
        }

        if !hit.source.measured {
            /* ⚑ Mesh anchors are **world-anchored objects**, so which frame's list they came from
               changes nothing about where they are — which is why this fallback is safe where the
               depth one needed a pose to travel with it. The ray still starts at the photograph's
               own pose. */
            let ownAnchors = frame.anchors.compactMap { $0 as? ARMeshAnchor }
            let anchors = ownAnchors.isEmpty
                ? (live?.anchors ?? []).compactMap { $0 as? ARMeshAnchor }
                : ownAnchors
            hit.meshFrom = ownAnchors.isEmpty ? "live" : "still"
            let t = frame.camera.transform
            let p = t.columns.3
            let ray = meshOnAxis(origin: SIMD3<Float>(p.x, p.y, p.z),
                                 direction: SIMD3<Float>(-t.columns.2.x, -t.columns.2.y, -t.columns.2.z),
                                 anchors: anchors)
            hit.triangles = ray.triangles
            hit.budgetHit = ray.budgetHit
            hit.meshWhy = ray.why
            if let point = ray.point {
                hit.source = .mesh
                hit.point = point
                hit.distance = ray.t
                hit.anchor = ray.anchor
                hit.kind = ray.kind
            }
        }

        hit.depthWhy = refusals.joined(separator: "; ")
        hit.ms = (CACurrentMediaTime() - began) * 1000
        return hit
    }

    /// The point, assembled once, so the two depth rungs cannot describe it differently.
    private static func fromDepth(_ read: Depth, frame: ARFrame, source: Hit.Source) -> Hit {
        let t = frame.camera.transform
        let p = t.columns.3
        let origin = SIMD3<Float>(p.x, p.y, p.z)
        let dir = simd_normalize(SIMD3<Float>(-t.columns.2.x, -t.columns.2.y, -t.columns.2.z))
        return Hit(source: source, point: origin + dir * read.metres,
                   // ⚑ On the axis the depth **is** the standoff. No distance to compute and none to
                   // get wrong.
                   distance: read.metres, confidence: read.confidence,
                   spreadM: read.spreadM, samples: read.samples)
    }

    /**
     ⚑ **The depth on the optical axis, in metres, or the reason there is none.**

     **Read on the axis, and that is what makes it both cheap and safe.** At the principal point the
     unprojection collapses to `origin + depth · (−Z)`: no pixel-to-sensor mapping, so it inherits
     the immunity the shutter's own comment already claims against the intrinsics misregistration
     between the streaming format and the high-resolution still. ⛑ *And the
     perpendicular-versus-radial question every depth map raises **cannot arise here**, because on
     the axis the two are the same number.* The intrinsics are used only to say **which pixel** is on
     the axis — a normalised coordinate carries between a 256×192 depth map and a 4032×3024 still
     over the same field of view, and the principal point is the one coordinate a difference in crop
     cannot move, because it is the centre of both.

     ⛑ **A patch, and the NEAR cluster of it — that choice is the defect itself in miniature.** A
     window straddling a lamp and the wall a metre behind it holds two populations, and a plain
     median or a mean picks whichever holds more pixels, **which is exactly how the plane fit got it
     wrong.** So the near decile anchors the answer and a 5 cm / 5% band decides which samples are
     the *same* surface. The band is sensor noise, never the size of an object: which surface wins is
     already settled — the near one.

     Formats are read rather than assumed, the discipline `harvestMesh` applies to the mesh buffers
     and for the same reason: an assumption that holds works until an OS release, and this one would
     fail silently by metres.
     */
    static func depthOnAxis(_ frame: ARFrame) -> (Depth?, String) {
        guard let depth = frame.sceneDepth else { return (nil, "no depth on the frame") }
        let map = depth.depthMap
        guard CVPixelBufferGetPixelFormatType(map) == kCVPixelFormatType_DepthFloat32 else {
            return (nil, "depth format \(CVPixelBufferGetPixelFormatType(map))")
        }
        CVPixelBufferLockBaseAddress(map, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
        let width = CVPixelBufferGetWidth(map), height = CVPixelBufferGetHeight(map)
        guard width > 0, height > 0, let base = CVPixelBufferGetBaseAddress(map) else {
            return (nil, "depth unreadable")
        }
        let rowBytes = CVPixelBufferGetBytesPerRow(map)

        /* Nullable in the API and treated as such: without it every sample is taken and the record
           says `unrated`, which is a different claim from `high` and has to stay a different one. */
        let rated: CVPixelBuffer? = {
            guard let c = depth.confidenceMap,
                  CVPixelBufferGetPixelFormatType(c) == kCVPixelFormatType_OneComponent8,
                  CVPixelBufferGetWidth(c) == width, CVPixelBufferGetHeight(c) == height else { return nil }
            return c
        }()
        if let rated { CVPixelBufferLockBaseAddress(rated, .readOnly) }
        defer { if let rated { CVPixelBufferUnlockBaseAddress(rated, .readOnly) } }
        let confBase = rated.flatMap { CVPixelBufferGetBaseAddress($0) }
        let confRow = rated.map { CVPixelBufferGetBytesPerRow($0) } ?? 0

        let k = frame.camera.intrinsics
        let res = frame.camera.imageResolution
        let px = min(max(Int(Double(k.columns.2.x) / Double(res.width) * Double(width)), 0), width - 1)
        let py = min(max(Int(Double(k.columns.2.y) / Double(res.height) * Double(height)), 0), height - 1)
        /* About 2% of the frame across — roughly 5 cm at a metre on this iPad's 256×192 map, which is
           inside a nameplate and inside a lamp. Derived from the buffer so a different depth
           resolution keeps the same angular size rather than the same pixel count. */
        let half = max(1, width / 50)

        func gather(_ floorLevel: Int) -> [Float] {
            var out: [Float] = []
            out.reserveCapacity((2 * half + 1) * (2 * half + 1))
            for y in (py - half)...(py + half) where y >= 0 && y < height {
                let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float.self)
                let conf = confBase?.advanced(by: y * confRow).assumingMemoryBound(to: UInt8.self)
                for x in (px - half)...(px + half) where x >= 0 && x < width {
                    if let conf, Int(conf[x]) < floorLevel { continue }
                    let d = row[x]
                    // LiDAR reports 0 where it has nothing, and noise past its range.
                    guard d.isFinite, d > near, d < reach else { continue }
                    out.append(d)
                }
            }
            return out
        }

        /* ⚑ **High first, and medium only where high had too little to say.** A single threshold
           either refuses every dark or glossy object or accepts the low-confidence pixels that are
           wrong by metres. An eighth of the window is the floor, and the word travels with the
           answer either way, so the desk is never left inferring which it got. */
        let window = (2 * half + 1) * (2 * half + 1)
        let floorCount = max(8, window / 8)
        var word = confBase == nil ? "unrated" : "high"
        var values = gather(ARConfidenceLevel.high.rawValue)
        if values.count < floorCount, confBase != nil {
            word = "medium"
            values = gather(ARConfidenceLevel.medium.rawValue)
        }
        guard values.count >= floorCount else {
            return (nil, "depth thin (\(values.count) of \(window))")
        }

        values.sort()
        let nearest = values[values.count / 10]
        let farthest = values[min(values.count - 1, (values.count * 9) / 10)]
        /* The near decile rather than the minimum, so one stray near pixel cannot set it — a decile
           of a hundred-odd samples is a dozen deep. */
        let band = max(Float(0.05), nearest * 0.05)
        let cluster = values.filter { $0 <= nearest + band }
        return (Depth(metres: cluster[cluster.count / 2], confidence: word,
                      // p90 − p10 over the confident samples: centimetres means one surface filled
                      // the window, a metre means it straddled an edge and that frame is worth less.
                      spreadM: farthest - nearest, samples: values.count), "")
    }

    /**
     ⚑ **The nearest triangle of the reconstructed scene along the ray**, or an honest miss.

     ARKit cannot do this — every `ARRaycastTarget` is a plane — so the intersection is done here by
     hand, against the geometry `sceneReconstruction = .mesh` has been accumulating in every
     non-RoomPlan mode since the continuous-session change and **which nothing ever queried.**

     **Nearest anchors first, then a box, then triangles**, which is what keeps this affordable.
     ARKit's mesh anchors are roughly metre-sized blocks; a ray crosses a handful of the two dozen in
     a room and every other block dies on six compares. The box test takes the best hit so far as its
     far bound, so once something close is found the rest of the room stops being triangles at all.
     *`renderArPreview` already sorts by anchor distance for the same reason.* Visiting order changes
     the cost, never the answer.

     ⛑ **The ray goes into the block's frame; the geometry never comes out of it.** One 4×4 inverse
     against several thousand triangles — and because the local ray is the exact preimage of the
     world ray, `t` is the **same parameter in both frames**, already in world metres, which is why
     the local direction is transformed and deliberately **not** re-normalised.
     */
    static func meshOnAxis(origin: SIMD3<Float>, direction: SIMD3<Float>,
                           anchors: [ARMeshAnchor]) -> MeshAnswer {
        var triangles = 0
        var budgetHit = false
        var sawGeometry = false
        var boxesCrossed = 0
        var best = reach
        var bestAnchor: ARMeshAnchor?
        var bestFace = -1

        func answer(_ why: String, _ dir: SIMD3<Float>) -> MeshAnswer {
            guard let winner = bestAnchor else {
                return MeshAnswer(point: nil, t: 0, anchor: nil, kind: nil,
                                  why: why, triangles: triangles, budgetHit: budgetHit)
            }
            return MeshAnswer(point: origin + dir * best, t: best,
                              anchor: winner.identifier.uuidString, kind: word(winner, face: bestFace),
                              why: "", triangles: triangles, budgetHit: budgetHit)
        }

        let length = simd_length(direction)
        guard length > 0 else { return answer("no direction", direction) }
        // Normalised in WORLD space and never again — see the note on `t` above.
        let dir = direction / length
        guard !anchors.isEmpty else { return answer("no mesh anchors", dir) }

        let ordered = anchors.sorted {
            let a = $0.transform.columns.3, b = $1.transform.columns.3
            return simd_distance(origin, SIMD3<Float>(a.x, a.y, a.z))
                 < simd_distance(origin, SIMD3<Float>(b.x, b.y, b.z))
        }

        for anchor in ordered {
            let geometry = anchor.geometry
            let verts = geometry.vertices
            let faces = geometry.faces
            /* `indexCountPerPrimitive` is READ rather than assumed — the rule `harvestMesh` states
               for the same buffers, because layout is ARKit's to change. A line primitive has no
               interior to hit and is skipped rather than misread. */
            guard verts.count > 0, faces.count > 0, faces.indexCountPerPrimitive == 3 else { continue }
            sawGeometry = true
            // Checked per anchor rather than per triangle: this is a stall guard, not a filter.
            if triangles >= triangleBudget { budgetHit = true; break }

            let inverse = simd_inverse(anchor.transform)
            let o4 = inverse * SIMD4<Float>(origin.x, origin.y, origin.z, 1)
            let d4 = inverse * SIMD4<Float>(dir.x, dir.y, dir.z, 0)
            let localOrigin = SIMD3<Float>(o4.x, o4.y, o4.z)
            let localDir = SIMD3<Float>(d4.x, d4.y, d4.z)

            /* Vertices through the source's own `offset` and `stride`, as a `(Float, Float, Float)`
               — the same twelve-byte reading `harvestMesh` uses. ⛑ `renderArPreview` reads these
               same buffers as `SIMD3<Float>`, which is sixteen bytes against a twelve-byte source;
               that is a latent over-read worth its own change, and burying an unrelated crash risk
               in the patch the field has to trust to diagnose this one would be the wrong trade.
               This reader agrees with `harvestMesh`, so the count of interpretations stays at two. */
            let vertexBase = verts.buffer.contents().advanced(by: verts.offset)
            let vertexStride = verts.stride
            func vertex(_ i: Int) -> SIMD3<Float> {
                let p = vertexBase.advanced(by: vertexStride * i)
                    .assumingMemoryBound(to: (Float, Float, Float).self).pointee
                return SIMD3<Float>(p.0, p.1, p.2)
            }

            // One cheap pass for the block's box, in its own frame. Min/max on three floats is a
            // fraction of a triangle test, and it is what buys the right to skip the triangle pass.
            var low = SIMD3<Float>(repeating: .greatestFiniteMagnitude)
            var high = SIMD3<Float>(repeating: -.greatestFiniteMagnitude)
            for i in 0..<verts.count {
                let v = vertex(i)
                low = simd_min(low, v)
                high = simd_max(high, v)
            }
            guard crosses(from: localOrigin, along: localDir,
                          low: low, high: high, from: near, to: best) else { continue }
            boxesCrossed += 1

            let indexBase = faces.buffer.contents()
            let indexWidth = faces.bytesPerIndex
            /* ⛑ `bytesPerIndex` is honoured rather than assumed 4. The header says the width is the
               buffer's to state; a 16-bit buffer read as 32-bit is not an error and not a crash, it
               is **a room made of the wrong triangles**. */
            func corner(_ i: Int) -> Int {
                let p = indexBase.advanced(by: i * indexWidth)
                return indexWidth == 2
                    ? Int(p.assumingMemoryBound(to: UInt16.self).pointee)
                    : Int(p.assumingMemoryBound(to: UInt32.self).pointee)
            }

            for face in 0..<faces.count {
                let i0 = corner(face * 3), i1 = corner(face * 3 + 1), i2 = corner(face * 3 + 2)
                guard i0 < verts.count, i1 < verts.count, i2 < verts.count else { continue }
                let v0 = vertex(i0), v1 = vertex(i1), v2 = vertex(i2)
                /* Möller–Trumbore, **with backfaces accepted.** ARKit promises no consistent winding
                   toward the observer, and *nearest surface along the ray* is the requirement — a
                   culled backface is a hole invented by arithmetic. */
                let edge1 = v1 - v0, edge2 = v2 - v0
                let h = simd_cross(localDir, edge2)
                let det = simd_dot(edge1, h)
                if abs(det) < 1e-9 { continue }   // the ray lies in the triangle's plane
                let invDet = 1 / det
                let s = localOrigin - v0
                let u = invDet * simd_dot(s, h)
                if u < 0 || u > 1 { continue }
                let q = simd_cross(s, edge1)
                let v = invDet * simd_dot(localDir, q)
                if v < 0 || u + v > 1 { continue }
                let hitT = invDet * simd_dot(edge2, q)
                if hitT > near, hitT < best {
                    best = hitT
                    bestAnchor = anchor
                    bestFace = face
                }
            }
            triangles += faces.count
        }

        if bestAnchor != nil { return answer("", dir) }
        /* ⚑ Four different misses, and the log says which. *"The mesh had no answer"* is not one
           fact: an empty session is a room nobody walked, a hole on the axis is a surface the LiDAR
           never saw, and a bound overrun is a ray that left the building. They need different
           fixes, and the bare boolean this replaces collapsed all of them into one. */
        return answer(!sawGeometry ? "no triangle mesh"
                      : boxesCrossed == 0 ? "no mesh block on the axis"
                      : "no triangle on the axis inside \(Int(reach)) m", dir)
    }

    /// Ray against an axis-aligned box, in the box's own frame — six compares and no square roots.
    /// This is why a room of a quarter-million triangles is not a quarter-million triangle tests.
    private static func crosses(from o: SIMD3<Float>, along d: SIMD3<Float>,
                                low: SIMD3<Float>, high: SIMD3<Float>,
                                from tMin: Float, to tMax: Float) -> Bool {
        var nearT = tMin, farT = tMax
        for k in 0..<3 {
            /* ⛑ Handled rather than divided: an axis-parallel ray gives an infinite slope, `0 × ∞`
               is NaN, and NaN compares false against everything — silently rejecting the block the
               concierge is standing square in front of. */
            if abs(d[k]) < 1e-8 {
                if o[k] < low[k] || o[k] > high[k] { return false }
                continue
            }
            let inv = 1 / d[k]
            var a = (low[k] - o[k]) * inv
            var b = (high[k] - o[k]) * inv
            if a > b { swap(&a, &b) }
            nearT = max(nearT, a)
            farT = min(farT, b)
            if nearT > farT { return false }
        }
        return true
    }

    /**
     ARKit's classification of one face, read as one byte for one face — never a whole buffer.

     ⛑ **It labels the surface the ray terminated on, never the subject of the photograph** — and it
     is the cheapest miss-detector available: `kind: "wall"` on a water-heater shot *is* the ray
     landing behind the thing, legible at the desk without another walk.

     ⚑ **And it is `nil` today, deliberately.** `ARMeshGeometry.classification` is nullable and is
     populated only under `ARSceneReconstructionMeshWithClassification`; `enter` asks for `.mesh`.
     The one-line change that populates it is **not made here**, because Gate 1's 46-minute
     `nominal` / 9%-battery result was measured on `.mesh`, and a reconstruction change re-opens a
     published thermal measurement. That is the same discipline this change applies to
     `HSGateOne`'s CSV column: an instrument is upgraded deliberately, in the run that re-measures
     it, never as a side effect. Absent `kind` reads *unclassified*, which is exactly what it is.
     */
    private static func word(_ anchor: ARMeshAnchor, face: Int) -> String? {
        guard let source = anchor.geometry.classification,
              face >= 0, face < source.count else { return nil }
        let raw = Int(source.buffer.contents()
            .advanced(by: source.offset + source.stride * face)
            .assumingMemoryBound(to: UInt8.self).pointee)
        return classes.indices.contains(raw) ? classes[raw] : nil
    }
}
