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

## Related

- Component sub-type taxonomy request + regional analytics rationale:
  `CHECKLIST-MASTER-REVIEW.md` §8.
- Vocabulary telemetry that feeds the taxonomy (freeform-type flag + nickname field in the
  export): `PLAN-STAGE-1.md` §7.
- Video evidence: parked until after field test 3 (audio covers weird-noise cases; video
  blobs are heavy against the durability gate above). Revisit as a capture kind in Stage 2.
