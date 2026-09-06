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

               ⛑ **Reconstruction is now ON here, and that reverses the note this comment used to
               carry.** It said reconstruction was *the expensive half and the mesh mode's job* —
               measured on 2026-09-04 and it is not: a full 46-minute run with reconstruction, a
               high-resolution format and a still every fifteen seconds held `thermalState` at
               **`nominal` for all 5,520 samples**, never dropped a frame from 24 fps, and used
               **9% of the battery against the sleeping build's 17%.**

               ⚑ **And the mesh is what the ray-cast should hit.** A plane is a guess at a surface;
               the mesh *is* the surface, and the desk's own process says so — *"where a mesh covers a
               confirmed container, prefer it for position and extent."* */
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
        failure = nil
        /* ⚑ Counted here, at the one place a session is (re)started. Every entry to this line is a
           re-establishment of tracking — the walk of 2026-08-30 reached this 111 times in five
           zones, and ARKit reported `initializing` on 109 of them and `relocalizing` on none. */
        reinitCount += 1
        lastInitAt = Date()
        HSZoneLog.record("enter", [
            "mode": next.rawValue, "reset": mustReset, "unmet": unmet, "reinits": reinitCount,
        ])
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
            return ["anchors": 0, "faces": 0, "zoneId": zoneId, "why": "nothing was meshed"]
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
            for i in 0..<(fb.count * perFace) {
                idx.append(Int(fb.buffer.contents()
                    .advanced(by: i * fb.bytesPerIndex)
                    .assumingMemoryBound(to: UInt32.self).pointee))
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

            /* ⚑ On-axis ray from THIS frame's transform. The optical axis is the one ray that needs
               no pixel-to-sensor mapping, so it is immune to the intrinsics misregistration reported
               between the stream and the high-resolution frame on some iPad generations. */
            let origin = SIMD3<Float>(p.x, p.y, p.z)
            let dir = SIMD3<Float>(-t.columns.2.x, -t.columns.2.y, -t.columns.2.z)
            var surface: [String: Any]? = nil
            if let hit = self.session.raycast(
                ARRaycastQuery(origin: origin, direction: dir, allowing: .estimatedPlane, alignment: .any)
            ).first {
                let q = hit.worldTransform.columns.3
                surface = ["x": Double(q.x), "y": Double(q.y), "z": Double(q.z),
                           "distance": Double(simd_distance(origin, SIMD3<Float>(q.x, q.y, q.z)))]
            }

            var position: [String: Any] = [
                "positioned": true, "zoneId": self.zoneId, "tracking": tracking,
                "at": ISO8601DateFormatter().string(from: Date()),
                "x": Double(p.x), "y": Double(p.y), "z": Double(p.z),
                "transform": (0..<4).flatMap { c in (0..<4).map { r in Double(t[c][r]) } },
                "mapping": mapping, "reinits": self.reinitCount,
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
            if let surface { position["surface"] = surface }

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
                    "torch": false, "lens": "normal",
                ]
                if wantsText, let read = CameraController.readAccurately(jpeg: jpeg) { entry["ocr"] = read }
                HSZoneLog.record("stillThroughArkit", [
                    "ms": ms, "bytes": jpeg.count, "mapping": mapping, "tracking": tracking,
                    "w": w, "h": h,
                    "surface": surface != nil,
                ])
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
        /* Measured against the pose held at `sleepSession`, before anything else moves. */
        let resumeJump: Float? = sleptAt.map { simd_distance($0, SIMD3<Float>(p.x, p.y, p.z)) }
        var out: [String: Any] = [
            "positioned": true,
            "zoneId": zoneId,
            "tracking": state,
            // ⚑ The three that let a desk age a pose. See the comments above and on `reinitCount`.
            "mapping": mapping,
            "reinits": reinitCount,
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
            /*
             ⚑ **The one measurement that observes the failure directly, at the instant it happens.**

             *Where the session went to sleep, against where it thinks it woke up.* Everything else
             on this pose — `mapping`, `reinits`, `sinceInitSec` — **describes conditions**. This
             one is the discontinuity itself: the concierge does not teleport, so a large
             `resumeJumpM` over a short `sleepSec` is the estimate moving, not the person.

             ⛑ **Recorded because my own diagnosis was wrong and could not be tested.** I read
             *zero `relocalizing` in 109 wakes* as evidence the wake was rebuilding the world —
             and it is a **tautology**: `initialWorldMap` and `sessionShouldAttemptRelocalization`
             appear nowhere in this plugin, so relocalisation was never possible to observe. *I
             diagnosed one forced-constant field and built a conclusion on a second one in the same
             message.* And `HSArProbe` had already measured this exact cycle: **origin moved
             0.00003 m and the mesh came back byte-identical.** A wake that rebuilt the world could
             not do that.

             So the wake is not the mechanism, and **the mechanism is now something a number can
             settle rather than an argument.** The leading candidate is genuine VIO drift in a
             degenerate room — positioning is the one mode that runs with `sceneReconstruction = []`,
             so it is the one mode without the LiDAR that would disambiguate repeating parallel
             pipes at 0.3–0.6 m.
            */
            "resumeJumpM": resumeJump.map { Double($0) } as Any,
            "sleepSec": sleptWhen.map { Date().timeIntervalSince($0) } as Any,
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

    /** Where the camera was when the session went to sleep. See `resumeJump` — this is half of the
     *  only measurement that observes the failure directly. */
    private var sleptAt: SIMD3<Float>?
    private var sleptWhen: Date?

    /**
     ⛑ **Only `pause()` and `closeZone()` reach this now.**
     *A zone that is open keeps its session running* — see `position()` for the measurements that
     made that the design rather than an option.
     */
    private func sleepSession() {
        if let c = session.currentFrame?.camera.transform.columns.3 {
            sleptAt = SIMD3<Float>(c.x, c.y, c.z)
        }
        sleptWhen = Date()
        session.pause()
        paused = true
        releaseCamera?()
    }

    /**
     ⚑ **Try to get the session back without touching the camera.**

     A `sensorFailed` while a zone is open is contention that has usually cleared by the time anyone
     reacts, and the only correct response is *ask ARKit again* — never *give the lens to the thing
     that took it.* ⛑ The old handler did the second, which produced the next `sensorFailed`, five
     times in nine minutes.
     */
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
            _ = self.enter(.positioning)
            self.showArPreview?(self.session)
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
