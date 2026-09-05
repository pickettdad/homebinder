# Consolidated design — per-photograph position over a 2–3 hour iPad session (v2)

**Against:** RESEARCH-BRIEF-POSITIONING-2026-09-04.
**Consolidates:** response v1 (Claude, 2026-09-04) and two review passes (ChatGPT, 2026-09-04). Both
reached the same architecture independently; this document settles the implementation details they
disagreed on and re-ranks the risks in light of a finding v1 missed.
**Numbers:** **measured** = yours. **est.** = reasoning, not measurement; §8 names the gate that
replaces each one. Nothing here has been run on `iPad13,4` / 26.6.

---

## 0 · In five lines

Your poses are wrong because the tracker is off during every walk; nothing done at resume can recover
a displacement that was never observed. Keep ARKit running for the whole room, build the map during
the RoomPlan walk, and take the 12 MP still *through* the tracking session with
`captureHighResolutionFrame`, which is delivered out-of-band and does not interrupt tracking. Per-room
origins mean the spatial error budget resets at every door; what carries across three hours is heat,
not drift. This architecture gives ARKit the information it needs for accuracy to hold — **whether
ARKit on iPadOS 26.6 actually holds it on this LiDAR iPad is an open question, because Apple has an
unresolved world-tracking drift regression on LiDAR devices since 26.4**, and a ten-minute test
settles it before anything is built. The engineering gate is a 10 cm return-to-reference residual
after 45 minutes of continuous walking and shooting.

---

## 1 · Decisions log

Where the reviews differed, and where this document lands.

| item | v1 | review | **landing** | why |
|---|---|---|---|---|
| Official photo pose | room-close anchor transform, capture-time as diagnostic | capture-time `camera.transform` of the high-res `ARFrame`, literally as the brief demands | **capture-time pose is the record.** Anchor delta is telemetry only | Cleanest measurement contract; the brief was explicit. A large delta is a process finding (map was thin at capture) that improves the anchor walk — it never rewrites a photograph |
| Kill threshold | 15 cm | 10 cm | **10 cm** | 15 cm is the system budget; mesh, plan and ray error must fit inside it |
| Anchor-walk exit | `.mapped` seen from ≥3 points | `.mapped` describes the visible area only; don't invent a heuristic | **RoomPlan completion is the exit; mapping status is recorded and gated, not trusted.** Shutter stays blocked while mapping is `.notAvailable` or `.limited` | Gate 1 decides whether the walk was enough, not a status enum |
| Raycast source | LiDAR depth at principal point of the adjacent regular frame; mesh fallback | mesh-first from the high-res frame's own ray | **mesh-first.** On-axis ray from the high-res transform intersected with the current mesh; depth as cross-check and fallback | One frame, one instant, no sync problem; immune to the intrinsics misregistration (on-axis) |
| Per-photo anchors | one per photograph | none in production | **handful in production, one-per-photo in the test harness** | The delta distribution validates the capture-time contract; after that it needs a few reference anchors, not 400 live objects |
| Scene reconstruction during photography | off after the walk if thermal demands | keep on in v1 | **on in v1.** First lever if Gate 2 shows thermal trouble | The mesh is a deliverable and improves over 40 minutes of new viewpoints; the ray depends on it |
| Anchor-walk duration | 60–120 s to a state | 20–30 s | **the RoomPlan walk, whatever it takes (typically 60–120 s)** | A time is not an exit criterion; RoomPlan needs the walk anyway so marginal cost ≈ 0 |
| Top risk | thermal | iPadOS 26.4+ LiDAR drift regression | **regression first, thermal second** | v1 missed it; it is corroborated by two production reports |
| Test plan | one hour | two gates | **three gates** — 10-min stock circle, 45-min production-config closure, 3-hour soak | Cheapest kill first; separates the OS from the load; heat does not reset at the door |
| Battery framing | %/h range | watts against a 28.65 Wh pack | **watts**, with a battery-health caveat | More defensible; nominal capacity on a 2021 device is optimistic by 10–15 % |
| Fallback if ARKit fails | — | change OS/device, or build RGB-D SLAM | **change OS/device, file Feedback with the number, wait.** No homebuilt SLAM | RoomPlan runs on ARKit's tracker regardless; a second map would be reconciled against a biased one |

---

## 2 · The mechanism of the current failure

ARKit world tracking is visual-inertial odometry plus a map — a continuous-time estimator. The
current build runs it sampled: off for 20–116 s, on for 1.4 s. During the off interval the device
moves and no instrument records it. At resume, position can only come from relocalisation against a
map, and §8b shows there is none: `worldMappingStatus` never past `limited`, 0–9 points,
`trackingState` `normal` throughout. `normal` reports the filter's internal consistency, not its
correspondence with the world.

| your measurement | reading |
|---|---|
| Standing still: 10 poses within 5 mm | the previous pose *is* the answer; a resume that keeps it is correct |
| Walking: error tracks travel, in 17 discrete steps | one unobserved displacement per resume |
| Early excursions recover, late ones don't | early, the few points near the origin still overlap the view; later nothing does |
| Origin moves 0.00003 m across pause/resume | the resume mechanism is flawless; it preserves a pose that is now wrong |
| Two RoomPlan runs, standing still: floor −16 cm, ceiling −31 cm | with no map each run re-estimates floor and ceiling from an unconstrained pose |

This is not drift. It is dead reckoning with the reckoning instrument switched off. The variable your
telemetry cannot see is device displacement during sleep. **All six §5 hypotheses probe the resume;
none examines the gap. This design deletes the gap.**

One caution the reviews surfaced: the 26.4+ regression (§7, item 1) has the *same signature* — good
standing still, directional error with travel. Your 2 % duty cycle explains your data on its own, so
your data cannot distinguish the two causes. Continuous tracking removes the first and exposes the
second. Gate 0 exists for that.

---

## 3 · The design

**Named mechanism: continuous mapped tracking with in-session stills — one tracker, one camera, one
room.**

Enabling facts, all verified against Apple's documentation or engineers:

- `ARSession.captureHighResolutionFrame` (iOS 16+) returns an `ARFrame` whose `capturedImage` is the
  wide camera's native full-resolution still, with EXIF and ARKit-populated pose, delivered out-of-band
  so the tracking stream is not interrupted. An Apple engineer confirmed on the M1 iPad Pro that the
  stream stays at 1920×1440@60 while the captured frame is 12 MP.
- iOS 17: `captureHighResolutionFrame(using: AVCapturePhotoSettings)` and
  `videoFormat.defaultPhotoSettings` — the capture goes through the photo-output path and accepts
  photo settings. Only one request may be in flight (`highResolutionFrameCaptureInProgress`).
- iOS 17: `RoomCaptureSession(arSession:)` honours a supplied `ARWorldTrackingConfiguration`;
  `stop(pauseARSession: false)` hands the live session back. Apple's own session describes this as the
  way to combine RoomPlan, scene geometry and high-quality image capture.
- Your §6: `configurableCaptureDeviceForPrimaryCamera` holds near-focus, focus point, spot metering,
  continuous AE and torch under ARKit; format changes on a running session cost ~2.2 s and 0.02–0.21
  mm.

### Per room

**A · Room start and anchor walk.**
Fresh `ARSession` per room (or `run` with `.resetTracking`, `.removeExistingAnchors`,
`.resetSceneReconstruction`) — the room-local frame is the design. `ARWorldTrackingConfiguration`
with `sceneReconstruction = .mesh`, the lowest-fps format among the 13 that carries
`isRecommendedForHighResolutionFrameCapture` (do not choose 4K streaming because it exists),
`frameSemantics` limited to `.sceneDepth`. One `RoomCaptureSession(arSession:)` per room, created
before the session runs; `RoomCaptureSession.run` replaces the configuration, so re-run your own after
its `didStart`. The concierge does the normal RoomPlan walk — walls, floor, ceiling, equipment — until
RoomPlan reports complete. Record mapping status throughout; do not trust it. Place one reference
anchor at the origin. Fire and discard two high-res captures as warm-up (a first-frame
orientation/projection inconsistency has been reported; the mitigation is free).

**B · Photography.**
`roomCaptureSession.stop(pauseARSession: false)`; re-run your configuration with **no reset
options**. Tracking never pauses again in this room. No `ARView`; drive `ARSession` with a delegate;
draw a viewfinder only while composing, dark otherwise (your §6 lever). At shutter:

1. Apply plate settings through the configurable device (measured to hold).
2. `captureHighResolutionFrame(using:)`. If a request is in flight, queue and show busy — bursts
   serialise.
3. From the **returned** `ARFrame`, record immediately: 12 MP image, timestamp, `camera.transform`,
   that frame's own `camera.intrinsics` and image dimensions, `trackingState`, `worldMappingStatus`,
   EXIF. **This transform is the photograph's pose. It is never rewritten.**
4. Ray: origin = transform translation; direction = optical axis (−Z). Intersect with the current
   `ARMeshAnchor` geometry; nearest valid hit within a plausibility bound (e.g. 8 m). Record hit,
   mesh anchor ID, and provenance. Cross-check against LiDAR depth at the principal point of the
   nearest regular frame; if the mesh has a hole on-axis, fall back to depth and mark the provenance.
   Store the ray as well as the point.
5. Shutter is **blocked** unless `trackingState == .normal` and mapping is `.mapped` or
   `.extending`. Under this design that gate means something; under the current one it restated the
   filter.
6. Encode the buffer off the tracking thread.

**C · Room close.**
Export `CapturedRoom`, all mesh anchors, the capture records, and the reference anchors' final
transforms with their correction history. Optionally `getCurrentWorldMap` for re-entry. Reset for the
next room.

---

## 4 · Why it holds — and what does not reset at the door

Three reasons for the room:

1. The tracker is never off while the device moves; your error source does not exist.
2. In a mapped room the person continually re-sees mapped surfaces and every re-observation corrects
   accumulated error. Under normal conditions ARKit with LiDAR kept running in one room is
   centimetre-scale — Apple's ARKitScenes ships per-frame ARKit poses as the reference for iPad Pro
   RGB-D captures. **September 2026 is not normal conditions — see §7 item 1.**
3. Per-room origins make the spatial horizon 45 minutes, not 180. Minute 150 is minute 5 of room
   seven.

Two things do not reset at the door: **heat** from rooms one through six, and **any OS-level tracking
bias**. That is why Gate 2 is a three-hour test and Gate 0 is a stock-ARKit test.

---

## 5 · Why this is not one of the six — nor "wait longer"

- It changes nothing about pause/resume (§5 rows 1, 2, 6); it removes pause/resume from photography.
- It does not blame the room or the subject (rows 3, 4): 0–9 points was a 1.4-second-old session.
- It agrees `trackingState` alone is worthless (row 5) and reads it with mapping status and delivered
  frame rate.
- §8's "wait longer" waits on a resumed session that still knows nothing about the walk. Your §9's
  "waking it more costs 5 seconds a shot" is the cost of *resuming*, which vanishes when you never
  pause; what remains is battery and heat.
- §2's "hard part" does not hold: the two can share the camera when the still is taken by the
  tracking session. Your §6 listed this as an untested gap; it is the answer.

---

## 6 · Cost

| item | today (measured) | design | basis |
|---|---|---|---|
| tracking interruption per photograph | 4.9 s | **0 s** | Apple's stated design |
| shutter-to-frame latency | 6.3 s cycle | **0.3–0.6 s est.**; p95 and max are the numbers, not the mean | unmeasured; Gate 1 |
| per room, added | — | RoomPlan walk you already do; +2.2 s handback; +5 s close | your §6 |
| per room, removed | 400 × 6.3 s ≈ **42 min** | — | your §4 |
| power today | 17 % / 45 min ≈ **6.5 W** average on a 28.65 Wh nominal pack | | arithmetic on your number |
| power ceiling for 3 h on internal battery | — | **9.55 W nominal; ~8.3 W at 85–90 % battery health** | |
| headroom for continuous ARKit | — | **~2–3 W over today's workload** | camera and ISP already run today; LiDAR, VIO and reconstruction are the additions; the dark screen is the subtraction |
| battery, 3 h | — | plausible on internal battery; **the pack answers battery outright** and adds heat — charge between rooms if thermal is marginal | Gate 2 |
| thermal, 45 min | unmeasured | `.fair` likely by 10–20 min; `.serious` plausible at 30–60 min with reconstruction and preview both on (**est.**); mechanical rooms are warm | Gate 2; Yembo's published experience |
| thermal, 3 h | **unknown** | unknown | Gate 2 |
| memory | — | one room's map, mesh, records: tens of MB (**est.**) | Gate 2 |
| photograph quality | full photo pipeline | **untested**; native 12 MP through the photo-output path with photo settings. If plates are less legible in bad light, this design has cost photograph quality and you judge it | Gate 1, last 15 min |

Thermal levers, in order, to be pulled only when Gate 2 says so: no preview rendering (already in);
lowest-fps high-res-capable format; `frameSemantics` minimal; scene reconstruction on during the walk
only, mesh exported first — a deliberate last resort because the mesh is a deliverable.

---

## 7 · Failure modes, ranked

1. **iPadOS 26.4+ world-tracking drift on LiDAR devices.** Reported in May 2026: a node anchored at
   the origin drifts directionally as the user walks a static scene on LiDAR devices, stable on
   non-LiDAR devices on the same OS, stable when stationary; no configuration option resolves it and no
   API disables LiDAR's contribution to VIO. Corroborated by a second production app (DeepWalk) that
   measures the drift directly in per-frame `ARCamera.transform` on a bare session with a minimal
   configuration, across iPhone Pro models and iPad Pros on all 26.4+ builds. Reported still present on
   26.6; no fix note seen. Whether a small room's constant re-observation masks a front-end bias, or
   the bias corrupts the map too, cannot be predicted — DeepWalk's routes are outdoor with no loop
   closure. **Gate 0 exists for this.**
2. **Silent thermal throttling.** iOS cuts the camera's effective frame rate; ARKit tracks against
   fewer frames; poses degrade with no error raised. The failure mode of every continuous-scanning app,
   and the one most likely to be *ours*. Detect by delivered fps and `thermalState`; at `.serious`
   reduce load; at `.critical` the room stops — there is no recovery, only a cooler device.
3. **Tracking loss mid-room** — camera covered, whip-pans, a dark closet, the lens 10 cm from a plate
   for a long time. Relocalisation normally succeeds when mapped surfaces re-enter view; every pose
   while `.limited` is bad, hence the shutter gate. Cost: "look around" for 2–5 s, a few times a room.
   If relocalisation never returns, the honest product decision is a re-anchor: new origin, new
   sub-zone, 30–60 s walk.
4. **False relocalisation** in visually identical bays: a step of decimetres in one frame while
   `.normal`. Seen as a step in a reference anchor's transform.
5. **The still is not photo-grade.** Photo-output path with photo settings, but the same
   computational pipeline as your current session is not promised. Torch, focus restriction and spot
   metering are measured to work. Gate 1 finds this in fifteen minutes.
6. **RoomPlan-on-custom-session edges.** `run` replaces the configuration (re-run yours after
   `didStart`); a second `RoomCaptureSession` on a live session has been reported to lose tracking (one
   per room); verify pose continuity across `stop(pauseARSession: false)` with your existing
   instrumentation.
7. **Burst serialisation.** One high-res request at a time; six rapid shots of a plate queue. p95
   latency must sit under the operator's fastest realistic interval.
8. **Mesh holes on the optical axis** send the ray to a far surface; hence the plausibility bound and
   depth fallback with provenance recorded.
9. **Intrinsics differ between stream and high-res frame** on at least one iPad Pro generation. The
   on-axis ray is immune; any future off-axis pixel-to-mesh mapping must use the high-res frame's own
   intrinsics.

---

## 8 · Validation gates

Cheapest kill first. Nothing in the production codebase changes before Gate 1 passes.

**Gate 0 — is ARKit on this OS usable at all? (10 minutes)**
Bare `ARWorldTrackingConfiguration`, nothing else: no RoomPlan, no reconstruction, no high-res
format. Place a node at the origin; walk in circles around a fixed point in a real room for ten
minutes; return to a rigid jig at 0, 5 and 10 minutes.
**Kill if:** origin displacement exceeds 10 cm. If it does, the decision is OS/device, not
architecture — file Feedback with the number and stop here.

**Gate 1 — does the production configuration hold for a room? (about 1 hour)**
Minutes 0–5: does any of the 13 wide formats carry `isRecommendedForHighResolutionFrameCapture`, and
does a returned frame measure 4032×3024? Time the call. *Kill if nil or not 12 MP.*
Minutes 5–10: RoomPlan on your session → `stop(pauseARSession: false)` → your config. Pose jump across
the transition. *Kill if > 5 cm.*
Minutes 10–55: one room, production configuration (reconstruction on, high-res format, dark screen).
RoomPlan walk. Then **45 minutes** of a real inspection pattern — approach plates, crouch, turn, torch
on and off, ~150 high-res captures — returning the iPad to a rigid jig every five minutes. Anchor every
photograph in this harness. Record thermal, battery, delivered fps, mapping status, latency.
**The number: maximum 3D closure error at any return, through minute 45.**
≤ 5 cm: proceed. 5–10 cm: viable. 10–15 cm: investigate before committing — the fps/thermal traces say
whether it was load. > 15 cm: dead. **Engineering go/no-go is 10 cm.**
Minutes 55–60: the same data plate in the worst light in the building, torch on, one frame via the
API and one via the current session; the desk judges legibility.

**Gate 2 — does the session hold for three hours? (one visit)**
A 2–3 hour simulated inspection across several room sessions on the production build. Per-room
closure residual; latency p50/p95/max; battery; `thermalState` timeline; delivered fps; photograph
quality across rooms; mesh completeness; ray-hit reliability and provenance mix; memory; capture
failures; time shutter-blocked and why; anchor-correction distributions. Heat from rooms one through
six did not reset with the coordinate frame; this is the real three-hour test.

---

## 9 · Telemetry

1. **Continuous trajectory at 10 Hz:** timestamp, transform, `trackingState` with reason,
   `worldMappingStatus`, feature count. Shutter moments stop being the primary record of ARKit health.
2. **Delivered frame rate** per minute from `ARFrame.timestamp` deltas — throttling shows here first.
3. **`thermalState` and battery** every 30 s as a timeline; ambient temperature noted by hand.
4. **Mapping and tracking transitions:** time-to-`.extending`, time-to-`.mapped`, every dip and its
   duration, and the pose discontinuity between the last `.normal` frame before a dip and the first
   after.
5. **Reference-anchor corrections:** every `didUpdate` delta on the origin anchor and the handful of
   reference anchors (all photo anchors in the test harness). The only visible measure of loop
   closure, and the distribution that validates the capture-time pose contract.
6. **Per photograph:** capture-time transform; high-res intrinsics and dimensions; `trackingState` and
   `worldMappingStatus` at the frame; capture latency; delta to the nearest regular frame's transform;
   exposure and ISO; ray, hit, distance, provenance (mesh / depth), mesh anchor ID; camera control
   state; thermal and battery at the moment.
7. **Mesh updates:** anchor ID, transform, vertex/face counts, version — enough to know whether
   previously observed geometry moved.
8. **Shutter-blocked time** per room, by reason.
9. **Closure residual as a first-class statistic** in test builds: whenever the device returns to a
   known rigid reference, the software reports whether the world moved.

Displacement during sleep — the quantity the current build cannot see — is moot; there is no sleep.

---

## 10 · The concierge budget

- **Per room, once:** the RoomPlan walk, to completion — typically 60–120 s, already spent today.
- **Per event, rarely:** when the app says tracking is lost, look around for 2–5 s. A few times a
  room; zero in a good room.
- **Per room, at close:** press done; ~5 s.
- **A discipline:** do not leave the iPad face-down for long stretches mid-room.
- **Per photograph:** nothing — and roughly six seconds faster than today.

---

## 11 · What the desk receives per photograph

Capture-time pose (4×4, room frame) · high-res intrinsics · ray origin and direction · hit point,
provenance and distance · `trackingState` / `worldMappingStatus` at capture · EXIF. Same frame as the
floorplan and mesh, which closes the second gate in the desk specification and makes the sentence about
late-zone poses unnecessary. No number in this record is ever revised.

---

## 12 · If a gate fails

If Gate 0 or Gate 1 fails on tracking rather than load: **do not** add periodic resets, re-anchors,
more `.normal` checks or longer waits — that is the workaround family the brief exists to escape. Do
not build a second SLAM system; RoomPlan still runs on ARKit's tracker and you would be reconciling a
homebuilt map against a biased one. The defensible moves are: hold or move the fleet to an OS build
without the regression if any exists, change device generation if it does not reproduce there, file
Feedback with the Gate 0 number attached, and report to the brief's authors that the platform — not the
architecture — currently cannot meet the requirement. The brief said that would be a useful answer.

---

## References

- Apple, *Bring your world into augmented reality*, WWDC22 — out-of-band high-resolution capture;
  native 12 MP; EXIF. https://developer.apple.com/videos/play/wwdc2022/10128/
- Apple Developer Forums 709811 — engineer confirms 12 MP capture on the M1 iPad Pro with a
  1920×1440@60 stream. https://developer.apple.com/forums/thread/709811
- `captureHighResolutionFrame(using:completion:)`, `defaultPhotoSettings`,
  `ARError.Code.highResolutionFrameCaptureInProgress` — Apple documentation.
- Apple, *Explore enhancements to RoomPlan*, WWDC23 — custom `ARSession`; `stop(pauseARSession:)`.
  https://developer.apple.com/videos/play/wwdc2023/10192/
- Apple Developer Forums 763400 — `RoomCaptureSession.run` replaces the configuration.
  https://developer.apple.com/forums/thread/763400
- Apple Developer Forums 808028 — high-res/depth intrinsics misregistration on iPad Pro (6th gen).
  https://developer.apple.com/forums/thread/808028
- Apple Developer Forums 827240 — world-tracking drift regression on LiDAR devices, iOS 26.4+.
  https://developer.apple.com/forums/thread/827240
- Apple Developer Forums 833040 — DeepWalk production report corroborating 827240 on iPhone Pro and
  iPad Pro. https://developer.apple.com/forums/thread/833040
- Yembo (HackerNoon, June 2026) — thermal throttling → dropped frames → silent tracking degradation.
  https://hackernoon.com/what-happens-when-you-max-out-an-iphone-thermal-throttling-in-real-time-ar
- Apple, ARKitScenes — per-frame ARKit poses as the reference for iPad Pro RGB-D captures.
  https://github.com/apple/ARKitScenes
- Apple Support 111897 — iPad Pro 11-inch (3rd generation) specifications, 28.65 Wh.
