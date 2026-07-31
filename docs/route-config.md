# Editing the inspection route (v1 slot model)

> **Scope — read this first.** This documents the **v1 slot model** (`route.baseline.ts`,
> `configVersion 1.1.0`), which the v2 pin model superseded for all new work. It is **not**
> stale documentation for dead code: `loadRoute()` still runs at app init
> (`sessionStore.ts:215`) and `SetupScreen` can still start a v1 session, so these rules
> still bind anyone editing that file. **New checklist content does not go here** — it goes
> in `docs/CHECKLIST-MASTER.md`, which generates `src/config/checklists.generated.ts` and has
> its own discipline in `CLAUDE.md`. Kept for the live v1 path, not as a model to follow.

The whole inspection lives in **`src/config/route.baseline.ts`**. The process doc is the
source of truth; this file renders it. The discipline: update the Baseline Inspection
Process doc first, then this file, then bump `configVersion` — same commit.

## The rules

1. **It's data, not code.** No functions, no expressions, no imports beyond the type.
   A round-trip test (`npm run validate:config`) enforces this.
2. **Bump `configVersion` on every edit** (semver: major = ids changed/removed,
   minor = slots/zones/flags added, patch = label/guidance wording). The content hash is
   computed automatically and pinned into every session — it proves which bytes ran.
3. **Never rename or reuse a slot id.** Ids are how captures, deferrals, and the
   downstream pipeline refer to slots across visits. Retire an id by deleting the slot;
   add a new one instead of renaming. (In-flight sessions are safe either way — they run
   on their pinned snapshot — but visit-two gap lists and pipeline joins care.)
4. **A bad edit cannot brick a visit**: validation fails closed at app startup and in CI
   with readable errors, and existing sessions keep their pinned snapshot.

## Vocabulary

| Concept | What it is |
|---|---|
| `zones[]` | The route, in walk order. Each has `slots` and optionally `rooms`. |
| `slots[]` | Capture slots: `id`, `label`, `guidance`, `required`, `minCaptures`, `voiceNote`, `needsScaleInFrame`, `tags`, `reCheckOf`, `constraints`. |
| `voiceNote` | `disabled` \| `optional` (default) \| `recommended` (button emphasized) \| `required` (blocks Next). Reserve `required` for slots where the photo can't carry the context (spoken readings, locations, identifications). |
| `templates[]` | Reusable room routines. `extends` chains (parent steps first). Step `label`/`guidance` may use `{room}`. |
| `zone.rooms[]` | Which room kinds a zone accepts and the template each expands with. The actual room list is per-house, set at session setup (and add-able mid-visit). |
| `conditionalBlocks[]` | Slot groups injected into zones when property flags match. `when` is `allOf`/`anyOf`/`not` over declared flag ids — **nothing more expressive, by design**. Logic beyond a flag combination belongs in code that emits a flag. |
| `exceptionReasons[]` | The allowed gate exits. `requiresNote` forces a short note; `feedsGapList` routes the exception onto the visit-two gap list in the export. |
| `zone.gate.review` | `none` (default) \| `ai`. With `ai`, closing the zone queues a best-effort "Second look" AI batch review — advisory findings only; the deterministic gate never waits on it. |
| `tags` + `constraints` | Cross-zone sequencing. `afterAllTagged` locks a slot until every slot carrying the tag is resolved — this is how the basement ceiling re-check waits for the water run. `reCheckOf` shows the referenced slot's photos side-by-side at capture time. |

## Workflow for a route edit

```bash
# 1. edit src/config/route.baseline.ts (and bump configVersion)
# 2. validate:
npm run validate:config
# 3. eyeball the effect on a realistic house: npm run dev, start a session,
#    toggle the relevant flags, check the zone lists
# 4. commit doc change + config change + version bump together
```

## What deliberately stays in code (not this file)

Gate enforcement · plan compilation/room expansion · exception consequences ·
export construction · capture mechanics. Config declares the inspection; code executes it.
If an edit seems to need config to "do" something, that's a feature request for the
engine, not a config trick.
