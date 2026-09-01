import ARKit
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
    private var capturedRoom: CapturedRoom?
    private var roomError: String?
    /// ⛑ The completion the fixed 2.5-second wait was standing in for. See `stopRoomPlan`.
    private var roomWaiter: (([String: Any]) -> Void)?
    /// Live scan feedback — RoomPlan reports both and the first cut ignored both.
    private var roomProgress: [String: Any] = [:]

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
    var onPreviewFrame: ((ARFrame) -> Void)?
    private var lastPreviewAt = Date.distantPast
    private var lastPlanAt = Date.distantPast
    var hideArPreview: (() -> Void)?

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
        case .mesh:
            if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
                config.sceneReconstruction = .mesh
            } else {
                unmet.append("mesh")
            }
            config.planeDetection = [.horizontal, .vertical]
            /* ⚑ The video format is chosen for the STILL, not the tracking. Still resolution follows
               it — 4032×3024 on the hi-res format against 2016×1512 on a low-power one, from the same
               call — so a format picked to lighten tracking quarters the photographs, and a plate is
               the thing being photographed. */
            if #available(iOS 16.0, *),
               let hi = ARWorldTrackingConfiguration.recommendedVideoFormatForHighResolutionFrameCapturing {
                config.videoFormat = hi
            }
        case .positioning:
            /* ⛑ **Plane detection stays ON, and stripping it was a bug I introduced** (zone log,
               2026-08-21: `surface: false` on every position taken).

               The ray-cast needs something to hit. With no plane search and no reconstruction there
               is no geometry in the session at all, so `raycast` returns an empty array every time
               and the pose comes back with no surface — ⚑ **which is the difference between *where
               the concierge stood* and *what they were standing in front of***, and the second is
               the one a measurement needs.

               Reconstruction stays off: that is the expensive half, and it is the mesh mode's job.
               Plane detection is the cheap half and it is what makes a pose worth taking. */
            config.planeDetection = [.horizontal, .vertical]
            config.sceneReconstruction = []
            config.environmentTexturing = .none
            if #available(iOS 16.0, *),
               let hi = ARWorldTrackingConfiguration.recommendedVideoFormatForHighResolutionFrameCapturing {
                config.videoFormat = hi
            }
        }
        /* ⚑ A dead session cannot be revived by `run(config)` — that is what made every mode after
           a failure inherit the corpse and need an app restart. If it has failed, the delegate has
           already cleared `everRan`, and the first run after that resets rather than resumes. */
        let mustReset = reset || !everRan || failure != nil
        failure = nil
        HSZoneLog.record("enter", ["mode": next.rawValue, "reset": mustReset, "unmet": unmet])
        session.run(config, options: mustReset ? [.resetTracking, .removeExistingAnchors] : [])
        everRan = true
        mode = next
        modeStartedAt = Date()
        paused = false
        return unmet
    }

    func setMode(_ next: Mode) -> [String: Any] {
        if mode == .roomplan, next != .roomplan { stopRoomCapture(keepSession: true) }
        // Leaving a scan mode: give the lens and the screen back before anything else happens.
        if next == .positioning {
            /* ⛑ **Finishing the mesh produced nothing, because nothing filed it.** The anchors
               accumulated inside the session and were thrown away with it — the concierge walked a
               room, pressed Finish and got silence. ⚑ The geometry is the deliverable here exactly
               as the frames are for a traverse, so it comes back on the way out. */
            let harvested = mode == .mesh ? harvestMesh() : [:]
            hideArPreview?()
            let unmet = enter(.positioning)
            sleepSession()
            var out: [String: Any] = ["mode": next.rawValue, "unmet": unmet, "paused": true]
            if !harvested.isEmpty { out["mesh"] = harvested }
            return out
        }
        // ⚑ Marked on the way in and again on the way out, so the open question — does enabling
        // reconstruction backfill or only accumulate forward? — is answered by ordinary zones.
        if next == .mesh { meshMarks.append(mark("mesh-on")) }
        if mode == .mesh, next != .mesh { meshMarks.append(mark("mesh-off")) }
        let unmet = enter(next)
        if next == .mesh { showArPreview?(session) }
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
            return ["anchors": 0, "faces": 0, "zoneId": zoneId, "why": "nothing was meshed"]
        }
        var minP = SIMD3<Float>(repeating: .greatestFiniteMagnitude)
        var maxP = SIMD3<Float>(repeating: -.greatestFiniteMagnitude)
        var faces = 0
        var pieces: [[String: Any]] = []
        for a in anchors {
            faces += a.geometry.faces.count
            let t = a.transform.columns.3
            minP = simd_min(minP, SIMD3<Float>(t.x, t.y, t.z))
            maxP = simd_max(maxP, SIMD3<Float>(t.x, t.y, t.z))
            pieces.append([
                "id": a.identifier.uuidString,
                "vertices": a.geometry.vertices.count,
                "faces": a.geometry.faces.count,
                "x": Double(t.x), "y": Double(t.y), "z": Double(t.z),
                "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(a.transform[c][r]) } }
            ])
        }
        return [
            "anchors": anchors.count,
            "faces": faces,
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
        saveWorldMap()
        session.pause()
        paused = true
        armed = false
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
     `surface` carries the ray-cast hit when there is one so the desk has both and can tell them
     apart. *2.3 m from the panel* is defensible; *2,438 mm* is not.
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

           The success path ended with `sleepSession()`. The failure path — tracking not settled in
           time — returned early and skipped it, so ARKit kept the camera and the capture session
           never restarted. ⚑ **A frozen viewfinder was the app telling the truth about a lens
           nobody had given back.** The log said it in two lines: `cameraYielded` with no
           `cameraReclaimed` after it.

           `defer` rather than a call before each `return`, because the reason this happened is that
           one of four exits was easy to miss, and a fifth exit added later would miss it too. */
        let wasAsleep = paused
        if paused { wake() }
        defer { if mode == .positioning { sleepSession() } }
        /* A cold wake has to establish tracking from nothing, which the log shows going
           initializing → normal → insufficientFeatures → normal before it settles. Three seconds was
           inside that, so a perfectly healthy wake reported `settling`. A warm one resumes into the
           same world and answers almost at once, so the two waits are not the same wait. */
        guard let frame = waitForTrackedFrame(timeout: wasAsleep ? 8.0 : 3.0) else {
            return ["positioned": false, "why": failure ?? "settling", "recoverable": true]
        }
        let state = HSArProbe.describe(frame.camera.trackingState)
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
            "mode": mode?.rawValue ?? "",
            "at": ISO8601DateFormatter().string(from: Date()),
            "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
            // The full transform, because a pose without an orientation cannot say which way the
            // camera was facing and the desk needs that to ray-cast for itself later.
            "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(t[c][r]) } }
        ]
        // Where the lens was pointing, hit against whatever geometry exists. Absent is fine and is
        // recorded as absent — a mesh hole reads UNKNOWN, never "nothing there".
        let origin = SIMD3<Float>(p.x, p.y, p.z)
        let direction = -SIMD3<Float>(t.columns.2.x, t.columns.2.y, t.columns.2.z)
        let query = ARRaycastQuery(origin: origin, direction: direction,
                                   allowing: .estimatedPlane, alignment: .any)
        if let hit = session.raycast(query).first {
            let h = hit.worldTransform.columns.3
            out["surface"] = [
                "x": Double(h.x), "y": Double(h.y), "z": Double(h.z),
                "distance": Double(simd_distance(origin, SIMD3<Float>(h.x, h.y, h.z)))
            ]
        }
        // The lens goes back in the `defer` above — on this path and on every other.
        HSZoneLog.record("position", ["ok": true, "tracking": state,
                                      "surface": out["surface"] != nil])
        return out
    }

    /// Wake positioning just long enough to read a pose. Never used by the scan modes, which hold
    /// the lens for their whole bounded job.
    private func wake() {
        enter(.positioning)
    }

    private func sleepSession() {
        session.pause()
        paused = true
        releaseCamera?()
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
    func startRoomPlan() -> [String: Any] {
        guard RoomCaptureSession.isSupported else {
            return ["started": false, "why": "RoomPlan unsupported on this device"]
        }
        guard mode != nil else { return ["started": false, "why": "no zone open"] }
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
            self?.hideArPreview?()
            self?.sleepSession()
            completion(out)
        }
        stopRoomCapture(keepSession: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            guard let self, let waiter = self.roomWaiter else { return }
            self.roomWaiter = nil
            waiter(["captured": false, "why": self.roomError ?? "the scan did not finish in 30 s"])
        }
    }

    private func deliverRoom(_ out: [String: Any]) {
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
    private static func describe(_ room: CapturedRoom, zoneId: String) -> [String: Any] {
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
        // Cheap, and it is the only thing that runs per frame here.
        if mode == .mesh || mode == .roomplan { saveWorldMap() }
        guard onPreviewFrame != nil, mode == .mesh || mode == .roomplan else { return }
        // ~20 fps is a live picture to a walking person and a third of the drawing work.
        guard Date().timeIntervalSince(lastPreviewAt) > 0.05 else { return }
        lastPreviewAt = Date()
        onPreviewFrame?(frame)
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
        everRan = false
        paused = true
        releaseCamera?()
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
        if let error {
            roomError = error.localizedDescription
            deliverRoom(["captured": false, "why": error.localizedDescription])
            return
        }
        Task { [weak self] in
            guard let self else { return }
            do {
                let room = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                self.capturedRoom = room
                self.deliverRoom(Self.describe(room, zoneId: self.zoneId))
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
        onEvent?(["roomShape": Self.describe(room, zoneId: zoneId)])
    }

    func captureSession(_ session: RoomCaptureSession,
                        didProvide instruction: RoomCaptureSession.Instruction) {
        HSZoneLog.record("roomInstruction", ["text": "\(instruction)"])
        onEvent?(["roomInstruction": "\(instruction)"])
    }
}
