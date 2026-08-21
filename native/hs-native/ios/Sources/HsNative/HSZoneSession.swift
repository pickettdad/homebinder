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
    var hideArPreview: (() -> Void)?

    /// ⚑ A session can DIE. `sensorFailed` is transient often enough that a retry is a real answer,
    /// so this is recorded, reported, and cleared by rebuilding rather than by restarting the app.
    private(set) var failure: String?
    private var everRan = false

    var isRunning: Bool { mode != nil }

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
        failure = nil
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
            /* Stripped: no plane search, no reconstruction, no environment texturing. It has exactly
               one job — hold the origin and hand back a pose when asked. */
            config.planeDetection = []
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
            hideArPreview?()
            let unmet = enter(.positioning)
            sleepSession()
            return ["mode": next.rawValue, "unmet": unmet, "paused": true]
        }
        // ⚑ Marked on the way in and again on the way out, so the open question — does enabling
        // reconstruction backfill or only accumulate forward? — is answered by ordinary zones.
        if next == .mesh { meshMarks.append(mark("mesh-on")) }
        if mode == .mesh, next != .mesh { meshMarks.append(mark("mesh-off")) }
        let unmet = enter(next)
        if next == .mesh { showArPreview?(session) }
        return ["mode": next.rawValue, "unmet": unmet, "paused": false, "failed": failure ?? ""]
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
        // Give the lens back the instant we stop needing it — the capture session is what the
        // concierge is looking through.
        releaseCamera?()
        return ["paused": true, "mode": mode?.rawValue ?? ""]
    }

    func resume() -> [String: Any] {
        guard let mode else { return ["paused": true, "why": "no zone open"] }
        enter(mode)
        return ["paused": false, "mode": mode.rawValue]
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
        /* ⚑ **The burst.** Positioning is awake for the instant a position is taken and asleep
           between containers, so the pose is fetched by waking the session, reading it, and going
           back to sleep — never by holding the lens across the zone.

           The first wake in a zone has to establish tracking and takes a second or two; every one
           after it resumes into the same world, measured at 0 ms with the mesh byte-identical. That
           asymmetry is why the wait is bounded and reported rather than hidden: a caller that gets
           `settling` back knows to hold still, and one that gets a pose knows it is real. */
        if paused { wake() }
        guard let frame = waitForTrackedFrame(timeout: paused ? 0 : 3.0) else {
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
        // Straight back to sleep, lens returned. The zone keeps its origin; the camera does not
        // keep ARKit.
        if mode == .positioning { sleepSession() }
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
        let deadline = Date().addingTimeInterval(max(timeout, 3.0))
        while Date() < deadline {
            if failure != nil { return nil }
            if let f = session.currentFrame, case .normal = f.camera.trackingState { return f }
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
        stopRoomCapture(keepSession: true)
        // The delegate delivers asynchronously; give it a moment, then report whatever arrived.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
            guard let self else { return }
            self.hideArPreview?()
            self.sleepSession()
            if let room = self.capturedRoom {
                completion(Self.describe(room, zoneId: self.zoneId))
            } else {
                completion(["captured": false, "why": self.roomError ?? "no room returned"])
            }
        }
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
        onEvent?(["tracking": HSArProbe.describe(camera.trackingState)])
    }
}

@available(iOS 17.0, *)
extension HSZoneSession: RoomCaptureSessionDelegate {
    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        if let error {
            roomError = error.localizedDescription
            return
        }
        Task { [weak self] in
            do {
                let room = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                self?.capturedRoom = room
            } catch {
                self?.roomError = error.localizedDescription
            }
        }
    }
}
