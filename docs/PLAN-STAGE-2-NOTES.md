# Stage 2 notes — decisions to fold in when PLAN-STAGE-2 is written

Scratch of ratified decisions that belong to Stage 2 (plan canvas / RoomPlan integration)
but were settled during Stage 0/1. When PLAN-STAGE-2 is authored these become entry
criteria / design constraints; nothing here is built in Stage 1.

## Entry gate (carried from PLAN-STAGE-0 §7)

- **WKWebView storage durability** is a Stage 2 *gate*, not a note: the native shell does
  not become the daily driver until a durability mitigation (filesystem export or SQLite
  mirror via plugin) exists and is verified on-device.

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

## Related

- Component sub-type taxonomy request + regional analytics rationale:
  `CHECKLIST-MASTER-REVIEW.md` §8.
- Vocabulary telemetry that feeds the taxonomy (freeform-type flag + nickname field in the
  export): `PLAN-STAGE-1.md` §7.
- Video evidence: parked until after field test 3 (audio covers weird-noise cases; video
  blobs are heavy against the durability gate above). Revisit as a capture kind in Stage 2.
