# Stage 2 notes — decisions to fold in when PLAN-STAGE-2 is written

Scratch of ratified decisions that belong to Stage 2 (plan canvas / RoomPlan integration)
but were settled during Stage 0/1. When PLAN-STAGE-2 is authored these become entry
criteria / design constraints; nothing here is built in Stage 1.

## Entry gate (carried from PLAN-STAGE-0 §7)

- **WKWebView storage durability** is a Stage 2 *gate*, not a note: the native shell does
  not become the daily driver until a durability mitigation (filesystem export or SQLite
  mirror via plugin) exists and is verified on-device.
  - **Status (2026-07-25):** the *filesystem export* half now exists — Stage 1 §7's pin-model
    export writes the manifest + media out of the app via the share sheet (iPad Files), with a
    pre-export integrity sweep. **The gate is not yet cleared:** it still requires
    *verified on-device* — i.e. run the export on the iPad, confirm the files land in Files, and
    confirm they re-open/verify. Until that on-device run happens, treat this as built-but-unproven.

## Canvas roles — two layers, not a hierarchy (owner, 2026-07-24)

- **Plan canvas = the index.** Complete room coverage, survives furniture moves; the
  thing you reopen next visit to *find* where something is. From RoomPlan (or the manual
  rough-rectangle fallback).
- **Photo canvases = the detail layer.** Disambiguate identical fixtures, capture
  nameplates and damage. They remain the *only* canvas for exteriors and any unscannable
  space, so photo canvases are never deprecated by the plan.
- **Stamp mode stays available on both.** No behavioural difference by canvas kind.

## Plan-anchor requirement is TYPE-SCOPED, never universal (owner, 2026-07-24)

Only **locator-class** component types require a plan anchor — shutoffs, mechanical
equipment, alarms, comparison positions, foundation cracks: things a person has to *find*
later. **High-count types do not** — receptacles, registers, windows, doors — and RoomPlan
renders windows and doors itself.

- **Reason:** a universal "place this on the plan" nag is a duplication tax on exactly the
  pins there are the most of. It would make the plan canvas feel like punishment.
- **Where the list lives:** the locator-class type set lands in the checklist master as a
  **vocabulary table** during the post-field-test content pass — do **not** invent it here.
  This note exists so Stage 2 cannot accidentally build the universal nag; it must read the
  requirement off the type, and only locator-class types carry it.

## AI suggestion → checklist / gap item, one tap (owner, 2026-07-24)

**Design record, not a Stage-1 build.** The assistant's field replies are frequently
*follow-up items* — "ask the owner about the panel age", "photograph the water-heater data
plate too". Those are exactly the content the **visit-two gap list** and the **session plan**
(`PLAN-STAGE-1.md` §7a) consume. So the shape must stay open for it: an AI suggestion should be
**convertible into a checklist or gap item with one tap**, without retyping.

Constraints for whoever builds it (Stage 2, once the session-plan round-trip exists):
- **Provenance tag is `ai-suggested-human-accepted`** — a distinct, first-class provenance,
  not a bare `human` or `ai` `Source`. The item exists because the AI proposed it *and* a human
  accepted it; both facts are load-bearing (the AI didn't unilaterally create work; the human
  didn't type it from scratch). Mirrors the `attest: evidence` "software proposes, human
  confirms" doctrine — the tap is the human act that makes it real.
- **One tap, in place.** The affordance lives on the assistant message (a "＋ Add as follow-up"
  action), pre-filling the item text from the suggestion; the human confirms or edits, never
  retypes. No new free-text flow.
- **It becomes session data, never config.** A converted item is a session-scoped gap /
  follow-up (feeds the visit-two gap list and, via §7a, next visit's session plan) — it must
  never touch the generated checklist config or its hash. Same rule as the session plan itself.
- **Do not design this out.** Nothing in Stage 1 needs to build it, but the chat event model,
  the gap-list shape, and the `Source` provenance vocabulary must all leave room for it so
  Stage 2 can add it without a migration.

## Manifest v4 — the active item set ships per scope (ratified 2026-07-30, both sides)

**Decision.** v4 carries the field's resolved **active item set** — its own answer to *what was
due here* — for every scope, open zones included. **Classification stays with the binder
builder:** what counts as a gap, what reaches the visit-two plan, what is merely outstanding.
Field ships facts; the builder assigns meaning. Increment 4 proceeds against v3 now and reads
the set through a per-manifest-version adapter (their Design v1.1 §C3), so this is additive on
both sides and blocks nothing.

**Why it cannot be derived downstream.** v3's principle stands — derived views are a
convenience, the config snapshot plus the event log are the trust root — but *unresolved* is
not a derivation from those. It needs the **active** item set: property flags × zone attributes
(with `defaultsTrueFor` resolution) × `pin.*` / `house.*` refs × list gates × component
inheritance chains. That is `activeRefs`, `effectiveAttributes`, `shows()` and
`componentItemsFor` in `src/engine/v2/checklist.ts`. Deriving it in the binder means a **second
implementation of the trigger engine**, whose failure mode is silent: the two apps disagree
about whether an item was ever due, and nothing errors. One implementation, shipped as data.

The *other* half of a gap — `na` carrying `feedsGapList` — **is** a plain join over
`resolutions[]` and `config.snapshot.naReasons`, and remains the builder's.

### Why the `zones[].audit` interim was offered and declined

Widening the existing close-audit snapshot to all scopes was the cheap path. It was declined,
and the reasoning is worth keeping because it generalises: **the audit is a summary of what is
*unresolved*, not a statement of what was *due*.** Answering "unresolved" requires a
classification call, so shipping it would put that call on the field side and force it to be
undone at v4. Three bounds make it unusable as the source even temporarily:

1. **Closed zones only.** It is recorded at `ZoneClosed`. On a real walk most zones are open at
   the moment of import, so for those zones there is simply no record.
2. **`standardUnresolved` is a bare count.** No ids, so nothing downstream can name the items.
3. **Zone scope only.** Nothing at pin or session scope — the entire component checklist and
   every session-wide item are absent.

`zones[].audit` keeps its existing job: the advisory close-out snapshot, as recorded, for audit
history. It is not a gap source and should not grow into one.

### Shape

A flat top-level array, matching `resolutions[]` so the two join on the same key
(`itemScopeKey(scope) + itemId`):

```ts
activeItems: {
  scope: ItemScope;   // {kind:"zone",zoneId} | {kind:"pin",pinId} | {kind:"session"}
  itemId: string;
  /** The field's own rendered-group key — advisory, for presentation parity. */
  group: string;
}[]
```

- **Ids only, never item bodies.** Text, `satisfy`, `attest`, `tier` and `unit` all live in
  `config.snapshot`, which ships whole. Duplicating them would create a second copy that can
  disagree with the first.
- **Coverage:** every zone (open *and* closed), every non-retired pin carrying a non-stub
  component list, and session scope once. The three derivation functions already exist —
  `deriveZoneItems`, `deriveComponentItems`, `deriveSessionItems` — so the build is
  serialisation, not new logic.
- **Sizing:** a few hundred entries at roughly 100 bytes each. Immaterial beside media.

**Snapshot semantics, stated so nobody assumes otherwise.** The active set is a function of
session state, so it answers *what was due at export time* — not what was due at every moment
of the visit. A pin created and then retired mid-walk had items due that the set will not
show. The event log remains the record of what happened; the active set is the state it ended in.

### One open question for the builder

`DerivedItem` also carries a `status`, and one of its values is **not reconstructable
downstream**: `proposed` — matching evidence exists on a pin and one human tap would confirm
it. `satisfied` and `na` are joinable from `resolutions[]`; `unresolved` is their absence; but
`proposed` comes from the field's proposal search over pins.

This is beyond the literal ask, so it is **not** in the shape above. Adding it would ship an
observation ("evidence exists"), not a judgment — the `attest: evidence` doctrine, exported.
Builder's call: say whether v4 should carry `status`, and it goes in as a fourth key.

## Related

- Component sub-type taxonomy request + regional analytics rationale:
  `CHECKLIST-MASTER-REVIEW.md` §8.
- The `DESIGN-OBJECT-CONCERN-MODEL.md` v4 line scopes v4 as the concern media-owner change
  only; that record is ratified and owner-governed, so it is **not** amended here. If the
  active-item-set addition should appear there, it is a v1.1 of that document.
- Vocabulary telemetry that feeds the taxonomy (freeform-type flag + nickname field in the
  export): `PLAN-STAGE-1.md` §7.
- Video evidence: parked until after field test 3 (audio covers weird-noise cases; video
  blobs are heavy against the durability gate above). Revisit as a capture kind in Stage 2.
