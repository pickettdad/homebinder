import ARKit
import AVFoundation
import Capacitor
import CoreImage
import CoreMotion
import Foundation
import SceneKit
import UIKit
import Vision

/**
 The capture camera (F-26).

 ⚑ **A mode declares a goal. The camera measures the scene and finds the settings that reach it.**
 Owner ruling 2026-08-12, and it is the whole shape of this file. An earlier form read "a mode is
 the camera's configuration", which builds a mode that forces a torch into a lit room — and most
 utility rooms built in the last twenty-five years are lit, so a forced torch lays a specular
 hotspot straight across the characters. **A camera that always torches reads worse than one that
 never does.** Every mode below therefore states what it wants, `apply` measures, and `unmet`
 reports what the hardware could not reach rather than silently approximating it.

 The surface is five methods and two listeners. Thermal and battery ride `modeStatus` rather than
 becoming a sixth method: they are status, they are wanted continuously, and a separate poll would
 be a second clock to keep in step.

 What is deliberately NOT here:
 - **No persistence of a device read.** There is nowhere in the manifest for `{text, engine,
   confidence}` to land (Register #163) and where it goes is a cross-repo contract. The live read
   drives auto-capture and the retake trigger in-session; `capture` returns it, and the web layer
   stores none of it.
 - **No pose.** Position needs ARKit/RoomPlan, which is the next step and not this one. `pose` is
   absent rather than fabricated — the declared no-position state the capture contract already
   carries.
 */
@objc(HSCameraPlugin)
public class HSCameraPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HSCameraPlugin"
    public let jsName = "HSCamera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "adjust", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startAudioProbe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAudioProbe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTraverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTraverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "probeAr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startBench", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopBench", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeBenchLoop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setZoneMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePosition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureStill", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "retryZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRoomPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRoomPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "zoneLog", returnType: CAPPluginReturnPromise)
    ]

    /**
     Enumerated once, at load, rather than per camera start.
     ⚑ These are fixed facts about the hardware — which lenses ARKit's world tracking offers, and
     whether the device meshes — so asking them repeatedly implies they might change. Read-only:
     it touches class properties and never starts a session, so it cannot collide with capture.
     */
    override public func load() {
        _ = CameraController.arCapabilitiesLogged
        /* ⚑ A launch-argument probe, so the costing can be taken without a person tapping a
           button in a room. `devicectl device process launch --console -- --hs-ar-probe` runs it
           and the answers arrive in the log as HS-AR-PROBE lines. Dev-only by construction: the
           argument is never passed by a shipped launch, and the same probe sits behind the dev
           bench for a re-run in a real room. */
        /* ⚑ The blank-input test, applied to the INSTRUMENT rather than the measure. Two minutes on
           charge: if the sampler reports drain while the device says it is charging, it is lying and
           every number the three real runs produce is worthless. Thirty seconds of work, and it is
           the reason anyone should believe an afternoon of walking. */
        if CommandLine.arguments.contains("--hs-bench-selftest") {
            let b = HSBench()
            bench = b
            _ = b.start(mode: .control, capSeconds: 120, sampleSeconds: 15, coolSeconds: 0,
                        conditions: ["note": "sampler self-test, on charge"], onSample: { s in
                NSLog("HS-BENCH-SAMPLE %@", String(describing: s))
            })
            DispatchQueue.main.asyncAfter(deadline: .now() + 135) {
                NSLog("HS-BENCH-SELFTEST %@", String(describing: b.stop()))
                self.bench = nil
            }
        }
        if CommandLine.arguments.contains("--hs-plate"), #available(iOS 16.0, *) {
            let p = HSPlateAB()
            plateAB = p
            p.run { _ in self.plateAB = nil }
        }
        if CommandLine.arguments.contains("--hs-gate1"), #available(iOS 16.0, *) {
            let g = HSGateOne()
            gateOne = g
            g.run { _ in self.gateOne = nil }
        }
        if CommandLine.arguments.contains("--hs-gate0"), #available(iOS 16.0, *) {
            let g = HSGateZero()
            gateZero = g
            g.run { _ in self.gateZero = nil }
        }
        if CommandLine.arguments.contains("--hs-control-probe"), #available(iOS 16.0, *) {
            let probe = HSControlProbe()
            controlProbe = probe
            probe.run { _ in self.controlProbe = nil }
        }
        if CommandLine.arguments.contains("--hs-lens-probe"), #available(iOS 16.0, *) {
            let probe = HSLensProbe()
            lensProbe = probe
            probe.run { _ in self.lensProbe = nil }
        }
        if CommandLine.arguments.contains("--hs-ar-probe") {
            let probe = HSArProbe()
            arProbe = probe
            probe.run { result in
                NSLog("HS-AR-PROBE RESULT %@", String(describing: result))
                self.arProbe = nil
            }
        }
    }

    private var controller: CameraController?

    private func ensureController() -> CameraController {
        if let existing = controller { return existing }
        let made = CameraController()
        made.onTextBoxes = { [weak self] payload in self?.notifyListeners("textBoxes", data: payload) }
        made.onStatus = { [weak self] payload in self?.notifyListeners("modeStatus", data: payload) }
        made.onTraverse = { [weak self] payload in self?.notifyListeners("traverse", data: payload) }
        controller = made
        return made
    }

    @objc func start(_ call: CAPPluginCall) {
        let mode = CameraMode(rawValue: call.getString("mode") ?? CameraMode.object.rawValue) ?? .object
        let controller = ensureController()
        DispatchQueue.main.async { [weak self] in
            guard let self, let webView = self.webView else {
                call.reject("No web view to place the preview behind")
                return
            }
            controller.start(mode: mode, behind: webView) { result in
                switch result {
                case .success(let capabilities):
                    call.resolve(["mode": mode.rawValue, "capabilities": capabilities])
                case .failure(let error):
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func setMode(_ call: CAPPluginCall) {
        guard let raw = call.getString("mode"), let mode = CameraMode(rawValue: raw) else {
            call.reject("mode is required and must be one of: object, concern, text, document")
            return
        }
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        // ⚑ Returns the mode ACHIEVED plus what could not be met. The viewfinder frame is painted
        // from this return and never from the button that was tapped: a frame painted from the
        // press is a silent failure with false reassurance stacked on top, and the failure it
        // guards against is twenty plates shot in the wrong mode, every one of which looks fine.
        let achieved = controller.apply(mode: mode)
        call.resolve(["mode": achieved.mode.rawValue, "unmet": achieved.unmet])
    }

    /**
     Choose the glass. ⚑ Resolves with the lens ACHIEVED, never the one asked for — same contract
     as `setMode`, and for the same reason: Text refuses wide, the ultra-wide does not exist on
     every iPad, and a traverse will not swap mid-run. A button painted from the tap would claim a
     field of view the photograph does not have.
     */
    @objc func setLens(_ call: CAPPluginCall) {
        guard let raw = call.getString("lens"), let wanted = CameraLens(rawValue: raw) else {
            call.reject("lens is required and must be one of: normal, wide")
            return
        }
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        let achieved = controller.requestLens(wanted)
        call.resolve(["mode": achieved.mode.rawValue, "lens": controller.currentLens.rawValue,
                      "unmet": achieved.unmet])
    }

    /**
     The shutter-sound probe (owner approval 2026-08-16). **A measurement, not a feature.**

     Whether `AVCapturePhotoOutput`'s shutter click lands inside a live recording decides the shape
     of the run trace, and it is a **device fact** — it varies by region, by iOS version and by
     whether an audio session is active, so it cannot be settled by reading documentation or by
     reasoning about it here. This records for as long as it is left running and hands back a file;
     the answer is whether you can hear the click on playback.

     It lives behind the instruments panel, which is a harness, and nothing in the concierge's path
     calls it.
     */
    @objc func startAudioProbe(_ call: CAPPluginCall) {
        ensureController().startAudioProbe { result in
            switch result {
            case .success(let payload): call.resolve(payload)
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }

    @objc func stopAudioProbe(_ call: CAPPluginCall) {
        guard let controller else {
            call.reject("No audio probe is running")
            return
        }
        controller.stopAudioProbe { result in
            switch result {
            case .success(let payload): call.resolve(payload)
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }

    @objc func adjust(_ call: CAPPluginCall) {
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        let focus = call.getObject("focusPoint").flatMap(Self.point)
        let metering = call.getObject("meteringPoint").flatMap(Self.point)
        // Tri-state on purpose: absent means "keep deciding for me", true/false is the human
        // overriding the measurement. A Bool with a default cannot express the first.
        let torch = call.getBool("torchOverride")
        controller.adjust(focusPoint: focus, meteringPoint: metering, torchOverride: torch)
        call.resolve()
    }

    @objc func capture(_ call: CAPPluginCall) {
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        /* ⚑ **Asked for by the caller, not inferred from the mode.** The door knows it is taking
           a room shot; the controller knows only that it is in `object` mode, which is also what a
           nameplate close-up runs in. Inferring here would put a 120° frame on every object photo
           in the house — thirty extra frames a room, for the one act that wanted two. */
        controller.capture(wideSibling: call.getBool("wideSibling") ?? false) { result in
            switch result {
            case .success(let payload): call.resolve(payload)
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }

    /**
     The traverse mechanism (owner rulings 2026-08-16). **Deliberately not a door.**

     There is no capture kind here, no in-frame guidance and no concierge-facing surface: the
     owner held those back because a surface built now would harden around a capture kind whose
     job may be about to double — the traverse and the run trace look like one primitive, and
     that costing is still open. What exists is the mechanism and a way to measure it.
     */
    @objc func startTraverse(_ call: CAPPluginCall) {
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        controller.startTraverse(continuesFrom: call.getString("continuesFrom")) { result in
            switch result {
            case .success(let payload): call.resolve(payload)
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }

    @objc func stopTraverse(_ call: CAPPluginCall) {
        guard let controller else {
            call.reject("Camera is not running — call start first")
            return
        }
        controller.stopTraverse { result in
            switch result {
            case .success(let payload): call.resolve(payload)
            case .failure(let error): call.reject(error.localizedDescription)
            }
        }
    }

    /**
     ⚑ The zone-session costing, measured rather than argued. Dev-bench only, read-only, and it
     leaves nothing behind: see `HSArProbe`. It takes tens of seconds and holds the camera for the
     whole of it, so it refuses to run while a capture session is live rather than fighting for the
     device — the collision would produce a wrong answer that looked like a real one.
    */
    @objc func probeAr(_ call: CAPPluginCall) {
        guard controller == nil else {
            call.reject("Close the camera first — the probe needs the camera to itself")
            return
        }
        guard HSArProbe.isSupported() else {
            call.resolve(["supported": false])
            return
        }
        let probe = HSArProbe()
        arProbe = probe
        probe.run { [weak self] result in
            self?.arProbe = nil
            call.resolve(JSObject(uniqueKeysWithValues: result.map { ($0.key, $0.value as? JSValue ?? String(describing: $0.value)) }))
        }
    }

    /// Held for the length of the run; the probe is otherwise unowned and would deallocate mid-flight.
    private var arProbe: HSArProbe?

    private var bench: HSBench?
    private var lensProbe: AnyObject?
    private var controlProbe: AnyObject?
    private var gateZero: AnyObject?
    private var gateOne: AnyObject?
    private var plateAB: AnyObject?

    /// The zone session — see `HSZoneSession`. One per zone, three bounded modes, one origin.
    private var zoneStore: AnyObject?

    @available(iOS 17.0, *)
    private var zone: HSZoneSession? {
        get { zoneStore as? HSZoneSession }
        set { zoneStore = newValue }
    }

    /// ARKit's own preview, for the length of a scan. ⚑ While ARKit holds the lens the capture
    /// session has no frames, so its layer is a still image of the last thing it saw — which is the
    /// black screen the field reported. The scan modes get a view fed by the session that actually
    /// owns the camera.
    private var arPreview: UIView?
    private let previewQueue = DispatchQueue(label: "ca.housesteady.camera.preview", qos: .userInteractive)
    /// ⛑ One draw at a time; a frame arriving mid-draw is dropped rather than queued. See
    /// `drawArPreview` — a preview is about *now*, and a backlog only makes the picture later.
    private var previewBusy = false
    /// Only restored if we were the ones who made it transparent — see `attachArPreview`.
    private var restoreOpaqueForAr = false

    private func attachArPreview(_ arSession: ARSession) {
        DispatchQueue.main.async { [weak self] in
            /* ⛑ **Every reason this can silently do nothing is now recorded.** The owner reported
               black screens during scans; the zone log could not see them, because it recorded what
               the SESSION did and a black screen is what the SCREEN did. A guard that returns early
               and says nothing is indistinguishable from a guard that never ran. */
            guard #available(iOS 17.0, *) else {
                HSZoneLog.record("arPreviewSkipped", ["why": "needs iOS 17"]); return
            }
            guard let self else { return }
            guard let web = self.webView else {
                HSZoneLog.record("arPreviewSkipped", ["why": "no web view"]); return
            }
            guard let superview = web.superview else {
                HSZoneLog.record("arPreviewSkipped", ["why": "web view has no superview"]); return
            }
            /*
             ⛑ **"A preview object exists" is not "a preview is on screen", and that gap was the
             black mesh screen** (field 2026-09-05: *"mesh was black screen the whole time"*).

             The old guard returned on existence alone. ⚑ *The log shows why that is not enough:*
             the preview attached during the floorplan went in at **`index: 1` of 3 subviews**, and by
             the time mesh opened the screen had re-mounted and the host's hierarchy was **2 subviews
             deep** — so the view still existed, still had a session behind it, and was **no longer in
             the stack being drawn.** Every fact the guard checked was true and the screen was black.

             *And the asymmetry is what hid it:* leaving a scan mode detaches and re-attaches, so
             positioning and RoomPlan always got a fresh view and only mesh — which is entered, not
             left — inherited the stale one.

             So the check is what actually governs: **is it in the current superview, and is it still
             below the web view.** If it is, keep it. If it is not, take it down and build it again.
             */
            if let existing = self.arPreview {
                let placed = existing.superview === superview
                let ordered = placed
                    && (superview.subviews.firstIndex(of: existing) ?? Int.max)
                     < (superview.subviews.firstIndex(of: web) ?? -1)
                if placed && ordered {
                    HSZoneLog.record("arPreviewKept", ["index": superview.subviews.firstIndex(of: existing) ?? -1])
                    return
                }
                HSZoneLog.record("arPreviewRehomed", [
                    "placed": placed, "ordered": ordered,
                    "was": existing.superview.map { String(describing: type(of: $0)) } ?? "none",
                ])
                existing.removeFromSuperview()
                self.arPreview = nil
            }
            /* ⛑ **Drawn from the frames rather than handed to `ARSCNView`, after two rounds of
               black screens** (field 2026-08-22 and 08-23).

               An `ARSCNView` given somebody else's already-running session renders nothing here —
               attaching a scene did not change it, and every fact the log could check said the
               preview was fine: attached, host transparent, correct place in the stack. ⚑ **I was
               debugging a component's internal contract with no way to see inside it.**

               But the frames are not in doubt: this session's delegate receives every one, which is
               how tracking states and scan progress reach the log at all. **So the thing that
               already has the pixels draws them**, and the black screen stops being a question
               about a view's private expectations and becomes one image assigned to one layer. */
            let view = UIView(frame: superview.bounds)
            view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            view.backgroundColor = .black
            view.layer.contentsGravity = .resizeAspectFill
            view.layer.masksToBounds = true
            /* ⛑ **Make the host transparent HERE rather than assuming somebody else did** (zone
               log, 2026-08-21: `arPreviewAttached webOpaque: true` — a preview correctly attached
               and completely invisible, which is the black screen).

               The capture path makes the web view transparent when it attaches its own preview. A
               scan can attach before that has happened, or after it has been undone, and then the
               view is behind an opaque page. ⚑ **A view that exists and cannot be seen is the worst
               kind of working**, so the thing that needs transparency asks for it itself. */
            if web.isOpaque {
                self.restoreOpaqueForAr = true
                WebLayer.makeTransparent(web)
            }
            /* And ABOVE the capture preview, not below it. `index: 0` in the same log means it went
               to the bottom of the stack, under a layer showing the last frame the capture session
               saw before it lost the camera. */
            superview.insertSubview(view, belowSubview: web)
            self.arPreview = view
            HSZoneLog.record("arPreviewAttached", [
                "w": Double(view.bounds.width), "h": Double(view.bounds.height),
                // ⚑ The two facts that decide whether anything can be SEEN, rather than whether a
                // view exists: is it under a transparent host, and is it above the stale AV layer.
                "webOpaque": web.isOpaque,
                "index": superview.subviews.firstIndex(of: view) ?? -1,
                "subviews": superview.subviews.count
            ])
        }
    }

    /**
     One frame onto the preview layer, **with the meshed surfaces painted onto it**.

     ⚑ **This is the coverage answer for the mesh, and it is a different question from the
     floorplan's** (owner, 2026-08-23). A floorplan's gaps show in its outline; a mesh's gaps do not
     show anywhere — the geometry is invisible, so a wall you never pointed at looks exactly like a
     wall you did. **Painting what has been captured makes the hole the obvious thing on screen**,
     while the concierge is still standing in front of it.

     Every mesh vertex is projected through the same camera that took the frame, so a dot lands on
     the surface it belongs to. ⛑ Subsampled hard and capped: this runs at twenty frames a second
     over tens of thousands of vertices, and the picture needs to be readable rather than complete —
     **a dense enough dusting shows a gap just as well as every point would, and leaves the room
     visible underneath it, which matters because the concierge is also navigating by this.**
     */
    /**
     ⛑ **Never on the caller's thread.** `ARSession`'s delegate is the MAIN thread, and this method
     builds a `CGImage` from a 12 MP-class buffer and rasterises up to 5,500 mesh triangles over it.
     ⚑ *Doing that on main at 20 Hz is the same defect that froze the app through `analyse` — the
     delegate cannot fire again while it runs, so the session stops delivering frames and the screen
     stops updating, which reads as a crash.*

     A frame arriving while one is drawing is **dropped**, not queued: a preview is about *now*, and
     a backlog only makes the picture later.
     */
    private func drawArPreview(_ buffer: CVPixelBuffer, _ anchors: [ARMeshAnchor], _ camera: ARCamera) {
        guard arPreview != nil, !previewBusy else { return }
        previewBusy = true
        previewQueue.async { [weak self] in
            self?.renderArPreview(buffer, anchors, camera)
            self?.previewBusy = false
        }
    }

    private func renderArPreview(_ buffer: CVPixelBuffer, _ anchors: [ARMeshAnchor], _ camera: ARCamera) {
        guard arPreview != nil else { return }
        let ci = CIImage(cvPixelBuffer: buffer).oriented(.right)
        guard let base = arPreviewContext.createCGImage(ci, from: ci.extent) else { return }

        guard !anchors.isEmpty else {
            DispatchQueue.main.async { [weak self] in self?.arPreview?.layer.contents = base }
            return
        }

        let size = CGSize(width: base.width, height: base.height)
        guard let ctx = CGContext(data: nil, width: base.width, height: base.height,
                                  bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.draw(base, in: CGRect(origin: .zero, size: size))

        /* ⛑ **Contiguous and filled, after two goes at this** (field 2026-08-23, with pictures).
         *
         * Dots shimmered and had no structure. Edges were worse in a way the screenshots made
         * obvious: **I was subsampling by skipping every Nth triangle**, and adjacent triangles are
         * what make a wireframe a surface — take every fortieth and you get isolated slivers
         * scattered over a room, which is exactly what came back. ⚑ **No density would have fixed
         * that; the sampling was destroying the only property that mattered.**
         *
         * So: nearest anchors first, every triangle in them, filled, until the budget runs out.
         * ARKit's mesh anchors are roughly metre-sized blocks, so the nearest few are the surfaces
         * the concierge is actually pointing at — **the thing they are deciding about is covered
         * completely, and the far side of the room is left alone rather than sprinkled.**
         *
         * Filled rather than stroked because the question is *is this surface captured*, and a
         * translucent film answers it at a glance where an outline asks to be interpreted.
         */
        let cam = camera.transform.columns.3
        let camPos = SIMD3<Float>(cam.x, cam.y, cam.z)
        // World → camera space, so "is this behind me" is one multiply and a sign test.
        let viewMatrix = simd_inverse(camera.transform)
        let near = anchors.sorted {
            let a = $0.transform.columns.3, b = $1.transform.columns.3
            return simd_distance(camPos, SIMD3<Float>(a.x, a.y, a.z))
                 < simd_distance(camPos, SIMD3<Float>(b.x, b.y, b.z))
        }
        ctx.setFillColor(red: 0.94, green: 0.71, blue: 0.16, alpha: 0.22)
        var drawn = 0
        outer: for anchor in near {
            let geo = anchor.geometry
            let verts = geo.vertices
            let faces = geo.faces
            guard faces.indexCountPerPrimitive == 3 else { continue }
            func vertex(_ index: Int) -> SIMD3<Float> {
                verts.buffer.contents()
                    .advanced(by: verts.offset + verts.stride * index)
                    .assumingMemoryBound(to: SIMD3<Float>.self).pointee
            }
            func indexAt(_ i: Int) -> Int {
                let p = faces.buffer.contents().advanced(by: i * faces.bytesPerIndex)
                return faces.bytesPerIndex == 2
                    ? Int(p.assumingMemoryBound(to: UInt16.self).pointee)
                    : Int(p.assumingMemoryBound(to: UInt32.self).pointee)
            }
            for f in 0..<faces.count {
                if drawn > 5500 { break outer }
                var pts: [CGPoint] = []
                var ok = true
                for corner in 0..<3 {
                    let v = vertex(indexAt(f * 3 + corner))
                    let world = anchor.transform * SIMD4<Float>(v.x, v.y, v.z, 1)
                    /* ⛑ **Reject anything BEHIND the lens before projecting it** (field 2026-08-23,
                       second screenshot: a huge yellow wedge sweeping across the room as the camera
                       panned).

                       `projectPoint` has no answer for a point behind the camera and returns a
                       mirrored one anyway. A triangle with one corner behind and two in front then
                       projects to an enormous screen-space polygon that sweeps as you turn — which
                       reads exactly as *the texture moves with me instead of staying on the wall*.

                       ⚑ The camera looks down its own −Z, so anything with camera-space z ≥ 0 is
                       behind it. Rejecting the whole triangle rather than clipping it loses a sliver
                       at the frame edge and keeps every remaining shape honest. */
                    let camSpace = viewMatrix * world
                    guard camSpace.z < -0.05 else { ok = false; break }
                    let screen = camera.projectPoint(SIMD3<Float>(world.x, world.y, world.z),
                                                           orientation: .portrait,
                                                           viewportSize: size)
                    guard screen.x.isFinite, screen.y.isFinite,
                          screen.x > -size.width, screen.y > -size.height,
                          screen.x < size.width * 2, screen.y < size.height * 2 else { ok = false; break }
                    pts.append(screen)
                }
                if ok, pts.count == 3 {
                    ctx.beginPath()
                    ctx.move(to: pts[0])
                    ctx.addLine(to: pts[1])
                    ctx.addLine(to: pts[2])
                    ctx.closePath()
                    ctx.fillPath()
                    drawn += 1
                }
            }
        }
        guard let painted = ctx.makeImage() else { return }
        DispatchQueue.main.async { [weak self] in self?.arPreview?.layer.contents = painted }
    }

    private let arPreviewContext = CIContext(options: [.useSoftwareRenderer: false])

    private func detachArPreview() {
        DispatchQueue.main.async { [weak self] in
            HSZoneLog.record("arPreviewDetached", ["had": self?.arPreview != nil])
            self?.arPreview?.removeFromSuperview()
            self?.arPreview = nil
            if self?.restoreOpaqueForAr == true, let web = self?.webView {
                WebLayer.restore(web, wasOpaque: true)
                self?.restoreOpaqueForAr = false
            }
        }
    }

    /**
     ⛑ **This flattened every structured value to a string, and it is the whole of 2026-08-23.**

     The old body was `$0.value as? JSValue ?? String(describing: $0.value)`. A nested `[String: Any]`
     is not a `JSValue`, so it fell to the `String(describing:)` arm — and the far side received
     `"[\"walls\": 4, \"doors\": 1]"` where it expected an object. ⚑ **Nothing failed. Every check
     of the form `typeof x === "object"` simply went false**, so the floorplan reported 0 walls
     forever, the mesh reported *nothing was meshed* while holding 32 pieces, and the plan's `walls`
     array — the whole deliverable — crossed as text.

     **The tell was the stringification being a legal answer.** A converter that cannot represent a
     value should refuse it, not describe it: `String(describing:)` turns a type error into a
     plausible-looking payload, which is the same shape as every measure in this project that
     returned a confident number instead of admitting it had nothing.

     So: recursive, and values it genuinely cannot carry are dropped rather than described.
     */
    private func jsValue(_ any: Any) -> JSValue? {
        switch any {
        case let v as JSObject: return v
        case let v as String: return v
        case let v as Bool: return v
        case let v as Int: return v
        case let v as Double: return v
        case let v as Float: return Double(v)
        case let v as NSNumber: return v.doubleValue
        case let v as [String: Any]: return js(v)
        case let v as [Any]: return v.compactMap { jsValue($0) }
        default: return nil
        }
    }

    private func js(_ d: [String: Any]) -> JSObject {
        var out = JSObject()
        for (k, v) in d {
            if let converted = jsValue(v) { out[k] = converted }
        }
        return out
    }

    /* ⚑ One guard, written once. iOS 17 is the floor because `RoomCaptureSession(arSession:)` and
       `stop(pauseARSession:)` are — without them the floorplan gets its own coordinate space and
       every position taken afterwards is measured against a different origin. Refusing is honest;
       shipping two thirds of the architecture is not. */
    @available(iOS 17.0, *)
    private func withZone(_ call: CAPPluginCall, _ body: (HSZoneSession) -> [String: Any]) {
        guard let zone else {
            call.reject("No zone open")
            return
        }
        call.resolve(js(body(zone)))
    }

    /// The same guard for the callers that do not need the session itself in scope.
    private func requireZone(_ call: CAPPluginCall, _ body: (CAPPluginCall) -> Void) {
        guard #available(iOS 17.0, *) else {
            call.reject("The zone session needs iOS 17")
            return
        }
        body(call)
    }

    @objc func openZone(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("The zone session needs iOS 17")
            return
        }
        /* ⛑ **This guard was the bug, and it was a leftover.** It dates from when the zone session
           was a standalone thing that needed the device to itself. Ownership is arbitrated now —
           `needCamera`/`releaseCamera` — so refusing whenever a capture session exists refuses
           *always*, because the viewfinder is where zones are opened from.

           ⚑ The symptom it produced is the one worth remembering: it worked the FIRST time and never
           again until the app was relaunched, because on first mount the zone effect happened to run
           before the camera had started. **An intermittent that is actually a startup-order race
           reads as flakiness**, and flakiness is what stops a real cause being looked for. */
        let id = call.getString("zoneId") ?? UUID().uuidString
        /* ⛑ **Re-opening the SAME zone must not rebuild it** (zone log, 2026-08-21). One kitchen
           produced six `openZone` calls — one per action tapped — and each built a fresh
           `HSZoneSession` with `reset: true`, so the zone's coordinate space was destroyed and
           remade every time.

           ⚑ **That silently breaks the load-bearing rule of the whole architecture.** Positions
           taken after a floorplan were measured against a different origin from the floorplan, so
           *at least one frame per container carries a position* was true of frames that could not
           be related to each other. Nothing failed; the numbers were simply in different worlds.

           It also orphaned in-flight work: a RoomPlan result arriving after its session had been
           replaced landed on nobody — which is `roomDeliveredLate` in the log, with a captured room
           and one wall in it, thrown away. */
        if let existing = zone, existing.zoneId == id {
            HSZoneLog.record("openZoneReused", ["zone": id])
            call.resolve(js(existing.state()))
            return
        }
        let made = HSZoneSession()
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            /* ⚑ **One owner of the lens, arbitrated here.** ARKit and the capture session cannot
               both hold the rear camera: run them together and ARKit is refused with `sensorFailed`
               while the preview freezes — both seen in the field 2026-08-21. The zone session asks
               for the camera, uses it, and gives it straight back. */
            made.needCamera = { [weak self] in
                self?.controller?.takeCameraForZone()
            }
            made.releaseCamera = { [weak self] in self?.controller?.giveCameraBackFromZone() }
            /* ⚑ ARKit's frames go to the SAME analysis the capture session feeds. See
               `CameraController.analyse` and `HSZoneSession.onAnalysisFrame`: one pipeline, one set
               of thresholds, two sources. */
            made.onAnalysisFrame = { [weak self] buffer in self?.controller?.analyseAsync(buffer) }
            made.showArPreview = { [weak self] arSession in self?.attachArPreview(arSession) }
            /* The preview is fed by whoever already has the frames — see `attachArPreview`. */
            made.onPreviewFrame = { [weak self] buffer, anchors, camera in
                self?.drawArPreview(buffer, anchors, camera)
            }
            made.hideArPreview = { [weak self] in self?.detachArPreview() }
            let out = made.openZone(id) { [weak self] event in
                self?.notifyListeners("zone", data: self?.js(event) ?? JSObject())
            }
            self.zone = made
            call.resolve(self.js(out))
        }
    }

    @objc func closeZone(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *), let z = zone else {
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            let out = z.closeZone()
            self?.zoneStore = nil
            call.resolve(self?.js(out) ?? JSObject())
        }
    }

    @objc func setZoneMode(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else {
            call.reject("The zone session needs iOS 17")
            return
        }
        guard let raw = call.getString("mode"), let m = HSZoneSession.Mode(rawValue: raw) else {
            call.reject("Unknown zone mode")
            return
        }
        if #available(iOS 17.0, *) { withZone(call) { $0.setMode(m) } }
    }

    @objc func pauseZone(_ call: CAPPluginCall) { requireZone(call) { c in
        if #available(iOS 17.0, *) { withZone(c) { $0.pause() } } } }
    @objc func resumeZone(_ call: CAPPluginCall) { requireZone(call) { c in
        if #available(iOS 17.0, *) { withZone(c) { $0.resume() } } } }
    /**
     ⚑ **A photograph taken through the tracking session**, with the pose of the frame it came from.
     See `HSZoneSession.captureStill`. Falls back to nothing: a caller that gets `ok: false` should
     use the ordinary shutter and will get no pose, which is the honest outcome.
     */
    /** ⚑ Re-run the session in place. See `HSZoneSession.retry` — never a close-and-reopen, which
     *  would mint a new origin and silently invalidate every pose already taken in this zone. */
    @objc func retryZone(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *), let z = zone else {
            call.resolve(["ok": false, "why": "no zone open"]); return
        }
        call.resolve(js(z.retry()))
    }

    @objc func captureStill(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *), let z = zone else {
            call.resolve(["ok": false, "why": "no zone open"]); return
        }
        z.captureStill(text: call.getBool("text") ?? false) { [weak self] out in
            guard let self else { return }
            call.resolve(self.js(out))
        }
    }

    @objc func takePosition(_ call: CAPPluginCall) { requireZone(call) { c in
        if #available(iOS 17.0, *) { withZone(c) { $0.position() } } } }
    @objc func startRoomPlan(_ call: CAPPluginCall) { requireZone(call) { c in
        if #available(iOS 17.0, *) { withZone(c) { $0.startRoomPlan() } } } }

    /// ⚑ What the zone session did, kept by the app rather than by whoever was watching — see
    /// `HSZoneLog`. Available whether or not a Mac is plugged in, which is the whole point.
    @objc func zoneLog(_ call: CAPPluginCall) {
        call.resolve(js(HSZoneLog.snapshot()))
    }

    @objc func stopRoomPlan(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *), let z = zone else {
            call.reject("No zone open")
            return
        }
        DispatchQueue.main.async { [weak self] in
            z.stopRoomPlan { out in call.resolve(self?.js(out) ?? JSObject()) }
        }
    }

    /**
     The device bench — see `HSBench`. Dev-bench only, and it takes the camera to itself for the
     length of a run, so it refuses while a capture session is live rather than fighting for the
     device: a collision would produce a wrong number that looked like a real one.
    */
    @objc func startBench(_ call: CAPPluginCall) {
        guard controller == nil else {
            call.reject("Close the camera first — the bench needs the device to itself")
            return
        }
        guard let mode = HSBench.Mode(rawValue: call.getString("mode") ?? "") else {
            call.reject("Unknown bench mode")
            return
        }
        if mode != .control, !ARWorldTrackingConfiguration.isSupported {
            call.reject("World tracking unsupported on this device")
            return
        }
        let made = HSBench()
        bench = made
        DispatchQueue.main.async { [weak self] in
            let started = made.start(
                mode: mode,
                capSeconds: call.getDouble("capSeconds") ?? 2400,
                sampleSeconds: call.getDouble("sampleSeconds") ?? 30,
                coolSeconds: call.getDouble("coolSeconds") ?? 600,
                conditions: call.getObject("conditions") ?? [:],
                onSample: { [weak self] s in
                    self?.notifyListeners("benchSample", data: JSObject(uniqueKeysWithValues:
                        s.map { ($0.key, $0.value as? JSValue ?? String(describing: $0.value)) }))
                })
            call.resolve(JSObject(uniqueKeysWithValues:
                started.map { ($0.key, $0.value as? JSValue ?? String(describing: $0.value)) }))
        }
    }

    @objc func stopBench(_ call: CAPPluginCall) {
        guard let bench else {
            call.reject("No bench running")
            return
        }
        DispatchQueue.main.async { [weak self] in
            let out = bench.stop()
            self?.bench = nil
            call.resolve(JSObject(uniqueKeysWithValues:
                out.map { ($0.key, $0.value as? JSValue ?? String(describing: $0.value)) }))
        }
    }

    @objc func closeBenchLoop(_ call: CAPPluginCall) {
        guard let bench else {
            call.reject("No bench running")
            return
        }
        let out = bench.closeLoop()
        call.resolve(JSObject(uniqueKeysWithValues:
            out.map { ($0.key, $0.value as? JSValue ?? String(describing: $0.value)) }))
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard let controller else {
            call.resolve()
            return
        }
        DispatchQueue.main.async {
            controller.stop()
            call.resolve()
        }
    }

    private static func point(_ object: JSObject) -> CGPoint? {
        guard let x = object["x"] as? Double, let y = object["y"] as? Double else { return nil }
        return CGPoint(x: x, y: y)
    }
}

// MARK: - Modes

enum CameraMode: String {
    case object
    case concern
    case text
    case document
}

/**
 A mode as a **goal**, not a settings bundle.

 Each field says what the capture must achieve. `CameraController.apply` measures the scene and the
 hardware, reaches what it can, and reports the rest in `unmet`.

 `torch` is the field that carries the ruling: it is a *policy*, never a switch. `.never` and
 `.whenUnderLit` are goals; there is deliberately no `.always`.
 */
/**
 Which piece of glass. Named for what the concierge sees, not for Apple's constants — Apple's
 `builtInWideAngleCamera` is the *normal* lens, and calling it "wide" in our own vocabulary while
 the owner uses "wide" to mean *wider than normal* is a collision waiting to be shipped.
 */
enum CameraLens: String {
    case normal
    case wide

    var deviceType: AVCaptureDevice.DeviceType {
        switch self {
        case .normal: return .builtInWideAngleCamera
        case .wide: return .builtInUltraWideCamera
        }
    }
}

/**
 A mode as a **goal**, not a settings bundle.

 Each field says what the capture must achieve. `CameraController.apply` measures the scene and the
 hardware, reaches what it can, and reports the rest in `unmet`.

 `torch` is the field that carries the ruling: it is a *policy*, never a switch. `.never` and
 `.whenUnderLit` are goals; there is deliberately no `.always`.
 */
struct ModeGoal {
    enum TorchPolicy { case never, whenUnderLit }
    /// What the lens does when nobody has said otherwise. ⚑ `locked` is not a default — it is a
    /// refusal, and only Text uses it.
    enum LensPolicy { case defaultsTo(CameraLens), locked(CameraLens) }

    let closeFocus: Bool
    /// Meter the subject rather than the scene — the plate, not the bright tank beside it.
    let spotMeterSubject: Bool
    let torch: TorchPolicy
    let liveText: Bool
    /// Extra exposures, but only when the live read comes back marginal. Never unconditionally.
    let bracketWhenMarginal: Bool
    let detectPageEdges: Bool
    let wantsLevel: Bool
    /**
     ⚑ **The mode sets the default; the concierge chooses** (owner ruling 2026-08-16, overturning
     the design session's position that the app should decide).

     *The lens is a substitute for stepping backwards, and in a tight mechanical room you often
     cannot step backwards.* "Does the whole thing fit in the picture" requires no knowledge of
     what the thing is, which is the governing filter for anything a concierge is asked to judge —
     so it is theirs to judge.

     Text is the one refusal: a 120° lens bends straight lines near the frame edge, and a plate
     photographed at the edge of an ultra-wide frame reads worse, not wider. There is nothing to
     gain there and characters to lose.
     */
    let lens: LensPolicy

    static func of(_ mode: CameraMode) -> ModeGoal {
        switch mode {
        case .object, .concern:
            // Concern is Object optically. It differs in what the concierge MEANS by it — "look
            // here" — and that meaning is recorded on the door, never inferred from the frame.
            return ModeGoal(closeFocus: false, spotMeterSubject: false, torch: .never,
                            liveText: false, bracketWhenMarginal: false,
                            detectPageEdges: false, wantsLevel: false,
                            lens: .defaultsTo(.normal))
        case .text:
            return ModeGoal(closeFocus: true, spotMeterSubject: true, torch: .whenUnderLit,
                            liveText: true, bracketWhenMarginal: true,
                            detectPageEdges: false, wantsLevel: true,
                            lens: .locked(.normal))
        case .document:
            // A different camera, not a photograph with a label: flat, high contrast, edges found
            // and corrected. Built as "a photo we named document" it produces a curled invoice at
            // an angle that reads badly.
            return ModeGoal(closeFocus: false, spotMeterSubject: false, torch: .whenUnderLit,
                            liveText: true, bracketWhenMarginal: false,
                            detectPageEdges: true, wantsLevel: true,
                            lens: .locked(.normal))
        }
    }

    /// The lens this goal wants, given whatever the concierge asked for. A locked mode ignores the
    /// request rather than half-honouring it, and `lensLocked` is what tells the UI to say so.
    func lens(requested: CameraLens?) -> CameraLens {
        switch lens {
        case .locked(let fixed): return fixed
        case .defaultsTo(let fallback): return requested ?? fallback
        }
    }

    var lensLocked: Bool {
        if case .locked = lens { return true }
        return false
    }
}

// MARK: - Controller

final class CameraController: NSObject {
    struct Achieved {
        let mode: CameraMode
        let unmet: [String]
    }

    enum CameraError: LocalizedError {
        case denied
        case noCamera
        case notRunning
        case notTraversing
        case captureFailed(String)

        var errorDescription: String? {
            switch self {
            case .denied: return "Camera access was refused. Settings ▸ HouseSteady Field ▸ Camera."
            case .noCamera: return "No usable rear camera on this device."
            case .notRunning: return "Camera is not running."
            case .notTraversing: return "No traverse is running."
            case .captureFailed(let why): return "Capture failed: \(why)"
            }
        }
    }

    var onTextBoxes: (([String: Any]) -> Void)?
    var onStatus: (([String: Any]) -> Void)?
    var onTraverse: (([String: Any]) -> Void)?

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "ca.housesteady.camera.session")
    private let visionQueue = DispatchQueue(label: "ca.housesteady.camera.vision")
    /// ⛑ One analysis at a time; a frame arriving while one runs is DROPPED, never queued. See
    /// `analyseAsync` — a backlog of stale frames would fire the shutter for a plate the concierge
    /// has already walked away from.
    fileprivate var analysisBusy = false
    /// Deskew, JPEG writes and the accurate OCR pass. Off main because a 12 MP read is most of a
    /// second, and off `visionQueue` because that one is feeding the live loop.
    private let processingQueue = DispatchQueue(label: "ca.housesteady.camera.processing")
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    private var device: AVCaptureDevice?
    /// Held so the lens swap can remove exactly the input it added, rather than guessing from
    /// `session.inputs` — the audio probe adds one too.
    private var videoInput: AVCaptureDeviceInput?
    /// The glass currently in the session.
    private var lens: CameraLens = .normal
    /// The glass to hold for the second half of a sibling pair — the one the concierge did NOT
    /// frame with — set for the length of one exposure. See `fireWideSibling`.
    private var siblingLensOverride: CameraLens?
    /// What the concierge asked for, which survives a mode change. ⚑ Kept separate from `lens`
    /// because Text *refuses* wide: stepping into Text must not silently discard a choice the
    /// concierge made, and stepping back out must restore it rather than making them ask twice.
    private var requestedLens: CameraLens?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var previewView: UIView?
    private weak var hostWebView: UIView?
    private var restoreOpaque: Bool?

    private let motion = CMMotionManager()
    private var statusTimer: Timer?

    private var mode: CameraMode = .object
    private var goal = ModeGoal.of(.object)
    private var torchOverride: Bool?
    private var torchOn = false

    /// Frames are analysed at a fraction of capture rate; text recognition is far more expensive
    /// than the 30 fps the session delivers, and a queue that never drains reads as a frozen app.
    private var frameCounter = 0
    private let analyseEveryNthFrame = 6
    private var analysing = false

    /**
     Which way up the camera is — **ONE angle, from which the preview, the still and Vision are
     all derived.**

     ⚑ This replaced two hand-written tables that disagreed, and the disagreement reached the
     field on 2026-08-15: held in landscape the preview was upside down while the green text
     boxes sat correctly over the characters. Both tables switched on `UIDeviceOrientation`, but
     the preview table used the angles that belong to `UIInterfaceOrientation` — and
     `UIDeviceOrientation.landscapeLeft` **is** `UIInterfaceOrientation.landscapeRight`. So the
     two landscape cases were swapped, and portrait, where the two vocabularies happen to agree,
     looked fine. The Vision table was the correct one, which is exactly why the overlay was
     right and the picture was wrong — *a bug that presents as the overlay being broken.*

     `AVCaptureDevice.RotationCoordinator` is Apple's answer to that trap. It reports the angle
     for the preview and the angle for the capture, it is KVO-observable, and it is right when
     the iPad is **flat** — a state `UIDevice.orientation` cannot express at all, and the state
     an iPad is in whenever a plate on top of a furnace gets photographed.

     ⚑ Deriving all three from one angle is the structural half of the fix: two tables can
     disagree, one cannot.
     */
    private var previewRotationAngle: CGFloat = 90
    private var captureRotationAngle: CGFloat = 90
    private var rotationObservations: [NSKeyValueObservation] = []
    /// Typed `AnyObject` because the stored property outlives the `iOS 17` availability check.
    private var rotationCoordinatorStore: AnyObject?

    /**
     Vision's view of the buffer, from the SAME angle that orients the preview.

     Read on the vision queue while written on main. That race is benign and deliberately not
     locked: the worst outcome is one analysed frame at the previous angle, mid-rotation, and a
     lock on the hot path costs more than the frame is worth.
     */
    private var visionOrientation: CGImagePropertyOrientation {
        Self.imageOrientation(forRotationAngle: previewRotationAngle)
    }

    private var lastRead: LiveRead = .empty

    /**
     Scene stability, measured by how far the picture MOVED — not by whether the text repeated.

     ⚑ The first cut asked whether consecutive reads returned the same characters, and on device it
     never once fired: at the fast recognition level the live read jitters hard enough that no two
     frames agree — the console recorded `VALUE SIZE`, then `VOAMAT ICONIIMIIIII#`, then
     `roiHhl ILilf4ll•lllJlJl` off one steady label. Keying the shutter to that made auto-capture a
     feature that could not happen, and it looked like the camera could not read a plate it was
     reading fine.

     What "steady on the plate" actually is: the operator has stopped moving. Vision's image
     registration answers exactly that and is documented as the cheap way to ask it (Apple's own
     scene-stability sample uses it for the same purpose). Characters still have to be present —
     a motionless camera pointed at a blank wall is not a plate — but their spelling does not have
     to agree frame to frame.
     */
    private let sequenceHandler = VNSequenceRequestHandler()
    private var previousFrame: CVPixelBuffer?
    private var motionHistory: [CGFloat] = []
    private let motionHistoryLength = 6
    /**
     A fraction of frame width. Hand-held still is small but never zero.

     ⚑ **0.008, raised from 0.006 on the owner's field report (2026-08-16):** holding under 0.006
     took kneeling with both elbows braced on his thighs to reach a low plate, and the bracing
     itself added shake. That is the shutter refusing to fire in exactly the posture a mechanical
     room forces.

     The arithmetic agrees it was too tight. Frames are analysed every sixth frame — 200 ms apart —
     and ordinary hand tremor over 200 ms is a few tenths of a degree, which at this camera's field
     of view is already around 0.005 of frame width. 0.006 sat inside the noise floor of a steady
     hand; 0.008 sits just above it.
     */
    private let stillThreshold: CGFloat = 0.008

    /**
     ⚑ **What "still enough" actually depends on — and it is not a constant.**

     The field number that forced this: **held 9.6 s** on one nameplate, crouched with both elbows
     braced, while the capture itself took 0.6 s. *Ninety-four percent of the wait was the gate.*
     A concierge cannot do that thirty times a room, so this is not a threshold to nudge.

     Blur is angular rate multiplied by **exposure time**, and a flat threshold ignores the second
     term entirely — so it demands the same stillness of an 8 ms frame in a bright garage as of a
     66 ms frame in a dark plant room. The bright case is being made to wait for no reason.

     And the camera is already working on the problem: optical stabilisation runs on this lens
     whatever we do, and `photoQualityPrioritization = .quality` fuses several exposures. **Holding
     the shutter for ten seconds buys almost nothing those two have not already bought** — it only
     buys it later.

     So the gate is computed from the exposure the camera reports, with a stabilisation credit, and
     ⚑ **clamped so it can never be stricter than the old flat value.** At the owner's 41.7 ms it
     comes out about 2.7× looser; in a bright room looser still; in a genuinely dark room it tightens
     back towards where it was, which is the one case where holding still is really buying something.

     `stillThreshold` above is the floor of that clamp and the value the panel prints when the
     camera has not yet reported an exposure.
     */
    private static let blurBudgetFrameWidths: CGFloat = 0.0015
    /// What optical stabilisation is worth, as a multiplier on tolerable movement. Deliberately
    /// conservative: OIS is usually quoted at two to three stops, and this claims rather less than
    /// one and a half.
    private static let stabilisationCredit: CGFloat = 3.0
    private static let stillThresholdCeiling: CGFloat = 0.05

    /// The analysis cadence in milliseconds — `motion` is a shift per analysed frame, so an
    /// exposure has to be expressed in the same units before the two can be compared.
    private var analysisIntervalMs: CGFloat { CGFloat(analyseEveryNthFrame) * 1000.0 / 30.0 }

    private var effectiveStillThreshold: CGFloat {
        guard let device else { return stillThreshold }
        let exposureMs = CGFloat(CMTimeGetSeconds(device.exposureDuration) * 1000)
        guard exposureMs > 0 else { return stillThreshold }
        let allowed = Self.blurBudgetFrameWidths * Self.stabilisationCredit * (analysisIntervalMs / exposureMs)
        return min(Self.stillThresholdCeiling, max(stillThreshold, allowed))
    }
    private var lastMotion: CGFloat = 1.0

    /**
     One capture the concierge asked for, which may arrive as several exposures.

     ⚑ A job rather than a dictionary of frames keyed by settings id, because **the torch pair is
     a second `capturePhoto` call with its own id** and both of its frames belong to one result.
     A per-id table cannot express that; it was fine while every capture was one settings object.
     */
    private final class CaptureJob {
        struct Frame {
            let data: Data
            /// Stamped per settings id at request time, never read off `torchOn` at delivery —
            /// by then the pair has already switched it.
            let torch: Bool
            /**
             ⚑ **Per FRAME, not per job — because the wide sibling is the one case where they
             differ**, and it is the whole point of the pair.

             The job-level `lens` was accurate for every capture built before this: one tap, one
             glass. A room shot now delivers a 1× frame and a 120° frame from one press, and a
             desk told *this capture was wide* about a pair where only the last frame was would be
             told something false about three frames to be told something true about one.
            */
            let lens: CameraLens
        }
        let completion: (Result<[String: Any], Error>) -> Void
        let bracketed: Bool
        /// What the torch was doing when the concierge pressed.
        let torchAtCapture: Bool
        /// Stamped at request time. A lens swap mid-job is refused, so one value describes the
        /// whole job — but it is recorded per job rather than read back at delivery, for the same
        /// reason `Frame.torch` is.
        let lens: CameraLens
        /// The LIT frames — one, or three under a bracket.
        var frames: [Frame] = []
        /**
         The unlit companion, held aside rather than appended.

         ⚑ It is now captured **first** in wall-clock order (owner ruling 2026-08-16: the flash
         reads as *done*, so the flash must be last), but it stays **last** in the delivered array.
         Keeping the array shape fixed is deliberate: the EV labels, `torchPairAgreement`'s choice
         of the nominal frame, the document deskew and the top-level read all key off position, and
         re-ordering the array to match the clock would have silently moved every one of them.
         */
        var companion: Frame?
        var outstanding: Int
        var wantsTorchPair: Bool
        var pairFired = false
        /// ⚑ Asked for by the door, then granted or refused by the hardware — see `wideRefused`.
        var wantsWideSibling: Bool
        var wideFired = false
        /// The 120° frame, held aside like the companion and appended LAST for the same reason:
        /// every index-keyed reading downstream would move if the array were re-ordered.
        var wideFrame: Frame?
        /// ⛑ **Measured, not assumed.** Two input swaps and two full re-configures per room shot,
        /// reported on the capture so the cost is a number in the record rather than a guess in a
        /// document — and so a device where it is expensive says so on the first walk.
        var lensSwapMs: Double?
        /// Why there is no wide frame, when one was asked for. An absence with no reason is the
        /// signal this project keeps having to go back and add.
        var wideRefused: String?

        init(completion: @escaping (Result<[String: Any], Error>) -> Void,
             bracketed: Bool, torchAtCapture: Bool, lens: CameraLens,
             outstanding: Int, wantsTorchPair: Bool, wantsWideSibling: Bool = false) {
            self.completion = completion
            self.bracketed = bracketed
            self.torchAtCapture = torchAtCapture
            self.lens = lens
            self.outstanding = outstanding
            self.wantsTorchPair = wantsTorchPair
            self.wantsWideSibling = wantsWideSibling
        }
    }

    /// Settings id → job. Two ids map to the same job for a torch pair.
    private var jobs: [Int64: CaptureJob] = [:]
    /// Settings id → the torch state that id was requested under.
    private var torchForRequest: [Int64: Bool] = [:]
    /// How long to let auto-exposure re-converge after the torch goes out for the paired frame.
    private static let torchPairSettleSeconds = 0.45

    struct LiveRead {
        let strings: [String]
        let meanConfidence: Double
        static let empty = LiveRead(strings: [], meanConfidence: 0)
        var characterCount: Int { strings.reduce(0) { $0 + $1.count } }

        /// Roughly the shortest run of characters worth firing a shutter for on a plate — below
        /// it, a stray word on a pipe label counts as a read.
        static let worthReadingCharacters = 6
        /// The boundary between a read that is going well and one that is not. **One number**,
        /// used by the retake trigger and the torch veto alike: two constants meaning the same
        /// thing is precisely how the two rotation tables drifted apart.
        static let goodConfidence = 0.55

        /**
         ⚑ Characters WERE detected and read badly. Never "no text found" — most captures
         legitimately contain none (a pipe, a stain, a wide shot), so a trigger that fires on
         nothing-read fires on the majority case and is ignored by the time a plate needs it.
         */
        var isMarginal: Bool { characterCount > 0 && meanConfidence < Self.goodConfidence }

        /**
         The read is going well enough that the mode's goal is already met.

         ⚑ This is what the torch asks before arming (owner ruling 2026-08-16). **The goal is
         legible characters, not a lit room** — so a camera that can already read the plate has
         nothing to gain from a torch and a specular hotspot to lose.
         */
        var isReadingWell: Bool {
            characterCount >= Self.worthReadingCharacters && meanConfidence >= Self.goodConfidence
        }

        /**
         What "the same read" means, and it is NOT array equality.

         ⚑ Proven wrong on device 2026-08-14: the first cut compared `[String]` exactly, and the
         fast recognition level jitters — a line splits, a stray character appears, the order
         changes — so three identical reads in a row essentially never happened and auto-capture
         never fired once. The camera looked like it could not read a plate it was reading fine.

         What actually needs to be stable is the CHARACTERS, not their line breaks or their order:
         a model number is the same model number whether Vision returns it as one line or two.
         */
        var fingerprint: String {
            strings
                .joined()
                .uppercased()
                .filter { $0.isLetter || $0.isNumber }
                .sorted()
                .reduce(into: "") { $0.append($1) }
        }
    }

    // MARK: start / stop

    func start(mode: CameraMode, behind webView: UIView, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard let self else { return }
            guard granted else {
                DispatchQueue.main.async { completion(.failure(CameraError.denied)) }
                return
            }
            self.sessionQueue.async {
                do {
                    /*
                     ⛑ **The ownership hole, and it was the only path without a guard.**

                     `reclaimCamera` refuses while a zone holds the lens. **This does not go through
                     `reclaimCamera`** — opening the capture screen calls `start()`, which configured
                     and started the capture session unconditionally. With a zone open that is ARKit
                     being shoved off the sensor, and the field log shows it four times in ninety
                     seconds: `cameraToZone` → `presetReasserted` → **`sessionFailed: Required sensor
                     failed`** → a forced re-init with a **new world origin**. ⚑ *That is the
                     "positioning stopped — tap to restart it" the concierge kept meeting, and six
                     re-inits is six origins, which is the drift problem coming back in by a side
                     door.*

                     ⚑ **Checked here, inside the queue block, not at the call site** — this hop is
                     asynchronous, so a check made before it says what was true then, not what is
                     true when the camera is actually touched.

                     While the zone owns the lens there is nothing to start: **ARKit is the camera**,
                     its preview is already on screen, and stills go through `captureStill`. Attaching
                     the capture session's own preview layer over it would show exactly the black
                     rectangle the field reported, because that layer has no running session behind it.
                     */
                    if self.zoneOwnsCamera {
                        HSZoneLog.record("startDeferredToZone", ["mode": mode.rawValue])
                        DispatchQueue.main.async {
                            self.startStatusSampling()
                            completion(.success(self.capabilities(unmetAtStart: [])))
                        }
                        return
                    }
                    try self.configureSession()
                    self.session.startRunning()
                    DispatchQueue.main.async {
                        self.attachPreview(behind: webView)
                        let achieved = self.apply(mode: mode)
                        self.startStatusSampling()
                        completion(.success(self.capabilities(unmetAtStart: achieved.unmet)))
                    }
                } catch {
                    DispatchQueue.main.async { completion(.failure(error)) }
                }
            }
        }
    }

    private func configureSession() throws {
        /* ⛑ **Re-asserted before the early return, because it used to be unreachable after launch.**

           `sessionPreset = .photo` below sits after this guard — and `stop()` never removes inputs
           (`removeInput` appears once in this file, inside `swapLens`), while the controller is a
           process-lifetime singleton. **So the preset was set once per app launch and a full
           stop/start cycle could never restore it.** Harmless while nothing else moved it; a latent
           trap now that ARKit does. */
        if session.sessionPreset != .photo, session.canSetSessionPreset(.photo) {
            session.beginConfiguration()
            session.sessionPreset = .photo
            session.commitConfiguration()
            HSZoneLog.record("presetReasserted", ["preset": session.sessionPreset.rawValue])
        }
        guard session.inputs.isEmpty else { return }
        guard let device = AVCaptureDevice.default(CameraLens.normal.deviceType, for: .video, position: .back) else {
            throw CameraError.noCamera
        }
        self.device = device
        self.lens = .normal

        session.beginConfiguration()
        session.sessionPreset = .photo

        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else { throw CameraError.noCamera }
        session.addInput(input)
        self.videoInput = input

        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
            photoOutput.maxPhotoQualityPrioritization = .quality
        }
        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        videoOutput.setSampleBufferDelegate(self, queue: visionQueue)
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        session.commitConfiguration()
    }

    /**
     Put the preview under the web layer and make the web layer see-through.

     ⚑ The transparency is restored in `stop()`, and that is not tidiness. A WKWebView left
     transparent over nothing is a black screen — #71's exact symptom, with no way to tell the two
     apart. #71 is closed, which is why this is allowed at all (CLAUDE.md), and leaving the app in
     that state on teardown would re-manufacture the ambiguity the rule exists to prevent.
     */
    private func attachPreview(behind webView: UIView) {
        guard let superview = webView.superview else { return }
        let container = PreviewView(frame: superview.bounds)
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.backgroundColor = .black

        let layer = container.previewLayer
        layer.session = session
        layer.videoGravity = .resizeAspectFill
        superview.insertSubview(container, belowSubview: webView)

        restoreOpaque = webView.isOpaque
        WebLayer.makeTransparent(webView)
        hostWebView = webView
        previewView = container
        previewLayer = layer
        startTrackingRotation(previewLayer: layer)
    }

    /**
     ⚑ **Hand the lens over, and hand it back. One owner at a time.**

     ARKit and an `AVCaptureSession` cannot both hold the rear camera. Running them together does
     not degrade — ARKit is refused outright with `sensorFailed`, and the AVFoundation preview
     *freezes* when ARKit takes the device out from under it. Both were visible in the field on
     2026-08-21: "Required sensor failed", a frozen viewfinder that unfroze when positioning was
     paused, and a black screen in the scan modes.

     ⛑ **The preview view and the whole controller stay in place.** Only the capture session stops,
     so coming back is `startRunning()` rather than a rebuild — which is why the handover is
     milliseconds and not the nine seconds that would come from tearing the input down.
     */
    /// ⚑ The zone takes the lens and keeps it. See `zoneOwnsCamera`.
    func takeCameraForZone() {
        zoneOwnsCamera = true
        // ⚑ Logged, because "did the new ownership code run at all" was a question two smoke tests
        // could not answer — the absence of `reclaimRefused` was ambiguous between *never called*
        // and *never reached*.
        HSZoneLog.record("cameraToZone", ["owns": true])
        yieldCamera()
    }

    /// The two moments a person actually asked for the lens back: pausing, and closing the zone.
    func giveCameraBackFromZone() {
        zoneOwnsCamera = false
        reclaimCamera()
    }

    func yieldCamera() {
        /* ⛑ **Synchronous, and asynchronous was the intermittent "Required sensor failed"**
           (field 2026-08-23).

           This was `sessionQueue.async`, so `enter()` called it and then ran ARKit **immediately**,
           while the capture session was still stopping on another queue. ARKit asked for a camera
           that was still held and was refused. ⚑ **A handover that does not wait is not a handover**
           — and it failed intermittently, which is the worst kind, because whether it worked
           depended on how busy the session queue happened to be. */
        sessionQueue.sync {
            if session.isRunning { session.stopRunning() }
        }
        HSZoneLog.record("cameraYielded", ["running": session.isRunning])
    }

    /**
     ⚑ **Refused while a zone holds the lens.**

     The zone session now runs for the life of a room rather than for the instant a pose is taken,
     so *"give the camera back"* stopped being a safe request. ⛑ Smoke test 2026-09-05: five
     `Required sensor failed` in nine minutes, a nine-second preset restore, a black screen — **and
     zero photographs through the tracking session** — because something reclaimed the lens, ARKit
     failed, the failure handler released the lens again, and round it went.

     *Ownership is a fact about the zone, not a race between two callers.*
     */
    private(set) var zoneOwnsCamera = false

    func reclaimCamera() {
        guard !zoneOwnsCamera else {
            HSZoneLog.record("reclaimRefused", ["reason": "zone owns the camera"])
            return
        }
        /* ⛑ **Synchronous, for the same reason `yieldCamera` is — and leaving this one async is why
           switching to Text froze the viewfinder** (field 2026-08-23).

           A capture runs `takePosition`, which wakes ARKit, reads a pose and hands the lens back.
           The hand-back was `async`, so the next call — `setMode`, arriving milliseconds later —
           configured a device whose capture session had not finished restarting, and the preview
           never came up. Backing out to the zone and in again rebuilt everything, which is exactly
           the shape of a fix that hides a race.

           ⚑ **I made the outbound handover synchronous a day ago and left its twin behind.** A
           handover has two ends and only one of them was waiting. */
        sessionQueue.sync {
            /*
             ⛑ **ARKit hands the lens back on ITS format, and that is the whole regression.**

             `HSZoneSession` sets `config.videoFormat` (:204, :223), which sets the shared
             `AVCaptureDevice.activeFormat`. Once `activeFormat` is set directly, the session goes to
             **`AVCaptureSessionPresetInputPriority` and `sessionPreset` stops being consulted at
             all** — so every still taken after a position handover comes off ARKit's *video* format:
             **640×480, 40 KB, visibly grainy**, measured on device 2026-08-30 across three legs and
             three object captures.

             ⚑ **This is where the fix belongs, and my first attempt at it belongs nowhere.** I put
             the preset restoration in `swapLens`, where it logged `restored: true` **and changed
             nothing** — the swap was never the cause, and the handover that was ran afterwards and
             put the device straight back on ARKit's format. *A fix that reports success while
             fixing nothing is worse than no fix*, because the log then argues against looking
             further. Same class as every other one-ended operation in this file, with the extra
             insult that the instrument agreed with it.

             Setting `sessionPreset` is what takes a session back OUT of input priority, so it is set
             here, on the way back in, inside a configuration block — and **read back afterwards**,
             because the thing consulted must be the thing that governs.
            */
            if !session.isRunning { session.startRunning() }
        }
        HSZoneLog.record("cameraReclaimed", ["running": session.isRunning])
        /*
         ⛑ **The restore is asynchronous, and that is a correction to yesterday's correction.**

         Restoring the preset *inside* the synchronous reclaim was right about the cause and wrong
         about the cost: **measured 9.3 s per handover on device 2026-08-30**, three times in one
         run, against 0.45 s before. That is the freeze and the black screen the field reported —
         *"froze up or lagged significantly when starting traverse, and then screen goes black."*
         The preview is down for the whole of a `startRunning` that has to renegotiate the device
         format ARKit left behind.

         ⚑ **A nine-second black screen is a worse defect than a soft first frame**, and the two are
         not close. So the reclaim returns immediately, the preview comes back, and the format
         settles behind it — with the settle **timed and logged**, because I have now guessed twice
         at this and a number is what ends that.
        */
        sessionQueue.async { [weak self] in
            guard let self else { return }
            let began = CACurrentMediaTime()
            guard self.session.sessionPreset != .photo, self.session.canSetSessionPreset(.photo) else { return }
            self.session.beginConfiguration()
            self.session.sessionPreset = .photo
            self.session.commitConfiguration()
            HSZoneLog.record("presetRestored", [
                "ms": (CACurrentMediaTime() - began) * 1000,
                "preset": self.session.sessionPreset.rawValue,
                // ⚑ Never assumed. If this reads false the stills are ARKit's video frames, and
                // every texture score and grain complaint downstream follows from it.
                "photoRestored": self.session.sessionPreset == .photo,
                "dims": "\(self.device?.activeFormat.highResolutionStillImageDimensions.width ?? 0)x\(self.device?.activeFormat.highResolutionStillImageDimensions.height ?? 0)",
            ])
        }
    }

    func stop() {
        statusTimer?.invalidate()
        statusTimer = nil
        stopTrackingRotation()
        // A traverse outlives nothing. Left running, its locked exposure and latched torch would
        // be inherited by the next session as settings nobody chose.
        visionQueue.async { [weak self] in
            self?.traverse = nil
            self?.isTraversing = false
            self?.traverseRequestIds.removeAll()
        }
        motion.stopDeviceMotionUpdates()
        setTorch(false)
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
            DispatchQueue.main.async {
                self.previewView?.removeFromSuperview()
                self.previewView = nil
                self.previewLayer = nil
                if let web = self.hostWebView, let was = self.restoreOpaque {
                    WebLayer.restore(web, wasOpaque: was)
                }
                self.restoreOpaque = nil
                self.hostWebView = nil
                // One last status, so the reader can see the session go down rather than infer it
                // from the stream stopping — and so the after-teardown battery sample has a mark.
                self.emitStatus(sessionRunning: false, unmet: [])
            }
        }
    }

    // MARK: mode

    /**
     Swap the glass.

     ⚑ **Refused mid-traverse, and that is not caution.** A traverse locks exposure, white balance
     and focus on its first frame and measures overlap between adjacent frames; changing the field
     of view part-way through changes what "40% of frame width" *means* and makes every pair after
     the swap incomparable with every pair before it. The run would still produce numbers, which is
     the dangerous kind of broken.

     Returns what was actually achieved — never what was asked — for the same reason `setMode` does.
     */
    @discardableResult
    func requestLens(_ wanted: CameraLens) -> Achieved {
        requestedLens = wanted
        return apply(mode: mode)
    }

    /// The session surgery alone. Split from `apply(mode:)` rather than calling back into it: a
    /// swap must be followed by a full re-configure, and two functions that each call the other to
    /// finish the job is how one of them ends up running twice.
    private func swapLens(to wanted: CameraLens) -> Bool {
        guard !isTraversing else { return false }
        guard wanted != lens else { return true }
        guard let newDevice = AVCaptureDevice.default(wanted.deviceType, for: .video, position: .back) else {
            return false
        }
        guard let newInput = try? AVCaptureDeviceInput(device: newDevice) else { return false }

        let previous = videoInput
        session.beginConfiguration()
        if let previous { session.removeInput(previous) }
        guard session.canAddInput(newInput) else {
            // Put back exactly what was there. A session left with no input is a black preview,
            // which is #71's symptom wearing someone else's clothes.
            if let previous { session.addInput(previous) }
            session.commitConfiguration()
            return false
        }
        session.addInput(newInput)
        /*
         ⛑ **Re-assert the preset, because adding an input can move it and nothing puts it back.**

         `sessionPreset` is set to `.photo` once at setup. AVFoundation is documented to change the
         preset when an input is added that cannot support the current one — and it does not change
         back when the original input returns. **Measured 2026-08-29:** after the sibling pair's
         swap, the session sat at `vga640x480` and every subsequent capture came back **640×480,
         49 KB** where the same code path had produced **2.5 MB** a fortnight earlier. The traverse
         is what found it, because a traverse takes the next captures on that session.

         ⚑ *A swap is an operation with two ends and this accounted for one of them* — the input was
         restored, the format the input implied was not. Same class as the lens itself, one layer
         down, in the change that fixed the lens. **The preset is re-asserted on every swap in both
         directions, and the achieved value is recorded rather than assumed.**
        */
        if session.canSetSessionPreset(.photo) {
            session.sessionPreset = .photo
        }
        session.commitConfiguration()
        HSZoneLog.record("lensSwap", [
            "to": wanted.rawValue,
            // Read back AFTER commit. The thing consulted must be the thing that governs.
            "preset": session.sessionPreset.rawValue,
            "restored": session.sessionPreset == .photo,
        ])

        videoInput = newInput
        device = newDevice
        lens = wanted

        /*
         All of this is per-DEVICE, so none of it survived the swap: the torch belongs to the device
         that owns it, and the rotation coordinator was built against the old one. Re-asserting
         rather than assuming is the same rule as reading `exifOrientation` off the bytes — the
         thing consulted must be the thing that governs. Focus and metering are re-applied by the
         `apply(mode:)` that called this.
        */
        torchOn = false
        torchChangedAt = nil
        companionVetoUntil = nil
        stopTrackingRotation()
        if let previewLayer { startTrackingRotation(previewLayer: previewLayer) }
        return true
    }

    func apply(mode: CameraMode) -> Achieved {
        self.mode = mode
        self.goal = ModeGoal.of(mode)
        var unmet: [String] = []

        // ⚑ The lens follows the mode's policy, and a mode that LOCKS the lens takes it back from
        // the concierge without discarding their choice — `requestedLens` holds what they asked
        // for and it is restored the moment they leave Text. Swapped before the device is read
        // below, because a swap replaces the very device this method goes on to configure.
        /* ⚑ The one thing that outranks the mode's lens policy, and it is deliberately narrow:
           the second half of a sibling pair, for the length of one exposure. `requestedLens` is
           untouched, so the concierge's standing choice survives the swap in both directions. */
        let wantedLens = siblingLensOverride ?? goal.lens(requested: requestedLens)
        if wantedLens != lens { _ = swapLens(to: wantedLens) }
        if lens != wantedLens { unmet.append("lens") }

        guard let device else { return Achieved(mode: mode, unmet: ["camera"]) }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }

            if goal.closeFocus {
                if device.isAutoFocusRangeRestrictionSupported {
                    device.autoFocusRangeRestriction = .near
                } else {
                    unmet.append("closeFocus")
                }
                if device.isFocusModeSupported(.continuousAutoFocus) {
                    device.focusMode = .continuousAutoFocus
                }
                if device.isFocusPointOfInterestSupported {
                    device.focusPointOfInterest = CGPoint(x: 0.5, y: 0.5)
                }
            } else {
                if device.isAutoFocusRangeRestrictionSupported { device.autoFocusRangeRestriction = .none }
                if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            }

            if goal.spotMeterSubject {
                if device.isExposurePointOfInterestSupported {
                    // Centre until a text box says otherwise; the live read then moves the metering
                    // point onto the characters, which is the whole difference between exposing for
                    // the plate and exposing for the bright tank beside it.
                    device.exposurePointOfInterest = CGPoint(x: 0.5, y: 0.5)
                } else {
                    unmet.append("spotMetering")
                }
            }
            if device.isExposureModeSupported(.continuousAutoExposure) {
                device.exposureMode = .continuousAutoExposure
            }
        } catch {
            unmet.append("configuration")
        }

        if goal.torch == .whenUnderLit && !device.hasTorch { unmet.append("torch") }
        if goal.bracketWhenMarginal && photoOutput.maxBracketedCapturePhotoCount < 3 { unmet.append("bracketing") }
        if goal.wantsLevel && !motion.isDeviceMotionAvailable { unmet.append("level") }
        if goal.wantsLevel && motion.isDeviceMotionAvailable && !motion.isDeviceMotionActive {
            motion.deviceMotionUpdateInterval = 0.1
            motion.startDeviceMotionUpdates()
        }

        // Reset the read and motion history: stillness measured before a mode change describes the
        // previous framing, and would let the first frame of the new mode fire the shutter.
        lastRead = .empty
        motionHistory.removeAll()
        previousFrame = nil
        lastMotion = 1.0
        evaluateTorch()
        emitStatus(sessionRunning: session.isRunning, unmet: unmet)
        return Achieved(mode: mode, unmet: unmet)
    }

    func adjust(focusPoint: CGPoint?, meteringPoint: CGPoint?, torchOverride: Bool?) {
        if let torchOverride { self.torchOverride = torchOverride }
        guard let device else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }
            if let focusPoint, device.isFocusPointOfInterestSupported {
                device.focusPointOfInterest = focusPoint
                if device.isFocusModeSupported(.autoFocus) { device.focusMode = .autoFocus }
            }
            if let meteringPoint, device.isExposurePointOfInterestSupported {
                device.exposurePointOfInterest = meteringPoint
                if device.isExposureModeSupported(.continuousAutoExposure) {
                    device.exposureMode = .continuousAutoExposure
                }
            }
        } catch { /* a failed adjust is reported by the next status, not by throwing */ }
        evaluateTorch()
    }

    // MARK: light measurement + torch

    /**
     How under-lit the scene is, 0 (bright) to 1 (dark), from what the exposure system had to do to
     reach its target: ISO relative to the format's ceiling, and shutter relative to 1/30 s.

     Measured rather than assumed, and **reported in `modeStatus` even when it changes nothing** —
     so a wrong threshold is visible as a number rather than felt as a camera that torches oddly.
     */
    private func lightScore() -> Double {
        guard let device else { return 0 }
        let format = device.activeFormat
        let isoSpan = max(1, format.maxISO - format.minISO)
        let isoLoad = Double((device.iso - format.minISO) / isoSpan)
        let seconds = CMTimeGetSeconds(device.exposureDuration)
        let shutterLoad = min(1.0, max(0.0, seconds / (1.0 / 30.0)))
        return min(1.0, max(0.0, 0.7 * isoLoad + 0.3 * shutterLoad))
    }

    /**
     Two thresholds, not one — and the reason is that the torch is **inside the loop that
     measures whether the torch is needed.**

     ⚑ Field pair, 2026-08-15: one auto-capture fired with the torch and put a specular hotspot
     across the plate; the next, 34 seconds later with nothing changed, fired without it. The
     single-threshold form makes that inevitable. `lightScore` is computed from ISO and shutter,
     the torch lights the scene, ISO falls, the score drops below the one threshold, the torch
     goes off — and five seconds later the score has risen again and it comes back on. **A
     5-second oscillator, one auto-capture landing on each phase**, which reads in the field as
     a camera that flashes at random.

     So: arm high, release **far** lower. With the torch lit a genuinely dark room still scores
     around the middle of that gap and the torch stays on; a room that was bright all along
     scores near zero with the torch adding to it, and it releases. The gap is what makes the
     actuator's own effect unable to cross back over the decision.
     */
    private static let underLitThreshold = 0.62
    /**
     ⚑ **Kept, and now known to be unreachable on its own — which is why the companion frame
     exists.**

     The paragraph above assumes the torch's own light pulls the score down across the release
     threshold. **The field run refuted that.** Five instrument readings across 98 minutes on
     2026-08-16 show `torch true` at light scores of 0.51, 0.53, 0.61, **0.99 and 1.00** — the
     score went *up* with the torch lit, and never came within a factor of three of 0.15.

     The reason is geometry, not tuning. `lightScore` is computed from ISO and shutter for the
     **whole frame**, and a torch reaches a few feet. Point it down a mechanical room and the far
     two-thirds of the picture is as dark as it ever was, so ISO stays pegged and the score stays
     near 1. *The actuator cannot lower the measurement it is judged by, so the latch has no exit.*

     Lowering the threshold cannot fix this and raising it re-creates the oscillator. The exit has
     to come from a different measurement, and `applyCompanionVerdict` is it.
     */
    private static let torchReleaseThreshold = 0.15
    /// Auto-exposure needs a moment to converge after the light changes. Deciding inside that
    /// window measures the transition rather than the scene.
    private static let torchSettleSeconds = 1.5
    private var torchChangedAt: Date?
    /**
     How far the light score must fall below where it stood when the torch armed before the torch
     lets go.

     Large on purpose. The score wanders as the camera is pointed around a room, and a small fall
     is a different wall rather than a different room — releasing on that is the oscillator this
     file already removed once. A quarter of the whole range is the size of a light being switched
     on, and nothing smaller is worth acting on.
     */
    private static let torchReleaseDrop = 0.25
    /// What the score read when the torch last armed. The baseline the drop is measured against —
    /// nil whenever the torch is off, so a stale one can never govern a later decision.
    private var lightScoreAtArm: Double?

    /**
     How long a companion frame's verdict governs arming.

     ⚑ The ruling says *don't arm the **next** capture*, and a count of captures would be the
     literal reading. It is the wrong one: between two captures the concierge is walking, and a
     torch that stays lit across that walk is the thing being complained about. So the veto is a
     window of wall-clock, and it is refreshed by every pair — which means in a room where the
     unlit frame keeps reading well the torch simply never comes back, and in a room where it
     stops reading well the torch returns within one capture.

     Reported in `modeStatus` beside the light score, so a wrong value is a number on screen.
     */
    private static let companionVetoSeconds = 30.0
    private var companionVetoUntil: Date?

    /**
     Did an accurate read of the unlit companion actually get the plate?

     Same two constants the live veto uses (`LiveRead.worthReadingCharacters`, `goodConfidence`) —
     one rule about what "read it" means, asked of a better recogniser.
     */
    private static func readSufficed(_ read: [String: Any]?) -> Bool {
        guard let read,
              let text = read["text"] as? String,
              let confidence = read["meanConfidence"] as? Double else { return false }
        let characters = text.filter { $0.isLetter || $0.isNumber }.count
        return characters >= LiveRead.worthReadingCharacters && confidence >= LiveRead.goodConfidence
    }

    /**
     Act on the companion frame, on main.

     Read well → the torch added nothing, so it stays off and does not arm for a while. Read badly
     → this room is genuinely dark, the torch earned its place, and it goes back on for the next
     shot rather than making the concierge rediscover that per capture.
     */
    private func applyCompanionVerdict(sufficed: Bool) {
        guard torchOverride == nil else { return }   // an explicit tap outranks the evidence
        if sufficed {
            companionVetoUntil = Date().addingTimeInterval(Self.companionVetoSeconds)
            if torchOn { setTorch(false) }
        } else {
            companionVetoUntil = nil
            if !torchOn { setTorch(true) }
        }
        emitStatus(sessionRunning: session.isRunning, unmet: [])
    }

    private func evaluateTorch() {
        guard let device, device.hasTorch else {
            torchOn = false
            return
        }
        if let torchOverride {
            if torchOverride != torchOn { setTorch(torchOverride) }
            return
        }
        // ⚑ Latched for the length of a traverse. Half-lit frames across one continuous move are
        // worse than either state held consistently, and a torch that switches mid-traverse is
        // the oscillation this file just removed, arriving through a different door.
        if isTraversing { return }
        switch goal.torch {
        case .never:
            if torchOn { setTorch(false) }
        case .whenUnderLit:
            if let changedAt = torchChangedAt, Date().timeIntervalSince(changedAt) < Self.torchSettleSeconds {
                return
            }
            let score = lightScore()
            /*
             ⚑ **The arm-only veto** (owner ruling 2026-08-16), and *arm-only* is the whole of its
             safety. **The goal is legible characters, not a lit room** — so if Vision is already
             reading the plate, the torch has nothing to add and a specular hotspot to lose.

             It is deliberately NOT consulted on release. A read taken while the torch is lit is a
             read *of the torch's own effect*, so letting a good lit read turn the torch off would
             put the actuator back inside the loop that decides about the actuator — the exact
             defect the hysteresis above exists to remove. Arming looks at an unlit scene, which
             is a real measurement; releasing does not, so releasing stays on the light score.

             `lastRead` is written on the vision queue and read here on main. Benign: the worst
             case is one decision taken against the previous frame's read, and a lock on this
             path would cost more than the frame is worth.
             */
            let readingWell = goal.liveText && lastRead.isReadingWell
            // ⚑ The companion frame's verdict outranks the light score in both directions, and it
            // is the only thing that can turn the torch off in a big dark room — the score cannot,
            // for the reason `torchReleaseThreshold` now records.
            let vetoed = companionVetoUntil.map { Date() < $0 } ?? false

            /*
             ⚑ **Somebody turned the light on** (owner report, 2026-08-16 evening: the torch stayed
             lit after the room light came on, and only went out after the next auto-capture).

             The absolute release threshold cannot see that, for the reason recorded on
             `torchReleaseThreshold`: with the torch lit in a big room the score stays near the top
             of its range whatever the room does, so it never falls to 0.15. And the companion
             frame — the only honest exit built so far — is only produced *by a capture*. So the
             torch was held by nothing re-reading while it held, which is the original latch wearing
             a smaller hat.

             A **drop from where the score sat when the torch armed** is visible without touching
             the actuator, and it is the one thing that distinguishes the room changing from the
             torch's own contribution: the torch's effect is a fixed offset once it is on, so any
             large fall after that belongs to the room. That keeps the arm-only discipline intact —
             nothing here consults a reading taken *because* the torch is lit; it compares two
             readings taken under the same torch state.
            */
            var roomBrightened = false
            if torchOn, let armedAt = lightScoreAtArm, score <= armedAt - Self.torchReleaseDrop {
                roomBrightened = true
            }

            let wanted = !vetoed && !roomBrightened && (torchOn
                ? score >= Self.torchReleaseThreshold
                : score >= Self.underLitThreshold && !readingWell)
            if wanted != torchOn { setTorch(wanted) }
        }
    }

    private func setTorch(_ on: Bool) {
        guard let device, device.hasTorch, device.isTorchAvailable else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }
            device.torchMode = on ? .on : .off
            torchOn = on
            torchChangedAt = Date()
            // Sampled BEFORE the torch's own light has had time to reach the sensor — this call is
            // the instant it switches, and auto-exposure needs `torchSettleSeconds` to respond. So
            // this is a reading of the unlit room, which is what the drop must be measured against.
            lightScoreAtArm = on ? lightScore() : nil
        } catch { torchOn = false }
    }

    // MARK: status

    private func startStatusSampling() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        guard statusTimer == nil else { return }
        // Five seconds: fast enough to watch a thermal state change during a walk, slow enough to
        // be free. iOS reports battery level in 5% steps, so a drain figure needs tens of minutes
        // before it means anything — which is a fact about the instrument, not about the app.
        let timer = Timer(timeInterval: 5.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.evaluateTorch()
            self.emitStatus(sessionRunning: self.session.isRunning, unmet: [])
        }
        RunLoop.main.add(timer, forMode: .common)
        statusTimer = timer
    }

    private func thermalWord() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }

    private func batteryStateWord() -> String {
        switch UIDevice.current.batteryState {
        case .charging: return "charging"
        case .full: return "full"
        case .unplugged: return "unplugged"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }

    private func emitStatus(sessionRunning: Bool, unmet: [String]) {
        var payload: [String: Any] = [
            "mode": mode.rawValue,
            "unmet": unmet,
            /* ⛑ **The camera can be running without OUR session running, and the field read the
               difference as a fault.** Inside a zone ARKit holds the lens for the life of the room,
               so `session.isRunning` is false while the camera is very much on — and a viewfinder
               that says *stopped* over a live preview is a lie told confidently.

               ⚑ *The question this field answers is "is the camera live", not "is my object
               running."* Ownership is the other half of the answer and it ships beside it. */
            "sessionRunning": sessionRunning || zoneOwnsCamera,
            "cameraHeldByZone": zoneOwnsCamera,
            "torchOn": torchOn,
            "torchOverridden": torchOverride != nil,
            "lightScore": lightScore(),
            "underLitThreshold": Self.underLitThreshold,
            // The release threshold rides beside the arm threshold so the hysteresis gap is a
            // pair of numbers on screen rather than a constant somebody has to go and read.
            "torchReleaseThreshold": Self.torchReleaseThreshold,
            // Why the torch is off when the light score says it should be on. Without this the
            // companion veto is an invisible hand and the panel reads as a contradiction.
            "companionVetoActive": companionVetoUntil.map { Date() < $0 } ?? false,
            /*
             ⚑ **What the light score is actually made of**, because the score alone cannot say
             whether the arm threshold is wrong or the room is simply not that dark.

             The owner walked into a dark room on 2026-08-17 with auto-capture on and the torch
             never fired; his mechanical room reads 0.25–0.50 against an arm threshold of 0.62.
             `lightScore` is `0.7 · isoLoad + 0.3 · shutterLoad`, and `isoLoad` is ISO measured
             against **this format's ceiling** — so a sensor with a very high maximum reads a dim
             room as only mildly dark, and the score can sit near the middle of its range in a room
             nobody could read a plate in.

             That is a claim about numbers nobody has looked at. These are those numbers. ⚑ It
             deliberately does NOT move the threshold: 0.62 was set before this session and how it
             was calibrated is not recorded anywhere, so changing it now would be replacing one
             unexplained constant with another.
            */
            "iso": Double(device?.iso ?? 0),
            "isoMax": Double(device?.activeFormat.maxISO ?? 0),
            "isoMin": Double(device?.activeFormat.minISO ?? 0),
            "exposureMs": device.map { CMTimeGetSeconds($0.exposureDuration) * 1000 } ?? 0,
            // The glass in use, what this mode defaults to, and whether the concierge may change
            // it. All three, because "wide is off" and "wide is not allowed here" are different
            // sentences and a single boolean would say neither.
            /* ⛑ **Inside a zone the lens cannot change, and saying otherwise is how a photograph
               came back "wide" after a room shot.** World tracking is offered only the wide-angle
               device on this iPad — thirteen formats, zero ultra-wide (`HSLensProbe`, 2026-08-24) —
               so while the zone holds the camera there is exactly one piece of glass and no choice
               to report. **A control offering a lens the photograph cannot have is worse than no
               control.** */
            "lensLocked": zoneOwnsCamera || goal.lensLocked,
            "lens": zoneOwnsCamera ? CameraLens.normal.rawValue : lens.rawValue,
            "lensAvailable": zoneOwnsCamera
                ? false
                : AVCaptureDevice.default(CameraLens.wide.deviceType, for: .video, position: .back) != nil,
            // ⚑ Whether the per-frame instruments are being measured at all. During a traverse the
            // frame callback belongs to the accumulator, so motion is not sampled — and a stale
            // number sitting there unlabelled is what the 2026-08-16 panels showed.
            "motionLive": !isTraversing,
            "previewRotationAngle": Double(previewRotationAngle),
            "captureRotationAngle": Double(captureRotationAngle),
            "thermalState": thermalWord(),
            "battery": [
                "level": Double(UIDevice.current.batteryLevel),
                "state": batteryStateWord()
            ],
            "at": ISO8601DateFormatter().string(from: Date())
        ]
        if let attitude = motion.deviceMotion?.attitude {
            let pitchDegrees = attitude.pitch * 180 / .pi
            let rollDegrees = attitude.roll * 180 / .pi
            payload["level"] = [
                "pitch": pitchDegrees,
                "roll": rollDegrees,
                // Held square to a wall plate: the iPad is upright and not twisted. Three degrees
                // is about what a hand can hold and well inside what perspective correction fixes.
                "square": abs(rollDegrees) < 3.0
            ]
        }
        onStatus?(payload)
    }

    private func capabilities(unmetAtStart: [String]) -> [String: Any] {
        let device = self.device
        return [
            "torch": device?.hasTorch ?? false,
            "nearFocus": device?.isAutoFocusRangeRestrictionSupported ?? false,
            "spotMetering": device?.isExposurePointOfInterestSupported ?? false,
            "maxBracketedFrames": photoOutput.maxBracketedCapturePhotoCount,
            "level": motion.isDeviceMotionAvailable,
            "textRecognition": true,
            /*
             ⚑ **Reported, not used.** The owner asked for a wider view in tight spaces (field note
             1, 2026-08-16) — and that request cannot be served by zoom, which only ever narrows.
             Going wider than the standard lens means switching to `builtInUltraWideCamera`, and
             whether this iPad has one is a fact about the model, not something to assume: iPad Pro
             carries an ultra-wide, iPad Air and the base iPad do not.

             So the fact is published and the switch is not built. Choosing a lens is a capture
             decision — which lens, chosen by whom, and whether a traverse may change it mid-run —
             and it needs a ruling before it needs code. This line means the next run answers
             *is it even possible on this device* without anyone guessing.
             */
            "lenses": Self.availableLensNames(),
            "arkit": Self.arCapabilities(),
            "unmetAtStart": unmetAtStart
        ]
    }

    /**
     ⚑ **What ARKit's world tracking will actually give us — the whole list, not a yes/no.**

     The traverse is ruled wide, and pose requires an `ARSession`, so whether world tracking offers
     the ultra-wide decides whether pose is reachable without giving up the lens ruling. Apple's
     only documented ultra-wide example is a **face**-tracking session, which is suggestive and not
     dispositive — so it is enumerated rather than assumed.

     ⚑ **Every format, with its device, resolution and frame rate**, because a binary answer would
     hide the third option: something between normal and ultra-wide, or ultra-wide at a reduced
     frame rate, is a trade nobody has priced. A virtual device — `builtInDualWideCamera`,
     `builtInTripleCamera` — is also an answer, since those can reach the ultra-wide lens.

     Field of view is reported per rear device from AVFoundation rather than per format, because
     `ARConfiguration.VideoFormat` does not expose it. Degrees are what makes "between" legible.

     Read-only. It enumerates class properties and never starts a session, so it cannot collide
     with the running capture.
     */
    /// Evaluated once on first touch, which is what makes the load-time log a single line.
    static let arCapabilitiesLogged: [String: Any] = arCapabilities()

    static func arCapabilities() -> [String: Any] {
        var formats: [[String: Any]] = []
        for format in ARWorldTrackingConfiguration.supportedVideoFormats {
            // The package floor is iOS 15 and high-resolution capture arrived in 16, so the flag
            // is reported only where it exists rather than raising the floor for a diagnostic.
            var entry: [String: Any] = [
                "device": format.captureDeviceType.rawValue,
                "width": Int(format.imageResolution.width),
                "height": Int(format.imageResolution.height),
                "fps": format.framesPerSecond
            ]
            if #available(iOS 16.0, *) {
                entry["hiResCapable"] = format.isRecommendedForHighResolutionFrameCapturing
            }
            formats.append(entry)
        }
        // The degrees behind each lens name, so "between normal and ultra-wide" is legible.
        var lenses: [[String: Any]] = []
        let types: [AVCaptureDevice.DeviceType] = [
            .builtInWideAngleCamera, .builtInUltraWideCamera, .builtInTelephotoCamera,
            .builtInDualWideCamera, .builtInTripleCamera
        ]
        for type in AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video,
                                                     position: .back).devices {
            lenses.append([
                "device": type.deviceType.rawValue,
                "fieldOfView": Double(type.activeFormat.videoFieldOfView)
            ])
        }
        func describe(_ f: ARConfiguration.VideoFormat?) -> String {
            guard let f else { return "none" }
            return "\(Int(f.imageResolution.width))x\(Int(f.imageResolution.height))@\(f.framesPerSecond) \(f.captureDeviceType.rawValue)"
        }
        var out: [String: Any] = [
            "worldTrackingSupported": ARWorldTrackingConfiguration.isSupported,
            "meshSupported": ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
            "formats": formats,
            "rearLenses": lenses
        ]
        if #available(iOS 16.0, *) {
            out["recommended4K"] = describe(ARWorldTrackingConfiguration.recommendedVideoFormatFor4KResolution)
            out["recommendedHiRes"] = describe(ARWorldTrackingConfiguration.recommendedVideoFormatForHighResolutionFrameCapturing)
        }
        // ⚑ Logged as well as returned: the answer decides a sequencing question, and reading it
        // off a device log is faster than a screenshot round-trip.
        NSLog("HS-ARKIT-CAPABILITIES %@", String(describing: out))
        return out
    }

    /// What rear lenses this device actually offers, by Apple's own type names.
    private static func availableLensNames() -> [String] {
        var types: [AVCaptureDevice.DeviceType] = [.builtInWideAngleCamera, .builtInTelephotoCamera]
        types.append(.builtInUltraWideCamera)
        let discovery = AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: .back)
        return discovery.devices.map { $0.deviceType.rawValue }
    }

    // MARK: the shutter-sound probe

    /// Exposed so the bridge can report the lens actually in the session, never the request.
    var currentLens: CameraLens { lens }

    private var audioRecorder: AVAudioRecorder?

    /**
     Start recording, with the audio session configured the way a run trace would need it.

     ⚑ `.playAndRecord` with `.mixWithOthers` is the configuration under test, not an arbitrary
     one: it is what a narrated run trace would run under, and the question is whether the camera's
     shutter sound survives it. `.defaultToSpeaker` is omitted deliberately — routing the monitor to
     the speaker would let the speaker's own output reach the microphone and manufacture the very
     click we are trying to detect.
     */
    func startAudioProbe(completion: @escaping (Result<[String: Any], Error>) -> Void) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async {
                guard granted else {
                    completion(.failure(CameraError.captureFailed("Microphone access was refused.")))
                    return
                }
                do {
                    let session = AVAudioSession.sharedInstance()
                    try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers])
                    try session.setActive(true)

                    let url = FileManager.default.temporaryDirectory
                        .appendingPathComponent("hs-audio-probe-\(Int(Date().timeIntervalSince1970)).m4a")
                    let settings: [String: Any] = [
                        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                        AVSampleRateKey: 44_100,
                        AVNumberOfChannelsKey: 1,
                        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
                    ]
                    let recorder = try AVAudioRecorder(url: url, settings: settings)
                    recorder.isMeteringEnabled = true
                    guard recorder.record() else {
                        completion(.failure(CameraError.captureFailed("The recorder would not start.")))
                        return
                    }
                    self.audioRecorder = recorder
                    completion(.success([
                        "path": url.path,
                        "startedAt": ISO8601DateFormatter().string(from: Date()),
                        // The two facts that decide whether a negative result means anything: if
                        // the device is muted or another app owns the session, "no click" proves
                        // nothing about the click.
                        "category": session.category.rawValue,
                        "otherAudioPlaying": session.isOtherAudioPlaying
                    ]))
                } catch {
                    completion(.failure(error))
                }
            }
        }
    }

    func stopAudioProbe(completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard let recorder = audioRecorder else {
            completion(.failure(CameraError.captureFailed("No audio probe is running.")))
            return
        }
        let url = recorder.url
        recorder.stop()
        audioRecorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.size] as? Int ?? 0
        completion(.success([
            "path": url.path,
            "bytes": bytes,
            "endedAt": ISO8601DateFormatter().string(from: Date())
        ]))
    }

    // MARK: capture

    /// Capacitor dispatches plugin calls off the main queue; job bookkeeping lives on main, so the
    /// hop happens once here rather than at three places inside.
    func capture(wideSibling: Bool = false, _ completion: @escaping (Result<[String: Any], Error>) -> Void) {
        if Thread.isMainThread {
            performCapture(wideSibling: wideSibling, completion)
        } else {
            DispatchQueue.main.async { [weak self] in self?.performCapture(wideSibling: wideSibling, completion) }
        }
    }

    private func performCapture(wideSibling: Bool,
                                _ completion: @escaping (Result<[String: Any], Error>) -> Void) {
        // Same barrier as `startTraverse`, same reason: a still taken while the format restore is
        // still in flight is ARKit's video frame wearing a photograph's filename.
        sessionQueue.sync { }
        guard session.isRunning else {
            completion(.failure(CameraError.notRunning))
            return
        }
        // Extra exposures only when the live read came back marginal — see `LiveRead.isMarginal`.
        let wantsBracket = goal.bracketWhenMarginal && lastRead.isMarginal
            && photoOutput.maxBracketedCapturePhotoCount >= 3
        /*
         ⚑ **When the torch fires, the no-torch frame comes with it** (owner ruling 2026-08-16).

         Hysteresis stopped the torch flickering. It did not stop a torch that is *correctly* on
         from ruining the shot: the hotspot on the owner's plate landed on `197 Min V` rather
         than the model line **by luck**, and where it lands is positional — no threshold can
         move it. The unlit frame holds exactly the characters the lit one erased.

         ⚑ And the pair is **one reader on two illuminations of one plate** — *not* two independent
         readings. Wherever the two transcriptions disagree, the disagreement localises the glare to
         those characters, which is a property of taking the pair at all. ⛑ **But the same Vision
         revision reads both**, so a systematic error of that reader appears identically in each and
         cancels out of the comparison. *Field 5's second independent reading is a second **reader**,
         and it is not built.* Called two independent reads here until 2026-09-01, which would have
         let a roadmap tick a box this does not fill.

         Paired only when the torch actually fires — one extra frame, on the minority of captures
         where there is anything to compare. Never during a traverse, where the torch is latched
         and the exposure locked, and a mid-traverse torch cycle would break both.

         ⚑ **And the unlit frame now goes FIRST** (owner ruling 2026-08-16, from the field). The
         owner starts moving the instant the flash fires, because *the flash reads as done* — so
         with the flash first, the companion was being taken during the motion the flash invited.
         Reordered rather than frozen: freezing the preview would hide the motion instead of
         removing it, and the photograph would still be taken while the iPad was moving.
         */
        let wantsTorchPair = torchOn && !isTraversing

        /* ⛑ **A mode that locks its lens refuses the sibling too, and it must.** Text is locked to
           normal because a 120° lens bends straight lines near the frame edge and a plate is
           straight lines — so a wide frame of a plate is not a second look at it, it is a worse
           one. Refused here rather than at the door, so the rule lives with the policy it belongs
           to instead of being restated in TypeScript. */
        /* ⚑ **The sibling is THE OTHER GLASS, not "the wide one".**

           The room shot already defaults to wide — `lensPolicyFor`, owner ruling 2026-08-16, *both
           are "get the whole of it in"* — so a pair defined as "add the 120° frame" would have
           refused itself on the one door that asks for it, and delivered a single frame that looked
           entirely normal. ⛑ *A feature that declines on its only caller, silently, is the shape of
           every rule-43 instance in this repo.*

           Defined as the other glass it holds whichever way round the concierge is pointing: they
           keep the framing they chose as the PRIMARY, and the frame they did not choose arrives
           beside it. */
        let wantsWide = wideSibling && !goal.lensLocked && !isTraversing

        if wantsTorchPair {
            beginPairWithUnlitFrame(bracketed: wantsBracket, wideSibling: wantsWide, completion: completion)
            return
        }

        let settings: AVCapturePhotoSettings
        if wantsBracket {
            let biases: [Float] = [-1.0, 0.0, 1.0]
            let brackets = biases.map { AVCaptureAutoExposureBracketedStillImageSettings.autoExposureSettings(exposureTargetBias: $0) }
            let bracket = AVCapturePhotoBracketSettings(
                rawPixelFormatType: 0,
                processedFormat: [AVVideoCodecKey: AVVideoCodecType.jpeg],
                bracketedSettings: brackets
            )
            bracket.isLensStabilizationEnabled = photoOutput.isLensStabilizationDuringBracketedCaptureSupported
            settings = bracket
        } else {
            settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            settings.photoQualityPrioritization = .quality
        }

        let id = settings.uniqueID
        jobs[id] = CaptureJob(
            completion: completion,
            bracketed: wantsBracket,
            torchAtCapture: torchOn,
            lens: lens,
            outstanding: wantsBracket ? 3 : 1,
            wantsTorchPair: wantsTorchPair,
            wantsWideSibling: wantsWide
        )
        torchForRequest[id] = torchOn

        // ⚑ On main, from the cached coordinator angle. The previous version read
        // `UIDevice.current.orientation` right here — on Capacitor's background call queue, where
        // that property is not valid — and the field stills came back unrotated while the preview,
        // driven from a main-thread notification, rotated correctly. Same class as any other
        // "the thing consulted was not the thing that governs".
        applyRotation(captureRotationAngle, to: photoOutput.connection(with: .video))
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    private func applyRotation(_ angle: CGFloat, to connection: AVCaptureConnection?) {
        guard let connection else { return }
        if #available(iOS 17.0, *) {
            if connection.isVideoRotationAngleSupported(angle) { connection.videoRotationAngle = angle }
        } else {
            Self.applyLegacyOrientation(angle, to: connection)
        }
    }

    /// Pre-iOS-17 path. Isolated in its own function so the deprecation is declared once rather
    /// than warned about at the call site of a branch that only runs on iOS 15/16.
    @available(iOS, introduced: 15.0, deprecated: 17.0, message: "videoRotationAngle above 17")
    private static func applyLegacyOrientation(_ angle: CGFloat, to connection: AVCaptureConnection) {
        let orientation: AVCaptureVideoOrientation
        switch Int(angle.rounded()) % 360 {
        // ⚑ `AVCaptureVideoOrientation` is INTERFACE orientation. Reading these four lines as
        // device orientations is the exact mistake that shipped: landscape inverted, portrait
        // fine, and the symptom blamed on the overlay.
        case 0: orientation = .landscapeRight
        case 180: orientation = .landscapeLeft
        case 270: orientation = .portraitUpsideDown
        default: orientation = .portrait
        }
        if connection.isVideoOrientationSupported { connection.videoOrientation = orientation }
    }

    /// 0 → `.up`, 90 → `.right`, 180 → `.down`, 270 → `.left`. The angle is the clockwise
    /// rotation that brings the buffer upright, which is exactly what these constants name.
    static func imageOrientation(forRotationAngle angle: CGFloat) -> CGImagePropertyOrientation {
        switch Int(angle.rounded()) % 360 {
        case 0: return .up
        case 180: return .down
        case 270: return .left
        default: return .right
        }
    }

    /**
     Start following the device's rotation, and apply it to the preview immediately.

     The coordinator is created against the preview layer so its preview angle already accounts
     for the layer's own geometry; `videoRotationAngleForHorizonLevelCapture` is cached rather
     than read at capture time because `capture` runs on Capacitor's background call queue.
     */
    private func startTrackingRotation(previewLayer: AVCaptureVideoPreviewLayer) {
        guard let device else { return }
        guard #available(iOS 17.0, *) else {
            legacyTrackOrientation()
            return
        }
        let coordinator = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: previewLayer)
        rotationCoordinatorStore = coordinator
        rotationObservations = [
            coordinator.observe(\.videoRotationAngleForHorizonLevelPreview, options: [.initial, .new]) { [weak self] c, _ in
                guard let self else { return }
                self.previewRotationAngle = c.videoRotationAngleForHorizonLevelPreview
                self.applyRotation(self.previewRotationAngle, to: self.previewLayer?.connection)
            },
            coordinator.observe(\.videoRotationAngleForHorizonLevelCapture, options: [.initial, .new]) { [weak self] c, _ in
                self?.captureRotationAngle = c.videoRotationAngleForHorizonLevelCapture
            }
        ]
    }

    /// iOS 15/16 only. Same angle vocabulary as the coordinator, so everything downstream —
    /// the preview, the still and Vision — reads one number whichever path produced it.
    private func legacyTrackOrientation() {
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(
            forName: UIDevice.orientationDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            let angle: CGFloat
            switch UIDevice.current.orientation {
            // The inversion, written out: device-landscape-left IS interface-landscape-right.
            case .landscapeLeft: angle = 0
            case .landscapeRight: angle = 180
            case .portraitUpsideDown: angle = 270
            case .portrait: angle = 90
            default: return // face up/down/unknown: keep the last real orientation
            }
            self.previewRotationAngle = angle
            self.captureRotationAngle = angle
            self.applyRotation(angle, to: self.previewLayer?.connection)
        }
    }

    private func stopTrackingRotation() {
        rotationObservations.forEach { $0.invalidate() }
        rotationObservations = []
        rotationCoordinatorStore = nil
    }

    /**
     The EXIF orientation actually written into a frame — read back off the bytes, not assumed.

     ⚑ This exists because the field pair on 2026-08-15 came back 4032×3024 with orientation 1
     on a portrait photograph: the rotation was not applied *at all*, while the preview in the
     same session was rotating. Which of the several candidate mechanisms did that was not
     decidable from two JPEGs, so the number is now in the capture payload and the next run
     answers it by showing rather than by argument. Absent tag means 1 by specification.
     */
    /* ⛑  so the zone session can stamp the SAME orientation on a still it took itself.
       Two implementations of "which way up is this JPEG" is how a frame ends up sideways in one
       path and upright in the other, with nothing saying which is right. */
    static func exifOrientation(of jpeg: Data) -> Int {
        guard let source = CGImageSourceCreateWithData(jpeg as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let value = properties[kCGImagePropertyOrientation] as? Int
        else { return 1 }
        return value
    }

    /**
     A delivered exposure, routed to whichever path asked for it.

     Two paths, two queues, and each piece of state is touched from exactly one of them: traverse
     bookkeeping lives on `visionQueue` (where the accumulator that fires it already runs), and
     capture jobs live on main. The routing question — which path is this id — is therefore asked
     on `visionQueue`, because that is the queue that owns the set being consulted.
     */
    fileprivate func finish(id: Int64, data: Data?, error: Error?) {
        visionQueue.async { [weak self] in
            guard let self else { return }
            if self.traverseRequestIds.contains(id) {
                self.completeTraverseFrame(id: id, data: data, error: error)
            } else {
                DispatchQueue.main.async { self.completeCaptureFrame(id: id, data: data, error: error) }
            }
        }
    }

    /// `forcedJob` is how a refused wide sibling re-enters the completion path with no delivery
    /// of its own: there is no settings id to look up because no photo was ever requested.
    private func completeCaptureFrame(id: Int64, data: Data?, error: Error?, forcedJob: CaptureJob? = nil) {
        guard let job = forcedJob ?? jobs[id] else { return }
        let requestedWithTorch = torchForRequest[id] ?? false

        if let error {
            release(job)
            job.completion(.failure(CameraError.captureFailed(error.localizedDescription)))
            return
        }
        // ⚑ Routed by ROLE, not by arrival order. The unlit companion now arrives first and is
        // held aside; the lit frames fill the array. `torchForRequest` is the authority on which
        // is which, stamped when the request was made rather than read off `torchOn` now — by now
        // the pair has already switched it.
        if let data {
            // `lens` is read HERE rather than off the job: during the wide stage the session is
            // genuinely on the other glass, and that is the fact the frame is meant to carry.
            let frame = CaptureJob.Frame(data: data, torch: requestedWithTorch, lens: lens)
            if job.wideFired && job.wideFrame == nil {
                job.wideFrame = frame
            } else if job.wantsTorchPair && !requestedWithTorch {
                job.companion = frame
            } else {
                job.frames.append(frame)
            }
        }
        job.outstanding -= 1
        guard job.outstanding <= 0 else { return }

        // The lit half is owed. Fire it before completing, so both halves arrive as one capture —
        // the concierge pressed once and must get one result back — and so the flash lands last.
        if job.wantsTorchPair && !job.pairFired {
            job.pairFired = true
            release(job)
            fireLitHalf(for: job)
            return
        }

        /*
         ⚑ **The other glass, in the same tap** — the sibling pair (running list item 7).

         *The lens is a substitute for stepping backwards*, and in a mechanical room there is often
         nowhere to step. So a room shot takes both: a 1× frame that carries the measured position,
         and a 120° frame beside it that inherits from its own sibling.

         ⛑ **It cannot be one exposure.** World tracking is offered only the wide-angle format on
         this iPad (`HSLensProbe`, 2026-08-24) — the physical ultra-wide exists and ARKit is not
         given it — so a positioned 0.5× frame is not available at any price. Two frames, one press,
         and the position lives on the one that can hold it.

         Fired here, after the torch pair, for the same reason the lit half is: the concierge
         pressed once and gets one result back.
        */
        if job.wantsWideSibling && !job.wideFired && job.wideRefused == nil {
            job.wideFired = true
            release(job)
            fireWideSibling(for: job)
            return
        }

        // ⚑ **The glass goes back before anything else happens.** A swap is an operation with two
        // ends, and this project's recurring defect is accounting for one of them: the preview,
        // the next capture and the next `takePosition` all inherit whatever is left here.
        if job.wideFired { restoreLensAfterWideSibling() }

        release(job)
        // The lamp goes out behind the pair. Whether it comes back is `applyCompanionVerdict`'s
        // decision, taken on the unlit frame's accurate read rather than on the light score.
        if job.wantsTorchPair { setTorch(false) }
        /*
         ⚑ **The torch is NOT restored here, and that deletion is the owner's ruling of 2026-08-16.**

         It used to be `setTorch(job.torchAtCapture)` — put it back the way the concierge found it.
         In the field that read as *the torch comes back on and stays on* (owner note 2, and
         `torch true` in all five instrument screenshots across 98 minutes), because the release
         threshold could never be reached: see `torchReleaseThreshold`.

         The pair has just handed us the one thing the light score cannot give — **a look at this
         scene with the actuator off.** So the torch stays off until that frame has been read, and
         `applyCompanionVerdict` decides from evidence whether it comes back. Restoring it first
         and deciding a second later would be the blink with an extra step.
         */
        let angle = Double(captureRotationAngle)
        let currentMode = mode
        let wantsDeskew = goal.detectPageEdges
        let wantsText = goal.liveText
        processingQueue.async { [weak self] in
            self?.assemble(job: job, id: id, rotationAngle: angle, mode: currentMode,
                           wantsDeskew: wantsDeskew, wantsText: wantsText)
        }
    }

    /**
     The 120° half of a sibling pair: swap the glass, take one frame, and hand the glass back.

     ⚑ **A refusal completes the capture rather than failing it.** The 1× frame is already in hand
     and it is the one carrying the position; losing a room shot because the second lens was busy
     would trade the frame that matters for the frame that helps. The reason is recorded on the
     result, because *an absence with no reason* is the signal nobody can act on.
     */
    private func fireWideSibling(for job: CaptureJob) {
        let other: CameraLens = lens == .wide ? .normal : .wide
        guard AVCaptureDevice.default(other.deviceType, for: .video, position: .back) != nil else {
            job.wideRefused = "no \(other.rawValue) lens on this device"
            completeCaptureFrame(id: -1, data: nil, error: nil, forcedJob: job)
            return
        }
        let started = CACurrentMediaTime()
        siblingLensOverride = other
        let achieved = apply(mode: mode)
        guard lens == other else {
            siblingLensOverride = nil
            _ = apply(mode: mode)
            job.wideRefused = achieved.unmet.contains("lens") ? "lens swap refused" : "swap did not take"
            completeCaptureFrame(id: -1, data: nil, error: nil, forcedJob: job)
            return
        }
        job.lensSwapMs = (CACurrentMediaTime() - started) * 1000

        // Exposure and focus were just re-asserted on a device that has never seen this scene.
        // The same settle the torch pair gets, for the same reason: a frame taken mid-converge is
        // a frame nobody can compare against the one beside it.
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.torchPairSettleSeconds) { [weak self] in
            guard let self else { return }
            guard self.session.isRunning else {
                self.restoreLensAfterWideSibling()
                job.wideRefused = "session stopped"
                self.completeCaptureFrame(id: -1, data: nil, error: nil, forcedJob: job)
                return
            }
            let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            settings.photoQualityPrioritization = .quality
            let id = settings.uniqueID
            job.outstanding = 1
            self.jobs[id] = job
            // ⛑ The torch is NOT fired for this frame. A 120° frame is a framing shot; a hotspot
            // sized for a plate 300 mm away lights a fifth of it and blows that fifth out.
            self.torchForRequest[id] = false
            self.applyRotation(self.captureRotationAngle, to: self.photoOutput.connection(with: .video))
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    /// Undo the override and re-run the mode's own policy. Never `requestLens` — that would write
    /// the concierge's standing choice, and this swap was the app's decision, not theirs.
    private func restoreLensAfterWideSibling() {
        guard siblingLensOverride != nil else { return }
        siblingLensOverride = nil
        _ = apply(mode: mode)
    }

    /// Every settings id pointing at this job — a torch pair registers two.
    private func release(_ job: CaptureJob) {
        for (key, value) in jobs where value === job {
            jobs[key] = nil
            torchForRequest[key] = nil
        }
    }

    /**
     Half one of a reordered pair: the torch goes out and the unlit frame is taken.

     The scene is genuinely darker with the torch off, so this frame wants the exposure system's own
     answer rather than the lit frame's settings — which is what continuous AE gives it, once it has
     had `torchPairSettleSeconds` to converge.
     */
    private func beginPairWithUnlitFrame(bracketed: Bool, wideSibling: Bool,
                                         completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let job = CaptureJob(completion: completion, bracketed: bracketed, torchAtCapture: true,
                             lens: lens, outstanding: 1, wantsTorchPair: true,
                             wantsWideSibling: wideSibling)
        setTorch(false)
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.torchPairSettleSeconds) { [weak self] in
            guard let self else { return }
            let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            settings.photoQualityPrioritization = .quality
            let id = settings.uniqueID
            self.jobs[id] = job
            self.torchForRequest[id] = false
            self.applyRotation(self.captureRotationAngle, to: self.photoOutput.connection(with: .video))
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    /// Half two: the torch comes back and the lit frames are taken, so the flash is the last thing
    /// that happens and "done" means done.
    private func fireLitHalf(for job: CaptureJob) {
        setTorch(true)
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.torchPairSettleSeconds) { [weak self] in
            guard let self else { return }
            let settings: AVCapturePhotoSettings
            if job.bracketed {
                let biases: [Float] = [-1.0, 0.0, 1.0]
                let brackets = biases.map {
                    AVCaptureAutoExposureBracketedStillImageSettings.autoExposureSettings(exposureTargetBias: $0)
                }
                let bracket = AVCapturePhotoBracketSettings(
                    rawPixelFormatType: 0,
                    processedFormat: [AVVideoCodecKey: AVVideoCodecType.jpeg],
                    bracketedSettings: brackets
                )
                bracket.isLensStabilizationEnabled = self.photoOutput.isLensStabilizationDuringBracketedCaptureSupported
                settings = bracket
            } else {
                settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
                settings.photoQualityPrioritization = .quality
            }
            let id = settings.uniqueID
            self.jobs[id] = job
            self.torchForRequest[id] = true
            job.outstanding = job.bracketed ? 3 : 1
            self.applyRotation(self.captureRotationAngle, to: self.photoOutput.connection(with: .video))
            self.photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    /// The expensive half — deskew, disk, OCR — off the main thread.
    private func assemble(job: CaptureJob, id: Int64, rotationAngle: Double, mode: CameraMode,
                          wantsDeskew: Bool, wantsText: Bool) {
        // ⚑ Document is a DIFFERENT CAMERA, not a photograph with a label. Built as the latter it
        // produces a curled invoice at an angle that reads badly — so the page is found and
        // flattened here, and `deskewed` reports whether it actually was.
        var deskewed = false
        // ⚑ Companion last, however the clock ordered them. See `CaptureJob.companion`: the EV
        // labels, the agreement comparison, the deskew and the top-level read all key off position.
        var outgoing = job.frames
        if let companion = job.companion { outgoing.append(companion) }
        // ⚑ **After the companion**, so the array shape stays: primary, [bracket], [companion],
        // [wide]. Every index-keyed reading downstream — the EV labels, the agreement comparison,
        // the top-level read — was written against positions, and appending anywhere but the end
        // moves all of them silently.
        if let wide = job.wideFrame { outgoing.append(wide) }
        if wantsDeskew, let first = outgoing.first, let flattened = Self.flattenPage(jpeg: first.data) {
            outgoing[0] = CaptureJob.Frame(data: flattened, torch: first.torch, lens: first.lens)
            deskewed = true
        }

        // Written to disk and returned as paths rather than base64: three 12 MP frames as base64 is
        // tens of megabytes crossing the bridge as a string, and the web layer wants a Blob at the
        // far end of it anyway.
        var written: [[String: Any]] = []
        var reads: [[String: Any]?] = []
        for (index, frame) in outgoing.enumerated() {
            let name = "hs-capture-\(id)-\(index).jpg"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            guard (try? frame.data.write(to: url, options: .atomic)) != nil else { continue }
            // ⚑ Read EVERY frame, not just the first. On a torch pair that is the whole point:
            // two independent reads of one plate, and where they disagree is where the glare was.
            let read = wantsText ? Self.readAccurately(jpeg: frame.data) : nil
            reads.append(read)
            var entry: [String: Any] = [
                "path": url.path,
                "bytes": frame.data.count,
                "index": index,
                // Read off the written bytes. 1 on a portrait shot means the rotation never
                // reached the photo connection — the 2026-08-15 finding, now self-reporting.
                // A deskewed document frame is legitimately 1: the page was straightened
                // into upright pixels, so there is nothing left for the tag to say.
                "exifOrientation": Self.exifOrientation(of: frame.data),
                "torch": frame.torch,
                // Per frame, because in a sibling pair they differ — see `CaptureJob.Frame.lens`.
                "lens": frame.lens.rawValue
            ]
            if let read { entry["ocr"] = read }
            written.append(entry)
        }
        guard !written.isEmpty else {
            job.completion(.failure(CameraError.captureFailed("could not write frames to disk")))
            return
        }

        var payload: [String: Any] = [
            "frames": written,
            "mode": mode.rawValue,
            "torchUsed": job.torchAtCapture,
            /*
             ⚑ **Which glass took this frame, recorded on the frame** (owner ruling 2026-08-16).

             *A missing object means something different at 65° than at 120°.* A desk reading a
             room shot and asking "why is the water heater not in any of these" needs to know
             whether the concierge had the wide view available and it still did not fit, or was
             shooting normal and simply could not step back far enough. Without this the two are
             indistinguishable and the wrong one gets acted on.
            */
            /* ⛑ The lens the capture was TAKEN under — the 1× frame, the one carrying the
               position. It is no longer a description of every frame: read `frames[i].lens` for
               that. Kept under its own name rather than removed, because a manifest field that
               changes meaning silently is worse than one that gains a neighbour. */
            "lens": job.lens.rawValue,
            /// Whether a 120° sibling was asked for, whether one arrived, and what it cost.
            "wideSibling": job.wideFrame != nil,
            "wideRefused": job.wideRefused as Any,
            "lensSwapMs": job.lensSwapMs as Any,
            "bracketed": job.bracketed,
            "torchPaired": job.pairFired,
            // Reported rather than assumed: a document capture where no page was found is a
            // photograph of a page, and the difference matters to whoever reads it later.
            "deskewed": deskewed,
            // The angle asked of the photo connection, beside the orientation each frame came
            // back carrying. Two numbers that must agree; printed so they can be seen not to.
            "rotationAngle": rotationAngle,
            "at": ISO8601DateFormatter().string(from: Date())
        ]

        /*
         ⚑ How much the lit and unlit reads of the same plate agree.

         The pair is two independent reads by construction; this is the one number that says
         whether they *found the same characters*, so a glare that erased something announces
         itself instead of waiting to be noticed at the desk. Fingerprinted — sorted alphanumerics
         — for the same reason auto-capture is: the fast and accurate recognisers reorder lines
         and split them, and none of that is disagreement.

         Gated on a pair existing AND both reads returning text. A number computed from one read,
         or from none, would be an alarm on a case where there is nothing to say.
         */
        /*
         ⚑ **Which two frames, and the first cut named them wrongly.** `reads[0]` vs `reads[1]` is
         lit-vs-unlit only when the capture is a bare pair. Text mode declares BOTH
         `bracketWhenMarginal` and `torch: .whenUnderLit`, so a marginal plate under a lit torch
         delivers **three bracketed lit frames and then the companion** — and `reads[1]` is the
         second bracket frame, also lit.

         The failure is the bad direction. Two lit frames of one plate agree closely, so the number
         came out **high**, and high means *no glare* — the alarm silenced precisely in the mode
         and the moment it exists for. The 2026-08-16 field captures are four frames from one job
         for exactly this reason.

         The comparison is nominal-exposure lit against the companion: one frame from each side at
         the exposure the scene actually called for. Best-of-three against one would flatter the
         torch, which is the side under suspicion.
         */
        if job.pairFired {
            let frames = zip(written, reads).map {
                (torch: ($0["torch"] as? Bool) ?? false,
                 index: ($0["index"] as? Int) ?? 0,
                 read: $1)
            }
            let nominal = job.bracketed ? 1 : 0   // bracket biases are [-1, 0, +1]: index 1 is 0 EV
            let lit = frames.first { $0.torch && $0.index == nominal } ?? frames.first { $0.torch }
            let unlit = frames.first { !$0.torch }
            if let lit, let unlit,
               let litText = lit.read?["text"] as? String, let unlitText = unlit.read?["text"] as? String {
                payload["torchPairAgreement"] = Self.agreement(between: litText, and: unlitText)
                // Which frames the number came from, so a surprising value can be checked against
                // the two photographs rather than argued about.
                payload["torchPairCompared"] = [lit.index, unlit.index]
            }

            /*
             ⚑ **The companion frame decides the next arming** (owner ruling 2026-08-16). This is
             the accurate read of an unlit frame — a measurement of the scene taken with the
             actuator off, which is the same class of evidence arming already uses, so it does not
             put the torch back inside the loop that decides about the torch.

             It also does something the light score structurally cannot: see `torchReleaseThreshold`
             for why a lit scene at range still scores near 1.0. This read is the only exit from
             that latch.
             */
            let sufficed = Self.readSufficed(unlit?.read)
            payload["companionReadSufficed"] = sufficed
            DispatchQueue.main.async { [weak self] in
                self?.applyCompanionVerdict(sufficed: sufficed)
            }
        }
        // The top-level read stays frame 0's — the declared surface, unchanged. Stored by nobody,
        // because there is nowhere for it to land (#163).
        if let first = reads.first, let read = first { payload["ocr"] = read }
        /*
         ⛑ **A live line per capture, for the tethered console.** `print` rather than `NSLog`
         because NSLog does not reach the stream `devicectl … --console` captures on modern iOS —
         a fact that cost two probe runs on 2026-08-28 before it was noticed.

         It says what the frames ARE, not that a capture happened: how many, which glass took each,
         and what the wide sibling cost or why it was refused. ⚑ *Capture is the one act where the
         record and the photograph can disagree and nothing downstream can tell*, so the line names
         both halves.
        */
        let lensLine = outgoing.map { $0.lens.rawValue }.joined(separator: ",")
        print("HS-CAP frames=\(written.count) lenses=[\(lensLine)] wideSibling=\(job.wideFrame != nil) "
              + "wideRefused=\(job.wideRefused ?? "-") lensSwapMs=\(job.lensSwapMs.map { String(format: "%.0f", $0) } ?? "-") "
              + "torchPaired=\(job.pairFired) bracketed=\(job.bracketed) mode=\(mode.rawValue)")
        HSZoneLog.record("capture", [
            "frames": written.count,
            "lenses": lensLine,
            "wideSibling": job.wideFrame != nil,
            "wideRefused": job.wideRefused ?? "-",
            "lensSwapMs": job.lensSwapMs ?? -1,
        ])
        job.completion(.success(payload))
    }

    // MARK: traverse

    /**
     The traverse (owner rulings 2026-08-16). **Renamed from *pan*, and the rename is a
     correction.**

     A pan is a spin about the vertical axis, which is nearly a pure rotation and therefore nearly
     a pure translation at the frame plane. **Real rooms are not coverable that way.** The owner's
     mechanical room is an L: getting round the corner means walking several feet, and walking
     gives **parallax** — near objects slide faster than far ones, and no translation-only model
     describes that. ⚑ *A word that says stand still and spin produces concierges who stand still
     and spin, in rooms that cannot be covered by spinning.*

     So the rule the concierge follows is **never break contact** — rotating, walking, going round
     a corner, all fine — and the only question asked of each adjacent pair is whether the two
     frames share content.

     ⚑ **Which is exactly why the verdict has three values and not two.** A false gap — telling
     the desk something was missed when the concierge merely walked — is worse than no flag at
     all, because it sends somebody back to a room that was covered. So `unverified` is a
     first-class answer: *the translation model does not describe this pair, so this mechanism
     cannot say.* Collapsing that into `gap` would be the alarm-on-the-majority-case failure, in
     the one place it costs a return visit.
     */
    private final class TraverseRun {
        let startedAt = Date()
        var frames: [[String: Any]] = []
        var pairs: [[String: Any]] = []
        /// Signed, normalised, accumulated since the last kept frame. Signed on purpose: panning
        /// right then back left returns you to where you were, and no frame is owed.
        var travel = CGPoint.zero
        var previousBuffer: CVPixelBuffer?
        var lastKeptBuffer: CVPixelBuffer?
        var pendingBuffer: CVPixelBuffer?
        /// What the accumulator had summed when this frame was requested. Kept so the pair's own
        /// measurement can be checked against it — see `measureOverlap`.
        var travelAtRequest: CGFloat = 0
        var awaitingFrame = false
        var index = 0
        var unmet: [String] = []
        var torchLatched = false
        /// ⚑ Fixed at the start of the run, for the same reason the exposure is — see `downscaled`.
        /// The crop axis must mean one thing for the whole traverse.
        var orientation: CGImagePropertyOrientation = .up
        /// ⚑ The device's LIVE rotation angle when this frame was requested — which is not the
        /// angle the file will be stamped with. The capture connection's rotation stays fixed for
        /// the leg (see `startTraverse`), so a leg walked with the iPad turned produces frames
        /// whose EXIF claims an orientation the device did not have. Recorded rather than
        /// reconciled: the manifest must not assert a frozen value as though it were observed.
        var rotationAtRequest: Double = 0
        /* ⚑ Carried on the run so it reaches the STOP payload. It was written only into the START
           payload when it shipped, and typed on `TraverseResult` — so the first walk that used it
           came back with `exposure` absent, and the number the whole shutter costing turns on was
           unreachable by the only thing that carries a walk off the device. **Seventh instance of
           rule 43, committed by the session that wrote the page naming it.** The bridge is untyped
           at the boundary, so TypeScript could not catch it; only a walk could. */
        var exposure: [String: Any] = [:]
        /// Frames captured and not filed — see `traverseKeepTexture`. Counted rather than silent:
        /// a run that drops half its frames must say so, or "30 frames" reads as "30 kept".
        var discarded = 0
        var discardedTexture: [Double] = []
        /// Largest single accumulator step since the last kept frame. The discriminator for the
        /// corner — see `advanceTraverse`. Reset when a frame is requested.
        var maxStep: CGFloat = 0
        /**
         ⚑ The previous leg this run declares itself a continuation of, if any.

         **A declaration about the concierge's own hands, never about coverage.** *I chose to stop
         here* is a fact they are qualified to state; *nothing was missed between the legs* is the
         desk's to decide and this records no opinion on it. That distinction is the whole shape —
         it is why the join is `declared` rather than `contiguous`.
        */
        var continuesFrom: String?
        /// `maxStep` as it stood when this pair's frame was requested — the value that travels
        /// with the pair rather than with the run.
        var stepAtRequest: CGFloat = 0
        /// Steps that failed to register since the last kept frame. Invisible to `travel`, which
        /// is why they are counted — see `advanceTraverse`.
        var droppedSteps = 0
        var droppedAtRequest = 0
    }

    /**
     Fraction of frame width to travel before the next still.

     ⚑ **0.20, down from 0.40, and the field run is what settled it.** A 180° turn standing on one
     spot — the easiest case there is, and the one a translation model describes best — returned
     **6 pairs out of 6 `unverified`, 0 gaps** (2026-08-16, 7:33). At 0.40 the two half-frames of a
     pair no longer share enough content for their translations to agree, so the disparity test
     exceeds tolerance on essentially every pair and the mechanism says nothing, ever.

     *A mechanism that always answers "cannot say" is not conservative, it is switched off* — and
     it is worse than switched off, because it looks like it is working.

     Halving the spacing roughly halves the disparity a given parallax produces, because disparity
     is a difference between two half-frame translations and both halves see more of the same
     scene. The cost is twice the frames for the same wall, which the run-length figures say is
     affordable: the L-walk kept 16 frames for a whole mechanical room.
     */
    private static let traverseTargetTravel: CGFloat = 0.20
    /// Below this, contact is not established and the pair is a gap.
    private static let traverseMinimumOverlap = 0.25
    /// Above this, the two halves of the frame moved differently — parallax — and a single
    /// translation does not describe the pair, so no claim is made about it either way.
    private static let traverseDisparityTolerance = 0.08
    /**
     How far a half's translation may sit from the whole frame's before it is treated as a failed
     registration rather than a disagreement.

     ⚑ Deliberately loose. A third of a frame is not parallax at any depth a room contains — this
     exists to reject nonsense, and adjudicating real parallax is `traverseDisparityTolerance`'s
     job. Set tighter it would start swallowing the very pairs the disparity test exists to judge,
     which would be this mechanism quietly agreeing with itself.
     */
    private static let traverseHalfSanityBound: CGFloat = 0.33
    /// How many times the target travel a pair's own displacement may reach before the whole-frame
    /// registration is treated as having failed. Derived from the trigger rather than fitted: a
    /// pair exists because one target's worth of travel accumulated, so several times that is not
    /// a fast operator, it is a bad number. See `measureOverlap`.
    private static let traversePlausibleShiftFactor: CGFloat = 2.5
    /**
     How far the accumulator's path length and the pair's own displacement may disagree before the
     pair is `unverified`.

     A quarter of the target travel, read off the trigger rather than fitted — two measurements of
     one displacement that differ by more than a quarter of it are not measuring the same thing. On
     the 2026-08-17 runs the survivors sit at a median of 0.0055 and 0.0154, an order of magnitude
     inside this, so it is a bound on nonsense and not a knob on the verdict.
     */
    private static let traverseCrossCheckTolerance: CGFloat = 0.05
    /// Below this there is not enough in a frame for its overlap to mean anything. Measured
    /// blank-first: covered lens 1.8, blurred carry 4.1-4.3, real frames 10.6-21.0.
    private static let traverseMinimumTexture = 5.0
    /// Registration runs at every other frame during a traverse rather than every sixth: a fast
    /// move between analysed frames is a pair the accumulator cannot register, and the
    /// accumulator is what decides when to fire.
    /**
     ⚑ **The traverse's shutter is metered per leg, not inherited from wherever the concierge
     happened to be standing.**

     Until 2026-08-19 `startTraverse` locked exposure with `.locked`, which freezes whatever the
     auto-exposure had settled on. The ruling behind it argued *brightness* — "lock it and let the
     window blow" — and nobody noticed that **locking exposure also freezes the shutter.** Every
     traverse frame of every walk came out at 1/15 s: a shutter for someone standing still. The
     moment the concierge walked, 71% of the frames were smear, and every measure in this file was
     fitted against that input.

     So: meter the room at the start of the leg, then take the fastest shutter it affords with ISO
     under the noise ceiling. Still ONE lock per leg — `.custom` freezes both terms exactly as
     `.locked` did — so frames within a leg still colour-match, which is the property the lock
     exists for. Legs are separate captures and are allowed to differ.

     The floor matters as much as the ceiling: a dark plant room cannot afford 1/125 at any usable
     ISO, and a shutter chosen past what the room allows buys a black frame instead of a smeared
     one. Floored at 1/30 — one full stop better than 1/15 — and under-exposure past that is
     accepted, because **a dark frame is recoverable and a smeared one is not.**
    */
    private static let traverseFastestShutter = CMTime(value: 1, timescale: 125)
    private static let traverseSlowestShutter = CMTime(value: 1, timescale: 30)
    /// ⚑ Where noise becomes unacceptable is the one number the costing could not settle from
    /// banked frames, so it is a named constant with the metered and chosen values recorded beside
    /// it on every leg — the next walk answers it with data rather than impression.
    /// Clamped to the active format's own ceiling at use, which is the hard limit.
    private static let traverseNoiseCeilingISO: Float = 1600

    /**
     ⚑ **Below this a frame is not filed at all** (design session ruling 2026-08-19). The traverse
     keeps capturing while the concierge walks between rooms — the trigger fires on *travel*, and it
     cannot tell walking from sweeping — and those frames were only ever tolerable because the gap
     detector needed continuity. The gap detector is dead, so they are pure noise in the binder's
     input, and the instrument that already works decides: texture, a property of one frame.

     ⚑ **And the honest number: on the 2026-08-20 walk this discards NOTHING.** Sixteen of thirty
     frames were the concierge walking to the next room, and the owner had slowed down through the
     doorway exactly as asked — so those frames measured 5.8 to 12.2 against a floor of 5.0. *The
     slowing that fixed the blur also removed the only evidence the filter had.* The threshold is
     kept at the gate's floor rather than raised to fit one walk, because a threshold fitted to one
     walk is how this feature lost a fortnight; per-frame texture is now recorded on every frame so
     the number can be chosen from a distribution instead.

     **And the real fix is not here.** These frames exist because the traverse does not know the
     concierge stopped sweeping. A filter on frame quality is a proxy for an intent the app is never
     told — which is the trigger's problem, not the filter's.
    */
    private static let traverseKeepTexture = 5.0

    private static let traverseEveryNthFrame = 2
    /// Working width for registration. Overlap is a geometric question, not a detail question.
    private static let traverseWorkingWidth = 384

    private var traverse: TraverseRun?
    private var traverseRequestIds: Set<Int64> = []
    /// Read from main (`capture`, `evaluateTorch`) and written on `visionQueue`. A stale read is
    /// worth one capture's worth of wrong pairing decision at a run boundary, and a lock across
    /// those two paths would cost more than that.
    private var isTraversing = false
    private let ciContext = CIContext(options: [.workingColorSpace: NSNull()])

    /**
     What shutter and ISO this room affords, read off the camera at the moment the leg begins.

     ⚑ **Meter, do not hardcode.** The four rooms measured on 2026-08-19 sat at ISO 400/500/640/2000
     for the same 1/15 s — a factor of five between the brightest and the darkest, in one house. A
     constant chosen for any one of them is wrong in the other three, and wrong in the direction
     that produces either smear or a black frame.

     Exposure is a product: `duration × iso` is what the auto-exposure had balanced when it settled,
     and holding that product constant is what "the same brightness, faster" means. So the fastest
     shutter this room affords is exactly the one at which ISO reaches the ceiling.

     Everything is recorded — what was metered, what was chosen, and both ceilings — because the one
     question the costing could not answer from banked frames is where noise becomes unacceptable,
     and a value that is computed but unreachable cannot answer it. (Rule 43, and this file has
     paid for it six times.)
    */
    static func traverseExposurePlan(for device: AVCaptureDevice)
        -> (duration: CMTime, iso: Float, record: [String: Any]) {
        let format = device.activeFormat
        let meteredDuration = CMTimeGetSeconds(device.exposureDuration)
        let meteredISO = device.iso
        // The hard ceiling is the format's; ours is a policy on top of it and can only be lower.
        let ceiling = min(Self.traverseNoiseCeilingISO, format.maxISO)

        // Fastest first, then clamped both ways. `light` has units of seconds × ISO.
        let light = meteredDuration * Double(meteredISO)
        var duration = light / Double(ceiling)
        duration = min(max(duration, CMTimeGetSeconds(Self.traverseFastestShutter)),
                       CMTimeGetSeconds(Self.traverseSlowestShutter))
        duration = min(max(duration, CMTimeGetSeconds(format.minExposureDuration)),
                       CMTimeGetSeconds(format.maxExposureDuration))

        // ⚑ ISO follows from the duration actually taken, not from the one we wanted. In a room
        // darker than the floor allows this lands ON the ceiling and the frame is under-exposed —
        // which is the trade the floor exists to make, stated in one line rather than hidden.
        var iso = Float(light / duration)
        iso = min(max(iso, format.minISO), format.maxISO)

        let chosen = CMTime(seconds: duration, preferredTimescale: 1_000_000)
        return (chosen, iso, [
            "meteredShutter": meteredDuration > 0 ? 1 / meteredDuration : 0,
            "meteredISO": Double(meteredISO),
            "shutter": duration > 0 ? 1 / duration : 0,
            "iso": Double(iso),
            "isoCeiling": Double(ceiling),
            "formatMaxISO": Double(format.maxISO),
            // True when the room could not afford the floor: the frame is darker than metered, and
            // the desk should know that rather than infer it from a dim photograph.
            "underExposed": Double(light / duration) > Double(format.maxISO) + 0.5
        ])
    }

    func startTraverse(continuesFrom: String? = nil,
                       completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard session.isRunning else {
            completion(.failure(CameraError.notRunning))
            return
        }
        var unmet: [String] = []
        /*
         ⚑ Locked, and the owner has ruled on the trade: **lock it and let the window blow.** The
         traverse is for the objects, the runs between them and anything a purposeful capture
         would miss — not for a pretty window, and the room shot covers the bright end.

         Focus and white balance lock for the same reason as exposure. Without the focus lock the
         lens hunts somewhere in the middle of the move and one frame in the run is soft; without
         the white balance lock the frames do not even colour-match, and a concierge looking at
         the result cannot tell that from a lighting change in the room.
         */
        /*
         ⛑ **Wait for the format before planning an exposure against it.**

         `traverseExposurePlan` opens with `let format = device.activeFormat` and derives the ISO
         ceiling and the shutter clamps from it. `lightScore()` reads it too, so the torch decision
         inherits the same numbers. ⚑ **If the preset restore is still in flight, the whole leg's
         exposure is planned against ARKit's binned video format** — which is how a lit room produced
         grain, and it would have survived the fix that made the restore asynchronous.

         `sessionQueue` is serial and the restore is already enqueued on it, so an empty `sync` is a
         **barrier**: it returns exactly when the restore ahead of it has finished. Costs nothing
         when there is nothing pending, which is the ordinary case.
        */
        sessionQueue.sync { }
        /*
         ⛑ **Let auto-exposure converge before metering it. This is the black viewfinder.**

         `traverseExposurePlan` reads `device.exposureDuration` and `device.iso` **at the instant of
         the call**, and since the leg anchors landed that instant is ~300 ms after the capture
         session restarted from an ARKit handover. **Auto-exposure has not converged yet**, so
         `light = duration × ISO` is computed from a reading of nothing: the plan then picks the
         fastest shutter and the lowest ISO and *locks them for the whole leg*.

         ⚑ **The field named it and the name was exact** — *"the exposure must be set on something
         wild because the image in the viewfinder is SO dark it almost looks black."* It was: not a
         black screen, a correctly-locked near-black exposure. And it explains the texture scores
         that survived every other fix — **a near-black frame has no Laplacian energy**, which is
         precisely what 1.0–3.2 against a threshold of 5 looks like.

         ⛑ **Third variant of one class in three days**: the meter is right, the moment is wrong.
         Before the leg anchors, `startTraverse` ran on a camera that had been settled for seconds.

         `isAdjustingExposure` is the device's own signal that it has finished, so it is what is
         waited on — never a sleep long enough to *probably* be enough. Bounded, and the wait is
         **recorded**: a leg that starts on an unconverged meter must be visible afterwards rather
         than inferred from a dark photograph.
        */
        var exposureWaitMs = 0.0
        var exposureSettled = true
        if let device {
            let began = CACurrentMediaTime()
            while device.isAdjustingExposure, CACurrentMediaTime() - began < 1.5 {
                Thread.sleep(forTimeInterval: 0.02)
            }
            exposureWaitMs = (CACurrentMediaTime() - began) * 1000
            exposureSettled = !device.isAdjustingExposure
        }
        var exposureRecord: [String: Any] = [:]
        if let device {
            do {
                try device.lockForConfiguration()
                // ⚑ Metered, not inherited — see `traverseFastestShutter`. `.custom` locks both
                // terms exactly as `.locked` did, so this is one lock per leg either way.
                let plan = Self.traverseExposurePlan(for: device)
                exposureRecord = plan.record
                if device.isExposureModeSupported(.custom) {
                    device.setExposureModeCustom(duration: plan.duration, iso: plan.iso)
                } else if device.isExposureModeSupported(.locked) {
                    device.exposureMode = .locked
                    unmet.append("meteredExposure")
                } else {
                    unmet.append("lockedExposure")
                }
                if device.isWhiteBalanceModeSupported(.locked) { device.whiteBalanceMode = .locked }
                else { unmet.append("lockedWhiteBalance") }
                if device.isFocusModeSupported(.locked) { device.focusMode = .locked }
                else { unmet.append("lockedFocus") }
                device.unlockForConfiguration()
            } catch {
                unmet.append("configuration")
            }
        }
        /* The rotation is fixed for the run. Frames individually re-rotated part-way through a
           continuous move would not be one traverse — the crop axis must mean one thing from the
           first pair to the last, or the pairs either side of a turn are silently incomparable.

           ⚑ **But fixed is not the same as true, and the record now says which it is.** Every frame
           of the 2026-08-19 clean-gap walk carries `exifOrientation: 6` because this line stamped
           it once, including the fifty frames taken with the iPad at the owner's side. The angle
           the device was actually at travels with each frame as `deviceRotationAngle` — see
           `completeTraverseFrame`. Reconciling them here would trade a true record for a broken
           measurement; recording both costs nothing and lies about nothing. */
        applyRotation(captureRotationAngle, to: photoOutput.connection(with: .video))
        let latched = torchOn
        // Read on main, where the rotation coordinator writes it, and carried into the run rather
        // than re-read per frame.
        let orientation = Self.imageOrientation(forRotationAngle: previewRotationAngle)

        visionQueue.async { [weak self] in
            guard let self else { return }
            let run = TraverseRun()
            run.unmet = unmet
            run.exposure = exposureRecord
            run.torchLatched = latched
            run.orientation = orientation
            run.continuesFrom = continuesFrom
            self.traverse = run
            self.isTraversing = true
            /* ⚑ **The traverse logged nothing, and it is the thing under test.** Finding out why a
               leg produced one frame took pulling the app's temp directory off the device by hand.
               A run now says it started, and says what the session was set to when it did — which
               is the fact that would have named tonight's regression in one line. */
            /* ⚑ The exposure the leg was actually locked to, and how long the meter took to
               settle. The plan has always been computed and only ever reached JavaScript; the one
               number that would have named this in a line was not in the file anybody pulls. */
            var started: [String: Any] = [
                "preset": self.session.sessionPreset.rawValue,
                "lens": self.lens.rawValue,
                "continuesFrom": continuesFrom ?? "-",
                "unmet": unmet,
                "exposureWaitMs": exposureWaitMs,
                "exposureSettled": exposureSettled,
            ]
            for (k, v) in exposureRecord { started["exp_\(k)"] = v }
            HSZoneLog.record("traverseStart", started)
            DispatchQueue.main.async {
                completion(.success([
                    "exposure": exposureRecord,
                    "startedAt": ISO8601DateFormatter().string(from: run.startedAt),
                    /*
                     ⚑ **Which registration model produced every number in this run.**

                     Stamped now, while there is only one, because the moment a second exists the
                     records become indistinguishable — and `overlap`, `displacement`, `crossCheck`
                     and the plausibility gate are all *defined against the translation-only model*.
                     A pair that reads 0.729 under translation reads differently under one that
                     carries scale, and a reader with no way to tell which produced a number cannot
                     compare two runs.

                     Exactly the reasoning `engine` already carries on an OCR read: a measurement is
                     only comparable against another from the same instrument. Adding this before
                     the second model exists is what keeps every traverse taken so far readable.
                    */
                    "registration": "flow-v3",
                    "continuesFrom": run.continuesFrom as Any,
                    "targetTravel": Double(Self.traverseTargetTravel),
                    "minimumOverlap": Self.traverseMinimumOverlap,
                    "disparityTolerance": Self.traverseDisparityTolerance,
                    "torchLatched": latched,
                    "rotationAngle": Double(self.captureRotationAngle),
                    "unmet": unmet
                ]))
            }
        }
    }

    func stopTraverse(completion: @escaping (Result<[String: Any], Error>) -> Void) {
        /* ⚑ What the leg actually produced, said at the moment it ends. A leg that kept one frame
           of nine is not a leg, and nothing in the app said so on 2026-08-29. */
        if let r = traverse {
            HSZoneLog.record("traverseStop", [
                "kept": r.frames.count, "discarded": r.discarded, "pairs": r.pairs.count,
                "preset": session.sessionPreset.rawValue,
            ])
        }
        visionQueue.async { [weak self] in
            guard let self else { return }
            guard let run = self.traverse else {
                DispatchQueue.main.async { completion(.failure(CameraError.notTraversing)) }
                return
            }
            self.traverse = nil
            self.isTraversing = false
            self.traverseRequestIds.removeAll()
            let payload: [String: Any] = [
                "frames": run.frames,
                "pairs": run.pairs,
                "startedAt": ISO8601DateFormatter().string(from: run.startedAt),
                "endedAt": ISO8601DateFormatter().string(from: Date()),
                // Both travel with the finished run, for the reasons given where they are set.
                "registration": "flow-v3",
                "continuesFrom": run.continuesFrom as Any,
                "torchLatched": run.torchLatched,
                "unmet": run.unmet,
                // ⚑ The count the binder actually asks for. A traverse with one unverified pair
                // is a different object from one with none, and summing it here means nobody
                // downstream has to know the verdict vocabulary to ask the question.
                "gaps": run.pairs.filter { ($0["contiguity"] as? String) == "gap" }.count,
                "unverified": run.pairs.filter { ($0["contiguity"] as? String) == "unverified" }.count,
                "exposure": run.exposure,
                "discarded": run.discarded,
                "discardedTexture": run.discardedTexture
            ]
            DispatchQueue.main.async {
                self.restoreContinuousModes()
                completion(.success(payload))
            }
        }
    }

    private func restoreContinuousModes() {
        guard let device else { return }
        do {
            try device.lockForConfiguration()
            if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
            if device.isWhiteBalanceModeSupported(.continuousAutoWhiteBalance) {
                device.whiteBalanceMode = .continuousAutoWhiteBalance
            }
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            device.unlockForConfiguration()
        } catch { /* the next apply(mode:) sets these again */ }
        evaluateTorch()
    }

    /// The accumulator. Runs on `visionQueue`, every other frame, for the whole traverse.
    private func advanceTraverse(with pixelBuffer: CVPixelBuffer) {
        guard let run = traverse, !run.awaitingFrame else { return }
        // ⚑ The run's orientation, fixed at `startTraverse` and not re-read per frame. Rotation is
        // already fixed for the length of a traverse — exposure, white balance and focus all lock
        // there — and an axis that changed halfway through would make the pairs before the turn
        // incomparable with the pairs after it, silently.
        guard let working = downscaled(pixelBuffer, crop: nil, orientation: run.orientation) else { return }

        // The first frame is kept unconditionally: there is nothing to have travelled from.
        guard let previous = run.previousBuffer else {
            run.previousBuffer = working
            requestTraverseFrame(run: run, buffer: working)
            return
        }
        run.previousBuffer = working
        /*
         ⚑ **A step that fails to register is invisible to the accumulator, and that is the half of
         the corner question `maxStep` cannot answer.**

         `maxStep` says the *successful* steps were small — 0.010–0.026 of frame width against
         0.013–0.034 on the pairs that passed — so the accumulator was tracking, and the pair
         displacements of 0.6–1.0 look like keyframe mis-registration rather than real travel.
         **But this early return drops a failed step silently**: travel simply does not advance, so
         the accumulator under-counts by exactly the amount it could not see, and the run keeps
         going as though nothing happened.

         The owner reports a long break in captures while rounding the corner. Two explanations
         survive that: the wider field of view needs more walking per frame-width, which the frame
         rates support (wide fired 17 frames to normal's 31 over the same L, and the ultra-wide is
         about twice the field) — or steps were failing there and the accumulator stalled. **A
         count separates them**, and without it the discriminator is half an answer that reads like
         a whole one.
        */
        guard let step = translationFraction(from: previous, to: working) else {
            run.droppedSteps += 1
            return
        }
        run.travel.x += step.x
        run.travel.y += step.y
        /*
         ⚑ **The size of a single accumulator step, kept so the corner can be explained.**

         The owner's 2026-08-17 walks put the remaining `unverified` pairs in clusters, and he
         identified where: **rounding the outside of the L, where the tank is nearest the lens.**
         Those pairs read `expectedTravel ≈ 0.20` against a `displacement` of 0.6–0.86.

         Two readings of that, and they demand opposite fixes. Either the pair mis-registered and
         the gate is right — or **the accumulator under-counted**, because close to an object a
         single step at 15 Hz exceeds what translational registration can follow, so it fires late
         and the frames really are that far apart. ⚑ In the second case the displacement is
         *correct*, several of those overlaps are already below the gap threshold, and the gate is
         converting **real gaps into "cannot say"** — the false-negative direction, at exactly the
         spot where a concierge is most likely to break contact.

         The step size discriminates: small steps mean the accumulator was tracking and the pair is
         wrong; large steps mean the accumulator was losing ground and the pair is right. Recorded
         rather than acted on, because acting on the wrong reading of this either invents gaps or
         hides them.
        */
        run.maxStep = max(run.maxStep, hypot(step.x, step.y))
        if hypot(run.travel.x, run.travel.y) >= Self.traverseTargetTravel {
            requestTraverseFrame(run: run, buffer: working)
        }
    }

    private func requestTraverseFrame(run: TraverseRun, buffer: CVPixelBuffer) {
        run.awaitingFrame = true
        run.pendingBuffer = buffer
        // ⚑ The angle the device is at NOW, against the angle the connection was frozen at when
        // the leg started. Read here rather than in the completion because this is the instant the
        // shutter is asked for; the same background-queue read the rest of this file already makes.
        run.rotationAtRequest = Double(captureRotationAngle)
        run.travelAtRequest = hypot(run.travel.x, run.travel.y)
        run.stepAtRequest = run.maxStep
        run.droppedAtRequest = run.droppedSteps
        run.travel = .zero
        run.maxStep = 0
        run.droppedSteps = 0
        // `.speed` because a traverse is a burst and the operator is still moving: a frame that
        // arrives late is a frame taken somewhere else. Quality prioritisation is right for a
        // deliberate plate and wrong here.
        let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        settings.photoQualityPrioritization = .speed
        traverseRequestIds.insert(settings.uniqueID)
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    private func completeTraverseFrame(id: Int64, data: Data?, error: Error?) {
        traverseRequestIds.remove(id)
        guard let run = traverse else { return }
        defer {
            run.awaitingFrame = false
            run.pendingBuffer = nil
        }
        guard error == nil, let data else { return }

        let index = run.index
        // ⚑ Incremented for every frame CAPTURED, filed or not, so the pair indices keep meaning
        // and a hole in `frames[].index` says plainly *a frame was taken here and dropped*.
        run.index += 1

        let texture = run.pendingBuffer.flatMap { textureScore($0) }
        if let texture, texture < Self.traverseKeepTexture {
            run.discarded += 1
            run.discardedTexture.append(texture)
            // The pair is still measured below — the buffer is in hand either way, and a record
            // with a hole in it is more use than a record that quietly renumbers itself.
            if let previous = run.lastKeptBuffer, let current = run.pendingBuffer {
                run.pairs.append(measureOverlap(from: previous, to: current,
                                                from: index - 1, to: index,
                                                expectedTravel: run.travelAtRequest,
                                                maxStep: run.stepAtRequest,
                                                droppedSteps: run.droppedAtRequest))
            }
            run.lastKeptBuffer = run.pendingBuffer
            /* ⛑ **A discard is a decision and it was silent.** Eight of nine frames were dropped
               for low texture in a dark room on 2026-08-29 and the concierge was told nothing — he
               walked the leg believing it was recording. Logged with the score and the threshold so
               *too dark to register* and *nothing was captured* stop looking identical. */
            HSZoneLog.record("traverseDiscard", [
                "index": index, "texture": texture, "keepAbove": Self.traverseKeepTexture,
                "kept": run.frames.count, "discarded": run.discarded,
            ])
            onTraverse?(["frames": run.frames.count, "pairs": run.pairs, "discarded": run.discarded])
            return
        }

        let name = "hs-traverse-\(Int(run.startedAt.timeIntervalSince1970))-\(index).jpg"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        guard (try? data.write(to: url, options: .atomic)) != nil else { return }
        run.frames.append([
            /// ⚑ Recorded on the FRAME, not only inside a pair. The discard threshold has to be
            /// chosen from a distribution across walks, and a value that lives only in a pair
            /// cannot be read for the frame it belongs to.
            "texture": texture ?? -1,
            "path": url.path,
            "bytes": data.count,
            "index": index,
            "exifOrientation": Self.exifOrientation(of: data),
            /* ⚑ What the file CLAIMS versus how the iPad was actually held. `exifOrientation` is
               read off the bytes and is stamped from the connection's rotation, which is frozen for
               the leg — so on the 2026-08-19 clean-gap walk all 70 frames read 6 while the iPad was
               carried at the owner's side. Recording both is the fix: the frozen value stays,
               because re-rotating mid-leg would make the pairs before a turn incomparable with the
               pairs after it, but the record stops asserting it as an observation. */
            "deviceRotationAngle": run.rotationAtRequest,
            "at": ISO8601DateFormatter().string(from: Date())
        ])

        if let previous = run.lastKeptBuffer, let current = run.pendingBuffer {
            run.pairs.append(measureOverlap(from: previous, to: current,
                                            from: index - 1, to: index,
                                            expectedTravel: run.travelAtRequest,
                                            maxStep: run.stepAtRequest,
                                            droppedSteps: run.droppedAtRequest))
        }
        run.lastKeptBuffer = run.pendingBuffer
        // `lastPair` is omitted rather than sent as a wrapped nil: `Optional.none as Any` does not
        // survive the bridge as a JS null, it survives as something the far side cannot read.
        // ⚑ `discarded` on EVERY progress event, including zero. Sending it only when something
        // was dropped means the reader cannot tell *nothing discarded* from *this build does not
        // report it* — and the screen would show a blank where the answer belongs.
        var progress: [String: Any] = ["frames": run.frames.count, "pairs": run.pairs,
                                       "discarded": run.discarded]
        if let last = run.pairs.last { progress["lastPair"] = last }
        onTraverse?(progress)
    }

    /**
     What one adjacent pair shares, and how much to trust the answer.

     Three registrations, not one: the whole frame, its left half and its right half. ⚑ **If a
     single translation describes the pair, the two halves agree; under parallax they do not** —
     near content slides faster than far content, which is precisely what walking round a corner
     does. `disparity` is that difference, and it is the number that decides whether `overlap`
     means anything.

     Homography would not rescue this. A homography is exact for a plane or for pure rotation, and
     parallax across a room's depth is neither — so the honest move is to *detect* that the model
     does not apply rather than to fit a fancier wrong one.
     */
    private func measureOverlap(from previous: CVPixelBuffer, to current: CVPixelBuffer,
                                from fromIndex: Int, to toIndex: Int,
                                expectedTravel: CGFloat, maxStep: CGFloat,
                                droppedSteps: Int) -> [String: Any] {
        let left = CGRect(x: 0, y: 0, width: 0.5, height: 1)
        let right = CGRect(x: 0.5, y: 0, width: 0.5, height: 1)
        let full = translationFraction(from: previous, to: current)
        let leftShift = crops(previous, current, left).flatMap { translationFraction(from: $0.0, to: $0.1) }
        let rightShift = crops(previous, current, right).flatMap { translationFraction(from: $0.0, to: $0.1) }

        // Recorded on every pair, whichever way it exits — the corner discriminator is only
        // useful on the pairs that failed.
        var record: [String: Any] = ["from": fromIndex, "to": toIndex,
                                     "maxStep": Double(maxStep), "droppedSteps": droppedSteps]
        guard let full, let leftShift, let rightShift else {
            record["measured"] = false
            record["contiguity"] = "unverified"
            // ⚑ WHICH kind of "cannot say". Three different things collapsed into one word, and
            // the counts alone could not tell them apart — see `unverifiedReason` below.
            record["reason"] = "unregistered"
            return record
        }
        // Half-crop x-translations are fractions of a half width; halve them to speak about the
        // whole frame. Heights are unchanged by the crop, so y needs no conversion.
        let disparity = hypot((leftShift.x - rightShift.x) * 0.5, leftShift.y - rightShift.y)
        let overlap = max(0, 1 - abs(full.x)) * max(0, 1 - abs(full.y))
        let displacement = hypot(full.x, full.y)

        /*
         ⚑ **A half that did not register is not a half that disagreed**, and the first cut could
         not tell the two apart. `translationFraction` returns `nil` only when Vision *errors*; a
         confident-looking alignment onto the wrong minimum comes back as an ordinary number, so
         the pair was recorded `measured: true` with a garbage value in it. **The blank-wall false
         negative, one level down** — and the same shape as the guard immediately below, which is
         why this one had to exist too.

         The 2026-08-16 evening run shows it plainly: across 144 half-readings the largest is
         exactly 0.7500, with a cluster at 0.69–0.75, and in **15 of 36 pairs exactly one half sits
         up there while the other is small — never both.** Parallax offsets both halves. A
         systematic optical effect scales both halves. **Only a failed registration moves one and
         leaves the other**, so the signature identifies the cause on its own.

         The test is physical rather than tuned: each half must have moved roughly as the whole
         frame did. Parallax nudges a half away from the whole; it cannot send it a third of a frame
         away, at any depth. So the bound is deliberately loose — it is here to catch nonsense, not
         to adjudicate parallax, and adjudicating parallax is what `disparity` is already for.
         */
        let leftVsWhole = hypot(leftShift.x * 0.5 - full.x, leftShift.y - full.y)
        let rightVsWhole = hypot(rightShift.x * 0.5 - full.x, rightShift.y - full.y)
        let worstHalf = max(leftVsWhole, rightVsWhole)

        /*
         ⚑ **Every pair carries the whole-frame numbers, whichever way it exits.**

         The first cut returned here with only `dx`, `dy` and `halfVsWhole`, and that blinded the
         one question the run was taken to answer. On 2026-08-17 the halves failed on 20 of 30
         pairs — and on the 10 that survived, the accumulator's path length and the pair's own
         displacement agreed to a median of **0.0027**, two independent measurements of the same
         travel landing within a quarter of one percent of frame width.

         That is a **better trust check than the half-split and it is already computed**: it reads
         the whole frame on both sides, so it does not inherit the half-texture problem that is
         failing two thirds of the pairs. But it could not be tested on the failing pairs, because
         this early return dropped exactly those two numbers. *An instrument that stops recording
         at the moment the interesting thing happens is not an instrument.*
        */
        record["expectedTravel"] = Double(expectedTravel)
        record["displacement"] = Double(displacement)
        record["halfVsWhole"] = Double(worstHalf)
        /*
         ⚑ **The half-shifts now ride every exit, and finding this cost a round.**

         They were written after the contiguity block, so a pair rejected by the plausibility gate
         carried none of them — and those are precisely the pairs any scale model has to be tested
         against. Replaying the recorded runs to derive scale offline turned up four usable pairs
         out of nine, all of them ones that had passed. **Rule 43 inside the instrument built to
         answer rule 43's own question.**
        */
        record["leftDx"] = Double(leftShift.x)
        record["leftDy"] = Double(leftShift.y)
        record["rightDx"] = Double(rightShift.x)
        record["rightDy"] = Double(rightShift.y)

        /*
         ⚑ **The scale estimate, MEASURED AND NOT ACTED ON.**

         The powder room settled that motion toward a subject is the traverse's problem rather than
         the corner's, so a registration carrying scale is the known fix. This is not that
         registration — it is the evidence needed to build it without guessing.

         Two candidate ways to get scale were considered and one is already refuted. Deriving it
         from the two half-frames is arithmetically clean — a scene scaling by `s` about the centre
         separates the half-crops by exactly `s - 1` — and it inherits the noise that retired the
         half-split as a trust check: replayed against the recorded walks it returned scale 1.83 and
         **-0.055** on pairs that had registered cleanly. Building the new model on the measurement
         the old model was retired for is the mistake this session warned the design session about
         two rounds ago.

         So Vision's own homography is asked instead, and its answer is recorded beside the
         translation-only verdict rather than replacing it. It cannot be validated from the
         screenshots the owner sends — those are re-rendered and re-cropped, and a harness built on
         them disagreed with the device on a pair whose value is known. **One walk with this
         recorded settles it on real buffers**, and then the switch is one line with evidence
         behind it.
        */
        let scaleRequest = VNHomographicImageRegistrationRequest(targetedCVPixelBuffer: current)
        if (try? VNSequenceRequestHandler().perform([scaleRequest], on: previous)) != nil,
           let warp = (scaleRequest.results?.first as? VNImageHomographicAlignmentObservation)?.warpTransform {
            let sx = (warp.columns.0.x * warp.columns.0.x + warp.columns.0.y * warp.columns.0.y).squareRoot()
            let sy = (warp.columns.1.x * warp.columns.1.x + warp.columns.1.y * warp.columns.1.y).squareRoot()
            record["homographyScale"] = Double((sx + sy) / 2)
            // Both axes, because a similarity has one scale and a homography that has drifted into
            // perspective does not — the gap between them says whether the fit is trustworthy.
            record["homographyScaleX"] = Double(sx)
            record["homographyScaleY"] = Double(sy)
            record["homographyTx"] = Double(warp.columns.2.x) / Double(CVPixelBufferGetWidth(current))
            record["homographyTy"] = Double(warp.columns.2.y) / Double(CVPixelBufferGetHeight(current))
        }
        record["dx"] = Double(full.x)
        record["dy"] = Double(full.y)
        record["overlap"] = Double(overlap)

        /*
         ⚑ **The WHOLE frame can mis-register too, and it does so per axis.**

         Three runs on 2026-08-17 show it unmistakably. The garage sweep reads `dx` of 0.203,
         0.216, 0.193 — landing on the 0.20 trigger almost exactly — while `dy` on the same pairs
         returns −0.750, −0.629, +0.639. **One axis is perfect and the other is garbage**, and
         across the three runs 26 of 110 shift readings exceed 0.5 with a cluster at 0.63–0.75.
         Vision returns a number, not a failure, so it was recorded as a measurement — the same
         defect as the half guard above, one level up.

         The bound is not tuned; it is read off the mechanism's own trigger. **A pair exists
         because the accumulator had travelled one target's worth**, so its displacement should be
         about `traverseTargetTravel`. A pair claiming three and a half times that has not measured
         a fast operator — the accumulator would have fired a frame long before. And the bound sits
         inside the region where overlap has already collapsed, so nothing that could have been
         called contiguous is being discarded.

         The effect on the recorded runs: the garage sweep goes from **0 of 7 usable to 3 of 3
         trustworthy**, and on every run the pairs that survive this gate have their path length
         and their displacement agreeing — 7 of 10, 3 of 3, 19 of 21.
         */
        /*
         ⚑ **This no longer decides anything, and the field numbers are why.**

         It was built for the translation-only era to catch a whole-frame registration returning
         garbage — and it did. But translation-only registration is exactly what flow replaced,
         *because it is unreliable on this lens*: the homography returned scale 0.637-1.186 on
         pairs whose true scale is 1.0, and an explicit scale search hit its own rail on a clean
         lateral step.

         So this gate rejects pairs using the measurement we already established is wrong, and it
         does so BEFORE flow is ever consulted. On 2026-08-19 it became the main source of
         "cannot say" on good walks: **8 of 16 on the fast mechanical run and 11 of 19 on the
         slow one**, both of which have healthy texture throughout — 7.5 to 26.4, nowhere near the
         blank floor. Those are pairs flow was never allowed to judge.

         ⚑ Keeping a gate we know measures wrongly ahead of a measure we have validated is
         backwards, and it is also the honest explanation for what the owner noticed twice: the
         fast/slow difference lives here, not in coverage.

         Recorded, not acted on. If flow ever needs a plausibility partner the number is still here.
        */
        let plausibleBound = max(expectedTravel, Self.traverseTargetTravel) * Self.traversePlausibleShiftFactor
        record["implausibleShift"] = displacement > plausibleBound

        /*
         ⚑ **The half-split no longer decides anything. It is recorded and it is not consulted.**

         It was the trust check from the start: split the frame, register each side, and treat a
         disagreement as parallax the translation model cannot describe. The reasoning was sound
         and the measurement is not — **a half-frame has half the texture**, and in a real
         mechanical room that is below what translational registration needs.

         The 2026-08-17 runs settle it. Of the pairs surviving the plausibility gate above, the
         half-check passes **3 of 17** on normal and **3 of 9** on wide — while those same pairs
         carry a median overlap of **0.78** and their two independent displacement measurements
         agree to a median of **0.0055** and **0.0154**. *The half-split was rejecting pairs that
         two whole-frame measurements agree are fine, four times out of five.*

         So the trust check moves to the one the design session named and the data now supports on
         both lenses: **the accumulator's path length against the pair's own displacement.** Two
         genuinely independent measurements of the same travel — one a running sum at 15 Hz, the
         other a single keyframe-to-keyframe registration — both reading the **whole** frame, so
         neither inherits the problem that broke the halves.

         ⚑ **Ordering mattered and nearly went wrong.** Adopting this before the plausibility gate
         would have been adopting a check built from the same broken registration that gate now
         removes: on the wide runs the two numbers disagreed by 0.33 and 0.46 precisely because
         both were corrupt. Registration first, then the check. That objection is now spent.

         The bound is read off the trigger, like the gate above: a pair exists because one target's
         worth of travel accumulated, so two measurements of that travel disagreeing by more than a
         quarter of it are not measuring the same thing.

         `disparity`, `disparityX`, `disparityY` and `halfVsWhole` are all still computed and still
         written to the record — gate the verdict, keep the diagnostic, so that if this check ever
         looks wrong the evidence for the previous one is sitting beside it.
         */
        let crossCheck = abs(displacement - expectedTravel)
        record["crossCheck"] = Double(crossCheck)

        /*
         ⚑ **The false NEGATIVE, which is the one nobody looks for.**

         A featureless pair — the blank painted wall between the furnace and the corner — gives
         translational registration nothing to lock onto, and it returns a translation near zero
         rather than returning nothing. Zero translation reads as **100% overlap**, so the pair
         that had least evidence of contact reports the most. Every other guard in this function
         is aimed at not crying gap; this one is aimed at not quietly certifying one.

         The check is free because both numbers already exist: the accumulator summed
         `expectedTravel` on its way to firing this frame, and the pair reports its own
         displacement. A tight arc legitimately makes path length exceed displacement, so the
         gate is deliberately the *strong* contradiction — the accumulator travelled a full
         target and the pair claims almost nothing moved. Curvature cannot explain that;
         featureless frames and a scene that changed entirely both can, and both mean the same
         thing here, which is that this mechanism cannot say.
         */
        /*
         ⚑ The flow answer decides; everything computed above stays on the record. Gate the verdict,
         keep the diagnostic — so if this mechanism ever looks wrong, the evidence for the three it
         replaced is sitting beside it and the runs stay comparable.
        */
        if let flow = flowCoverage(from: previous, to: current) {
            record["covered"] = flow.covered
            record["flowMedian"] = flow.median
            record["flowP90"] = flow.p90
            /*
             ⚑ **Coherence: proposed, tested blank-first, and NOT adopted — recorded only.**

             The owner's proposal was good and came from watching his own corner: a clean sweep is
             one cluster, a corner is two real ones, junk is none. Tested against a blank input
             first, which is the rule, and it fails there:

               covered lens    local +1.000   global 0.995   <- as coherent as a clean sweep
               blurred carry   local +0.997   global 0.448
               clean sweep     local +1.000   global 0.996
               the corner      local +0.998   global 0.938   <- correctly survives

             **Local coherence measures Vision's smoothness prior, not the scene** — the estimator
             regularises neighbouring vectors, so they agree whatever the input, and everything
             reads 1.000. Global coherence does catch the blurred carry, but texture already does,
             and it **fails on the covered lens in the same direction as coverage** rather than the
             opposite one.

             ⚑ The reason is structural and it is the fifth instance: coherence is derived from the
             flow field, which is derived from correlating two frames, so it inherits the failure it
             was proposed to escape. Texture escapes it by needing no partner at all. Cost is real
             arithmetic on vectors already in hand — 0.2 ms against 150 ms of flow — so it is kept
             as a recorded number and given no authority.
            */
            record["flowConsistency"] = flow.consistency

            /*
             ⚑ **Is this the same PLACE — recorded, deliberately not gated, and the sample is why.**

             The owner's clean-gap sweep is the case nothing catches: he swept a textured wall,
             lowered the iPad to his side with the lens open, walked, and raised it at a different
             textured wall. **Texture passes both ends because both are textured — texture never
             looks at the pair** — and coverage read 0.78 to 0.996 across the middle, so 23 of 28
             pairs came back contiguous. The carry frames measured 5.0 to 8.7, above the 5.0 floor.

             A feature print is the first measure here that asks the question the feature is
             actually for, and it is not a pixel correlation: it is a learned descriptor of content,
             so it needs no corresponding pixels. Two frames of one wall came back 0.31 to 0.57;
             two frames of different walls, 0.86 to 1.28. Two prints and a distance cost 5 ms
             against 150 ms of flow.

             ⚑ **It is not gated because a wider sample overlaps.** A DIM room pair that genuinely
             shares content — verified by eye, the neon sign and the brick both present — reads
             **0.873**, higher than two genuinely different mechanical-room frames at **0.726**. Low
             light makes the descriptor unstable, which is this track's recurring shape a seventh
             time: less information, less reliable measure. A threshold fitted to eleven hand-picked
             pairs would be fitted to that overlap.

             ⚑ And blank-first found its other blind spot before any of this: two covered-lens
             frames read **0.202**, i.e. *the same place*. Texture already guards that, but it means
             this can never gate alone.

             So it is recorded on every pair. One walk gives a distribution over dozens rather than
             a threshold over eleven, and then the decision has evidence behind it.
            */
            if let a = featurePrint(previous), let b = featurePrint(current) {
                var distance = Float(0)
                if (try? a.computeDistance(&distance, to: b)) != nil {
                    record["placeDistance"] = Double(distance)
                }
            }

            /*
             ⚑ **Coverage alone is INVERTED, and the owner's deliberate break proved it.**

             He covered the lens mid-run. Those pairs returned coverage of 0.982, 0.990, 0.994,
             0.996 and **1.000** — the highest in the run — while the honest pairs either side read
             0.812. The whole irregular run scored 29 of 32 contiguous with a median of 0.948,
             **beating the real traverse's 0.829.**

             The reason is structural, and it was predicted in writing before this data was opened:
             optical flow with nothing to track returns vectors near ZERO, every sampled pixel
             therefore stays inside the frame, and the pair with the least evidence of contact
             reports the most. That is `#104`'s blank-wall false negative — *the pair that had least
             evidence of contact reports the most* — arriving for the third time, in the mechanism
             that replaced the two guards written for it.

             So coverage is trusted only when the picture moved as much as the CAMERA did. The
             accumulator already measured the camera independently, and a pair exists because it
             travelled one target's worth. If the flow field says the image barely moved while the
             accumulator says the camera did, the frames are not evidence of contact — they are
             evidence of nothing to see.

             ⚑ No new tuned number: this reuses the quarter-of-target ratio `impossiblyStill`
             already uses, and `traverseMinimumOverlap` is deliberately untouched, because a real
             gap has still never been observed and tuning against its absence is what produced this.
            */
            /*
             ⚑ **Coverage means nothing if there was nothing in the frame to cover.**

             The owner carried the iPad between two rooms with the traverse running. It fired twenty
             frames in five seconds, and those frames are the floor and his shoe, smeared — and
             flow-v2 called every one of them contiguous at 0.80 to 0.93. It could not tell *I swept
             this wall* from *I walked past with the camera swinging*, which is the distinction the
             feature exists to make.

             It also explains what he noticed unprompted: **the faster you go, the more contiguous
             it gets called.** Faster means more blur, blur means less texture, less texture means
             less to correlate — and every measurement here has reported most confident where it had
             least evidence.

             So both frames must contain something before their overlap is allowed to mean anything.
             ⚑ The floor is deliberately low — it sits above the blur at 4.3 and far below the
             dimmest real frame at 10.6 — because it is here to reject the unarguable, on four blank
             and four real samples. The value is recorded on every pair so the distribution can be
             read rather than guessed at.
            */
            if let a = textureScore(previous), let b = textureScore(current) {
                record["textureFrom"] = a
                record["textureTo"] = b
                if min(a, b) < Self.traverseMinimumTexture {
                    record["measured"] = false
                    record["contiguity"] = "unverified"
                    record["reason"] = "tooLittleTexture"
                    return record
                }
            }

            let cameraMoved = expectedTravel >= Self.traverseTargetTravel
            let pictureMoved = flow.median >= Double(Self.traverseTargetTravel) * 0.25
            if cameraMoved && !pictureMoved {
                record["measured"] = false
                record["contiguity"] = "unverified"
                record["reason"] = "flowStill"
                return record
            }

            record["measured"] = true
            record["contiguity"] = flow.covered < Self.traverseMinimumOverlap ? "gap" : "contiguous"
            return record
        }
        // Flow could not answer. Fall back to the translation-only chain below, which is already
        // conservative — it says "cannot say" far more often than it says anything else.
        record["covered"] = nil as Any?

        let impossiblyStill = expectedTravel >= Self.traverseTargetTravel
            && displacement < Self.traverseTargetTravel * 0.25

        let contiguity: String
        var reason: String?
        if impossiblyStill {
            contiguity = "unverified"
            reason = "impossiblyStill"
        } else if crossCheck > Self.traverseCrossCheckTolerance {
            // ⚑ Not a gap. The two measurements do not agree, so this mechanism has nothing to say
            // about whether contact was kept — and saying "gap" here is the false alarm that sends
            // somebody back to a room they already covered.
            contiguity = "unverified"
            reason = "crossCheck"
        } else if Double(overlap) < Self.traverseMinimumOverlap {
            contiguity = "gap"
        } else {
            contiguity = "contiguous"
        }

        // dx, dy, overlap, expectedTravel and displacement are already on the record — written
        // above so that a pair which exits early still carries them.
        record["measured"] = true
        record["disparity"] = Double(disparity)
        record["contiguity"] = contiguity
        if let reason { record["reason"] = reason }

        /*
         ⚑ **The parts the verdict was computed FROM, recorded beside the verdict.**

         Two runs on 2026-08-16 said the same thing at two different spacings: 87% unverified at
         0.40 of frame width, 86% at 0.20. Frame counts doubled, so the trigger genuinely changed
         — and the verdict did not follow. **Whatever dominates this measurement does not scale
         with how far apart the frames are**, which rules out the reason 0.20 was chosen and
         leaves several candidates that the counts cannot separate.

         So the components go on the record rather than a third guess at the constant:

         - `disparityX` / `disparityY` **apart**, because they are not the same quantity. `x` is a
           fraction of frame WIDTH (halved out of half-crop space); `y` is a fraction of frame
           HEIGHT, unconverted because the crops do not change height. If the failure is nearly all
           `y`, the tolerance is being spent on vertical registration noise between two half-frames
           and the whole disparity test is answering a question nobody asked.
         - the four raw half-shifts, because the *shape* of the disagreement is the discriminator:
           **a systematic optical effect scales the two halves** (their ratio is roughly constant
           while the difference tracks displacement), whereas **parallax offsets them** (the
           difference is set by scene depth and is largely indifferent to displacement). One walk
           with these numbers distinguishes those; no amount of reasoning from here does.

         Nothing here changes a verdict. Measuring and then tuning is the order — tuning first is
         how a number gets moved twice on a theory that already failed once.
         */
        record["disparityX"] = Double(abs(leftShift.x - rightShift.x) * 0.5)
        record["disparityY"] = Double(abs(leftShift.y - rightShift.y))
        record["leftDx"] = Double(leftShift.x)
        record["leftDy"] = Double(leftShift.y)
        record["rightDx"] = Double(rightShift.x)
        record["rightDy"] = Double(rightShift.y)
        return record
    }

    /// ⚑ `.up`, and that is load-bearing: `a` and `b` are already working buffers, oriented once by
    /// `advanceTraverse` on the way in. Orienting again here would turn them twice and put the crop
    /// axis back where this change just took it from.
    /**
     ⚑ **Coverage measured by asking where each pixel went, not by fitting a transform to the pair.**

     Every earlier mechanism assumed adjacent frames were related by a single global 2D transform —
     translation, then translation plus scale, then a homography. **That premise is false here and
     the frames prove it.** A 120° lens looking at a cluttered room with real depth, while the
     operator walks partly toward it, produces pairs no similarity or homography describes: on the
     2026-08-17 run the homography returned scale 0.637–1.186 on pairs whose true scale is 1.0, and
     an explicit scale search returned 0.700 — its own search rail — on a clean lateral step.

     `#104` said this in its own comment and was not believed: *the honest move is to detect that
     the model does not apply rather than fit a fancier wrong one.* The scale hypothesis was a way
     of not believing it.

     Optical flow assumes nothing global. It answers, per pixel, *where did this go* — so depth,
     lens distortion and motion toward a subject are all describable, and **coverage becomes a
     count of pixels that landed inside the next frame**, which is the question the traverse has
     been asking all along.

     On the run that motivated it, every one of the eight pairs tested — four the old mechanism
     accepted and four it rejected as implausible — returns coverage between 0.77 and 0.88, with a
     steady leftward median flow of 38–56 px. ⚑ **The rejected pairs are indistinguishable from the
     clean ones, so the walk held contact throughout and the 7-of-19 verdict was wrong rather than
     merely cautious.** Measured at 41 ms per pair against roughly one pair per second.
     */
    private func flowCoverage(from previous: CVPixelBuffer, to current: CVPixelBuffer)
        -> (covered: Double, median: Double, p90: Double, consistency: Double)? {
        let request = VNGenerateOpticalFlowRequest(targetedCVPixelBuffer: current)
        request.computationAccuracy = .high
        request.outputPixelFormat = kCVPixelFormatType_TwoComponent32Float
        guard (try? VNImageRequestHandler(cvPixelBuffer: previous, options: [:]).perform([request])) != nil,
              let observation = request.results?.first as? VNPixelBufferObservation else { return nil }

        let buffer = observation.pixelBuffer
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
        guard width > 0, height > 0, let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let stride = CVPixelBufferGetBytesPerRow(buffer)

        var inside = 0, total = 0
        var magnitudes: [Double] = []
        // ⚑ Recorded, never gated. See `flowCoverage`'s note on coherence.
        var sumX = 0.0, sumY = 0.0, sumMagnitude = 0.0
        // Every fourth pixel each way. Coverage is a proportion, and a sixteenth of a 384-wide
        // frame is thousands of samples — enough for a proportion and a fraction of the work.
        for y in Swift.stride(from: 0, to: height, by: 4) {
            let row = base.advanced(by: y * stride).assumingMemoryBound(to: Float.self)
            for x in Swift.stride(from: 0, to: width, by: 4) {
                let dx = Double(row[x * 2]), dy = Double(row[x * 2 + 1])
                let tx = Double(x) + dx, ty = Double(y) + dy
                total += 1
                let magnitude = (dx * dx + dy * dy).squareRoot()
                magnitudes.append(magnitude)
                sumX += dx; sumY += dy; sumMagnitude += magnitude
                if tx >= 0, tx < Double(width), ty >= 0, ty < Double(height) { inside += 1 }
            }
        }
        guard total > 0 else { return nil }
        magnitudes.sort()
        let w = Double(width)
        return (Double(inside) / Double(total),
                magnitudes[magnitudes.count / 2] / w,
                magnitudes[min(magnitudes.count - 1, Int(Double(magnitudes.count) * 0.9))] / w,
                sumMagnitude > 0 ? (sumX * sumX + sumY * sumY).squareRoot() / sumMagnitude : 0)
    }

    /**
     ⚑ **How much there is to see in ONE frame — and the point is that it needs no partner.**

     Every measure that has failed in this feature was a correlation between two frames: the blank
     wall returning near-zero translation as 100% overlap, the half-registration pegging at a rail,
     flow reading a covered lens as perfect coverage. **Correlation with nothing to correlate
     returns confident nonsense**, and it has now done so four times in three unrelated mechanisms.

     Texture is a property of a single frame. It has no partner to be fooled about, so *the failure
     mode that keeps recurring is structurally unavailable to it* — it cannot report high confidence
     for want of evidence, because want of evidence is exactly what it measures.

     Tested against a blank input FIRST, which is the rule the previous four should have been held
     to: covered lens **1.83, 1.88** · the owner's blurred carry frames, which flow-v2 called
     contiguous at 0.80–0.93, **4.11, 4.32** · a genuinely covered mechanical wall **16.44, 20.96**
     · and a genuinely covered but DIM living room **11.02, 10.62**. The dim room scoring 2.5x the
     blur is what says this measures texture and not brightness.

     Variance of the Laplacian, sampled: the standard sharpness measure, and cheap.
     */
    private func textureScore(_ buffer: CVPixelBuffer) -> Double? {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
        guard width > 2, height > 2, let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let stride = CVPixelBufferGetBytesPerRow(buffer)
        let bytes = base.assumingMemoryBound(to: UInt8.self)
        func luminance(_ x: Int, _ y: Int) -> Double {
            let p = bytes + y * stride + x * 4
            return 0.114 * Double(p[0]) + 0.587 * Double(p[1]) + 0.299 * Double(p[2])
        }
        var sum = 0.0, sumSquares = 0.0, n = 0.0
        for y in Swift.stride(from: 1, to: height - 1, by: 2) {
            for x in Swift.stride(from: 1, to: width - 1, by: 2) {
                let laplacian = abs(4 * luminance(x, y) - luminance(x - 1, y) - luminance(x + 1, y)
                                    - luminance(x, y - 1) - luminance(x, y + 1))
                sum += laplacian; sumSquares += laplacian * laplacian; n += 1
            }
        }
        guard n > 0 else { return nil }
        let mean = sum / n
        return (sumSquares / n - mean * mean).squareRoot()
    }

    /// A learned descriptor of what a frame CONTAINS, as opposed to how its pixels correlate with
    /// another frame's. See the note at its call site for why it is recorded and not gated.
    private func featurePrint(_ buffer: CVPixelBuffer) -> VNFeaturePrintObservation? {
        let request = VNGenerateImageFeaturePrintRequest()
        guard (try? VNImageRequestHandler(cvPixelBuffer: buffer, options: [:]).perform([request])) != nil
        else { return nil }
        return request.results?.first as? VNFeaturePrintObservation
    }

    private func crops(_ a: CVPixelBuffer, _ b: CVPixelBuffer, _ rect: CGRect) -> (CVPixelBuffer, CVPixelBuffer)? {
        guard let ca = downscaled(a, crop: rect, orientation: .up),
              let cb = downscaled(b, crop: rect, orientation: .up) else { return nil }
        return (ca, cb)
    }

    /// Translation between two buffers, normalised to each axis's own extent. `nil` when Vision
    /// could not align them at all — which is information, not an error to swallow.
    private func translationFraction(from previous: CVPixelBuffer, to current: CVPixelBuffer) -> CGPoint? {
        let width = CGFloat(CVPixelBufferGetWidth(current))
        let height = CGFloat(CVPixelBufferGetHeight(current))
        guard width > 0, height > 0 else { return nil }
        let request = VNTranslationalImageRegistrationRequest(targetedCVPixelBuffer: current)
        // A fresh handler per pair: the shared one carries the live loop's sequence state, and
        // interleaving two sequences through it would make each one's history the other's noise.
        do { try VNSequenceRequestHandler().perform([request], on: previous) } catch { return nil }
        guard let observation = request.results?.first as? VNImageTranslationAlignmentObservation else { return nil }
        let t = observation.alignmentTransform
        return CGPoint(x: t.tx / width, y: t.ty / height)
    }

    /**
     A small BGRA copy, optionally of a normalised sub-rectangle. Registration is a geometric
     question; running it at sensor resolution would cost twenty times as much to answer it.

     ⚑ **`orientation` is not decoration, and its absence was a real defect.** The video data
     output's connection is never rotated — `applyRotation` is only ever applied to the photo
     connection and the preview layer — so these buffers arrive in **sensor space**, which does not
     turn with the iPad. Every crop below was therefore taken in sensor coordinates while being
     *named* left and right.

     Held in landscape those agree. Held in **portrait** they are ninety degrees apart, and the
     "left half" and "right half" `measureOverlap` compares are in fact the **top and bottom** of
     what the concierge sees — so the frame gets split *along* the direction of travel instead of
     across it. The 2026-08-16 evening run was shot at `rotation · 90°`, which is portrait, and its
     numbers show exactly that: median |dy| 0.2153 carrying all the travel, median |dx| 0.0247, and
     a median `disparityX` of 0.2708 on the axis with no signal in it.
     */
    private func downscaled(_ buffer: CVPixelBuffer, crop: CGRect?,
                            orientation: CGImagePropertyOrientation) -> CVPixelBuffer? {
        var image = CIImage(cvPixelBuffer: buffer).oriented(orientation)
        if let crop {
            let e = image.extent
            image = image.cropped(to: CGRect(x: e.origin.x + crop.origin.x * e.width,
                                             y: e.origin.y + crop.origin.y * e.height,
                                             width: crop.width * e.width,
                                             height: crop.height * e.height))
        }
        guard image.extent.width > 0 else { return nil }
        let scale = CGFloat(Self.traverseWorkingWidth) / image.extent.width
        let scaled = image
            .transformed(by: CGAffineTransform(translationX: -image.extent.origin.x, y: -image.extent.origin.y))
            .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let height = max(1, Int((scaled.extent.height).rounded()))
        var out: CVPixelBuffer?
        let attributes: [CFString: Any] = [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary]
        guard CVPixelBufferCreate(kCFAllocatorDefault, Self.traverseWorkingWidth, height,
                                  kCVPixelFormatType_32BGRA, attributes as CFDictionary, &out) == kCVReturnSuccess,
              let out else { return nil }
        ciContext.render(scaled, to: out)
        return out
    }

    /// Jaccard overlap of the two reads' alphanumeric character multisets, 0…1.
    private static func agreement(between lhs: String, and rhs: String) -> Double {
        func bag(_ s: String) -> [Character: Int] {
            var counts: [Character: Int] = [:]
            for ch in s.uppercased() where ch.isLetter || ch.isNumber { counts[ch, default: 0] += 1 }
            return counts
        }
        let a = bag(lhs), b = bag(rhs)
        guard !a.isEmpty || !b.isEmpty else { return 1 }
        var shared = 0, total = 0
        for key in Set(a.keys).union(b.keys) {
            let x = a[key] ?? 0, y = b[key] ?? 0
            shared += min(x, y)
            total += max(x, y)
        }
        return total == 0 ? 1 : Double(shared) / Double(total)
    }

    /**
     Find the page in the frame and flatten it. Returns nil when no page is found — and nil means
     the original frame is kept, never a guessed crop.

     Contrast is lifted modestly after the correction, not before: a perspective warp of an already
     clipped image loses the detail the lift was meant to reveal.
     */
    private static func flattenPage(jpeg: Data) -> Data? {
        // ⚑ `applyOrientationProperty` — without it CIImage ignores the EXIF tag entirely and
        // the page detector is handed a sideways invoice, which it finds badly or not at all.
        // Invisible while the rotation was never applied; a live defect the moment it is.
        guard let source = CIImage(data: jpeg, options: [.applyOrientationProperty: true]) else { return nil }
        let request = VNDetectDocumentSegmentationRequest()
        let handler = VNImageRequestHandler(ciImage: source, options: [:])
        do { try handler.perform([request]) } catch { return nil }
        guard let page = request.results?.first else { return nil }

        let extent = source.extent
        func denormalise(_ point: CGPoint) -> CGPoint {
            CGPoint(x: extent.origin.x + point.x * extent.width, y: extent.origin.y + point.y * extent.height)
        }
        guard let corrected = CIFilter(name: "CIPerspectiveCorrection", parameters: [
            kCIInputImageKey: source,
            "inputTopLeft": CIVector(cgPoint: denormalise(page.topLeft)),
            "inputTopRight": CIVector(cgPoint: denormalise(page.topRight)),
            "inputBottomLeft": CIVector(cgPoint: denormalise(page.bottomLeft)),
            "inputBottomRight": CIVector(cgPoint: denormalise(page.bottomRight))
        ])?.outputImage else { return nil }

        let flattened = corrected.applyingFilter("CIColorControls", parameters: [
            kCIInputContrastKey: 1.15,
            kCIInputSaturationKey: 0.0
        ])

        let context = CIContext()
        guard let colourSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return nil }
        return context.jpegRepresentation(of: flattened, colorSpace: colourSpace, options: [:])
    }

    /* ⛑ `internal`, not `private`, so the plate A/B probe reads both paths with **the same
       recogniser and the same settings**. *Duplicating this function to give a probe access would
       have compared two readers and called it a comparison of two cameras* — the exact
       two-homes-for-one-fact failure this file has paid for twice. */
    static func readAccurately(jpeg: Data) -> [String: Any]? {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        // ⚑ Orientation passed explicitly. The previous form took `UIImage(data:)?.cgImage`,
        // which discards the EXIF tag, so the accurate read — the one whose confidence decides
        // whether a retake is offered — was handed a sideways plate and reported it as a bad
        // read. The live loop already passes an orientation; this is the same rule, one layer up.
        let orientation = CGImagePropertyOrientation(rawValue: UInt32(exifOrientation(of: jpeg))) ?? .up
        let handler = VNImageRequestHandler(data: jpeg, orientation: orientation, options: [:])
        do { try handler.perform([request]) } catch { return nil }
        guard let results = request.results, !results.isEmpty else { return nil }
        var lines: [[String: Any]] = []
        var total = 0.0
        for observation in results {
            guard let candidate = observation.topCandidates(1).first else { continue }
            /*
             ⚑ **Where on the plate, not just what it said** (design ask, 2026-09-04).

             `read.text` was one block per photograph, so **a frame holding two plates could not be
             paired region by region against the desk's own reading** — and the two-plate case is
             precisely the one that motivated the one-plate-per-frame rule, so the workaround failed
             on the only case it existed for.

             ⛑ The box was always there and was thrown on the floor: `observation.boundingBox` sat
             beside the string this loop already took. *Flipped to a top-left origin here, matching
             the live loop's own flip, because two coordinate conventions for one idea is how a
             reader ends up mirroring a plate.*
            */
            let b = observation.boundingBox
            lines.append([
                "text": candidate.string,
                "confidence": Double(candidate.confidence),
                "x": Double(b.origin.x),
                "y": Double(1 - b.origin.y - b.height),
                "w": Double(b.width),
                "h": Double(b.height),
            ])
            total += Double(candidate.confidence)
        }
        guard !lines.isEmpty else { return nil }
        let mean = total / Double(lines.count)
        let characters = lines.reduce(0) { $0 + (($1["text"] as? String)?.count ?? 0) }
        return [
            "lines": lines,
            "text": lines.compactMap { $0["text"] as? String }.joined(separator: "\n"),
            "meanConfidence": mean,
            /*
             ⚑ **The verdict is computed HERE, against the one constant that defines it.**

             `LiveRead.goodConfidence` is the single boundary between a read going well and one
             that is not — used by the live retake trigger and the torch veto alike, and its own
             comment says why: *two constants meaning the same thing is precisely how the two
             rotation tables drifted apart.* A TypeScript threshold beside it would be a third.

             ⛑ And `marginal` is **never "no text found"**. Most captures legitimately contain
             none — a pipe, a stain, a wide shot — so a trigger that fires on nothing-read nags on
             the majority case and is ignored by the time a plate needs it.
            */
            "characterCount": characters,
            "marginal": characters >= LiveRead.worthReadingCharacters && mean < LiveRead.goodConfidence,
            // Named precisely, because a read is only comparable against another read from the
            // same recogniser on the same OS (Register #135). Nothing here persists it.
            "engine": "vision.VNRecognizeTextRequest.accurate.rev\(VNRecognizeTextRequest.currentRevision)",
            "osVersion": UIDevice.current.systemVersion
        ]
    }
}

// MARK: - Live frames

extension CameraController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        analyse(pixelBuffer)
    }

    /**
     ⚑ **One analysis pipeline, two possible sources of frames.**

     This used to live inside `captureOutput` and be reachable only from the `AVCaptureSession`.
     ⛑ **The moment ARKit began holding the camera for the life of a zone, that made live text
     recognition dead inside every room** — the nameplate mode's auto-capture had nothing to read,
     and the field found it the same evening.

     *The fix is a second caller, not a second implementation.* `HSZoneSession` feeds ARKit's own
     `capturedImage` here at the same cadence, so the motion window, the stillness threshold, the
     character floor, the marginal-read verdict and the emitted payload are **one set of numbers**
     rather than two that drift. **Two implementations of "is this plate readable" is exactly the
     defect this file has paid for twice.**
     */
    /**
     ⛑ **OFF the caller's thread, and getting that wrong froze the app on its first frame.**

     `analyse` runs `VNImageRequestHandler.perform` **synchronously**. Under the capture session that
     was fine: the sample-buffer delegate already runs on a background queue. ⚑ **`ARSession`'s
     delegate runs on the MAIN thread** — so feeding ARKit's frames straight in put a full Vision
     text recognition on the main thread at frame rate, and the first one blocked it hard enough
     that `didUpdate` could never fire again. *Field 2026-09-05: frozen after one capture, and the
     zone log simply stops mid-sentence at the first position.*

     **A frame is dropped rather than queued when one is already in flight.** *A backlog of stale
     frames is worse than a gap:* the motion window and the stability trigger are about **now**, and
     analysing a frame from four seconds ago would fire the shutter for a plate the concierge has
     already walked away from.

     `busy` is written from two queues and deliberately not locked — the worst case is one extra or
     one missed frame at 5 Hz, and a lock on the main thread to protect a boolean is the disease.
     */
    func analyseAsync(_ pixelBuffer: CVPixelBuffer) {
        guard !analysisBusy else { return }
        analysisBusy = true
        visionQueue.async { [weak self] in
            self?.analyse(pixelBuffer)
            self?.analysisBusy = false
        }
    }

    func analyse(_ pixelBuffer: CVPixelBuffer) {
        frameCounter += 1

        /*
         ⚑ The traverse accumulator runs FIRST and outside the text-mode guard, at its own faster
         cadence. Two reasons, and both were defects waiting to happen:

         - The guard used to be `goal.liveText` at the top of this method, so in object mode there
           were no analysed frames **at all** — and a traverse is exactly the thing you do in
           object mode. The accumulator would have measured nothing and fired no stills.
         - Every sixth frame is 5 Hz. A quick move covers more than half a frame width between
           two of those, which is a pair the registration cannot align — so the accumulator would
           lose track precisely when the operator moved fastest, which is when it matters.

         Text recognition is skipped outright while traversing: a traverse does not want a live
         plate read, and leaving it on would put a 12 MP-class request on the same queue as the
         accumulator that decides when to fire.
         */
        if isTraversing {
            if frameCounter % Self.traverseEveryNthFrame == 0 { advanceTraverse(with: pixelBuffer) }
            return
        }

        guard frameCounter % analyseEveryNthFrame == 0 else { return }
        measureMotion(of: pixelBuffer)

        /*
         ⚑ **Motion is emitted whether or not this mode reads text, because it used to freeze.**

         The whole instrument line — `read · N chars` and `motion · X` — was published only from
         the recognition callback below, which is gated on `goal.liveText`. So in object mode, and
         for the whole of any traverse, those two fields **stopped updating while thermal, battery,
         light and rotation beside them kept ticking**. The 2026-08-16 screenshots caught it: two
         panels nineteen minutes apart, both reading `motion · 0.0883` to four decimals.

         A frozen number that looks live is worse than an absent one — it gets read, and decisions
         get made on it. So the event goes out regardless, and `reading` says whether the character
         count means anything rather than leaving a stale `0 chars` to be believed.
         */
        guard goal.liveText, !analysing else {
            if !goal.liveText { emitFrameStatus(boxes: [], read: .empty, reading: false) }
            return
        }

        analysing = true
        let request = VNRecognizeTextRequest { [weak self] request, _ in
            defer { self?.analysing = false }
            guard let self else { return }
            let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
            self.handle(observations: observations)
        }
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: visionOrientation, options: [:])
        do { try handler.perform([request]) } catch { analysing = false }
    }

    /// How far the picture shifted since the last analysed frame, as a fraction of frame width.
    private func measureMotion(of pixelBuffer: CVPixelBuffer) {
        defer { previousFrame = pixelBuffer }
        guard let previous = previousFrame else { return }
        let width = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
        guard width > 0 else { return }

        let request = VNTranslationalImageRegistrationRequest(targetedCVPixelBuffer: pixelBuffer)
        do { try sequenceHandler.perform([request], on: previous) } catch { return }
        guard let observation = request.results?.first as? VNImageTranslationAlignmentObservation else { return }

        let transform = observation.alignmentTransform
        let shift = (abs(transform.tx) + abs(transform.ty)) / width
        motionHistory.append(shift)
        if motionHistory.count > motionHistoryLength { motionHistory.removeFirst() }
        // A mean over the window rather than the latest frame: one steady frame in the middle of a
        // sweep is not stillness, and it is exactly what a single-frame test would fire on.
        lastMotion = motionHistory.reduce(0, +) / CGFloat(motionHistory.count)
    }

    private func handle(observations: [VNRecognizedTextObservation]) {
        var boxes: [[String: Any]] = []
        var strings: [String] = []
        var total = 0.0
        var union: CGRect?

        for observation in observations {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let box = observation.boundingBox
            union = union?.union(box) ?? box
            strings.append(candidate.string)
            total += Double(candidate.confidence)
            boxes.append([
                "text": candidate.string,
                "confidence": Double(candidate.confidence),
                // Vision's origin is bottom-left; the web layer draws from top-left.
                "x": box.origin.x,
                "y": 1.0 - box.origin.y - box.height,
                "w": box.width,
                "h": box.height
            ])
        }

        let read = LiveRead(strings: strings, meanConfidence: strings.isEmpty ? 0 : total / Double(strings.count))
        lastRead = read

        if goal.spotMeterSubject, let union, let device, device.isExposurePointOfInterestSupported {
            // Meter where the characters actually are — the plate, not the bright tank beside it.
            // Vision's box is bottom-left origin in image space, which is what
            // exposurePointOfInterest expects once y is flipped.
            let point = CGPoint(x: union.midX, y: 1.0 - union.midY)
            // Unlock only if the lock was taken: `try?` then an unconditional unlock is an
            // unbalanced release when the lock fails, and AVFoundation traps on that.
            if (try? device.lockForConfiguration()) != nil {
                device.exposurePointOfInterest = point
                device.unlockForConfiguration()
            }
        }

        emitFrameStatus(boxes: boxes, read: read, reading: true)
    }

    /**
     One publisher for the per-frame instruments, called from both the reading and the non-reading
     path so neither can go quiet while the other speaks.

     `reading` is the gate on the character fields. Without it a mode that never runs recognition
     publishes `0 chars · 0.00`, which is indistinguishable from *looked and found nothing* — the
     same sentence meaning two different things, which is what made the frozen panel readable as a
     live one.
     */
    fileprivate func emitFrameStatus(boxes: [[String: Any]], read: LiveRead, reading: Bool) {
        let gate = effectiveStillThreshold
        let still = motionHistory.count >= motionHistoryLength && lastMotion < gate
        onTextBoxes?([
            "boxes": boxes,
            // Steady AND looking at characters. Either alone is the wrong trigger: a still camera
            // on a blank wall, or a jittering one over a plate.
            "stable": reading && still && read.characterCount > 0,
            // ⚑ Marginal means characters WERE detected and read badly. A frame with no text is
            // not a marginal read — it is a photograph of a pipe, and telling someone to retake it
            // is an alarm on the majority case.
            "marginal": reading && read.characterCount > 0 && read.meanConfidence < LiveRead.goodConfidence,
            "reading": reading,
            "meanConfidence": read.meanConfidence,
            "characterCount": read.characterCount,
            "still": still,
            // Reported whether or not it changed anything, so a threshold that turns out wrong in
            // a real mechanical room is a number somebody can read rather than a shutter that
            // mysteriously will not fire. Same stance as `lightScore`.
            "motion": Double(lastMotion),
            // The gate actually applied to this frame, not the floor it is clamped to —
            // printing the constant while a different number decides is how a panel lies quietly.
            "stillThreshold": Double(gate)
        ])
    }
}

// MARK: - Photo delegate

extension CameraController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        finish(id: photo.resolvedSettings.uniqueID, data: photo.fileDataRepresentation(), error: error)
    }
}

// MARK: - Web view transparency

/**
 The two lines that put the web layer over the preview.

 `isOpaque = false` is the whole trick and it is also the trap: get it wrong and the symptom is a
 black screen, which is #71's symptom exactly. Restoring the previous value on teardown is what
 keeps the two distinguishable.
 */
/**
 A view whose backing layer IS the preview layer.

 ⚑ Proven necessary on device 2026-08-14: with the preview as a *sublayer*, the container
 autoresized on rotation and the layer did not — CALayer has no autoresizing — so turning the iPad
 to landscape left a black band down the right of the picture while every web overlay sat correctly
 over it. Making it the backing layer means UIKit resizes it, and there is no second frame to keep
 in step.
 */
final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    // swiftlint:disable:next force_cast
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

enum WebLayer {
    static func makeTransparent(_ view: UIView) {
        view.isOpaque = false
        view.backgroundColor = .clear
        view.subviews.compactMap { $0 as? UIScrollView }.first?.backgroundColor = .clear
    }

    static func restore(_ view: UIView, wasOpaque: Bool) {
        view.isOpaque = wasOpaque
        view.backgroundColor = wasOpaque ? .white : .clear
    }
}
