# HouseSteady — capture kinds: what is a photograph and what is not

**v1.1 · 2026-08-27.** *Supersedes the note of 2026-08-26.* · **Owner-ruled.** · **Cross-repo contract note — both sides build from this.**
**Carry it to:** Mac Field (field repo) and Builder Code (binder repo). **Neither side may implement half of it.**
⚑ **Neither repo held v1.0.** *It lived only in the project folder. Both sides commit this one to their own `/docs`.*

---

## 0 · What changed in v1.1, and why the correction was worth cutting

**v1.0 described a defect in the present tense that does not exist yet, and named the wrong failure.** *Read at source in both repos on 2026-08-27; every claim below is a file and a line, not a summary.*

| v1.0 said | measured |
|---|---|
| Floorplan and mesh **are** filed as `kind: photo` | ⚑ **Neither is written as a media file at all yet.** *They exist only as `CaptureIntent` values — `src/engine/v2/events.ts:122–128`* |
| They would arrive as `photo` | ⛑ **They would arrive as `voice`** |
| A new `kind` value would hide in the binder | ⚑ **It would not.** *`media.kind` is a checked vocabulary; a planted value is flagged, counted and listed* |
| The three `kind = 'photo'` predicates — **unverified** | ✓ **Verified.** *`ai/tasks/nameplate.ts:272`, `pinType.ts:183`, `routing.ts:220`* |

**The ruling in §1 is unchanged. The mechanism in §2 is confirmed and its reasoning is now correct. §3 shrinks on the binder side and grows on the field side.**

---

## 1 · The ruling — three things, and only one is a picture

*Unchanged from v1.0.*

| | what it is | audience | identified? |
|---|---|---|---|
| **Raw floorplan** | ⚑ **Data.** Walls, doors, windows, openings — dimensions, transforms, RoomPlan's own confidence | **Desk.** Measurement, placement, quoting | ⛑ **Never** |
| **Raw mesh** | ⚑ **Data.** Anchors, faces, per-piece geometry, `walkedExtent` | **Desk only** | ⛑ **Never** |
| **The rendered plan drawing** | **An image, and a real client asset** | ⚑ **The client — it goes in the Binder** | ⛑ **Never** |

⚑ **The third one does not exist yet, and it is the one with the most value in it.** *Mac Field already draws the plan to scale on screen with lengths. That drawing — or a desk-produced version of it — is the client artifact.* **It is *derived*, not captured: produced from the raw floorplan rather than photographed.** **So it is never a subject for identification either, and it must not inherit that treatment by being an image.**

⛑ **Mesh has no direct client life, and its indirect one is real: it is what corrects the plan when RoomPlan misses a peninsula.** *It feeds a client deliverable without being one.*

---

## 2 · The mechanism — a distinct `kind`, and the reason is not the one v1.0 gave

⚑ **The raw floorplan and raw mesh get their own capture kind. They stop deriving `photo`, `video` or `voice` from their mime.**

**Why a kind rather than making every planner check `mime` as well — now verified rather than asserted.**

- ⚑ **A distinct kind fails safe, and this is measured.** **Every gate in the binder that reaches a model is an allowlist or an equality on `'photo'`:** *`engine/identify.ts` gates on `IMAGE_KINDS = ['photo']`; `engine/assembly.ts` gates on `CONSUMED_KINDS`; and three SQL predicates — `ai/tasks/nameplate.ts:272`, `pinType.ts:183`, `routing.ts:220` — each read `m.kind = 'photo'`.* **Five gates, none of them an exclusion list. A kind they have never met is refused by all five without any of them being changed.**
- ⚑ **`kind` is what everything filters on.** **If they stay in the photograph vocabulary, every filter that ever looks for photographs must remember to exclude them** — *and a rule written as the list of symptoms seen so far breaks on the next surface added.*
- **`identify.ts` and `assembly.ts` both already name what they exclude rather than skipping it silently.** *So a new kind arrives as a sentence a person can read, not as a gap.*

### ⛑ The finding v1.0 missed, and it is the load-bearing one

**The field does not assign `kind`. It derives it from mime, and the derivation has no fallthrough:**

> `mime.startsWith("image") ? "photo" : mime.startsWith("video") ? "video" : "voice"`
> *`src/engine/export/manifestV3.ts:69–70`*

⛑ **Anything that is not an image or a video becomes a voice note.** *A floorplan at `application/json` would be filed as `kind: "voice"` and counted in `totals.voiceNotes`.*

⚑ **This is why the fix cannot be described as "stop calling it a photograph."** *It was never going to be one.* **And it is worse than a mislabel:**

⛑ **The binder now surfaces an unrecognised `media.kind` — PR #123 — but the field can never emit one.** **Everything unrecognised collapses to `voice`, which is a word the binder knows. So the check fires on nothing and the file passes quiet at both ends.** *The producer defeats the consumer's guard. A check built on the assumption the bug also makes.*

**So the field owes two changes, not one: the new kind, and the removal of the silent fallthrough.** ⚑ **The second is the more valuable, because it is what makes every future mislabel visible instead of this one.**

### The shape of the new kind — one word, not two

⚑ **One new kind covers both. `intent` continues to distinguish floorplan from mesh.**

*`kind` answers **what is this file**; `intent` answers **what was the concierge doing**. They are different questions and both are already carried. Two kinds would restate the intent inside the kind, and a fact with two homes drifts.*

**Proposed word: `geometry`.** ⛑ **The word is Mac Field's to disagree with — the shape is not.** *If a later capture is structured data that is not geometry, it takes its own word and the binder surfaces it. That is what the open vocabulary is for.*

### The prerequisite v1.0 named is discharged

**PR #123 shipped it.** *`media.intent`, `canvas.kind` and `session.propertyFlag` were swallowed and are now surfaced, reaching a reader through `import/validate.ts` into both the CLI report and `web/src/pages/ImportReport.tsx`.* ⚑ **`media.kind` was never the gap — it was already checked. The gap was `capture_intent`, which is exactly how `floorplan` and `mesh` arrived silently in the first place.**

**Under the version policy this is an addition and stays `manifestSchemaVersion` 3.**

---

## 3 · What each side owes

**Field side — two changes.**
1. *Emit the raw floorplan and raw mesh under the new kind.*
2. ⚑ *Remove the `voice` fallthrough in `kindOf`, so an unrecognised mime produces something the binder's vocabulary check can see.*
*`intent` stays as it is — `floorplan` and `mesh` are still the words that make them findable.*

⛑ **Also a documentation fix.** *`docs/MANIFEST-FIELD6-ADDITIONS.md` and `docs/fixtures/manifest-position-example.json` both call the media array `files[]`. The emitter has always written `media[]` (`manifestV3.ts:182, :338`). The doc is wrong, not the code — and it is what the hand-written binder fixture copied.*

**Binder side — smaller than v1.0 implied, and say so rather than filling it.**
*Routing the new kind away from identification and assembly is already true by construction. What is owed is the proof — a planted new kind the five gates refuse — and, later, reading it as the geometry it is. **The reading waits on a real export and should not be built against a guess at the payload.***

**Neither side alone.** ⚑ **The rendered plan drawing is unbuilt and unassigned.** *Whether the field renders it or the desk does is open; that it is derived, client-facing, and never identified is not.*

---

## 4 · The thing worth building deliberately rather than letting fall out

*Unchanged from v1.0.*

⚑ **An annotated plan showing the water shutoff, the gas shutoff, the panel, the sump and the exits is arguably the single most useful page in the Binder.**

**It is the page a house-sitter needs, a contractor needs, and an adult child three provinces away needs at two in the morning.** ⚑ **Almost nobody has one for their own house.**

*Recorded here because it is downstream of the rendered drawing and would otherwise arrive as a side effect of a file format decision. It deserves designing.*
