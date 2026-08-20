# The three modes, the thermal test, and what the device already settles
2026-08-20. Answers the owner's mode question and scores the Google research against measurements
taken on `iPad13,4`, iPadOS 26.5. **Nothing here changes capture behaviour.**

## 1 · The owner's architecture, restated to check I have it

Enter a zone → **floorplan** → **room shot** (desk-AI context, placement, and a second pair of eyes
on what the concierge missed) → **object containers**, each with at least one positioned frame →
**zone concerns** outside any container. **Mesh only where the room earns it** — a mechanical or
laundry room, where tracing runs and knowing distances is the point.

That is right, and one line of it is the load-bearing one: ⚑ ***at least one*** **frame per
container carries a position.** Everything else in the container inherits it. That is what makes the
expensive mode optional rather than continuous, and it is measured below.

## 2 · What the device settles, so it need not be argued

| claim | measured |
|---|---|
| "restrict the AR configuration to 30 fps" | ⚑ **available** — world tracking offers **24, 25, 30 and 60 fps** on this iPad |
| "turn off `sceneReconstruction` and plane detection" | valid — and re-running with a lighter config **without `.resetTracking` keeps the session** |
| "stopping the session loses the coordinate map" | ⚑ **not for a pause.** `pause()` → ultra-wide shot → `run(config)` recovered with **mesh byte-identical** (11 anchors / 38,393 faces both sides) and **no relocalisation** |
| "warm-up 1–3 s on resume" | **0 ms** measured on resume-after-pause; the 1–3 s applies to a *fresh* session, not a resumed one |
| step-out overhead | **86–607 ms** across runs, with the ultra-wide input **pre-built at launch** |
| the same, input built while ARKit holds the camera | **9,008 ms** — the number a design would wrongly be built around |

⚑ **A cost nobody costed, found by accident.** The still resolution follows the **video format**. With
`recommendedVideoFormatForHighResolutionFrameCapturing` a full-resolution frame is **4032×3024**;
with a low-power format selected the same call returned **2016×1512**. So "drop to 30 fps to halve
the load" is not only a frame-rate decision — **it can quarter the photographs.** If the low-power
mode is the one that runs for hours and is also the one taking most of the pictures, that trade is
the wrong way round and the format must be chosen for the still, not the tracking.

## 3 · ⚑ The owner is right that location-only can be paused, and it is measured

*"The location only being on all the time is the one system we could pause if we had to, and only
rely on it for one capture per object container."*

**Yes.** A pause holds the world: mesh identical, origin unmoved (`poseJumpMetres` 0.00003), no
relocalisation, and resume-to-normal at 0 ms. So the session does not have to run between containers
at all — it has to be **alive at the instant the one positioned frame is taken**.

That turns the heaviest continuous cost into a duty cycle. It also makes the failure mode explicit
and worth designing for: **a container whose positioned frame was taken while the session was
paused is unpositioned forever**, and nothing downstream can tell. That is an ordering rule, and
ordering rules need enforcing rather than documenting.

## 4 · The thermal test — the owner's shape, and why the order breaks it

The proposal: 5 minutes RoomPlan → 10 minutes mesh → 20 minutes location-only.

⚑ **Run back to back, that cannot attribute heat to modes.** Thermal state lags load by minutes and
accumulates: the location-only phase would inherit everything the first two put in, so a cool
reading would mean *the device coasted* and a hot one would mean *it never recovered* — and the two
are indistinguishable from inside one run. It is the fast-versus-slow traverse confound again, where
a difference that lived entirely in one gate took rounds to unpick.

**One mode per run, from a cold start, same duration each — 20 minutes.** Then the numbers are
comparable and the question *which mode costs what* has an answer:

    Run A   20 min   RoomPlan
    Run B   20 min   world tracking + mesh
    Run C   20 min   low-power tracking only (no mesh, no planes, 30 fps)
    Run D   20 min   today's AVCapture camera — the control that makes the others readable

Cold start means the device back to `nominal` and roughly the same battery level each time. Record
battery percentage and `thermalState` every minute, and the room, because a mechanical room is the
worst case — repetitive metal, poor light, overlapping geometry.

**Against the known baseline: 98 minutes, 100% → 85%, `nominal` throughout — 9.2%/hour** with camera
and screen live. Run D should land near it; that is the check that the harness works before its
readings are believed.

⚑ **And there is no per-mode power number in this document on purpose.** A first attempt measured
in-process CPU and returned a *negative* rate for one mode, which is impossible; even corrected it
would have been a floor rather than a cost, since ARKit works largely outside the process. **A
number that cannot be trusted is worse than none, because it gets quoted.** This one needs the owner
walking.

## 5 · Where the research is right, and the one place to be careful

Right, and now confirmed: separate the modes; never leave RoomPlan running; freeze mesh updates once
the geometry is good; drop the frame rate; disable what a mode does not need; save world maps
periodically because an app that dies from heat should not take the zone's coordinate space with it.

⚑ **The one to be careful with:** *"For subsequent photos, do not request new ARKit frame data — use
standard AVFoundation captures."* That reads as a saving and it is a **teardown**. Handing the camera
between ARKit and AVFoundation is what cost 9,008 ms cold, and it puts every subsequent frame outside
the session — which is fine when the container's anchor frame is already taken, and a silent loss
when it is not. **Staying in the session and taking the extra frames through it is cheaper than
leaving**, because leaving is the expensive verb. Take subsequent frames from the running session;
leave only for width, and only when the concierge calls for it.

**And the binding is the desk's**, as the owner says. The device's job is to stamp each frame with a
pose and a container id and to be honest when it has neither.
