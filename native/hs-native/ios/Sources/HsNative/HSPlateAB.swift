import ARKit
import AVFoundation
import Foundation
import UIKit
import Vision

/**
 **The plate test — the last thing that can sink the new architecture.**

 The research response's Gate 1, minutes 55–60: *"the same data plate in the worst light in the
 building, torch on, one frame via the API and one via the current session; the desk judges
 legibility."*

 ⚑ **This does not ask the desk to judge. It measures.** Both paths photograph the same plate, both
 photographs go through **the same Vision recogniser at the same settings**, and the comparison is
 character count and mean confidence. *A number, not an impression* — because "looks about the same"
 is what a person says about two photographs when one of them is quietly worse.

 ## Why it has to be sequential, and what that costs

 ARKit and an `AVCaptureSession` cannot hold the rear camera at once, so the two paths cannot fire
 together. ⛑ **The operator must hold the same framing across the whole run**, and the honest way is
 to brace the iPad rather than hold it. *If the framing moves, the comparison measures the framing.*

 ## The sequence, ~50 seconds

     0–15 s   aim at the plate and brace. Torch arms. Nothing is captured.
     15–21 s  THREE frames through ARKit's session (captureHighResolutionFrame)
     21–28 s  handover: ARKit pauses, the photo session starts
     28–34 s  THREE frames through the current path (AVCapturePhotoOutput)
     34 s     six JPEGs and six reads written to Documents

 Both paths get the same device settings first — near-focus restriction, centre spot metering,
 continuous auto-exposure, torch on — applied through `configurableCaptureDeviceForPrimaryCamera`
 under ARKit and through the same `AVCaptureDevice` under AVFoundation. **Measured on 2026-08-28 to
 take and hold under ARKit; that measurement is what makes this test worth running at all.**
 */
@available(iOS 16.0, *)
final class HSPlateAB: NSObject, AVCapturePhotoCaptureDelegate {
    private let arSession = ARSession()
    private let photoSession = AVCaptureSession()
    private let photoOut = AVCapturePhotoOutput()
    private var device: AVCaptureDevice?
    private var lines: [String] = []
    private var avShots = 0
    private var done: (([String: Any]) -> Void)?

    private func say(_ s: String) { print("HS-PLATE \(s)"); lines.append(s); flush() }

    func run(completion: @escaping ([String: Any]) -> Void) {
        done = completion
        say("device \(UIDevice.current.model) iPadOS \(UIDevice.current.systemVersion)")
        say("AIM AT THE PLATE AND BRACE THE IPAD. Do not move it for 40 seconds.")

        let config = ARWorldTrackingConfiguration()
        // Same 4:3 preference the corrected Gate 1 uses — the stream's aspect ratio is the still's.
        let capable = ARWorldTrackingConfiguration.supportedVideoFormats
            .filter { $0.isRecommendedForHighResolutionFrameCapturing }
        let fourThree = capable.filter { abs($0.imageResolution.width / $0.imageResolution.height - 4.0/3.0) < 0.02 }
        if let f = (fourThree.isEmpty ? capable : fourThree).min(by: { $0.framesPerSecond < $1.framesPerSecond }) {
            config.videoFormat = f
            say("ARKit format \(Int(f.imageResolution.width))x\(Int(f.imageResolution.height))@\(f.framesPerSecond)")
        }
        arSession.run(config, options: [.resetTracking, .removeExistingAnchors])

        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
            guard let self else { return }
            self.device = ARWorldTrackingConfiguration.configurableCaptureDeviceForPrimaryCamera
            self.applyPlateSettings(to: self.device, torch: true, label: "ARKit")
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.arkitShots(0) }
        }
    }

    /// The Text-mode settings, applied identically on both sides. ⚑ If these differ between paths
    /// the test compares settings, not cameras.
    private func applyPlateSettings(to device: AVCaptureDevice?, torch: Bool, label: String) {
        guard let device else { say("\(label): NO DEVICE"); return }
        do {
            try device.lockForConfiguration()
            if device.isAutoFocusRangeRestrictionSupported { device.autoFocusRangeRestriction = .near }
            if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
            if device.isFocusPointOfInterestSupported { device.focusPointOfInterest = CGPoint(x: 0.5, y: 0.5) }
            if device.isExposurePointOfInterestSupported { device.exposurePointOfInterest = CGPoint(x: 0.5, y: 0.5) }
            if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
            if torch, device.hasTorch, device.isTorchModeSupported(.on) { try? device.setTorchModeOn(level: 1.0) }
            device.unlockForConfiguration()
            say("\(label): settings applied, torch \(device.isTorchActive), ISO \(Int(device.iso)), shutter 1/\(Int(1/CMTimeGetSeconds(device.exposureDuration)))")
        } catch { say("\(label): LOCK REFUSED \(error.localizedDescription)") }
    }

    private func arkitShots(_ n: Int) {
        guard n < 3 else {
            say("ARKit path done — handing the camera over")
            if let d = device, (try? d.lockForConfiguration()) != nil { d.torchMode = .off; d.unlockForConfiguration() }
            arSession.pause()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.startPhotoPath() }
            return
        }
        arSession.captureHighResolutionFrame { [weak self] frame, error in
            guard let self else { return }
            if let f = frame, error == nil {
                let w = CVPixelBufferGetWidth(f.capturedImage), h = CVPixelBufferGetHeight(f.capturedImage)
                if let jpeg = self.jpeg(f.capturedImage) { self.record("arkit", n, jpeg, "\(w)x\(h)") }
            } else { self.say("ARKit shot \(n) FAILED \(error?.localizedDescription ?? "")") }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.arkitShots(n + 1) }
        }
    }

    private func startPhotoPath() {
        guard let cam = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: cam) else { say("AV: no camera"); finish(); return }
        photoSession.beginConfiguration()
        photoSession.sessionPreset = .photo
        if photoSession.canAddInput(input) { photoSession.addInput(input) }
        if photoSession.canAddOutput(photoOut) { photoSession.addOutput(photoOut) }
        photoOut.maxPhotoQualityPrioritization = .quality
        photoSession.commitConfiguration()
        photoSession.startRunning()
        device = cam
        // Same settings, same torch, and a moment for auto-exposure to converge — the lesson from
        // 2026-08-30, where metering an unconverged camera locked a near-black leg.
        applyPlateSettings(to: cam, torch: true, label: "AVFoundation")
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.avShot() }
    }

    private func avShot() {
        guard avShots < 3 else {
            if let d = device, (try? d.lockForConfiguration()) != nil { d.torchMode = .off; d.unlockForConfiguration() }
            photoSession.stopRunning(); finish(); return
        }
        let s = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        s.photoQualityPrioritization = .quality
        photoOut.capturePhoto(with: s, delegate: self)
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        let n = avShots; avShots += 1
        if let d = photo.fileDataRepresentation(), error == nil {
            record("avfoundation", n, d, "\(photo.resolvedSettings.photoDimensions.width)x\(photo.resolvedSettings.photoDimensions.height)")
        } else { say("AV shot \(n) FAILED \(error?.localizedDescription ?? "")") }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.avShot() }
    }

    /// ⚑ Both paths read by the SAME recogniser at the SAME settings. That is the whole comparison.
    private func record(_ path: String, _ n: Int, _ jpeg: Data, _ dims: String) {
        if let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            try? jpeg.write(to: dir.appendingPathComponent("hs-plate-\(path)-\(n).jpg"))
        }
        let r = CameraController.readAccurately(jpeg: jpeg)
        let chars = (r?["characterCount"] as? Int) ?? 0
        let conf = (r?["meanConfidence"] as? Double) ?? 0
        let text = ((r?["text"] as? String) ?? "").replacingOccurrences(of: "\n", with: " ⏎ ")
        say(String(format: "%@ #%d  %@  %d KB  chars=%d  confidence=%.3f", path, n, dims, jpeg.count/1024, chars, conf))
        say("   text: \(text.prefix(180))")
    }

    private func jpeg(_ b: CVPixelBuffer) -> Data? {
        CIContext().jpegRepresentation(of: CIImage(cvPixelBuffer: b),
                                       colorSpace: CGColorSpaceCreateDeviceRGB(),
                                       options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.95])
    }

    private func finish() {
        say("DONE — six frames and six reads written. Plug in.")
        done?(["lines": lines.count])
    }

    private func flush() {
        guard let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        try? lines.joined(separator: "\n").write(to: dir.appendingPathComponent("hs-plate.txt"),
                                                 atomically: true, encoding: .utf8)
    }
}
