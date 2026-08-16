import AVFoundation
import Capacitor
import CoreImage
import CoreMotion
import Foundation
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
        CAPPluginMethod(name: "adjust", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "capture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startTraverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTraverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

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
        controller.capture { result in
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
        controller.startTraverse { result in
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
struct ModeGoal {
    enum TorchPolicy { case never, whenUnderLit }

    let closeFocus: Bool
    /// Meter the subject rather than the scene — the plate, not the bright tank beside it.
    let spotMeterSubject: Bool
    let torch: TorchPolicy
    let liveText: Bool
    /// Extra exposures, but only when the live read comes back marginal. Never unconditionally.
    let bracketWhenMarginal: Bool
    let detectPageEdges: Bool
    let wantsLevel: Bool

    static func of(_ mode: CameraMode) -> ModeGoal {
        switch mode {
        case .object, .concern:
            // Concern is Object optically. It differs in what the concierge MEANS by it — "look
            // here" — and that meaning is recorded on the door, never inferred from the frame.
            return ModeGoal(closeFocus: false, spotMeterSubject: false, torch: .never,
                            liveText: false, bracketWhenMarginal: false,
                            detectPageEdges: false, wantsLevel: false)
        case .text:
            return ModeGoal(closeFocus: true, spotMeterSubject: true, torch: .whenUnderLit,
                            liveText: true, bracketWhenMarginal: true,
                            detectPageEdges: false, wantsLevel: true)
        case .document:
            // A different camera, not a photograph with a label: flat, high contrast, edges found
            // and corrected. Built as "a photo we named document" it produces a curled invoice at
            // an angle that reads badly.
            return ModeGoal(closeFocus: false, spotMeterSubject: false, torch: .whenUnderLit,
                            liveText: true, bracketWhenMarginal: false,
                            detectPageEdges: true, wantsLevel: true)
        }
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
    /// Deskew, JPEG writes and the accurate OCR pass. Off main because a 12 MP read is most of a
    /// second, and off `visionQueue` because that one is feeding the live loop.
    private let processingQueue = DispatchQueue(label: "ca.housesteady.camera.processing")
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    private var device: AVCaptureDevice?
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
    /// A fraction of frame width. Hand-held still is small but never zero.
    private let stillThreshold: CGFloat = 0.006
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
        }
        let completion: (Result<[String: Any], Error>) -> Void
        let bracketed: Bool
        /// What the torch was doing when the concierge pressed. The pair restores it afterwards.
        let torchAtCapture: Bool
        var frames: [Frame] = []
        var outstanding: Int
        var wantsTorchPair: Bool
        var pairFired = false

        init(completion: @escaping (Result<[String: Any], Error>) -> Void,
             bracketed: Bool, torchAtCapture: Bool, outstanding: Int, wantsTorchPair: Bool) {
            self.completion = completion
            self.bracketed = bracketed
            self.torchAtCapture = torchAtCapture
            self.outstanding = outstanding
            self.wantsTorchPair = wantsTorchPair
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
        guard session.inputs.isEmpty else { return }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.noCamera
        }
        self.device = device

        session.beginConfiguration()
        session.sessionPreset = .photo

        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else { throw CameraError.noCamera }
        session.addInput(input)

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

    @discardableResult
    func apply(mode: CameraMode) -> Achieved {
        self.mode = mode
        self.goal = ModeGoal.of(mode)
        var unmet: [String] = []

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
    private static let torchReleaseThreshold = 0.15
    /// Auto-exposure needs a moment to converge after the light changes. Deciding inside that
    /// window measures the transition rather than the scene.
    private static let torchSettleSeconds = 1.5
    private var torchChangedAt: Date?

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
            let wanted = torchOn
                ? score >= Self.torchReleaseThreshold
                : score >= Self.underLitThreshold && !readingWell
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
            "sessionRunning": sessionRunning,
            "torchOn": torchOn,
            "torchOverridden": torchOverride != nil,
            "lightScore": lightScore(),
            "underLitThreshold": Self.underLitThreshold,
            // The release threshold rides beside the arm threshold so the hysteresis gap is a
            // pair of numbers on screen rather than a constant somebody has to go and read.
            "torchReleaseThreshold": Self.torchReleaseThreshold,
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
            "unmetAtStart": unmetAtStart
        ]
    }

    // MARK: capture

    /// Capacitor dispatches plugin calls off the main queue; job bookkeeping lives on main, so the
    /// hop happens once here rather than at three places inside.
    func capture(_ completion: @escaping (Result<[String: Any], Error>) -> Void) {
        if Thread.isMainThread {
            performCapture(completion)
        } else {
            DispatchQueue.main.async { [weak self] in self?.performCapture(completion) }
        }
    }

    private func performCapture(_ completion: @escaping (Result<[String: Any], Error>) -> Void) {
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

         ⚑ And the pair is **two independent reads of one plate by construction**: wherever the
         two transcriptions disagree, the disagreement localises the glare to those characters.
         That is a property of taking the pair at all, not something anybody has to implement.

         Paired only when the torch actually fires — one extra frame, on the minority of captures
         where there is anything to compare. Never during a traverse, where the torch is latched
         and the exposure locked, and a mid-traverse torch cycle would break both.
         */
        let wantsTorchPair = torchOn && !isTraversing

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
            outstanding: wantsBracket ? 3 : 1,
            wantsTorchPair: wantsTorchPair
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
    private static func exifOrientation(of jpeg: Data) -> Int {
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

    private func completeCaptureFrame(id: Int64, data: Data?, error: Error?) {
        guard let job = jobs[id] else { return }
        let requestedWithTorch = torchForRequest[id] ?? false

        if let error {
            release(job)
            job.completion(.failure(CameraError.captureFailed(error.localizedDescription)))
            return
        }
        if let data { job.frames.append(CaptureJob.Frame(data: data, torch: requestedWithTorch)) }
        job.outstanding -= 1
        guard job.outstanding <= 0 else { return }

        // The unlit half of the pair is owed. Fire it before completing, so both frames arrive as
        // one capture — the concierge pressed once and must get one result back.
        if job.wantsTorchPair && !job.pairFired {
            job.pairFired = true
            fireTorchPair(for: job)
            return
        }

        release(job)
        if job.wantsTorchPair { setTorch(job.torchAtCapture) }
        let angle = Double(captureRotationAngle)
        let currentMode = mode
        let wantsDeskew = goal.detectPageEdges
        let wantsText = goal.liveText
        processingQueue.async { [weak self] in
            self?.assemble(job: job, id: id, rotationAngle: angle, mode: currentMode,
                           wantsDeskew: wantsDeskew, wantsText: wantsText)
        }
    }

    /// Every settings id pointing at this job — a torch pair registers two.
    private func release(_ job: CaptureJob) {
        for (key, value) in jobs where value === job {
            jobs[key] = nil
            torchForRequest[key] = nil
        }
    }

    private func fireTorchPair(for job: CaptureJob) {
        setTorch(false)
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.torchPairSettleSeconds) { [weak self] in
            guard let self else { return }
            // The scene is genuinely darker now, so this frame wants the exposure system's own
            // answer rather than the lit frame's settings — which is what continuous AE gives it,
            // once it has had `torchPairSettleSeconds` to converge.
            let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
            settings.photoQualityPrioritization = .quality
            let id = settings.uniqueID
            self.jobs[id] = job
            self.torchForRequest[id] = false
            job.outstanding = 1
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
        var outgoing = job.frames
        if wantsDeskew, let first = outgoing.first, let flattened = Self.flattenPage(jpeg: first.data) {
            outgoing[0] = CaptureJob.Frame(data: flattened, torch: first.torch)
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
                "torch": frame.torch
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
        if job.pairFired, reads.count >= 2,
           let lit = reads[0]?["text"] as? String, let unlit = reads[1]?["text"] as? String {
            payload["torchPairAgreement"] = Self.agreement(between: lit, and: unlit)
        }
        // The top-level read stays frame 0's — the declared surface, unchanged. Stored by nobody,
        // because there is nowhere for it to land (#163).
        if let first = reads.first, let read = first { payload["ocr"] = read }
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
        var awaitingFrame = false
        var index = 0
        var unmet: [String] = []
        var torchLatched = false
    }

    /// Fraction of frame width to travel before the next still. 0.40 leaves ~60% nominal overlap.
    private static let traverseTargetTravel: CGFloat = 0.40
    /// Below this, contact is not established and the pair is a gap.
    private static let traverseMinimumOverlap = 0.25
    /// Above this, the two halves of the frame moved differently — parallax — and a single
    /// translation does not describe the pair, so no claim is made about it either way.
    private static let traverseDisparityTolerance = 0.08
    /// Registration runs at every other frame during a traverse rather than every sixth: a fast
    /// move between analysed frames is a pair the accumulator cannot register, and the
    /// accumulator is what decides when to fire.
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

    func startTraverse(completion: @escaping (Result<[String: Any], Error>) -> Void) {
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
        if let device {
            do {
                try device.lockForConfiguration()
                if device.isExposureModeSupported(.locked) { device.exposureMode = .locked }
                else { unmet.append("lockedExposure") }
                if device.isWhiteBalanceModeSupported(.locked) { device.whiteBalanceMode = .locked }
                else { unmet.append("lockedWhiteBalance") }
                if device.isFocusModeSupported(.locked) { device.focusMode = .locked }
                else { unmet.append("lockedFocus") }
                device.unlockForConfiguration()
            } catch {
                unmet.append("configuration")
            }
        }
        // The rotation is fixed for the run, like the exposure. Frames individually re-rotated
        // part-way through a continuous move would not be one traverse.
        applyRotation(captureRotationAngle, to: photoOutput.connection(with: .video))
        let latched = torchOn

        visionQueue.async { [weak self] in
            guard let self else { return }
            let run = TraverseRun()
            run.unmet = unmet
            run.torchLatched = latched
            self.traverse = run
            self.isTraversing = true
            DispatchQueue.main.async {
                completion(.success([
                    "startedAt": ISO8601DateFormatter().string(from: run.startedAt),
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
                "torchLatched": run.torchLatched,
                "unmet": run.unmet,
                // ⚑ The count the binder actually asks for. A traverse with one unverified pair
                // is a different object from one with none, and summing it here means nobody
                // downstream has to know the verdict vocabulary to ask the question.
                "gaps": run.pairs.filter { ($0["contiguity"] as? String) == "gap" }.count,
                "unverified": run.pairs.filter { ($0["contiguity"] as? String) == "unverified" }.count
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
        guard let working = downscaled(pixelBuffer, crop: nil) else { return }

        // The first frame is kept unconditionally: there is nothing to have travelled from.
        guard let previous = run.previousBuffer else {
            run.previousBuffer = working
            requestTraverseFrame(run: run, buffer: working)
            return
        }
        run.previousBuffer = working
        guard let step = translationFraction(from: previous, to: working) else { return }
        run.travel.x += step.x
        run.travel.y += step.y
        if hypot(run.travel.x, run.travel.y) >= Self.traverseTargetTravel {
            requestTraverseFrame(run: run, buffer: working)
        }
    }

    private func requestTraverseFrame(run: TraverseRun, buffer: CVPixelBuffer) {
        run.awaitingFrame = true
        run.pendingBuffer = buffer
        run.travel = .zero
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
        run.index += 1
        let name = "hs-traverse-\(Int(run.startedAt.timeIntervalSince1970))-\(index).jpg"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        guard (try? data.write(to: url, options: .atomic)) != nil else { return }
        run.frames.append([
            "path": url.path,
            "bytes": data.count,
            "index": index,
            "exifOrientation": Self.exifOrientation(of: data),
            "at": ISO8601DateFormatter().string(from: Date())
        ])

        if let previous = run.lastKeptBuffer, let current = run.pendingBuffer {
            run.pairs.append(measureOverlap(from: previous, to: current, from: index - 1, to: index))
        }
        run.lastKeptBuffer = run.pendingBuffer
        // `lastPair` is omitted rather than sent as a wrapped nil: `Optional.none as Any` does not
        // survive the bridge as a JS null, it survives as something the far side cannot read.
        var progress: [String: Any] = ["frames": run.frames.count, "pairs": run.pairs]
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
                                from fromIndex: Int, to toIndex: Int) -> [String: Any] {
        let left = CGRect(x: 0, y: 0, width: 0.5, height: 1)
        let right = CGRect(x: 0.5, y: 0, width: 0.5, height: 1)
        let full = translationFraction(from: previous, to: current)
        let leftShift = crops(previous, current, left).flatMap { translationFraction(from: $0.0, to: $0.1) }
        let rightShift = crops(previous, current, right).flatMap { translationFraction(from: $0.0, to: $0.1) }

        var record: [String: Any] = ["from": fromIndex, "to": toIndex]
        guard let full, let leftShift, let rightShift else {
            record["measured"] = false
            record["contiguity"] = "unverified"
            return record
        }
        // Half-crop x-translations are fractions of a half width; halve them to speak about the
        // whole frame. Heights are unchanged by the crop, so y needs no conversion.
        let disparity = hypot((leftShift.x - rightShift.x) * 0.5, leftShift.y - rightShift.y)
        let overlap = max(0, 1 - abs(full.x)) * max(0, 1 - abs(full.y))

        let contiguity: String
        if Double(disparity) > Self.traverseDisparityTolerance {
            // ⚑ Not a gap. The model does not describe this pair, so this mechanism has nothing
            // to say about whether contact was kept — and saying "gap" here is the false alarm
            // that sends somebody back to a room they already covered.
            contiguity = "unverified"
        } else if Double(overlap) < Self.traverseMinimumOverlap {
            contiguity = "gap"
        } else {
            contiguity = "contiguous"
        }

        record["measured"] = true
        record["dx"] = Double(full.x)
        record["dy"] = Double(full.y)
        record["overlap"] = Double(overlap)
        record["disparity"] = Double(disparity)
        record["contiguity"] = contiguity
        return record
    }

    private func crops(_ a: CVPixelBuffer, _ b: CVPixelBuffer, _ rect: CGRect) -> (CVPixelBuffer, CVPixelBuffer)? {
        guard let ca = downscaled(a, crop: rect), let cb = downscaled(b, crop: rect) else { return nil }
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

    /// A small BGRA copy, optionally of a normalised sub-rectangle. Registration is a geometric
    /// question; running it at sensor resolution would cost twenty times as much to answer it.
    private func downscaled(_ buffer: CVPixelBuffer, crop: CGRect?) -> CVPixelBuffer? {
        var image = CIImage(cvPixelBuffer: buffer)
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

    private static func readAccurately(jpeg: Data) -> [String: Any]? {
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
            lines.append(["text": candidate.string, "confidence": Double(candidate.confidence)])
            total += Double(candidate.confidence)
        }
        guard !lines.isEmpty else { return nil }
        return [
            "lines": lines,
            "text": lines.compactMap { $0["text"] as? String }.joined(separator: "\n"),
            "meanConfidence": total / Double(lines.count),
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
        guard goal.liveText, !analysing else { return }

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
        // Steady AND looking at characters. Either alone is the wrong trigger: a still camera on a
        // blank wall, or a jittering one over a plate.
        let still = motionHistory.count >= motionHistoryLength && lastMotion < stillThreshold
        let stable = still && read.characterCount > 0

        // ⚑ Marginal means characters WERE detected and read badly. A frame with no text is not a
        // marginal read — it is a photograph of a pipe, and telling someone to retake it is an
        // alarm on the majority case.
        let marginal = read.characterCount > 0 && read.meanConfidence < 0.55

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

        onTextBoxes?([
            "boxes": boxes,
            "stable": stable,
            "marginal": marginal,
            "meanConfidence": read.meanConfidence,
            "characterCount": read.characterCount,
            // Reported whether or not it changed anything, so a threshold that turns out wrong in
            // a real mechanical room is a number somebody can read rather than a shutter that
            // mysteriously will not fire. Same stance as `lightScore`.
            "motion": Double(lastMotion),
            "stillThreshold": Double(stillThreshold)
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
