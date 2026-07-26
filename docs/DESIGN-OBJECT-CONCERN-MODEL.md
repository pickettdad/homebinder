# The Object / Concern Model — Cross-App Design Record (v1)

**Date:** 2026-07-25
**Status:** Ratified by owner. Binds both the Field app and the Binder Builder.
**Why this exists:** this model spans two codebases and two Code sessions. Without a single record it gets re-litigated, and the two apps drift. Neither session invents changes to it; changes come back through the owner as a new version of this file.
**Sequencing:** nothing here lands before the five-zone field test, which measures sweep capture, pick-lists, and checklist attention across zones. A model change first would confound all three readings.

---

## 1. The model

Four kinds of thing:

| | What it is | Lifespan |
|---|---|---|
| **Zone** | A room or area | The house |
| **Object** | A thing that lives in the house — water heater, panel, deck | Years; replaced, not resolved |
| **Concern** | Something observed that needs tracking | Opens, is watched or acted on, closes |
| **Capture** | Photo, audio, video, note, AI thread | Attached to any of the above |

**Objects and concerns are separate entities, not one entity with a flag.** Today a pin is an object *or* a concern depending on `flag: fine|monitor|issue`. That jamming-together is the source of the disorganization the owner reported. One object has many concerns over its life; each concern has its own history.

**Concerns can be zone-owned or object-owned.** A sloping floor, a damp smell, a stained ceiling belong to the room, not to any object. Forcing them onto a freeform pin would poison the component taxonomy that's meant to grow from real usage.

**Concerns can float.** Raised during the sweep, attached to an object later — mirroring how captures already float in the inbox. This is not an edge case; it is the direct consequence of the capture-first walkabout. Requiring the object to exist first is exactly the gating friction that stops concerns being raised at hour three.

**One owner per concern, plus a hypothesis link.** A concern belongs to one zone or one object. Where two concerns may be connected — ceiling stain below, leaking sink above — they carry a typed **"possibly related to"** link. The link type is deliberately hypothetical: never "caused by." Noticing that two observations might connect is identification; deciding they do is a plumber's call.

**`monitor` and `fine` retire as pin flags.** Monitoring is a decision about a concern's severity, made by the builder or by a monthly visit — not a property of an object. And "I looked and it's fine" is what a satisfied checklist item already records.

## 2. The seam between the apps

**The Field app owns observations. The Builder owns the concern record.**

Field says: *on this visit, concern #47 was observed, still present, two photos.*
Builder holds: *#47 — opened Aug 2026 at the water heater, observed on four visits, contractor engaged November, completed January, verified February.*

Everything in that middle section — coordination, quotes, trades, verification — never touches the Field app, because none of it happens at the house with an iPad in hand.

**A concern never auto-closes in the field.** If a failed check passes on a later visit, the field records *this check now passes* against an open concern. It does not resolve it. Resolution is the builder's, with a reason: repaired by trade on date, homeowner fixed it, no longer observable. Without this rule two systems end up disagreeing about whether something is closed, with no way to adjudicate.

**In-month coordinated fixes belong to the Builder**, as Master Spec §18 (Repair & Project Register) — project, scope, permits, quotes, approval, contractor, dates, invoice, warranty, verification. Not a third system. A CRM, if one is ever needed, would own business process (scheduling, invoicing, client comms); the builder owns the concern's resolution record. Splitting a concern's lifecycle across two systems recreates the exact problem this seam prevents.

## 3. Identity — corrected

- **`pinId` is a uuid, permanent, minted offline.** Concerns mint their own the same way. No server, no coordination, works in a basement. **The Builder adopts field-minted IDs as canonical** rather than mapping to its own — no reconciliation layer.
- **The human-facing number is session-scoped.** Verified in code: the counter lives on the session row, so visit two restarts at #1. Numbers are permanent *within* a visit only.
- **Therefore the session-plan import is the cross-visit identity mechanism, not a convenience.** Without it, a five-year-old leak is minted fresh every visit and nothing ever lines up. This raises the import's priority materially.

## 4. Retirement — corrected

"Misplaced pins vanish from the record" is not possible and should not be. The event log is append-only; that immutability is the durability guarantee everything else rests on.

**The reason code drives binder inclusion, not deletion:**

| Reason | Log | Binder |
|---|---|---|
| `misplaced` / `duplicate` | Retained forever | Excluded |
| `removed` / `replaced` | Retained forever | Included as house history ("furnace present until 2027") |

Same outcome, honest mechanism. This mirrors the existing N/A reason discipline, where `none-present` means *confirmed absent is real data* — the reason **is** the data.

## 5. Vocabulary — four streams, never collapsed

| Stream | What it is | Feeds |
|---|---|---|
| **Gaps** | Unresolved items, `na` with `feedsGapList` | Visit-two plan. Never becomes a concern — a missing photo isn't a problem with the house |
| **Findings** | Failed checks + confirmed absences. **Not synonymous with problems** | Condition assessment |
| **Triggered flags** | Specialist assessments the inspection tripped | Referral list |
| **Concerns** | Tracked things needing attention | Dashboard, project register |

**"Concern," not "issue."** "Issue" asserts a defect and carries quasi-legal weight; the concierge doesn't assess. "Concern" says this was noticed and is being tracked — true, and claims nothing more. Client-facing and schema use the same word.

**A failed check creates a concern**, with the check recorded as its origin. This is not the auto-flag pattern we rejected: choosing "foil flex" records a *fact* (the hazard implication is a judgment, so it prompts and doesn't impose), but tapping **Fail** *is* the judgment — the human already made it. Automating this removes a step currently asked of the inspector at hour three; the app already prompts "drop an issue pin where it lives" and relies on memory.

## 6. What is deliberately excluded

**No condition grading on objects.** "Condition: poor" is a professional judgment a concierge cannot defend and a homeowner may act on. The component checklist already produces a better condition record: `wh.fittings` across four visits reads `pass, pass, pass, fail` — a comparable story a grade cannot tell. Objects need their component answers preserved across visits, which the session-plan import supplies.

## 7. Consequences per app

**Field app:** concern as an entity with uuid identity · zone-owned and object-owned concerns · floating concerns with reassignment (mirrors `MediaReassigned`) · hypothesis links · retirement reason codes · `monitor`/`fine` flags retire · failed check spawns a concern · object-scoped checklist view (a filter on the existing `group` key, not new machinery) · canvas renders two entity types and must distinguish them visually.

**Binder builder:** owns concern state and lifecycle · adopts field IDs · consumes retirement reasons for inclusion decisions · §18 project register holds coordination · emits the session plan carrying open concerns with their IDs.

**Manifest breaks cleanly to v4.** Concerns become a fifth media-owner kind needing a path segment. No dual support — v3 has exactly one real export and it is archived. The append-only event log does **not** break; new event types are additive.

**Known silent breakage:** Table D declares the `issues` layer as `flag = issue`. Promoting concerns to entities empties that predicate with no error. Fixed in the master in the same pass.

## 8. Recursive canvas — deferred, not dropped

An object's photo becoming its own canvas with concern pins on it is the strongest idea in the model: *here is your water heater, and here are the three things marked on it.* It is also the most structurally expensive — canvas ownership must become zone-or-object, and anchors must bind concerns as well as pins. Both are the most load-bearing event types in the model. Additive and doable; sequence it last.

## 9. Build order

1. `.unit` photo items — master content, no code, **before the walk** (a photo not taken cannot be retrofitted)
2. Object-scoped checklist view — a filter, ~1 day, independent of everything else, addresses the reported overwhelm
3. Retirement reason codes
4. Concern entity + zone concerns + manifest v4
5. Failed check → concern
6. Recursive canvas

## 10. Dashboard cautions (carried, for whoever builds it)

- **Count only what's yours.** Identified is yours. Coordinated is yours. Fixed is the trade's. "34 concerns identified, 28 resolved through coordinated trades" is true and still impressive; "we fixed 28 things" is not.
- **Watch the incentive.** A metric counting concerns found rewards finding more. Frame as stewardship record, not scorecard.
- **A well-maintained house is a success.** After three years of good stewardship the numbers should *fall*. If the headline metric is concerns found, the best outcome looks like the worst. At least one metric must grow with time rather than problems — visits completed, months of continuous documentation, systems under active watch.

---

**Status:** v1 ratified. Changes come through the owner as v2, never invented by either session.
