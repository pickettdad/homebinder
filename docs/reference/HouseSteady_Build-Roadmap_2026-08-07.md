# HouseSteady — Build Roadmap & Session Plan

**Role of this file:** the working map — where every track stands, what is waiting on whom, what is next. **Pointers and status, never content.**
**Filename rule:** dated, replaced wholesale.

**Status date:** 2026-08-07
**Why this replaces a cut from four hours ago.** The 2026-08-06 roadmap was organised around the two build tracks, so **anything living *between* them appeared in neither.** The owner asked one question — does the direction to Field reflect that visit two is a pushed checklist — and the answer was not in the file.

**The seams were not undocumented, and the first version of this header said they were.** Checked: the session plan appears in nine project documents, manifest v4 in four, position on capture in four. **Each is recorded by whichever document owns one end of it** — the Object/Concern Model, the Manifest Contract, the Field Track Orientation, the Capture Mode spec.

**What was missing was the aggregation.** Nothing gathered them as a class, so the pattern was unreadable without holding five documents together at once — and the pattern is the point: **three of five have a built producer and an unbuilt consumer.** §3 is that aggregation, and it belongs here because gathering relationships between documents is what a navigation file is for.

**Third instance of this shape in a week.** The maintenance schedule and the class engine, both documented, neither referencing the other. Two unit vocabularies, both declared, zero overlap, neither aware. Now five seams, each recorded, never gathered. **The project records facts well and records relationships between documents poorly.**

---

## 0. The one-paragraph version

**The reference work is done and the building has restarted.** The class list — the thing every other piece waited on since the pivot — is finished and reviewed. Both Code sessions are working. **Nothing is waiting on design.** The remaining risk is not in either track; it is in the seams between them, where three producers are built and their consumers are not.

---

## 1. The service this is building, because the tracks are only readable against it

| | what happens | what it needs |
|---|---|---|
| **Discovery Visit** | The conversation, then **capture only.** No checklist, no tests | Capture mode. **Visit kind on session start is the trigger** |
| **The desk pass** | The captures become a known house — assemble, place, identify, confirm | Identification and confirmation need **only photographs.** Assembly and placement need **RoomPlan** |
| **The Home Profile** | Goes to the client between the visits: inventory, calendar, what we will look at, and the questions only they can answer | Objects, and the frame's owner questions |
| **Inspection Visit** | Targeted, from a list the desk produced | **The session-plan import — see §3.1** |
| **Handover** | The Binder, and building the ongoing plan with the client | Increment 6 |
| **Monthly, thereafter** | The recurring service | The import, again, for continuity |

---

## 2. Where each track stands

### Track A — Field app

**Capture mode, building now.** All four walk defects fixed. **F-28 closed** — the durability gate cleared by the walk at 163 files, so the native shell is the shipping surface in fact and in the record. PR #74 merged; nothing stranded; 196 tests green on main.

**Build order in `PLAN-STAGE-1` §9a, none of it needing the Mac:** visit kind on session start · notes internal by default · the capture screen and its loop · the empty-zone reason at close. **Steps 1 and 2 in progress.**

**One thing needs the Mac: F-26**, the native viewfinder returning image and position together. **The Mac arrives Tuesday 2026-08-11** — a 2026 MacBook Air, 16 GB, which clears the 8 GB practical floor that ruled out the 2015 Air. **RoomPlan, the floorplan deliverable and position on capture all unblock that day.**

**Field issue #64 open.** Both halves land with the master bundle.

### Track B — Binder builder

**Increment 4 closed.** Gap report, session plan emitter, editor, branded render, signature as the render gate.

**Increment 5 — the engine.** `class-frame-v1.json` holds **176 classes**, three outside review passes triaged and merged. Built: the assist machinery, the completeness state, the class frame and its audit. **Next: §2 objects, then §3 identification.**

**Increment 6** — workbench and the first binder sections. Not started.

### Track C — Business

**The only track with nothing moving.** Economics has not run. Scope v4 is stale — Entry 23.

---

## 3. The seams — what one track owes the other

**Every one of these is invisible from inside either track. Three are half-built, and in each case the half that exists is the producer.**

| Seam | Producer | Consumer | Gates |
|---|---|---|---|
| **Session plan** | binder — **built** | field — **not built** | **§3.1** |
| **Manifest v4** | field — not built | binder | The concern register |
| **Class → pin type** | binder — frame **built** | field types the pin | The Inspection Visit's list being *this house's* list |
| **Position on capture** | field — **unblocks 2026-08-11** | binder places the captures | Whether the desk pass is confirmation or data entry |
| **Checklist Master → config** | design drafts, owner checks | field generates | All five bundle items |

### 3.1 · The session-plan import is the pivot's second half

**The pivot has two halves. Visit one is capture only — that half is being built. Visit two is a checklist pushed from the binder — and the receiving end does not exist.**

**The binder emits it; Increment 4 shipped the emitter. The field import is scoped in detail and not built**, and it is sequenced late.

**What that costs is degradation, not breakage.** A concierge can pin at any visit, so tagging component lists `monthly` genuinely works today. **What does not work is continuity — and Field Code checked the code rather than the documents, which sharpened it:** the gap is not that pin numbers restart. **`pinId` is a fresh uuid on every re-pin**, and the Object/Concern Model has the binder adopting field-minted uuids as canonical. **So the same water heater arrives at the desk as a different object every month**, not as the same object renumbered — which is worse, and is the failure the import exists to prevent.

**Stated separately because they size differently:** §9a's four steps make the monthly checklist *correct*. **They do not make it longitudinal.**

**So the import is what makes visit two *visit two* rather than visit one again.** The Object/Concern Model says exactly this, and it is why F-29 mattered. **Late is defensible — Discovery and the desk pass must work before there is anything to push — but it should be sequenced deliberately rather than by default.**

---

## 4. The shortest path to something visible

1. **Run identification against the owner's own 163 photographs.** The repo fixture is manifest-only; the real files are on his machine. **Photographs in, objects out, classes seeded, on his own house. No Mac, no client.**
2. **The confirmation surface** — where a person accepts or corrects what the engine proposed.
3. **The review queue** — what the frame got wrong, counted, from the first house.
4. **The Home Profile render** — the first client-facing deliverable of the three-visit model.
5. **The Mac lands Tuesday** → placement, the floorplan, F-26.
6. **The session-plan import** → §3.1, and the monthly service becomes recurring rather than repeated.

---

## 5. What is waiting on the owner

| | |
|---|---|
| **The Mac** | **Arrives Tuesday 2026-08-11.** Position on capture, the floorplan, F-26 — and with it desk-pass placement, which decides whether stage two is confirmation or data entry |
| **Photographs from the walk** | **The cheapest unblock on this list** — it is what turns the engine from specified into visible |
| **Building fabric** | **Ratified.** ~30 classes — roof, cladding, foundation, ductwork, interior distribution. The largest remaining gap in the frame |
| **Checklist Master bundle — five items, one version** | F-4's split · exterior and access measurements · **the monthly list, which is genuinely unwritten** · two unit rows · `flat_roof`'s Table A cell. **Design drafts; the owner checks the judgement calls** |
| **Two honesty-label answers** | `s19.reserve-figure` and `property.triggers`. These block five further steps |
| Scope 13–23 · golden set · Object/Concern Model v2 | Unchanged |

## 6. Decisions in force — added since 2026-08-04

- **Seasonal and cottage properties are out of scope for the first years.** The frame's assumption that a property stays heated year-round is therefore correct rather than a gap. **Waterfront classes stay**
- **The Checklist Master stays inspection-only; care lives in the class frame.** Field component lists generate *verification per object*, the frame generates *care* — two streams, no collision. **Amendment 6 holds by accident today because the master contains no care, and the master rewrite is where that could break**
- **An audience default rides every care category** — `owner`, `professional` or `both`. The concierge is not a value on that axis
- **A zero-care ruling states why no care exists, never who would do it**
- **Care describes; opportunity recommends**
- **The finest read of an object is the authoritative one.** A canvas frame establishes that a thing is there; it cannot name a model, read a plate or assert a state — and it never supersedes a detail read of the same object. **Amendment 10, from three errors on a real mechanical room, none of which was missing evidence**
- **A still is a member of a set; a frame is a member of a sequence.** Following a pipe needs the sequence, which is why video is sequenced into the pass rather than excluded from it
- **The capture moment is the only time intent is free.** After it, intent is reconstructed — and a reconstruction that fails is what the mechanical room reading documents

## 7. Process rules — added since 2026-08-04

- **Rule 14 · A correction is authored whole, never appended.** The tell: read only the first sentence; if that alone is now false, the note is wrong regardless of what follows
- **Rule 11b · A check whose two sides cannot disagree has not been passing.** Convenience is how the two sides come to share a source
- **A delta enumerates every change mechanically before narrating any of them.** A wrong count is caught by arithmetic; an undescribed change is caught by nothing
- **Deriving a number does not help if the rule you check it against is a guess.** The bookkeeping guard took a projection for a cap
- **Outside review runs on distinct prompts pointed at different failure modes.** The axis that predicts model usefulness is **locality, not breadth**

## 8. Open questions

- The precedence rule's remaining gaps · whether opportunity output reaches a client unprompted · AI cost thresholds, which want measurement

## 9. Document accuracy

**`HouseSteady_Document-Register_2026-08-06b.md` is authoritative** for where every governing document lives and what is open, with owners.

---

**Status:** replaces the 2026-08-06 roadmap wholesale, four hours later, for the reason in the header.
