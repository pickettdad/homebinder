# Field App — Capture Mode Build Spec

**Date:** 2026-08-03
**For:** Field Code
**Scope:** the Discovery Visit's field behaviour — **capture mode**, plus four defects the walk screenshots surfaced that are wrong today regardless of the redesign.
**Governed by:** `HouseSteady_Baseline-Service-Design_v1-1_2026-07-31.md` §4 · `HouseSteady_Baseline-Process_v2-1_2026-08-02.md` Stage 1 · `HouseSteady_Field-Change-Request-Register_2026-08-03.md` F-1 to F-3, F-6, F-20 to F-24.
**Cause:** the first five-zone walk on a real house, 2026-07-31. Capture and inspection do not fit in one visit, and the app as built pushes a concierge toward inspection.

**What this is not.** Inspection mode is **recorded, not specced** — it depends on the session plan, which depends on the binder's desk pass, which is mid-build. §11 records what is known about it so nothing is designed into a corner.

---

## 0. Non-negotiables

1. **Identification, never assessment.** The concierge records what is there. They do not judge whether it is acceptable.
2. **Nothing the concierge sees is a config id.** §8.
3. **Fail open on vocabulary.** An unknown type, list or reason is preserved, displayed, counted and marked — never dropped, never guessed.
4. **The export is the completion gate.** A visit is not done until it is out of the app.
5. **Do not break inspection.** Everything that works today keeps working; it becomes the other mode.

---

## 1. Two modes, one app — and mode is not a toggle

**Same data model, same zones, same pins, same manifest.** What changes is what is on screen and what is primary.

**The named failure:** *mode is a switch the concierge sets, and on a busy morning they are in the wrong one — capturing against an inspection screen, or worse, running a checklist on a discovery walk.*

**So mode follows the visit kind and is never independently settable.** `scope[]` already carries `baseline`, `monthly`, `seasonal:spring`; F-4 adds a capture kind and the content pass decides which items sit where. **Until F-4 lands, mode follows the visit kind the operator picks at session start** — one decision, at the one moment it is unambiguous.

*Recorded, not specced:* whether a single visit can ever run both. My reading is no — the process separates them deliberately, and an app that allows it invites the walk that produced this document. But a concierge who finishes capture early and starts inspecting is a real scenario and it wants a real answer before it happens.

---

## 2. What capture mode's main screen is

**The Captures screen that already exists is nearly right and is currently a side view.** *(IMG_0050 — zone chips across the top, photo grid, "0 unfiled · 113 total this visit.")* **Promote it.**

Capture mode's home is:

- **The current zone, named and large** — with a fast switcher to any other, and a fast way to add one
- **The photographs taken in it**, most recent first
- **The camera, as the dominant and obvious action**
- **A count that means something on this visit** — photographs taken, zones walked. **Not open items.**

### 2.1 · What capture mode does not show at all

**Checklist · Tests · open counts · pins · the canvas concept.**

**The named failure:** *the concierge walks into a room to photograph it and the screen says "35 core open."* On a Discovery Visit that number is meaningless — nothing was supposed to be resolved — and it is the single most discouraging thing on the screen. Every zone header currently leads with it.

**Not hidden behind a tab. Not collapsed. Absent.**

---

## 3. The capture loop

**The named failure, and it is what actually broke the walk:** *there are four places to put a photograph — zone captures, pin evidence, canvas, inbox — and the concierge stops to decide which. The deciding is the cost, not the tapping.*

**In capture mode there is one destination: the current zone.** No pin evidence, no canvas, no inbox. A photograph taken in the kitchen belongs to the kitchen, and the desk works out what is in it.

**The loop, and nothing is added to it:**

1. **Shutter.**
2. **Use Photo · Retake · Use Photo and add Note.**
3. Camera reopens, or one tap on the camera to reopen.

**The third button is the only addition (F-1).** Voice or text. **It fires on roughly one capture in ten**, so it is present and unobtrusive rather than prominent.

**Single-shot, not sweep.** The walk found single capture materially better and sweep is not wanted here.

**Standalone voice notes**, with no photograph attached, from anywhere in capture mode. *"Basement, going clockwise, this wall is the mechanical side."* The concierge is already talking; the transcript is orientation the desk cannot otherwise get.

### 3.1 · Access is its own thing to capture (F-3)

Attic hatches, crawlspace entrances, panels behind stored boxes, shutoffs behind appliances. **Photograph the access, not only the thing.**

*Recorded, not specced:* whether this needs a marker at capture time or is purely a habit the checklist reinforces. **My reading is habit** — one more decision in the room is what this whole document is trying to remove — but if the desk turns out to need access photographs findable, that is a real argument the other way.

---

## 4. Position (F-2)

**RoomPlan runs on ARKit, which tracks the iPad in space. The tracking does not stop when a photograph is taken.**

**So every capture records where the concierge stood and which way they pointed, in the floorplan's coordinate space. Zero taps.**

**This is the highest-value item in this document.** With it, the desk pass is *confirmation* — the photographs are already on the plan and someone fixes the ones that drifted. Without it, the desk places several hundred photographs by hand, and the entire redesign's economics change.

**Drift is real** — ARKit is usually good to about a metre indoors, occasionally worse — **so position is a proposal, never a fact.** Record it with whatever confidence the framework reports; the desk confirms.

**Where RoomPlan cannot run, capture proceeds normally with no position.** Absent position is a declared state, not an error.

### 4.1 · The floorplan is the priority capture

Every home needs one and most do not have one. It produces the deliverable, the room dimensions, and window and door measurements in one pass. **A wide canvas photograph is the fallback, not the alternative** — and it keeps its own separate job: an orienting shot of a utility room, kitchen or laundry **sent with a trades request**, so a contractor arrives familiar with the workspace.

---

## 5. Notes are internal by default (F-6)

**Every note the concierge takes in capture mode is internal.** The desk decides what surfaces.

**The named failure:** *a concierge observing significant mould, or that a space is filthy, hesitates because they are not sure who will read it — and either softens it or does not write it.* **A softened field note is a lost observation**, and the judgement in it has to be adjudicated at the desk regardless.

**No visibility toggle. No second button.** One less decision in the room, and it is what keeps the notes honest.

---

## 6. Zone creation

**Fast, and it stays fast.** *"Start where you're standing"* is the right instinct and the screen already says it.

**One correction (F-20).** Zone attributes are four toggles — finished, sleeping, stairs, mechanical — and **an untouched toggle records exactly the same `false` as a considered "no."** There is no skip path.

**That is not a capture-mode problem to solve here**, and the binder already handles it correctly by carrying the map verbatim. But **it is the reason the binder can never render `false` as *"we established there is none"***, and it wants a real answer eventually — a tri-state, or a confirm at zone close.

**What does belong here: when a zone closes with no media, ask why, then and there.** A concierge at a sealed attic hatch knows; the same person at a desk three weeks later may not. **And where a resolution already explains it** — this walk's attic resolved `att.access-honesty = no access` — **offer that as a candidate, shown and never pre-filled.**

---

## 7. Four defects, wrong today

**These are not redesign requests. Fix them regardless of what happens to capture mode.**

### 7.1 · A measure input shows no unit (F-21)

*"Sill height above finished floor"* accepts `26` with **nothing on screen saying inches.** Table H declares `in` for that item and the concierge never sees it.

**Two failures at once.** Somebody could type millimetres. And the meaning of the stored number depends on a declaration nobody was shown.

**Show the declared unit beside the field, from the config, never a literal.** The binder deliberately refused to guess this value's wire shape for exactly this class of reason; the app is currently asking a human to guess instead.

### 7.2 · Pass / Fail is offered on a measured value (F-22)

**Recording `26` and tapping a large green Pass is the concierge asserting that sill height is acceptable** — an egress code judgement, and not theirs to make.

**A door that will not latch is a fact and Pass/Fail fits it. A number is just a number**, and whether it satisfies anything is a specialist's call.

**So a measure item records its value and nothing else.** No verdict, no green, no red. If a value being out of range matters, that is a downstream flag against a declared threshold — not a button in a room.

*This is the third instance of doctrine arriving through a button label rather than a data path, after `confirmed` covering a research interval and `capture-complete` claiming a completeness nobody could assess. **No scan catches these** — the flaw is in the word.*

### 7.3 · Internal vocabulary is on screen (F-23)

Component type ids — `appliance-range-hood`, `receptacle-gfci`, `untyped`. List ids — `INTERIOR-BASE`, `WET-BASE`. Internal counts — `core open`. Truncated affordances — `N/A...`.

**And one that should be fixed today whatever else happens:** the property-flags screen renders

> ⚠ `**not yet asked at intake**` — see §9

**A specification cross-reference, with its literal markdown asterisks, in the user interface.** §8 is the durable fix; this line is a one-character deletion.

### 7.4 · The palette is not HouseSteady's (F-24)

Near-black navy, a bright teal accent, crimson for Fail. **The Brand Guide declares navy #15223B, brass #BE8A3D, ivory #FBF8F2** — teal and crimson appear nowhere in it.

**This is not the dark-versus-light question.** Navy is already dark; a navy-and-brass interface would be entirely on-brand. **The defect is that the app does not look like the company, on a screen a homeowner can see.**

**Recommendation, and it is a design call worth stating rather than assuming:** **ivory-based for capture mode** — used in daylight, in front of clients, and a screen can push brightness in a dark basement but cannot fight reflection on a dark field in a bright kitchen. Navy structural, brass for accent. **Inspection mode can stay dark if that proves better in a crawlspace**, and that is a legitimate reason for the two modes to look different.

---

## 8. The vocabulary layer

**`appliance-range-hood` is not a thing anyone says.** The concierge needs wording that is casual and specific at once — *"Range hood"*, *"GFCI outlet"*, *"Every room"*, *"Wet areas"*, *"Not yet identified"*.

**Where it lives: the Checklist Master declares it.** Not the app, and not derived from the id — `receptacle-gfci` mechanically becomes *"Receptacle gfci"*, which is worse than the id.

**And the master is already half of the way there.** It declares `componentAliases` — 56 phrases across 29 types — **which point inward**, mapping what a concierge might say to a type. **A label points outward.** Same table, opposite direction, and the second is missing.

**Three registers, and they are genuinely different:**

| | Example |
|---|---|
| **Config id** — machine, never seen | `appliance-range-hood` |
| **Concierge-facing** — working language, on the field screen | *Range hood* |
| **Client-facing** — the binder's own vocabulary | *Ducted range hood* |

**The third already exists** in the binder's `client-names-v1.json` and is not this. **Do not conflate them and do not derive one from another** — the concierge and the homeowner are different readers and the words diverge on purpose.

**Where nothing is declared, fall back to the id and say so** — a visible gap that names itself, not a silent one. Same discipline as everywhere else.

---

## 9. Export, recorded not specced

**It works and it is not this increment's problem.** But the walk produced 8 files needing 8 individual saves, and **capture-first means more media, not less** — a nine-zone walk plausibly runs to fifteen files and 2 GB.

**The export is the completion gate**, so friction here is friction on the one step that must not be skipped. Worth watching on the next walk rather than solving now.

**And the open question underneath it is already registered:** how a client's 2 GB baseline reaches a hosted builder is Open-Items O6, and it is a contract question rather than an ops detail.

---

## 10. Tests and scans

- **A capture in capture mode has exactly one possible destination** — the current zone. No path writes to pin evidence, canvas or inbox.
- **No checklist, test or open-count value is reachable from any capture-mode screen.**
- **No concierge-facing string is a config id**, and where a label is missing the fallback is visibly marked rather than silently substituted.
- **A measure item records a value with no verdict** — no code path attaches pass or fail to one.
- **A measure input renders the unit declared for that item by the config**, never a literal.
- **Position is recorded where available and absent-with-a-reason where not** — never defaulted, never inferred.
- **Every note is internal**; no path sets a note visible to a client.

---

## 11. Inspection mode — recorded, not specced

**Not buildable yet.** It consumes the session plan, which the binder emits and which has no receiver. Recorded so nothing is designed into a corner:

**The concierge is walked through it, and that is right for inspection and wrong for capture.** Capture is open-ended and the app must get out of the way. **Inspection is a known list of specific things at specific places** — the plan is the point, and holding it in your head is the failure mode. Entry 15 made literal: the software carries the expertise.

**But it is a route, not a rail.** Some ordering is causal — the water run upstairs before ceilings are checked below, the furnace tested once with registers verified as rooms are passed, exterior while light holds. The rest is an efficient path, and a locked door breaks it instantly. **The session plan carries constraints separately from preferences. The app follows the preference, enforces nothing, and warns only when a real dependency is about to be violated. A satnav reroutes; it does not refuse.**

---

## 12. Out of scope

Inspection mode · the `scope[]` capture/inspection split, which is F-4 and an owner-authored content pass · the session plan import · manifest v4 · exterior and aerial vocabulary · the zone-attribute tri-state.

---

**Status:** ready for Field Code on owner ratification. **§7 is independent of everything else and can ship first.**
