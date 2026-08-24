# Field 6 — where ARKit stands, and two decisions for the owner
**From:** Mac Field · **Date:** 2026-08-23 · **Carry this file; the design session does not read this repo.**

**Companion documents, both in `docs/`, both needed with this one:**
`MANIFEST-FIELD6-ADDITIONS.md` · `fixtures/manifest-position-example.json`

---

## 0 · State, in one line each

| | |
|---|---|
| **RoomPlan** | ⚑ **Working.** Live wall/door/window counts, a to-scale plan drawn on screen with lengths in feet and inches, geometry filed verbatim. Best run: 7 walls, delivered on time. |
| **Mesh** | ⚑ **Working.** 19–36 anchors per room, up to 178,595 faces, filed with per-piece vertex counts and transforms. |
| **Position + ray-cast** | ⚑ **Working.** Measured pose, tracking state, full 4×4, and the ray-cast surface with its distance. Refusals recorded as refusals. |
| **Capture / UI** | Floorplan and mesh are zone-screen actions; room shot moved there too; Back returns to the zone; scans hide the capture strip; auto-capture waits for a dwell. |
| **Manifest** | Additive, `manifestSchemaVersion` **stays 3**. Fixture committed. |
| **Device bench** | Built, blank-input-validated, **never run.** The thermal question below is what it is for. |

**PR to merge: `#131`.** Everything above is in it.

---

## 1 · What broke, because the pattern matters more than the list

**Seven separate faults, and four were one class:** *an operation with two ends where only one was
accounted for.*

- The bridge converter stringified nested dictionaries, so the floorplan reported **0 walls while
  holding four** and the mesh reported **nothing meshed while holding 32 pieces**. ⚑ Nothing failed —
  every `typeof x === "object"` simply went false. **A converter that cannot represent a value should
  refuse it, not describe it.**
- `yieldCamera` async → ARKit asked for a lens still held → *"Required sensor failed."*
- `reclaimCamera` async → `setMode` configured a session still restarting → frozen viewfinder.
- The failure path in `position()` never released the lens → frozen viewfinder, again.
- `openZone` refused whenever a capture session existed — a leftover guard that made it work the
  first time and never again until relaunch.
- The zone was rebuilt on every action tap, so **each zone had several coordinate spaces**.
- A stale `ARFrame` reported `normal` after a sleep, so several captures shared one pose — ⚑ **stated
  exactly as confidently as a correct one.**

⛑ **Both ends of every camera handover are now logged on every crossing**, so the next instance of
that class names itself instead of costing a walk. `HSZoneLog` — the app's own record, shareable
without a tether — is what found most of these.

---

## 2 · Decision one: does ARKit hold the camera for the whole zone?

**Today the lens changes hands per anchor.** ARKit re-establishes tracking on each wake, and that
cycle is a **2–3 second pause** the concierge feels. It is not a bug to tune; it is the price of
keeping a live AVFoundation viewfinder.

**Mitigated, not removed:** a container is anchored on its **first** capture and the rest inherit —
so four shots of one object cost one pause rather than four.

**The alternative, already measured on 2026-08-19:** take the photographs *through* ARKit while a
zone is open. **12 MP stills in 65 ms · a hand-rolled bracket works · the torch lights · the same
wide-angle glass the plate path uses today.** No handover, no pause.

⚑ **The owner's thermal instinct is right and is the reason this is answerable rather than
arguable.** RoomPlan and the mesh are bounded and finish; what would run long is the stripped
positioning config — no scene reconstruction, no environment texturing, 30 fps available on this
device. ⛑ **One caveat: plane detection had to go back ON in positioning**, because a session with
no geometry has nothing for the ray-cast to hit and every pose came back without a surface. Planes
are the cheap half; reconstruction is the expensive half and stays off.

**The bench exists to answer this and has never been run.** Three modes, cold start, time to first
thermal transition. It is an afternoon of the owner's walking, and it is the only thing standing
between this decision and evidence.

---

## 3 · Decision two: which frame should anchor a container?

⚑ **The owner's objection is correct and I had not seen it.** *The first shot of a fridge is the
whole-object shot from five or six feet back. That frame gets the position — but the fridge is six
feet from where the concierge stood.*

**Partly resolved by the ray-cast, and worth being precise about how far.**

- `position.x/y/z` is **where the concierge stood**. From six feet back, that is six feet wrong.
- `position.surface` is **the ray-cast hit in front of the lens, with its distance** — for a
  whole-fridge shot that lands on the fridge's front face. **So the object's position is recoverable
  from a distant frame**, and the desk can see the difference plainly because both travel.

**But the nameplate shot is still the better anchor, for two reasons.** It is 0.3–1 m from the
object, so drift and ray error are proportionally smaller; and its ray lands on the object rather
than near it.

⛑ **So "first capture wins" is the wrong rule, and it is a capture-practice question rather than a
manifest one — the owner's to rule.** Three candidates:

1. **Anchor every frame.** Correct, and costs the 2–3 s pause per photograph. Unacceptable today;
   **free** if decision one goes to ARKit-holds-the-camera.
2. **Anchor the first frame *and* every Text-mode frame.** Roughly two pauses per container, and the
   good anchor is always among them. Cheap to build now.
3. **Anchor the first frame only** — today's behaviour — and let the desk rank by
   `surface.distance`, which the manifest already carries.

⚑ **Note that (1) becomes the obvious answer if decision one goes the ARKit way**, which is why the
two decisions should be taken together rather than in sequence.

**And the ranking signal exists whichever is chosen:** `surface.distance` is in every positioned
frame, so *closest wins* is a rule the desk can apply without the field guessing.

---

## 4 · A limitation the desk must know about

⛑ **RoomPlan does not see a half-wall peninsula.** Observed 2026-08-23 in the owner's kitchen: the
half wall the sink is set into — **the thing that closes the room** — is absent from the plan
entirely. RoomPlan models full-height walls; a partition stopping at counter height is not a wall to
it and often not anything to it.

⚑ **So `walls` is not "every vertical surface", and a plan can look complete while missing the
feature the room is defined by.** Islands, peninsulas and counter runs are all in this class.

**The mesh sees them, because geometry needs no category** — so kitchens, baths, ensuites, powder
rooms and pantries now earn a mesh recommendation alongside the equipment rooms. That is the owner's
finding turned into a rule.

**Also not in the plan, and returned as `null` rather than omitted:** flooring type, registers,
floor area. *An absent key reads as nobody computed it; `null` reads as the plan does not carry it.*

---

## 5 · Accuracy, so nobody has to discover it

Two opposite bedroom walls differed by a few inches. **That is RoomPlan's real accuracy, and it is
deliberately not corrected.** Squaring rooms up would make the drawing look more trustworthy while
destroying the one signal that says how much to trust it.

⚑ **Marker-accurate stands: *2.3 m from the panel* is defensible, *2,438 mm* is not.** Derived
lengths round to the inch for that reason.

---

## 6 · What is asked of the design session

1. **Decision one** — ARKit holds the camera for a zone, or the handover stays. **Take it with
   decision two.**
2. **Decision two** — which frame anchors a container.
3. **Ratify or reject** the mesh recommendation now covering fitted rooms.
4. **Note the peninsula limitation** in Baseline Service Design, since it changes what a floorplan
   can be claimed to contain.
5. **Confirm** that the manifest additions need no version bump — they are additive, and under the
   ratified policy that is the field side's call. *Flagged rather than assumed.*
