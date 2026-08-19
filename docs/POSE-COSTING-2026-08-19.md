# Pose and LiDAR in the traverse — a costing
2026-08-19. Requested by the design session. **Nothing here is built.** Facts are from Apple's
documentation and this repository; where a fact needs the device to settle it, that is said.

## 0 · The fact asked for first, and the framing corrected

**Does this iPad have LiDAR?** Yes — `iPad13,4`, iPad Pro 11-inch 3rd generation. Every iPad Pro
from 2020 carries it. Confirmable at runtime with
`ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)`.

**Is pose implemented?** No. It exists as `pose?: { x, y, z }` in `hsCamera.ts` and as a paragraph
in the plugin header saying position needs ARKit and is not this step.

⚑ **But this is not rule 43, and the distinction matters.** Rule 43 is *a value being computed is
not the same as a reader being able to reach it* — something measured, then dropped on the way out.
`pose` is nothing of the kind: it is never computed, it is documented as absent, and it is reported
as absent. The comment reads *"the declared no-position state, never a fabricated one."* That is a
declared-and-unbuilt capability, honestly labelled. Calling it rule 43 would blur a rule that has
earned its precision over six instances.

⚑ **There IS an unbuilt capability with a user-facing surface, though, and it is not `pose`.**
`src/native/roomPlan.ts` is a complete bridge — `isSupported`, `scan` — and
`src/screens/Stage0ScanCard.tsx` is a card that calls it. **There is no native RoomPlan plugin**:
`native/hs-native/ios/Sources/HsNative/` contains only the camera and shell plugins. It fails safe
twice over — the bridge finds no plugin and reports unsupported, and nothing imports the card at
all — so it is dead code rather than a broken button. Worth deleting or finishing, not worth
alarm.

**And the sequencing criticism is fair even though the rule name is not.** Eight rounds went into
inferring motion from pixels while the device's own answer sat unbuilt.

## 1 · Can a traverse take frames from an ARSession and record relative pose?

**Yes, and pose is free.** `ARFrame` carries `capturedImage` and `camera.transform`, a 4x4 world
transform per frame. Relative pose between two kept frames is one matrix multiply. ⚑ **It is not a
comparison between two images**, which is the entire reason to want it: every one of the seven
measures tried has failed when two images looked alike or unalike for reasons unrelated to motion.

**⚑ ARKit owns the camera, so yes — two capture paths, and they cannot run at once.** An
`ARSession` and the plugin's `AVCaptureSession` cannot hold the rear camera simultaneously. So:

- The nameplate camera stays on AVFoundation. It needs the torch pair, the bracket, close focus,
  spot metering and 12 MP stills, and it is the surface that has been proven in the field.
- The traverse moves to ARKit.
- Starting and ending a traverse becomes a session teardown and rebuild. **Budget roughly one to
  two seconds each way**, plus ARKit's own tracking initialisation, during which pose is
  `.limited(.initializing)`. That is a real cost paid twice per traverse and it should be measured
  rather than assumed.

**Resolution is NOT the cost it would have been.** Two documented facts remove it:
- `recommendedVideoFormatFor4KResolution` gives 3840x2160 video. Today's traverse frames are
  3680x2760, so this is comparable rather than a step down.
- `captureHighResolutionFrame(completion:)` (iOS 16+) takes a **full-resolution still during a
  running session**, using the format's `defaultPhotoSettings`. So a traverse under ARKit can keep
  shooting stills at the quality it shoots now.

**⚑ And the torch ruling survives.** `configurableCaptureDeviceForPrimaryCamera` hands back the
underlying `AVCaptureDevice`, so torch and focus remain controllable inside an AR session. The
dark-utility-space ruling does not have to be revisited.

**⚑ One genuine collision to flag:** `ARWorldTrackingConfiguration.isAutoFocusEnabled` exists
because world tracking wants autofocus. The traverse currently **locks** focus for the length of a
run, deliberately, so that one frame in the sweep is not soft. Locking focus under ARKit may
degrade tracking. This is a trade nobody has had to make yet.

## 2 · Is the ultra-wide available under ARKit? — ⚑ THIS IS THE BLOCKER

**It must be enumerated on the device, and I will not assert it.**
`ARConfiguration.VideoFormat.captureDeviceType` exposes the camera behind each format, and the
answer is one loop over `ARWorldTrackingConfiguration.supportedVideoFormats`.

⚑ **What the documentation does say is not encouraging.** Apple's only ultra-wide example reads:
*"to specify the ultra-wide camera in a **face-tracking** session, search the supported video
formats for `builtInUltraWideCamera`."* Face tracking, not world tracking. Suggestive, not
dispositive.

**Why this is the blocker rather than a detail: the traverse is ruled wide.** If world tracking is
wide-angle-only, then pose and the lens ruling collide, and it is the owner's call:
- traverse on ARKit at normal field of view, losing the wide framing ruled for it; or
- keep the wide lens and keep inferring motion from pixels; or
- wide for framing, normal for measuring, which means two runs and is almost certainly not worth it.

**This single enumeration decides whether the rest of the costing is worth acting on**, and it is
about ten lines behind the existing dev screen.

## 3 · What scene reconstruction adds, and what it costs

`sceneReconstruction = .mesh` requires LiDAR and yields `ARMeshAnchor` geometry. What that buys is
**distances in metres, as a by-product of walking the room**: clearance in front of equipment,
ceiling height, run lengths — the measurements a trade needs to quote, taken without anybody
measuring anything.

⚑ **And it makes a relation's two endpoints computable rather than narrated**, which is the part
that reaches beyond the traverse.

**The cost is thermal and it is the one number this project already knows how to take.** Apple's own
guidance is blunt: *"each feature consumes device energy and compute cycles, so to maximize device
uptime and performance, enable additional options sparingly."* World tracking plus mesh is
materially heavier than an AVCapture preview.

**The baseline is in hand: 98 minutes, 100% to 85%, `nominal` throughout — 9.2%/hour with camera
and screen live.** A three-hour visit fits comfortably today. ⚑ Whether it still fits with world
tracking and mesh running is unknown and is **a twenty-minute measurement, not an argument**.

## 4 · Recommendation

1. **Enumerate the video formats on the device** — ten lines behind the dev screen, answers §2, and
   decides whether any of this proceeds.
2. **If wide survives: run one twenty-minute mesh-enabled session and watch thermal and battery**
   against the known baseline.
3. **Only then** consider moving the traverse to ARKit.

⚑ **And the argument that makes this worth the disruption is not accuracy, it is honesty.** ARKit
reports its own tracking state — `normal`, `limited(reason)`, `notAvailable`. **The device says when
it does not know.** Every measure built in this track has had that bolted on afterwards, at the cost
of a round each, and four of them shipped without it and were found wrong in a mechanical room.

**Keep recording `placeDistance` regardless.** If pose proves expensive or the lens conflict kills
it, the distribution is the fallback, and it is five different-place samples away from being
decidable.

---

# ADDENDUM — the enumeration was run on the device, 2026-08-19

Read off `iPad13,4` at plugin load, iPadOS 26.5. Raw output logged as `HS-ARKIT-CAPABILITIES`.

## ⚑ The answer to §2: NO. World tracking is wide-angle only.

**Every one of the twelve supported video formats is `builtInWideAngleCamera`.** Neither
`builtInUltraWideCamera` nor `builtInDualWideCamera` appears among them.

⚑ **And this was very nearly reported backwards.** A first pass grepped device-type strings out of
the whole log and found `UltraWide` and `DualWide` present — but those came from the *separate*
AVFoundation lens list added for field-of-view context, not from `supportedVideoFormats`. Pairing
each device to its own format entry reverses the conclusion. **Verify against the artifact, not
against a string that appears near it.**

## The rear lenses, in degrees

| device | field of view |
|---|---|
| `builtInWideAngleCamera` | **64.7°** |
| `builtInUltraWideCamera` | **107.3°** |
| `builtInDualWideCamera` (virtual) | 111.6° |

## World-tracking formats, all wide-angle

| resolution | fps | hi-res still capable |
|---|---|---|
| 3840x2160 | 30 / 25 / 24 | yes |
| 1920x1440 | 60 | yes |
| 1920x1440 | 60 / 30 | no |
| 1920x1080 | 60 / 30 | yes |
| 1920x1080 | 60 / 30 | no |
| 1280x720 | 60 / 30 | no |

`recommended4K` = 3840x2160@30 wide. `recommendedHiRes` = 1920x1440@60 wide.
`worldTrackingSupported` = true. **`meshSupported` = true.**

## What this costs, under the owner's pre-stated ruling

The ruling was given in advance: **take pose, lose the wide.** So the trade is now priced rather
than argued:

- **Field of view falls from 107.3° to 64.7°, a factor of 1.66.** The same wall needs about
  two-thirds more frames laterally, and the trigger already fires on travel rather than time, so
  this needs no change — it simply fires more often. Storage is ruled not a constraint.
- **Resolution is not a loss.** Today's traverse frames are 3680x2760. Tracking at 1920x1440@60
  with `captureHighResolutionFrame` for the stills keeps still quality and gives ARKit the frame
  rate it wants; 4K@30 is the alternative if a still per frame is preferred over tracking headroom.
- ⚑ **The corner argument strengthens rather than weakens.** A narrower lens sees less of a tight
  room per frame, but pose measures motion toward a subject directly — which is the thing eight
  rounds of pixel comparison could not do. The failures are not equal: a missed strip of wall is
  visible and re-walkable; a false contiguous across a real gap is invisible and files as complete.

## Next, in order

1. **Autofocus collision — measure, do not reason.** Run a locked-focus world-tracking session and
   read `ARCamera.trackingState`; `limited(.insufficientFeatures)` is ARKit saying so itself.
2. **The twenty-minute mesh thermal run** against the known 98-minute, 9.2%/hour, `nominal`
   baseline. Mesh is supported, so this is now a measurement rather than a question.
