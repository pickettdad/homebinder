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
  /** {kind:"unresolved"} | {kind:"proposed",pinIds} | {kind:"satisfied"} | {kind:"na",reasonId} */
  status: ItemStatus;
}[]
```

**`status` is included (builder, 2026-07-30), with their consumption rule recorded as part of
the contract:** `resolutions[]` stays authoritative for `satisfied` and `na`; the builder reads
only `proposed` from `status`; a disagreement between the two is *reported*, never silently
resolved in favour of one — the treatment `zones[].audit` already gets. The redundant values
are shipped precisely so that cross-check is possible.

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

### `proposed` is far narrower than "a photograph is being held" — do not build the report on it

**Settled: `status` ships. This is not a reopening — it is what `proposed` actually means, which
does not match the reasoning that selected it, measured against master v1.11.**

The justification for taking `status` was the client-facing report: *an item with a photograph
sitting unconfirmed on a pin must not read as "we did not capture this."* **Shipping `status`
does not fix that case.** `statusOf` (`checklist.ts:111`) proposes under three conditions, all
required:

```ts
if (item.attest === "evidence" && item.satisfy === "pin" && item.pinTypes?.length) { … }
```

And what it tests is *"a pin of a wanted component type exists in scope"* — **never whether any
media exists.** Two consequences, both counted against the 409-item master:

| | count | behaviour |
|---|---|---|
| can ever be `proposed` | **38** | evidence + `satisfy:pin` + `pinTypes` |
| **photo/evidence items** | **74** | **never propose** — read `unresolved` with photos on the pin |
| all evidence items that can never propose | 155 | wrong `satisfy` kind |
| action items | 216 | never propose, by rule (review §3.3) |

So `utl.pipe-material` ("Supply pipe material photographed close-up") with a photograph on the
pin and no confirming tap reads **exactly `unresolved`** — indistinguishable from an item nobody
touched. That is the reported failure mode, surviving the fix chosen for it.

It fails in the other direction too: **`proposed` can fire with zero media.** Creating a
water-heater pin proposes `utl.water-heater` immediately, no photograph involved. `proposed` is
therefore neither necessary nor sufficient for "we are holding a photograph."

**What actually answers the media question, already shipping in v3:** `pins[].mediaIds`, and
`media[]` carrying `owner: {kind:"pin",pinId}`. For any pin-scoped item the builder can ask
today whether that pin holds media, with no v4 dependency.

**The honest limit, which no current field is close to closing.** Neither signal binds media to
a *specific item*. `utl.pipe-material` and `utl.every-nameplate` can sit on the same pin, and
media presence cannot tell them apart. The item↔media link exists in exactly one place —
`ItemResolution.evidence.mediaId` — and only on a **satisfied** resolution, i.e. never for the
unconfirmed case the report cares about. Closing that means the field recording which capture
was taken *for* which item at capture time, which is a capture-flow feature, not a manifest
key. **It should be scoped deliberately if the report needs it — not assumed into v4.**

`status` still earns its place: the 38 proposable items are real, and the cross-check over
`satisfied`/`na` is real. It is simply a different signal from the one the report was going to
be built on.

### Per-item evidence at capture time — DECLINED, deliberately (builder, 2026-07-30)

Offered from this side as the only thing that would close the gap above; **declined, and not to
be scoped.** Recorded as an explicit exclusion rather than left absent, per the rule that an
exclusion is evidence of a decision while a silence is indistinguishable from an oversight
(`CHECKLIST-MASTER-REVIEW.md` §23).

Two reasons, both sound:

1. **Per-pin media presence must not gate the client report either.** A water-heater pin
   carrying a wide shot and a nameplate but no drain-pan photo would go quiet on the drain pan.
   Filtering gap rows on "this pin holds media" *suppresses real gaps* — worse than the problem
   it was reaching for.
2. **The defence lives in the design, not the data.** The gap report is an editor over
   pre-populated rows that a human signs. A concierge looking at an unresolved
   `utl.pipe-material` row on a pin holding three photographs is exactly what the review pass
   is for. Their mitigation is a **row affordance** — every gap row pointing at a pin shows what
   media that pin carries, at the point of review. **No manifest change.**

**And it would invert the walk.** Asking what a photograph is *for* at capture time contradicts
the four-pass model (REDESIGN-v2 / issue #40), where capture is deliberately fast and binding
happens at review. `ItemResolution.evidence.mediaId` already *is* the concierge saying *this
photo answers this item*; an unconfirmed photograph honestly is not evidence yet.

### The measurement that would reverse it — and how it is actually computed

**Trigger condition (builder):** if a five-zone walk finishes with **many unresolved items
sitting on pins that carry media**, the review pass is not happening in the field and binding
must move earlier. Count it rather than guess.

**Method — ratified by the builder 2026-07-30; this is the route both sides use.** It is *not* computable
from a v3 export downstream: "unresolved at pin scope" needs the active item set, which is the
v4 addition this whole section exists to add. Re-deriving it in the binder to run the
measurement would be the second trigger engine, measuring the thing it would be wrong about.

**It is computable, exactly once, by replaying the export through the real engine.** The v3
manifest carries `events[]` verbatim, and `foldV2(events)` reconstructs `SessionStateV2` from
nothing else (`fold.ts:186`). Feed that plus `config.snapshot` to `deriveZoneItems` /
`deriveComponentItems` / `deriveSessionItems` and the answer comes out of the single
implementation — no second engine, no v4 dependency.

**So the measurement is not time-sensitive and does not need tooling on walk night.** The
exported event log preserves everything it needs; it can be run any time after the walk from
the export files. Build the script when the count is wanted, not before.

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
