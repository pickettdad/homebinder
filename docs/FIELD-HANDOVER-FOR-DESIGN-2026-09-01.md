# Field → design session: the traverse became a capture kind, and the first real export exists

**2026-09-01 · Mac Field.** ⚑ **Read §1 first — it is a design and implementation the design session
has not seen.** §2 is the export. §3 is what the walk broke.

---

## 1 · ⚑ The traverse, which changed shape between the last brief and the walk

**The design session last saw the traverse as a mechanism deliberately without a door** — no capture
kind, no concierge surface, held back while the run trace's costing was open. **That costing closed
on 2026-08-29** with the owner's ruling that the run-trace video is retired and *"if the traverse
takes over the job, that's the replacement."* Everything below followed in the two days before the
walk, and the walk ran on it.

### 1a · It carries world anchors — at leg ends, and per-frame is decision one

The design session asked whether the useful signal is camera position per frame, ray-cast surface
per frame, or both. ⛑ **The question could not be answered as posed, and the reason is structural:**
a traverse runs on the `AVCaptureSession` with exposure, focus and white balance locked, and **ARKit
cannot hold the lens at the same time.** There is no per-frame pose *and* no per-frame ray-cast to
choose between — neither exists. One position costs a full camera handover.

**Measured, 2026-08-30, on the real boundary:**

| | |
|---|---|
| Whole leg boundary | **6.29 s** |
| of which ARKit relocalising | **4.90 s** |
| the pose read itself | **0.02 s** |
| a **fresh** session reaching `normal` | **0.85 s** |
| a **resumed** one | **4.87–4.90 s** |

⚑ **So per-frame world position is decision one, not an addition to this.** What shipped instead:
**an anchor at each end of each leg**, taken where the concierge has already stopped, so no handover
ever falls inside a run.

⛑ **And the route comes from the concierge, not the sensor.** *A run that doubles back is walked as
separate legs* — `continuesFrom` already linked them — so **the leg endpoints form a polyline of the
actual route** rather than a straight line through it. For the owner's water line that crosses the
room, skips a unit and doubles back, that is three legs and six anchors, with the doubling-back
**explicit in the data rather than inferred.** *This is a better answer than per-frame position for
the stated need: frame-to-frame image registration cannot give world direction at any price.*

**On the other half of the question:** camera position *or* surface point was a false choice.
`takePosition` returns both — `x/y/z` is where the concierge stood, `surface` is what they were
aimed at when geometry existed to hit it. **91 of 109 positioned frames on the walk carried a
surface.**

### 1b · It became a control, because the reason to hide it expired

It lived inside the collapsed instruments panel, in monospace — *"nothing a concierge would ever
find"* — correctly, while the capture kind was held back. **Now a bar in the viewfinder**: start,
stop, **`next leg ↩`**, leg number, live `keeping N/M`, and a voice button.

⚑ **`next leg` is the load-bearing control, not `stop`.** Chaining behind *stop, leave the screen,
re-enter, start* would leave it unused — which is how the traverse came to be hidden in the first
place. It also **carries the boundary anchor forward**: the end of leg N and the start of leg N+1
are the same place at the same moment, and measuring it twice cost eleven seconds of black preview
before this was noticed.

### 1c · A voice note binds to its leg, and cycles at the boundary

**The owner's requirement, and his reasoning overturned ours.** We had a note spanning legs bind to
the *run*. He killed it: *"if I narrated something specific to leg 6, the desk would need to fish
through all audio through all legs."* **A mechanical room is seven or eight legs** — a run-long file
makes every question a search; a per-leg file makes it a lookup.

**So the note is cycled.** Pressing *next leg* while recording closes the note against the leg it
covered and opens one on the next, **without releasing the microphone** — `getUserMedia` was the
expensive half and no longer runs at a boundary. ⚑ **Measured gap: 7 ms**, shown on the traverse bar.

⛑ **The trigger is the live recording, never the leg change.** If the concierge stopped talking
during leg 6, leg 7 does not start recording on its own.

**Result on the walk: 12 legs, 12 notes, 12 distinct `captureId`s.** Exactly one per leg.

### 1d · Two things the traverse taught us that were nearly shipped wrong

⛑ **The traverse must NOT run on the wide lens, and the ruling that said it should was never in
force.** `lensPolicyFor` defaulted the traverse to wide from 2026-08-16; a separate bug meant it
never applied, so **every successful traverse this project ever ran was on normal.** Fixing that bug
applied the default for the first time and the traverse collapsed — texture **1.1–1.99** against a
keep threshold of 5, every frame discarded. *A 120° frame spreads the same wall over a fifth of the
pixels, and the traverse registers by detail.* **The room shot keeps wide** — one framed photograph,
no registration. **Framing wants width; registration wants detail.**

⛑ **And the exposure was being metered before the camera had converged.** `traverseExposurePlan`
reads `device.exposureDuration` and `device.iso` at the instant of the call — 300 ms after the
session restarted from the leg's position handover. It locked the fastest shutter and lowest ISO for
the whole leg. The owner named it: *"the exposure must be set on something wild because the image in
the viewfinder is SO dark it almost looks black."* Now waits on `isAdjustingExposure`; **the wait is
~200 ms and the metered ISO went from effectively nothing to ~1000.**

---

## 2 · The export exists and the contract holds

**1.4 GB · 548 media files · five zones · exported 2026-09-01T02:17:31Z.**

    zones 5 · pins 40 · photos 140 · voiceNotes 13 · geometry 6 · unknown 0
    mediaFiles 548 · mediaBytes 1,405,554,238

⚑ **Every path the fixture documents exists in the real export.** No missing field, no renamed one.

| | |
|---|---|
| **Kitchen peninsula mesh** | 25 anchors, **133,838 faces**, 6.9 × 1.6 × 6.4 m |
| **Mechanical room mesh** | 23 anchors, **262,642 faces**, 4.8 × 2.2 × 5.7 m |
| **Floorplans** | 4 delivered — 6, 5, 6 and **8 walls** |
| **Traverse** | 12 legs, **301 frames, zero discarded**, 24 anchors all positioned |
| **Mechanical room** | 426 photographs, 21 containers, 13 notes — **45 min, 17% battery** |

- **`geometry: 6`, `unknown: 0`** — the Capture-Kind Contract Note's two changes both landed.
- **`projection` on all 109 positioned entries.** Required, so answered every time.
- ⛑ **`Required sensor failed.` appears 20 times as a position *refusal*, never as an absence.**
  *The refusal doctrine earned itself on the one thing that went wrong.*

### ⚑ `projectableFrame: null` is common, and the fixture did not show it

**Of 19 room-shot entries: 9 named a 1× companion frame, 10 had none.** A receiver built only
against the pointer form meets `null` on its first real export. Both forms are now illustrated.

*The fixture also carried an explicit `intent: null`; the real export writes that key **0 times in
548 entries** and simply omits it on 222. Absent reads "no intent declared"; null reads "an intent
was declared and it was nothing".* **Third fixture error found by the tripwire, this one with the
export itself as the evidence.**

---

## 3 · What the walk broke, and what is owed

| | |
|---|---|
| ⛑ **A nameplate filed against the wrong equipment** | The container was resolved **after** the frames returned — 1–3 s on a bracket — so a container opened in that window took ownership of the previous object's plate. **A wrong answer that looks like a right one.** Fixed: the container is decided at the shutter |
| **The room shot disarmed after one frame** | Three angles were taken of the mechanical room; **one landed as an ordinary zone capture.** ⚑ *A room shot is one act per angle, and the concierge decides how many angles a room has* — the 2026-08-21 "once, at the start of a zone" ruling predates photographing a room with equipment on four walls. **Design session may want to ratify or overturn this** |
| **A new container inherited the last plate's camera mode** | The object shot of a water heater was taken in Text mode — close-focused, spot-metered, lens-locked. The `+` now returns to `object` |
| **Both meshes carried `zoneId: ""`** | Every floorplan carried it. Recoverable from `owner.zoneId`, but **two rooms were meshed and telling them apart is the entire question.** Fixed |
| ⚠️ **One floorplan lost — OPEN** | `roomPlanStopping` → 28 s → zone re-entered → capture session started → **`sensorFailed`.** The stop was still in flight when the camera was taken back. The full bath has 34 photographs and no plan. **Not yet fixed — it needs the stop to complete before the handback, and deserves its own change** |

**Also owed and unchanged:** the rule-43 pair — `meshRecommendation` and `containerAnchorState` are
computed, tested and called by no screen. Their natural home is the **mesh decision point** the
design session's own §8 item 2 describes, at the moment a floorplan finishes. Queued to be built
together.
