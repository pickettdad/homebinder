# Does world tracking offer the ultra-wide on this iPad? — measured
2026-08-24 · `iPad13,4`, iPadOS 26.5 · `HSLensProbe`, run on device.

## The answer: no. And the disagreement resolves without anyone being careless.

    13 formats offered to ARWorldTrackingConfiguration
    ULTRA-WIDE FORMATS: 0     DUAL-WIDE FORMATS: 0
    every entry: AVCaptureDeviceTypeBuiltInWideAngleCamera
    RUNNING ON:  AVCaptureDeviceTypeBuiltInWideAngleCamera

⚑ **And the physical lens is present:**

    physical rear lenses: BuiltInWideAngleCamera, BuiltInUltraWideCamera, BuiltInDualWideCamera

**Those two facts are the whole disagreement.** *This device has an ultra-wide* is **true**. *World
tracking offers it* is **false**. The research is right about the hardware and about iOS 16 adding
the capability; it does not follow that this configuration on this device exposes a format for it.

⛑ **The methodology question was fair and the answer is that it was tested properly.** The
enumeration reads `format.captureDeviceType` per format — not resolution — and this probe checked it
a second, differently-shaped way: filter for `.builtInUltraWideCamera`, **report the count as a
number**, then start a session and read back what it actually took from
`configurableCaptureDeviceForPrimaryCamera`. The list says what is offered; that says what was
taken. Both say wide-angle.

*The count moved from 12 to 13 between 2026-08-18 and today, which is its own small argument for
re-reading rather than citing.*

## ⚑ The new fact, and it is worth more than the answer

**A FORMAT change survives `run(config)` without `.resetTracking`.**

    switching 1920x1440 → 1920x1080, no options
    FORMAT SWITCH pose jump 0.0152 m · tracking normal

**Fifteen millimetres is a hand moving, not an origin being rebuilt.** So the design session's
question — *a semantic change survives, but does a format change, which swaps the camera intrinsics?*
— is answered **yes**. Configuration and format can both change mid-zone without costing the world.

⛑ **And the research snippet's `options: [.resetTracking, .removeExistingAnchors]` is correct at
session start and fatal mid-zone**, because it destroys the origin every position in that zone is
measured against. Flagged because the snippet reads as a recipe.

## What was not measured, said rather than implied

**LiDAR-off-in-ultra-wide is untested here, because there is no ultra-wide session to test it in.**
The probe reports `sceneDepth supported: true, present now: false` — but that is only because
`.sceneDepth` was never requested in the frame semantics, **not** evidence about the lens. It is
recorded so nobody reads it as a finding.

## What follows

⚑ **The escape hatch stays what it was always specified as.** The owner's framing already covered
this: *a button for wide angle, hand off, hand back* — per wide shot, not per capture. The answer
being *no* leaves that design untouched.

**It does mean the 0.5× frame cannot be natively positioned**, so the sibling pair stands: one tap,
a 1× frame carrying the measured position and the 0.5× frame beside it, inheriting from its own
sibling.

**Aspect ratio is noted and untested** — the 11" screen does not match the ultra-wide output ratio,
which matters for the AVFoundation hatch rather than for ARKit.
