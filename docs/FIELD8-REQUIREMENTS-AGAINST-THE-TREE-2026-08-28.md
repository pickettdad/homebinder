# Baseline Service Design v1.12 §8 — the eight field requirements, read against the repo

**2026-08-28 · Mac Field.** Answering §0 A of the running list: *"§8 lists eight requirements for
the field track. Read them against the tree and say where they disagree — a requirements list
nobody has checked against the repo is a list, not a requirement."*

⚑ **The list was right to be suspicious of itself. One of the eight is finished and described as
unbuilt; one is genuinely done and diagnosed in the present tense from a tree that stopped existing
seventeen days ago; two are not started and the document says so honestly.** Every claim below is a
file and a line.

## The table

| | requirement | verdict |
|---|---|---|
| **1** | The capture architecture — zone session, RoomPlan on it, mesh as a mode, position at the shutter | ⚑ **Document is wrong. Built.** |
| **2** | Capture flow order: floorplan → mesh decision → room shot → containers; a note binds to the previous capture | ⛑ **Partial — and it is the real gap** |
| **3** | The capture-intent marker | ✓ **Done, end to end, no disagreement** |
| **4** | One camera per screen | ✓ **Done — diagnosis stale by seventeen days** |
| **5** | The zone grid in capture order | ✓ **Done** |
| **6** | Position by inheritance, and a paused session refuses rather than inherits | ⚑ **Both halves now built — one of them on this branch** |
| **7** | `item.scope` and the second visit kind | **Not started. Document accurate to the counts** |
| **8** | Session plan import | **Not started. Document says so four times** |

---

## 1 · The capture architecture — the document describes a build that shipped five days before it

**v1.12 heads §4.1a-iii *"The capture architecture — SPECIFICATION, UNBUILT"* and says "it describes
a capture path that does not exist yet". §8 item 1 says "the native viewfinder is built; this is
what remains". §10 says "the floorplan and position remain unbuilt and are Field 6".**

⛑ **Field 6 landed on `main` on 2026-08-23/24** — `0dfc1e5`, `bea7481`, `ee25ff8`, merged as #131
and #132, with device evidence in the commit bodies.

- `HSZoneSession.swift:50` — one `ARSession` owned for the zone's life; `:127` `openZone()` starts
  paused in `positioning`; `:182–232` `enter(mode)` runs `session.run(config, options: [])` with
  **no `.resetTracking`**, so all three modes share one origin.
- `:498–523` RoomPlan runs on **that same session** — `RoomCaptureSession(arSession: session)`,
  and `stop(pauseARSession: !keepSession)`.
- `:192` mesh is a real mode (`sceneReconstruction = .mesh`); `:273` `harvestMesh()` returns
  per-anchor vertices, faces, transforms and `walkedExtent`.
- `:371–437` `position()` returns x/y/z, a column-major 4×4 and a ray-cast `surface`, **or a typed
  refusal**, and the refusal is persisted as one.
- The plan and the mesh are **filed as media** (`CameraScreen.tsx:545`, `:571`) and the plan is
  drawn to scale (`FloorPlanView`).

**⚑ The Capture-Kind Contract Note v1.1 §0 is wrong in the same direction, and it matters more**,
because it states it as *measured*: *"Neither is written as a media file at all yet… they exist only
as `CaptureIntent` values."* They have been written as `application/json` media blobs since
2026-08-23. **The note's second row — that they would arrive as `voice` — was exactly right**, and
that is now fixed (this branch, item 3).

**What is genuinely not built, and it is worth keeping on a list.** Two helpers are computed and
read by nobody: `meshRecommendation` and `containerAnchorState` (`src/native/zone.ts:135`, `:107`)
are exported and tested and **no screen calls either**. So the app never advises on mesh, and
nothing tells anyone whether a container is anchored. *Rule 43, twice, in one file.*

## 2 · The capture flow order — the real gap, and it is two gaps

**This is the one worth the design session's attention.**

**The order is reversed.** The document states floorplan → mesh decision → room shot → containers.
`CaptureModeScreen` renders *"Photograph this room"* first (`:391`), then Room shot (`:427`),
Traverse, Paper, Video, Run trace, Voice — and **Floorplan and Mesh last** (`:482–499`). They are
four always-live peer buttons; **nothing sequences them and nothing gates the room shot on a
floorplan having run.**

⛑ **There is no "mesh decision" anywhere.** Mesh is an unconditional peer door, and `finishScan`
(`CameraScreen.tsx:522–559`) ends by printing dimensions and returning to positioning **without ever
asking about mesh** — which is also where `meshRecommendation` would have had its reader.

**A note cannot bind to a previous capture.** `CaptureTarget` has no media variant
(`events.ts:139–142`), so there is nothing for a filmstrip to point at. A voice note files to the
**zone** (`CaptureModeScreen.tsx:556`); the only per-capture note is `MediaCaptioned` on the capture
*currently being taken*, and that path is unreachable on the native shipping surface.

⚑ **This is a gap, not the document being wrong.** The newest baseline cut cited anywhere in the
tree is **v1.8** (`objectContainer.ts:2`). v1.12 §8 is a specification the code predates, which is
precisely what §0 A of the running list was for.

## 3 · The capture-intent marker — done, and nothing to report

Chosen at the door in both screens, written onto `PhotoAdded`, carried on `MediaRef` through
`foldV2`, emitted as `MediaFileEntryV3.intent`, serialized by `exportSessionV3`. `room-shot` kept
its own value. *Pan* appears in no user-visible string — the button reads *"↔ Traverse"*.

Two dead branches inside it, cosmetic: `ACTIONS` is deliberately empty, so the in-viewfinder
room-shot button never renders (the live path is `startAction`); and nothing ever sets
`pendingIntent` to `"run-trace"`, so that arm of the pill at `:1331` is unreachable.

## 4 · One camera per screen — done, and the diagnosis is stale

`globalCameraApplies` returns false for the whole Discovery visit (`captureSurface.ts:25`), with a
real reader guarding the app's only floating surface (`App.tsx:50`, `:75`). ⚑ **The requirement's
present tense — *"capture mode currently renders underneath a floating camera"* — describes a tree
that stopped existing on 2026-08-11** (`6e7200c`).

**On the literal wording**: `CaptureModeScreen` does render four photo doors and two video doors.
Read as *one photo door and one video door* the requirement is unmet — but that reading contradicts
§4.1a/§4.1b, which *define* the three kinds as doors with intent recorded on them. Read as the
surface rule (`captureSurface.ts:13` — the removed pair differed *"only in whether they passed
through the confirm sheet"*), it is met. **Flagging the ambiguity rather than choosing for you.**

## 5 · The zone grid in capture order — done

`groupIntoRuns` sorts ascending by timestamp, uuidv7 mediaId as tie-break, and starts a new run
where the pause exceeds `RUN_GAP_MS = 60_000`. Each run renders as its own three-column grid, no
labels, no counts.

Two scoping facts the wording does not cover: captures filed into an open container land on the pin
and **never appear in the zone grid** (a room's record is split across two surfaces by design,
v1.8 §4.1a-ii); and the viewfinder filmstrip renders in raw stored order with no time sort, so a
reassigned capture shows at the tail there while the zone grid puts it back where it was taken.

## 6 · Position by inheritance — both halves now built, one of them today

**The paused half was already enforced and is the stronger half.** `HSZoneSession.swift:374`
refuses with `{positioned: false, why: "paused"}` rather than handing back a held pose, and that
refusal reaches the desk **as a refusal** rather than as an absence.

**The inheritance half was absent at HEAD, deliberately.** The owner ruled on 2026-08-23 —
*"position everything; the desk ranks"* — and `ee25ff8` removed the container anchor, on the
grounds that *first frame wins* makes the field choose which frame represents an object, and the
first shot of a fridge is the worst available anchor.

⚑ **Restored on this branch as a sampling rate rather than a choice**: first frame in a container,
plus **every** Text frame, so the nameplate shot is always among the candidates and the desk still
ranks by `surface.distance`. **The ruling is untouched — only the sampling rate drops.**

### ⛑ And one contract hole, now closed

The manifest told the desk that an **absent** `position` means *inherits from its container*. But
the traverse, the floorplan and the mesh all file to the **zone**, which has no container to
inherit from — so absence meant two different things, and **a signal that means both *fine* and
*unplaceable* is one nobody can read.**

**The disambiguator was already on every entry and was not named as load-bearing**: `owner.kind ===
"pin"` → inheritance; `owner.kind === "zone"` → genuinely unknown. Stated in
`MANIFEST-FIELD6-ADDITIONS.md §1` and in the type.

## 7 · `item.scope` and the second visit kind — not started, and the document is exact

All 409 items carry a scope; **nothing reads it.** Parsed by the generator, validated by Zod,
emitted into `checklists.generated.ts`, and the string `item.scope` occurs nowhere in `src/`,
`scripts/`, `tests/` or `netlify/`. `shows()` (`checklist.ts:112`) consults gate and trigger only.
The document's counts — 402 `[baseline]`, 6 `[baseline, monthly]`, 1 `[baseline, seasonal:spring]`
— match the generated file exactly.

⛑ **One refinement, because it is mistakable for the requirement being met.** Capture and inspection
items *are* different sets today — by **screen swap** (`App.tsx:109` → `CaptureModeScreen`, which
renders no checklist at all), not by `scope[]`. That is the wrong mechanism and leaves `scope[]`
unread. The scope vocabulary also admits only `baseline` / `monthly` / `seasonal:*`, so a capture
visit kind **cannot currently be authored into `scope[]` at all.**

*(Scope tags do leave the app inside the verbatim config snapshot — transport to the binder, not a
field-side read.)*

## 8 · Session plan import — not started, and PLAN-STAGE-1 already says so

No product code parses, gates, stores or applies a session plan; no plan-import event exists;
`createSessionV2` takes no plan argument. `db.ts` declares **no property entity** — the only
property-shaped field is a free-text `propertyLabel?` on `SessionRow`, so the fixture's `propertyId`
has nowhere to land and nothing carries identity across visits.

**Not bare, though**: the golden fixture is committed and `tests/engine/sessionPlanFixture.test.ts`
pins its shape and encodes the four ratified receiver rules. ⛑ That is emitter-side validation —
the test's own `SessionPlanShape` is declared inside the test and imported by nothing — so it proves
the snapshot has not drifted and **cannot make an iPad in a basement read a plan.**

⚑ **One trap worth naming**, because a name-based audit scores this requirement as done:
`SessionPlan` **does** exist as an exported type at `src/engine/plan.ts:41`. It is the v1
route-config slot compiler, read only by `fold.ts:94`. Different thing entirely.

---

## What this changes for the design session

1. ⚑ **§4.1a-iii, §8 item 1 and §10 need rewriting** — they describe Field 6 as unbuilt and it
   shipped. So does Capture-Kind Contract Note v1.1 §0, which states it as measured.
2. ⛑ **§8 item 2 is the live one.** Flow order and note-binding are both genuinely absent, and the
   mesh decision point is where the unread `meshRecommendation` would find its reader. **This is
   the requirement to spend design attention on; the others are bookkeeping.**
3. **§8 item 4's wording needs one decision from you** — surface rule or literal door count. The
   tree implements the surface rule and §4.1a requires it.
4. **Two computed-but-unread helpers** (`meshRecommendation`, `containerAnchorState`) are waiting
   for consumers that §8 item 2 would create.
