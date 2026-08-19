# Does entering a zone start a tracking session that lives for the whole zone?
2026-08-19. Asked by the design session **before Stage 5 hardens**, because the answer may change
Stage 5's shape. **Nothing here is built.** Facts are from Apple's documentation, this repository,
and the on-device enumeration recorded in
[POSE-COSTING-2026-08-19.md](POSE-COSTING-2026-08-19.md).

## 1 · The answer is yes, and it is Apple's documented flow rather than a trick

Three APIs carry it, and the middle one is the whole architecture:

| API | what it gives |
|---|---|
| `RoomCaptureSession(arSession:)` | RoomPlan runs on **your** session — "RoomPlan preserves all of the AR session's settings" |
| `RoomCaptureSession.stop(pauseARSession: false)` | ⚑ **end the room scan without ending the tracking session** |
| `StructureBuilder.capturedStructure(from:)` | merges several `CapturedRoom`s — *"succeeds when all of the captured rooms share compatible world space"* |

`stop(pauseARSession: false)` is the load-bearing call. It exists precisely so a scan can finish
while the coordinate space survives, and Apple's own multi-room guidance names passing one
`ARSession` through successive room captures as the first of two ways to keep rooms compatible.

**So the "yes" branch is buildable as documented.** Enter a zone → start one `ARSession` → RoomPlan
scans the shell on it → `stop(pauseARSession: false)` → every object shot, plate and traverse frame
taken afterwards carries an `ARCamera.transform` **in the same coordinate space as the floorplan and
the mesh.** That is the version where measurement-as-query works, because containers and mesh share
coordinates.

## 2 · What the "no" branch actually costs — and the bridge is worse than it looks

Two `ARSession`s are two coordinate spaces: a new session defines its world origin from wherever the
device happened to be. Apple's second route across that gap is `ARWorldMap` relocalisation, and it is
**conditional in a way that matters in a basement**:

- the session starts in `.limited(.relocalizing)` and only reaches `.normal` *if* it can reconcile;
- reconciling requires the camera to **see part of the previously mapped area again** — Apple's own
  instruction to the user is *"Move your device to the most recently scanned room"*;
- if it cannot reconcile, it **stays in `.relocalizing` indefinitely**;
- reliability *"strongly depends on the real-world environment"* and degrades with changed lighting.

⚑ **So the fallback asks the concierge to walk backwards to a room they have finished, and may then
fail silently-ish anyway.** A scan-then-stop-then-traverse design does not merely make joining harder;
without relocalisation **the floorplan and the traverse cannot be joined at all.**

## 3 · The cost of "yes", stated plainly

### 3a · ⚑ The lens trade stops being a traverse question and becomes a zone question

**World tracking is wide-angle only** — every one of the twelve supported video formats on
`iPad13,4` is `builtInWideAngleCamera`; neither `builtInUltraWideCamera` nor `builtInDualWideCamera`
appears. That was enumerated on the device, not inferred.

A zone-long session therefore puts **every capture in that zone at 64.7°**, not just the traverse:

    ultra-wide 107.3°  →  normal 64.7°   is 2.15× the linear width, at any distance

| framed on the ultra-wide at | needs, on the normal lens |
|---|---|
| 0.8 m | 1.7 m |
| 1.0 m | 2.1 m |
| 1.5 m | 3.2 m |

**This is the finding that has been under-weighted.** The lens ruling exists because *the lens is a
substitute for stepping backwards, and in a tight mechanical room you often cannot step backwards*
(`lensPolicyFor`, owner ruling 2026-08-16). A zone-long session revokes that substitute for the whole
zone — for object shots and room shots, not only for the traverse. In a plant room where the
concierge is a metre from a furnace, the choice is *step back to 2.1 m* or *do not get the whole
thing in the picture*, and often neither is available.

⚑ **That is a capture-doctrine change, not an implementation detail, and it is the owner's call.**

### 3b · The plate camera, which is better than feared but not settled

`captureHighResolutionFrame(using photoSettings: AVCapturePhotoSettings?, completion:)` (iOS 16+)
takes **custom photo settings**, obtained from the video format's `defaultPhotoSettings` and
modified. `AVCapturePhotoBracketSettings` is a subclass of `AVCapturePhotoSettings`, so the type
system permits handing the bracket in.

**Whether the AR capture pipeline honours a bracket is not documented.** It is one of the two things
that must be settled on the device before any of this is committed to.

Device-level control survives: `configurableCaptureDeviceForPrimaryCamera` returns the underlying
`AVCaptureDevice`, so torch, focus and exposure remain settable — **including the metered shutter
shipped today**, which would need re-applying on that path rather than inheriting from the
`AVCaptureSession` that no longer exists.

Two known frictions:
- `ARWorldTrackingConfiguration.isAutoFocusEnabled` exists because world tracking wants autofocus;
  the traverse deliberately **locks** focus for a leg. Locking focus under ARKit may degrade
  tracking. Nobody has had to make this trade yet.
- `captureHighResolutionFrame` fails with `highResolutionFrameCaptureInProgress` if one is already
  running — so the bracket, if it works at all, is a serialised sequence rather than a burst.

### 3c · Thermal, and the ruling on how to find out

⚑ **Field 6 includes mesh — one build, not pose-then-decide** (design session ruling 2026-08-19).
Splitting them means a second pass through the same code. **Thermal is measured during the build,
not as a gate before it.**

The baseline is in hand and is the thing to measure against: **98 minutes, 100% → 85%, `nominal`
throughout — 9.2%/hour with camera and screen live.** World tracking plus `sceneReconstruction =
.mesh` running for a whole zone is materially heavier, and Apple's guidance is blunt: *"each feature
consumes device energy and compute cycles… enable additional options sparingly."*

## 4 · What it buys, which is the reason to consider paying

- **One coordinate space for the whole zone.** Floorplan, mesh, object pins, plates and traverse
  frames all in it. Measurement-as-query — clearance in front of equipment, ceiling height, run
  lengths — becomes a lookup rather than a second visit with a tape.
- **A relation's two endpoints become computable rather than narrated.**
- ⚑ **The device says when it does not know.** `ARCamera.trackingState` is `normal`,
  `limited(reason)` or `notAvailable`. Every measure built in the traverse track had honesty bolted
  on afterwards at the cost of a round each, and four shipped without it and were found wrong in a
  mechanical room. This is the property the pinned traverse never had.

## 5 · What must be settled on the device before committing

Two things, both small, neither an argument:

1. **Does a bracket survive `captureHighResolutionFrame(using:)`?** If not, the plate path either
   loses bracketing inside a zone session or the session tears down for every plate — and tearing
   down for every plate is the "no" branch wearing the "yes" branch's clothes.
2. **What does a zone-long world-tracking + mesh session cost thermally**, against 9.2%/hour? Taken
   *during* the Field 6 build, per §3c.

⚑ **And one thing that is not a device question at all: §3a is an owner ruling, and it should be
made before either measurement is worth taking.** If 64.7° for every capture in a tight plant room is
unacceptable, the zone-long session is unacceptable with it, and neither measurement matters.
