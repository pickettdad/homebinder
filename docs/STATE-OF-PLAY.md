# State of play — Field Mac session

**Rewritten wholesale, 2026-09-06.** *Replaced, never appended to. Its consumer is the next session,
which may be a fresh one after a usage cut-off.*

---

## ⚑ Where the build actually is

**The continuous ARKit zone session works end to end on device.** ARKit holds the rear camera for the
life of a room; photographs come back through `captureStill` at **4032×3024 in 60–90 ms** with a pose
measured from the frame that became the photograph.

The last tethered walk (2026-09-06) was the **first fully clean one**:

| | |
|---|---|
| floorplan delivery | **0.68 s** (`roomPlanStopping` → `roomDelivered`) |
| `sessionFailed` | **0** |
| `reinits` | **2** — one to open, one for RoomPlan |
| `originEpoch` | **1** all walk — one coordinate frame |
| mesh | **24 anchors** |
| stills through ARKit | **6**, three reporting `mapping: "mapped"` |
| black screens | none |

**Positioning error is measured and settled — do not propose measuring it again.**
`docs/GATE1-RESULT-2026-09-04.md`: **6.0 cm max over 45 min against a 10 cm go/no-go**, plateauing
near 5 cm and wandering. ⛑ *Bounded error, not drift.*

---

## ⚑ The two-zone walk, 2026-09-06 — what it proved

**A ~16-minute untethered walk, two zones (Bedroom A, kitchen): floorplan + mesh + objects + room
shots + traverse legs in each.**

| | |
|---|---|
| both zones exported separately | ✅ `bedroom-a-81b5ba` / `kitchen-e4b910` — the filename collision fix held |
| mesh geometry | ✅ **946 KB and 2.4 MB** of real vertices, faces and transforms |
| floorplans | ✅ every surface with dimensions, confidence, 4×4 transform (5 walls / 4 walls) |
| positions | ✅ **all 15 measured by `sceneDepth`** — not one invented plane |
| traverse frames | ✅ `kept 22 / 24 / 21`, **zero discarded** |
| thermal | ✅ **nominal across all 287 rows**, matching Gate 1's 45 minutes — *while doing more* |
| `originEpoch` | ✅ **1 throughout each zone** |

⛑ **The robustness datapoint worth keeping.** The iPad went **sensor-face-down on a table for 123
seconds** while the owner typed notes. Tracking went `limited(insufficientFeatures)` and came back
`normal` — **with no re-initialisation, no reset, and the same origin.** *The session held the room
through a two-minute blackout.* That is the case the old sleeping build could not have survived, and
it arrived free from an ordinary walk rather than from a probe.

⚠️ **Battery is not measurable on a short walk.** iOS reports `batteryLevel` in **5% steps**, so a
16-minute walk draining ~3% reads as a flat 100% — indistinguishable from a broken instrument. The
honest claim is **under 5% in 16 minutes**, consistent with Gate 1's 9%/46 min. *A longer untethered
walk settles it.*

**Still wrong after this walk:** the room shot produced **no wide sibling at all** (lens histogram
across 82 media: `{normal: 76, absent: 6}`) — a workflow is designing the handover.

## ⚑ The room shot's wide frame — it existed, and it cost the position every time

**Owner, 2026-09-06: *"we did have room shot that took the wide angle and then the normal after. From
what I saw it worked and then it was gone."* He is right, and the earlier export proves it** — 5
`wide` frames, room shots filed as pairs at one timestamp: `primary lens=wide` + `insurance
lens=normal`.

⛑ **And every one of them carries this:**

```
primary   lens=wide    positioned=false   why="Required sensor failed."
insurance lens=normal  position=null
```

⚑ **`Required sensor failed` is ARKit being refused the camera.** The lens swap knocked world tracking
off the sensor on every room shot — so the pair arrived with **no position at all**, on either frame.
*The picture worked and the thing the desk places with was destroyed to get it.*

**So the continuous-session rebuild did not break the room shot. It removed the thing that was
breaking tracking, and the wide frame went with it.** ⛑ *"It never worked" was wrong; so is "it
worked". It produced two photographs and no pose.*

**What the owner is asking for — wide for the visual placement, normal immediately after carrying the
position and the raycast — has never existed in any build.** It is buildable, and the traverse is the
proof: a deliberate yield and a deliberate reclaim, `kept 22 / 24 / 21` frames with none discarded and
`originEpoch` unchanged. **The old room shot's swap was not deliberate — it collided.**

⚠️ **Open before any of it is built:** `minAvailableVideoZoomFactor` and `constituentDevices` on the
ARKit-configured device **have never been read**. The device *type* was measured twice; the zoom floor
never once. *If a virtual dual-wide reports a sub-1.0 floor, the viewfinder and the capture both widen
with no handover, no second session and no pre-build* — and the whole problem disappears.

## ⛑ Operational rules the walk established

- **Press Floorplan once you are standing in the room.** Creating a zone starts nothing — the ARKit
  origin is minted by the first capture door. Tapping Floorplan half a second after creating the zone
  scans wherever you are, which is the recorded cause of *"floorplan picked up some of the dining
  room."*
- **Press Finish mesh LAST.** It harvests everything the zone accumulated, not what was scanned while
  mesh mode was on. Never pressing it discards all of it.


## ⛑ The defect that was open, and the fix that shipped 2026-09-06

**The capture raycast does not hit the object.** Both sites use `allowing: .estimatedPlane`
(`HSZoneSession.swift:745` in `captureStill`, `:1015` in `position()`), which asks ARKit to *invent* a
plane. A water heater is not a detected plane, so the ray returns a guess.

⚑ **Proven from the field, not argued.** Two photographs of one object, same session, same
`originEpoch`, 2 minutes apart (2026-09-06 export, Bedroom 4):

```
camera moved   dx=+0.352  dy=-0.658  dz=+0.195   0.771 m
surface moved  dx=+0.537  dy=-0.683  dz=+0.253   0.905 m
per-axis ratio surface/camera:  x 1.53   y 1.04   z 1.30
```

**All near 1, none near 0.** A ray hitting the same physical object would barely move — the ratio
would be ~0. **The surface tracks the observer**, and the standoff barely changed (0.867 → 0.936 m).

**⚑ The subject was a table lamp** (owner, 2026-09-06), and that sharpens the diagnosis rather than
confirming the first reading of it. Checking the rest of the export: `surface.distance` across the
current build runs **0.333 m to 2.982 m, stdev 0.701** — *not* a constant. **So the ray is hitting
something real. It is hitting the wrong something.**

⛑ **A lamp is ~0.15 m across and thin. `.estimatedPlane` finds the big background plane — the wall or
the table behind it — never the small object in front.** Two standing positions give two points on
that background, which is exactly the 1:1 tracking. *And it generalises to everything this app
photographs: a valve, a nameplate, a shutoff, a lamp. **Planes miss precisely the objects that matter.***

*The session's own doctrine already said the answer:* **"A plane is a guess at a surface; the mesh IS
the surface."** The raycast never used the mesh.

⚑ **The lamp raises `sceneDepth` above the mesh as the likely winner.** LiDAR measures the nearest
thing at the centre pixel; mesh reconstruction is poor on thin geometry and may not contain the lamp
at all. **Nearest-surface-along-the-ray is the requirement, not any-surface.**

**Fixed 2026-09-06 — `HSSurface`, one function both capture doors ask.** `sceneDepth` on the
optical axis first (the LiDAR measures the nearest thing at that pixel whether or not reconstruction
kept it), a ray/triangle intersection against `ARMeshAnchor` geometry where depth cannot see, and a
**refusal** otherwise. No plane, no estimate, no `ARRaycastQuery` left in the session. Every exported
`surface` carries `source`; the zone log carries `surfaceMs` and the reason each rung refused, in
place of the bare `surface: true/false` that let a 96% rate of inventing planes read as validation.

⚑ **The acceptance test is the owner's own pair, and it is now runnable:** two photographs of one
object from two standing positions, ratio of surface movement to camera movement. **Near 0 and this
worked. Near 1 and it did not.** ⛑ *There is a third outcome and it must not be read as success:*
ratio near 0 but `distance` systematically longer than the standoff — that is the ray finding the
wall behind a thin object, which is the case `sceneDepth` exists in this ladder to avoid and the
case the mesh rung alone cannot. Unproven on hardware: it needs a tethered Debug run and then a
TestFlight archive, per the build order.

---

## ⚑ 2026-09-07 evening — the image-quality question, closed by measurement

**The owner's ask:** *"I want the best solution for the image quality, not a bandaid — the step out
seems like a bandaid."* He was right about the step-out: it would put a camera handover on every
photograph, which is exactly what the continuous-session rebuild removed.

### What shipped, and he confirmed it on the device

⚑ **The in-zone still was never stamped with an orientation.** It encodes a `CVPixelBuffer`, which
carries no metadata, and then called `CameraController.exifOrientation(of:)` — whose own comment says
it exists *"so the zone session can stamp the SAME orientation on a still it took itself"* — **to
read.** Nothing had written a tag, so it returned the specified default of `1`.

⛑ **`1` is not an absence. It is a positive claim that a sideways photograph is upright**, and
everything downstream believed it. **Including Vision:** `readAccurately` takes its orientation from
that tag, so **every in-zone plate since 2026-09-05 was read at `.up` while lying on its side** — a
silent OCR loss the desk cannot recover. It reached the traverse on 09-07 through
`entry["exifOrientation"] ?? 1`.

**Fixed** (`7418ea0`): the zone owns a `RotationCoordinator` against ARKit's device, the angle→EXIF
mapping stays in `CameraController` (*"two tables can disagree, one cannot"*), and **no reading
produces no tag** rather than a plausible default. ✅ **Owner verified upright on device.**

Carried in the same commit, none of which can move sharpness and none of which is filed as though it
could: **colour attachments now survive `copyBuffer`** (measured present on ARKit's buffers, so a
real loss), **sRGB named** instead of uncalibrated deviceRGB, **one `CIContext`** instead of one per
photograph, and `rotationAngle` stops being a hard-coded `0` on the TS side.

### ⚠️ The softness: diagnosed, and it is not what this session first claimed

**Scored on the Mac from the owner's own captures — no walk:** not motion blur (anisotropy 0.03–0.13),
not defocus (no tile anywhere is sharp), not JPEG (≈2.2 bits/pixel, at the top of Apple's own band).
⚑ **It is a dim room:** shadow SNR **18.5** against **41.5** on a well-lit frame *from the identical
code path*, shadows at luma 23 vs 53, 1.6× the colour noise.

**Every lever now has a number** (`PHOTO-SETTINGS-RESULT-2026-09-07`):

| lever | measured | status |
|---|---|---|
| photo pipeline / fusion | — | 🔴 `.quality` **refused** (`ARError 107`), `.balanced` **inert** |
| exposure 1/15–1/30 @ low ISO | **+27% shadow SNR, −37% noise** | ⚠️ tracking cost **unmeasured** |
| torch | **+13%** | ✅ safe, small |
| encode / colour / JPEG | **0** | ✅ fixed anyway |

⛑ **The `.quality` refusal returns an `NSError`, not an exception** — so it was always safe to try,
and is now known rather than assumed. *This session proposed it as "the non-bandaid answer" and was
wrong; the document exists so the next session does not re-propose it.*

### 🔴 What a desk can never answer — the owner named it

Feature counts read **2–4** against Gate 1's median of **229**. This session read that as a
textureless scene. **The owner's diagnosis is structural and better:** *"you are starting fresh in a
space with no world-tracking history and expecting it to pick things up immediately?"*

⚑ **ARKit triangulates feature points from parallax.** A stationary iPad seconds after a cold `run()`
generates almost none, **so any stationary probe reads near-zero features whatever the scene.**
*The cost half of the exposure question is only observable while walking.* The image half stands — a
static scene is a fair test of a photograph.

### The open decision, and it is the owner's

**Exposure is the one real remaining code lever: +27% shadow SNR for object captures.** It cannot be
shipped on the desk evidence alone, because a longer exposure could starve VIO during a walk and
nothing here can see that. **So it is a walk to validate, for a 27% gain** — or it is deferred and
the mechanical-room walk happens instead. *A trade-off between two defensible options is his call.*

⚠️ **And the largest remaining variable is not in the code at all: it is how far the concierge stands
from what they are photographing.**

## What is fixed and on the device

- **ARKit frames are copied, never retained** — holding one past the delegate starved the frame pool
  and froze the viewfinder while the shutter kept working
- **`start()` consults zone ownership** inside the queue block; **`openZone` closes the outgoing zone**
  rather than stranding `zoneOwnsCamera` true for the rest of the walk
- **`enter()` shows the preview** — it is the one function that always takes the lens, and
  `showArPreview` had lived in five callers with `wake()` as caller six
- **`pause()` hides the AR preview** before releasing the lens
- **RoomPlan is held until it delivers** — `stop()` is async and dropping the reference made delivery
  a coin toss; **both ends of the build are logged** (`roomDidEnd` / `roomBuilding` / `roomBuilt`)
- **`supersedeRoomPlan`** — one function, three callers, so an interrupted plan is recorded not dropped
- **`originEpoch`** advances only on `.resetTracking`, stamped on plan, mesh and every pose
- **Mesh and positioning are one configuration** — `enterUnchanged` makes switching free
- **Every capture carries its own pose** (the per-container sampling rate is retired)
- **Mesh overlay follows the mode**, not the presence of anchors

## Still open

**From the 2026-09-06 audit (22 confirmed, 14 high — a design workflow is producing patches):**
`roomWaiter` cleared on a Task thread racing `enter(.mesh)` · re-entering a paused zone resets the
React flag but not the native arm · `beginTraverse` gives the lens to ARKit then needs the capture
session · torch override that can never be left · `stop()` never unlocks white balance · in-zone
stills record `torch: false` always · traverse readout prints `disparity 0.000` · `sleepSession()`
has no callers so `resumeJumpM`/`sleepSec` can never be populated.

**From the running list:** `item.scope` has no consumer · door identity across zones (blocked on
design) · property/session-plan import (desk side unbuilt).

---

## Next

**The mechanical room walk, and it is the export that unblocks Builder.** Everything above serves it.

⚑ *Before asking the field for a number, check whether a gate already bought it.* Gate 0 (4.5 cm),
Gate 1 (6.0 cm bounded, thermal nominal, 9%/46 min) and the plate A/B are **results, not history**.
