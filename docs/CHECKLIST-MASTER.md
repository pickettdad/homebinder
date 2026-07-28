# HouseSteady Field Assistant — Checklist Master (v1.11)

**Version:** v1.11 · **Date:** 2026-07-28 · **Supersedes:** v1.10 (2026-07-28)
**Governance:** this file is a **governed cross-app contract** — see §10. Field is custodian; the binder builder and the equipment registry are consumers with ratifying interest on named surfaces.
**What this is:** the source-of-truth content for v2's verification checklists — the human-editable master that `scripts/gen-checklists.mts` generates config from. Never edited downstream.


**Authored from:** v1.5.1, per the whole-file transfer rule.


**Changelog v1.5 → v1.5.1** (housekeeping + alias content, applied 2026-07-27):
- **Removed a duplicate `Authored from:` line.** v1.5 carried both a stale `v1.3.1` (inherited from v1.4) and the correct `v1.4.1`. That field exists to prevent version confusion, so contradicting itself is the one defect it cannot have. Authoring by script caused it.
- §0 title and vocabulary-table range corrected (`A–D` → `A–E`).
- **Table E authoring rule added, and 24 aliases rewritten or added.** Prompted by a defect the field session found *inside v1.5's own fix*: `air-conditioner` was authored id-style, so a person typing "air conditioner" with a space still found nothing — the exact failure G7 reported, reappearing one layer down. Separators are now solved in code (hyphen, underscore and space normalize to one thing); what code cannot solve is a **genuinely different word**, which is what the new rows address.




**Changelog v1.6 → v1.6.1 — v1.6 was never built. It carried three defects, all in the same class.**

The field session reviewed v1.6 before building and found that **every one of its three problems was a case of the prose asserting something the machine-read tables did not say.** That is worth naming as a class, because it is not a typo class — it is the authoring failure this file is most prone to.

**1. `mechanical-base` was inherited by nothing.** §1's diagram said "inherited by every zone type." The list's own header said it. **§4's Inherits column — the only place the generator reads — was byte-identical to v1.5.1.** Zero of thirteen zone types listed it, while §6's `utility` had been emptied. Result: mechanical items render **nowhere**, in every house, with no build error. That is the v1.6 bug made universal instead of basement-only. **Fixed: `mechanical-base` added to all thirteen Inherits cells.**

Also corrected: §6's prose claimed *"that attribute, not the zone type, is what brings `mechanical-base` in."* That is not how the engine works. **Inheritance attaches the list; the attribute gates the items inside it.** Both are needed, and describing one as replacing the other is what produced the defect.

**2. Base lists could not carry sub-headings.** `mechanical-base` arrived with 24 items under six authored sub-headings (Heating & air / Water / Drainage / Electrical / Fuel / Close-out) — but the generator only parsed bold sub-headings inside §6 zone sections. In a base list they would be dropped, collapsing 24 items into one rendered group with **20 core — 2.5× the ≤8 cap §2 sets for itself**, and destroying the accordion grouping that made the checklist tolerable in the first place. **Fixed in code by the field session** (sub-headings allowed in base lists; group key falls back to the base id). §0 now documents the dialect so it is not re-broken.

**3. `defaults true for utility` had nowhere to live.** Table B carried one boolean per attribute, so the note parsed as plain `yes` and the default silently vanished — every zone including `utility` would start unchecked. **Fixed: Table B gains a fourth column, `defaults true for`.** Data-driven; the alternative was hardcoding "utility" in app code, which breaks config-is-data.

**4. `pin.*` is now rejected at session scope.** The field session found that `pin.*` evaluated at session scope *already* means house-wide, so adding `house.*` would have left one namespace meaning two things depending on where it was evaluated — the exact ambiguity §3 exists to prevent. **No session item uses `pin.*` today, so the restriction is free now and would not be later.** `pin.*` is zone-only and the validator rejects it at session scope; `house.*` is the house-wide form.

**Count reconciliation:** component types **58** and `.unit` items **23** match exactly across both sessions' parses — same file, same reading. Items differ (345 rows vs 377 unique ids) and the two sessions should reconcile directly rather than either guessing; the likely difference is table rows in §5/§6/§7 versus unique ids across base + zone + session + component lists. Recorded in §9.








**Changelog v1.10 → v1.11 — the last two provenance candidates, and the distinction that resolved them.**

v1.10 deferred `fp.sweep` and `irr.test-record` pending a judgment: *is the record the tag, or the reading of it?* **The deferral dissolves, because v1.9's N/A semantics already answer it in both directions:**
- Tag present → photograph it; the provenance row is honest.
- No tag, owner's word only → the source resolves N/A `none-present`, and the value is **declared** unverifiable.

**Leaving them unsourced is the one option that records "I saw the tag" and "the owner told me" in the same field with no way to separate them** — precisely what Table I exists to stop.

**The distinction that makes this different from `wt.consumables` is worth keeping**, because it is what stops the boundary test collapsing into a coin flip:

| | shape | verdict |
|---|---|---|
| `wt.consumables` | An artifact value **and** testimony bundled in **one field** — "size and last change." No single photograph reaches the whole value. | **Excluded.** A row would assert a check nobody can perform. |
| `fp.sweep`, `irr.test-record` | **One** value that is **sometimes** evidenced. | **Included.** That is a resolution state, not a split — and the N/A path already models it. |

**Added:** `fp.sweep-tag` and `irr.test-tag` (photo, standard), with Table I rows. Both source items resolve N/A `none-present` when no tag exists, which is real data: the date came from the owner, and the record says so.

**Table I is now complete for the current library.** The §9.8 sweep opened in v1.9 is closed: seven values sourced, one deliberately excluded and recorded as such, none deferred.

**Changelog v1.9 → v1.10 — the §9.8 provenance sweep, resolved, plus the boundary test that made it resolvable.**

**The boundary test (field session, adopted into §2):**
> **Is there a single artifact a photograph could capture that would let someone else reach the same value?** Yes → Table I entry required. Partly, or the value includes testimony → **do not claim provenance.**

This is what keeps Table I meaning one thing. A provenance row on a value that is *partly* verifiable is worse than no row, because it asserts a check nobody can actually perform.

**Applied to the three §9.8 candidates:**
- **`pnl.service` and `pnl.brand` — in.** Both come off a panel label. `pnl.wide` locates the panel (a different item class) and `pnl.directory` photographs the circuit directory (a different artifact). Both values are insurance-relevant and both were unverifiable. **`pnl.label` added**, framed for what the dead-front-stays-on policy actually leaves visible: the manufacturer/rating label and the main breaker's amp marking, with the door open.
- **`wt.consumables` — deliberately out.** "Last change" is usually what the owner says. No photograph verifies testimony, and a provenance row implying the whole value is verifiable would be worse than none. **Recorded as an explicit exclusion in §9 so it is not re-swept later as an oversight.**

**Two further candidates surfaced by the test and left for the field to judge with the items in hand** (§9.8): `fp.sweep` ("last-sweep evidence noted") and `irr.test-record` ("last certification date if documented"). Both read a physical tag, both look like the same class as `pnl.service` — but both are phrased as *evidence noted*, and whether the tag or the concierge's reading of it is the record is a call worth making at the object rather than from here.

**One clarification added to Table I, from the field session's check.** Provenance is **co-visibility on the same pin**, not global existence. Their first implementation verified the source item existed *anywhere* in the config — under which a furnace nameplate would have satisfied a water heater's age. The invariant is that the photograph is taken **of the same object**, resolved across inheritance (`wsf.age → wt.nameplate` passes because the chain is walked, not because the id exists somewhere).

**And the unverifiable declaration must travel.** Where a source item resolves N/A `none-present`, that fact has to reach the consumer through the manifest. Dropped in an aggregation layer, the honesty is lost exactly where it was needed — an unverifiable value re-enters the fleet looking verified.

**Changelog v1.8 → v1.9 — derived-value provenance, and the two gaps it immediately found.**

v1.8's discussion produced a rule about derived values, stated in prose:

> A value derivable from **other values in the same record** must not be recorded — it can contradict its own inputs. A value derived from an **artifact by applying expertise** should be recorded, **because the source artifact is captured alongside it as the check.**

That last clause is an invariant, and the field session checked it. **It held for one of three items:**

| item | source artifact captured? |
|---|---|
| `wh.age` — decoded from serial | ✅ `wh.nameplate` |
| `ft.age` — "from data plate" | ❌ `fuel-tank` had **no plate item at all** — only `ft.wide`, a locating shot |
| `apw.hose-age` — "hose year if marked" | ❌ `app.nameplate` photographs the washer, not the hose |

**Nobody's data is wrong today, and that is the problem.** Those ages cannot be re-checked by anyone — not next year, not by a specialist, not by the homeowner. And it lands hardest on the consumer §10 names as unable to argue for itself: **an unverifiable install year enters the fleet aggregate looking identical to a verified one, and nothing downstream can distinguish them.** That is the permanent-corruption case, arriving quietly rather than as a visible break.

**Fixed three ways:**
1. **`ft.nameplate`** added to `fuel-tank` — data plate photographed. Core, because it is the source of a core value.
2. **`apw.hose-label`** added to `appliance-washer` — hose date code photographed where legible. Standard, and resolves N/A `none-present` when no date exists, which is itself real data: *the age is unverifiable* rather than silently unverified.
3. **New Table I — derived-value provenance.** The prose rule becomes a declaration site, per §2. **Any item recording a value transcribed or decoded from a physical artifact must have a Table I entry naming the item that photographs that artifact.** Parser-enforceable: the entry must exist, the source item must exist, and the source item must be a `photo`. That check would have caught both gaps at authoring time rather than two years into a series.

*Scope note:* v1.9 applies the rule to the three age items — the unambiguous cases. **Other candidates exist** (`pnl.service` and `pnl.brand` are read off a panel label; `wt.consumables` off the unit) and are recorded in §9 rather than swept in blind, because whether a choice or a note counts as "transcribed from an artifact" is a judgment the field should make with the items in front of it.

**Changelog v1.7.2 → v1.8 — the egress split. One item retired, four added.**

`liv.egress` read *"opens fully; size and sill height measured"* and recorded **one number**. A year later nobody knows which dimension it was. Split into four:

| new id | records |
|---|---|
| `liv.egress-opens` | check — window opens fully and stays open unheld |
| `liv.egress-width` | measure (in) — clear opening width |
| `liv.egress-height` | measure (in) — clear opening height |
| `liv.egress-sill` | measure (in) — sill height above finished floor |

**Why four and not three:** *"opens fully"* is a check, not a measurement, and folding it into a number leaves it homeless. **Why splitting matters beyond tidiness:** egress thresholds are **per dimension** — a minimum width, a minimum height, a minimum openable area and a maximum sill height are four different limits. One number cannot be tested against four, and the binder cannot report *which* dimension failed. That is the real argument, and it is stronger than "three numbers beat one."

**Openable area is deliberately NOT a fifth item.** It is derived from width × height. Recording a derived value creates a number that can disagree with its own inputs, and the binder can compute it from two measurements that cannot.

**`liv.egress` retires; it does not carry over to any of the four.** By §2's move-vs-redefine rule this is a redefinition, and it is a **worse case than `bth.toilet-secure`**: that id carried a pass/fail, and a pass/fail rendering against the wrong question is visibly a category error. This one carries a **number**, of now-unknown provenance — nobody can say which dimension a past reading measured. **A number carries false precision: it looks like data, so nothing about it invites doubt.** Recorded in Table F.

**Rendered under a sub-heading, so the cap holds.** Four core items added to `interior-base` would take its group from five core to eight — at the §2 cap, with no headroom. Under the authored sub-heading **Egress (sleeping rooms)** they form their own group of four, and interior-base's main group drops to four. Uses the base-list sub-heading machinery added in v1.6.1.

**Cost, stated plainly:** one tap becomes four, at one window per sleeping room. Proportionate for a life-safety item — and `liv.egress` was the **only** item in the master where a single `measure` carried more than one number, so this does not generalise into a wave of splits.

**Changelog v1.7.1 → v1.7.2 — Table H made honest, two units assigned, the meter decision deferred deliberately.**

- **Table H's prose contradicted its own table.** It asserted *"Every `measure` item declares its unit inline"* while five did not. That is the prose-vs-tables class living inside the table written to prevent it. Reworded to state what is true, with the exceptions named. The field session correctly declined to enforce the rule against an open question; it becomes enforceable when the last three are answered.
- **`liv.egress` and `sit.measurements` assigned `in`.** Both are lengths; the unit was never in doubt. That leaves three, not five.
- **Three moisture items stay unitless deliberately** — `int.moisture-suspect`, `rgh.moisture`, `wet.surround-moisture`. **The owner does not yet own a moisture meter**, and the unit cannot be declared before the instrument exists: %WME, %MC and relative 0–100 are different scales, and a wrong declaration corrupts the series exactly as Table H warns. See §9 — this is now a **purchasing decision with a permanent schema consequence**, not a content gap.
- **Count correction:** five unitless items, not six as v1.7 stated.
- **Emphasis removed from the thirteen §4 Inherits cells** (v1.7.1, folded in here). v1.7 authored the emphasis ban while the file violated it thirteen times — the ban caught it on first contact, which is the rule paying for itself immediately.

**Changelog v1.6.2 → v1.7 — governance, plus four stability fixes the governance made obvious.**

**1. §10 Governance added.** The master graduates from "Field's config" to a governed cross-app contract, alongside the Manifest Contract and the Object/Concern Model. Field remains custodian of the file, the validator, wording, ordering and gating ergonomics; the **binder builder** ratifies on named binding surfaces; the **equipment registry** is named as a third consumer that has no session and cannot argue for itself. Proposed by the builder session; three amendments from this side accepted there. Full statement in §10.

**2. Choice option values now carry the id lifecycle (§2, Table G).** Option values are the builder's `answer.*` condition vocabulary and the registry's query predicates. **They are never renamed — only retired and replaced**, exactly as item ids are, and retirements are recorded in **Table G**. A silent rename would break a downstream condition with no error, which is the same failure shape as an id rename breaking a cross-visit series.

**3. `.unit` and `.wide` are declared item classes (§2), not naming conventions.** The builder binds to them — `.unit` is the condition baseline, `.wide` is the locating photo. A suffix convention is prose pretending to be structure, which this file's own rule (§2, declaration sites) forbids. Now declared, so the parser can enforce them.

**4. New Table H — measure units.** Five units are in use inline (`in`, `psi`, `%RH`, `year`, `mm`). Declared, they cannot drift: `fc.width` recorded in mm on visit one and cm on visit five would corrupt the comparison series with **nothing able to catch it**, because every existing check compares the config to itself. Same failure class as the underscore corruption — see §9.
   *Flagged, not fixed:* six `measure` items carry **no unit at all** (`int.moisture-suspect`, `liv.egress`, `rgh.moisture`, `wet.surround-moisture`, `sit.measurements`, and moisture readings generally). Assigning them requires knowing what the actual instrument reads — %WME versus a relative scale — and guessing would corrupt the series in precisely the way Table H exists to prevent. Recorded in §9 for the field to answer from the instrument.

**5. No markdown emphasis in parsed cells (§0).** v1.6.1 authored `**mechanical-base**` inside Inherits cells, which forced an emphasis-stripper in the generator, which then ate the underscores in `has_stairs`, `has_plumbing` and `exterior_wall` and shipped three corrupted ids to main. Nothing caught it: the corruption was applied uniformly to both the ids and every reference to them, so the config stayed internally consistent. **Emphasis in a parsed cell is decoration for humans and a hazard for machines.**

**6. Three component types added** (`leak-sensor`, `humidifier`, `dehumidifier`) — the B5 set. These exist so the builder's maintenance conditions have pin types to reference: `house.leak-sensor` and the rest cannot resolve against a type that does not exist.

**Changelog v1.6.1 → v1.6.2 — one defect, and a rule change to stop its class.**

**The defect:** `mechanical-base`'s heading said *"Every item below is gated on `zone.has_mechanicals`."* Five of its six tables carry no trigger column. Measured on a generated config: **21 of 24 items ungated, 17 of them core.** With inheritance now universal (v1.6.1), every bedroom, hallway and bathroom would render all 24 mechanical items — a bedroom checklist demanding a furnace and a main water shutoff. v1.6 made the shutoff map vanish; v1.6.1 would have made it appear everywhere. Equally wrong, and it is the wall-of-items problem the accordion exists to prevent, reproduced in every room.

**The fix — a list-level gate, declared in the heading (§0).** `### mechanical-base — gated on zone.has_mechanicals`. Chosen over 21 identical trigger cells for three reasons, the third decisive:
1. Twenty-one duplicated cells are noise and drift row by row.
2. The gate is a property of the *list*, and the heading is where the master already states it.
3. **The Fuel items need `zone.has_mechanicals` AND `property.gas`. Trigger cells are `anyOf` only — an `allOf` of two refs is not expressible in a cell.** A list gate ANDs cleanly with each item's own trigger, so per-row gating could not have worked at all.

**The rule change, which matters more than the fix.** This was the **fourth** occurrence of one class: *the prose asserting something the machine-read tables did not say.* v1.6.1's status line named that class and then reproduced it twice inside the same revision. Naming a failure mode has demonstrably not prevented it.

So the rule is restated in a form that can be acted on rather than merely remembered:

> **When a structural fact ends up stated in prose, that is a signal the dialect is missing a place to declare it.** Prose is the symptom, not the cause. The response is not to write the fact more carefully in prose, nor to duplicate it into cells — it is to **add a declaration site** and move the fact there. Every structural claim must have exactly one parsed home.

The list gate is that response applied to this case: the gate lived in a sentence because the dialect had nowhere for a list-level condition to live. It does now.

**Changelog v1.5.1 → v1.6** — five changes, four of them from the binder session's reconciliation review.

**1. The §1 hole (their Q1) — the biggest defect found since G1.** Every mechanical item lived in the `utility` **zone type's** list. `basement` inherits none of them. So a bungalow with the furnace, panel and main shutoff in an open basement corner — most of the regional housing stock — produced an **empty emergency shutoff map**, silently, because the concierge sensibly created a `basement` zone rather than a `utility` one. Convention ("always make a utility zone") fails the first time mechanicals sit in the corner of a finished rec room.

Fixed two ways, belt and braces:
- **`mechanical-base`** — a new base list carrying every mechanical item, gated on the new attribute **`zone.has_mechanicals`** and inheritable by *any* zone type. `utility` sets the attribute true by default; a basement, garage, crawlspace or site zone sets it with one tap. **All ids are preserved** — this is a move, not a redefinition (§2), so the `utl.` prefix is now historical exactly as `liv.` is inside `interior-base`. Downstream bindings by item id are unaffected. This was the binder session's explicit confirm question; the answer is yes, ids carry.
- **`ses.shutoff-map`** — a session item asserting the §1 map is complete, evaluated house-wide at close regardless of how zones were named. Precedent: `ses.alarm-coverage` does exactly this for alarms.

*Consequence worth stating:* **zone type is now a labelling convenience and the attribute drives content.** That is the more honest model regardless of this bug.

**2. New `house.*` trigger namespace (their Q2).** `pin.*` is and remains strictly zone-scoped — "a pin of this type exists *in this zone*." The maintenance schedule needs "*this house* has a sump," which is a different question, and roughly a dozen of its conditions were written against the wrong one. `house.<pin-type>` = a pin of this type exists anywhere in this visit. Both are kept; both are real. **Not Table A** — those flags come from intake, declared before the visit, and sump presence is usually discovered during it.

**3. Two Table A flags added (their Q5), plus one flagged as incomplete.** `seasonal_vacancy` and `secondary_suite` are both already *asked on the intake form* and were never given a flag — the question was collected and the vocabulary never received the answer. Worth a sweep for others in that state. `flat_roof` is added because Master Spec §15's trigger table carries it, but **the intake form does not ask it** — recorded in §9 as an open item rather than shipped as a flag nothing can set.

**4. `dock` stub filled.** It was a stub *actively referenced* by `sit.shoreline`, so a waterfront property could produce a `dock` pin with no items behind it. Caught by their stub-exclusion question.

**5. New Table F — retirement lineage, structured.** §2 already requires a retirement to record where its content went; that was prose. The binder correctly treats a retired id as a **discontinuity** — the cross-visit series ends and never joins its replacement, because a false join is worse than an honest break. Structured lineage lets it show the thread without joining it: *"this series ends at v1.5 — the master records the content continuing as `wc.secure`."* Software still refuses the join; the human still gets the thread.

*Not added: `answer.*` triggers.* See §3.

**Why v1.5 exists — the emergency shutoff map is incomplete.**

The binder session hand-audited the real field export against Master Spec §1 and found eight gaps (G1–G8). Read together they are not eight unrelated misses: **six of the eight are the same hole.** §1 is the shutoff-and-control map — the page a homeowner opens when water is coming through the ceiling — and the library could not populate it. A water heater with no shutoff item, a septic system with no alarm, solar with no disconnect, a pool with no bonding disconnect, irrigation with no shutoff, a curb stop filed as a note on a basement pin.

v1.5 closes §1. Every entry on the Master Spec §1 shutoff list now has somewhere in this library to land.

**Changelog v1.4.1 → v1.5**

*New rule, §2 — the pin-vs-item test (from the G8 diagnosis, adopted as authored):*
> **Does the thing need its own position on the map? If someone must walk somewhere else to reach it, it is a pin, not an item.**

This is what caught G8: `wm.curbstop` was an item on the interior `water-main` pin, so it inherited a basement position — but the curb stop is at the street. Applied the other way, G1's water-heater shutoff is correctly an *item*: it is on or immediately at the unit, so it shares the unit's position.

*New component types (5):*
- **`curb-stop`** — G8. A site pin. `wm.curbstop` retires (redefinition, not a move: an item became an entity — per the §2 move-vs-redefine rule the id does not carry over).
- **`septic-alarm`** — G5. The alarm panel is typically at the house while the lids are in the yard; two positions, two pins.
- **`solar-inverter`** — G2, stub filled. Carries the DC and AC disconnects §1 needs.
- **`pool-equipment`** — G3, stub filled. Carries the electrical disconnect and the barrier check.
- **`irrigation-backflow`** — G4, stub filled. Carries the irrigation shutoff.

*New items on existing components (4):*
- **`wh.shutoff`** — G1. Water heater water shutoff **and** fuel/power isolation, in one item because the emergency sheet needs both. **The highest-priority single fix in this revision.**
- **`blr.switch`** — found while closing G1: the boiler had no emergency-switch item though the furnace has `fur.switch`. Same class of gap, same §1 line.
- **`sp.unit`** — G6 remainder. `sp.pit` photographs the pit interior, which is not a locating shot; §1 needs to find the sump.
- **`sp.breaker`** — found while closing G6: §1 lists "sump pump breaker and discharge." Discharge was covered by `sp.discharge`; the breaker was not.

*New zone items (2):* `sit.curbstop` (site, municipal-water trigger) · `utl.septic-alarm` (utility, septic trigger).

*New Table E — component aliases.* G7 reported no `air-conditioner` type. There is no missing type — `heat-pump` already serves AC condensers — but a concierge searching "air conditioner" finds nothing, which is a real defect in a type picker. Aliases are search-only synonyms that resolve to a canonical type. They never create a type, never appear in the manifest, and never carry items.

*G6/G7 partial-closure note:* the dry run analysed the pre-v1.4 config (266 items, 48 types). v1.4 had already added `fur.unit` and `wh.unit`, closing most of G6 before it was reported. Only the sump-pump half remained, and it is closed here.

*Carried forward, still open:* guidance text · monthly-scope coherence · seasonal mapping · remaining stubs · binder traceability · apartment/condo parked.

**Why this revision exists — two field findings from the 2-zone TestFlight walk:**

1. **There are no plumbing fixtures.** 52 component types and not one `toilet`, `sink`, `shower`, or `bathtub`. The owner had to freeform-enter the most common objects in a house.
2. **Only 4 of 52 types ask for a photo of the whole thing.** Nameplates, pits, and discharge points are captured; the object itself mostly isn't. A condition baseline you didn't photograph cannot be retrofitted next year.

Both are the same defect: the library was built from mechanical systems outward and never covered the ordinary. This version closes it.

**It also resolves the sub-type taxonomy that has been "awaiting telemetry" since v1.1.** The telemetry arrived: the owner freeform-entered plumbing fixtures, and nicknamed six kitchen appliances because `appliance` couldn't distinguish them. That is the signal the deferral was waiting for. Sub-types are now authored, not invented.

**Changelog v1.4 → v1.4.1** (owner adjudication 2026-07-26 — classification and rule only; **no cell value changes**):
- **`bth.toilet-secure` and `bth.tub-surround` reclassified from renames to retirements.** v1.4's changelog called them "re-pointed", which read as renaming an id — against the id-stability rule. They were in fact **redefined**: the old items were `check`/`action` physical tests; `bth.toilet` and `bth.fixtures` are `pin`/`evidence` linkage items. Restoring the old ids would let a past pass/fail test result render as satisfying a pin-linkage question — **false continuity, which is worse than an honest orphan.** Their content moved to `wc.secure` / `wc.base-dry` and `tub.surround` / `shw.surround`, exactly as `kit.dw-connection` → `apd.connections` did. All six v1.4 id departures are retirements.
- **New rule, §2: move keeps the id; redefine retires it.** The precedent cases are a different class — `liv.egress` and `bsm.finished-behind` *moved* (same question, same text, same attest, different list) and correctly kept their ids. Decidable at a glance, and it would have caught this at authoring time.

**Changelog v1.3.1 → v1.4**

*Schema:*
- **Component inheritance.** Component types may inherit another type's items, mirroring the zone-type inheritance already in §1. Declared in the heading: ``### `appliance-dishwasher` — inherits `appliance` ``. A sub-type carries every parent item plus its own. **Generator work required** — this is the mechanism flagged as "moderate, mirrors zone-type inheritance" in the §8 change-request.

*New component types (16):*
- **Plumbing fixtures (5, standalone):** `toilet` · `sink` · `shower` · `bathtub` · `laundry-tub`
- **Appliance sub-types (7, inherit `appliance`):** `appliance-refrigerator` · `appliance-dishwasher` · `appliance-range` · `appliance-range-hood` · `appliance-washer` · `appliance-dryer` · `appliance-microwave`
- **Water-treatment sub-types (4, inherit `water-treatment`):** `water-softener` · `sediment-filter` · `uv-sterilizer` · `reverse-osmosis`

*Whole-unit photo items (14 added):* `wh.unit` `fur.unit` `blr.unit` `hp.unit` `hrv.unit` `wt.unit` `wpt.unit` `gen.unit` `gd.unit` `fp.unit` `app.unit` `dk.unit` `ch.unit` `wlh.unit` — plus one on each new plumbing fixture. **Scoped deliberately, not blanket:** equipment, plus things whose condition visibly changes (deck, chimney, wellhead). Not added to `window`, `door`, `tree`, `register`, `cleanout`, `floor-drain`, `backwater-valve`, `vent-termination`, `receptacle-gfci` — a whole-unit shot of a receptacle serves nothing. Types that already carry one (`pnl.wide`, `wm.wide`, `gs.wide`, `ft.wide`, `sp.pit`, `rw.photo`, `sl.photo`, `ds.discharge`, `fd.photo`, `co.photo`, `bw.photo`, `fc.photo`, `cp.reference`) are unchanged.

*Zone items re-pointed to the new fixtures:* `bth.toilet-secure` **retired**, replaced by `bth.toilet` (pin) · `bth.tub-surround` **retired**, replaced by `bth.fixtures` (pin) · new `kit.sink` · new `lnd.tub`. *(v1.4 wrote these as `→` renames; corrected to retirements in v1.4.1 — see that changelog.)* The fixture's own items now carry the detail; the zone item just ensures the fixture gets pinned.

*Interim notes collapsed:* `wt.train` reworded — with sub-types real, the "type" half is the pin type; only position in the train remains. `app.type` reworded for the same reason and demoted to `standard` (the pin type now carries it).

*Table D — flagged, deliberately unchanged.* The `issues` and `monitor` predicates read `flag = issue` / `flag = monitor`. The Object/Concern model retires those flags, which will empty both layers silently. **They are left working as-authored** — changing them now breaks a layer that functions today, for an entity that doesn't exist yet. They must change in the same pass as the concern entity work. Recorded in §9.

*Carried forward, still open:* guidance text · monthly-scope coherence · seasonal mapping · stub components · binder traceability · apartment/condo parked.

---

## 0. Table dialect (for the generator — v1.11)

- Base/zone/session tables: `id | text | satisfy | tier | attest [| scope] [| trigger]`. Scope defaults to `[baseline]` where the column is absent.
- Component tables (§7): `id | text | satisfy | tier | attest`.
- **No markdown emphasis inside parsed cells (v1.7).** Ids, types, refs and option values are read literally. Bold or italic markers inside a parsed cell force the generator to strip them, and a stripper broad enough to remove emphasis has already proved broad enough to remove underscores from snake_case ids. **Emphasis belongs in prose, never in a cell the parser reads.**
- **List-level gate (v1.6.2).** A list heading may carry `— gated on <ref>`: `` ### `mechanical-base` — gated on `zone.has_mechanicals` ``. **Every item in that list is conditioned on that ref.** Where an item also carries a trigger cell, the effective condition is **`allOf(list gate, item trigger)`** — the cell's own `|` remains `anyOf` internally. This is the only way to express an AND of two refs; trigger cells cannot. Applies to base lists, zone lists and component lists alike. A list may carry at most one gate.
- **Bold sub-headings are permitted in base lists as well as zone lists** (v1.6.1). They are group keys; a base item with no sub-heading groups under the base id. `mechanical-base` relies on this — without it, 24 items collapse into one group of 20 core, 2.5× the §2 cap.
- **Component inheritance** is declared in the heading: ``### `child-type` — inherits `parent-type` ``. The child's rendered list is the parent's items followed by its own. Ids remain globally unique.
- Satisfy cell sub-parses:
  - pin types inline — `` pin `water-main` ``, alternatives `` pin `furnace|boiler|heat-pump` ``
  - measure units in parens — `measure (psi)`, `measure (year)`
  - choice options in parens, pipe-separated — `choice (ball|gate|other|unknown)`
- **Trigger cells:** `|` means anyOf; ids after the first inherit the prefix of the first (`property.gas|propane` ⇒ `property.gas` OR `property.propane`).
- Vocabulary tables (A–I at end): columns as declared per table. **Table E rows are `alias | canonical type` — aliases are free text (spaces, capitals, punctuation), never ids.**
- Malformed rows fail closed.

---

## 1. The two-axis model, plus one attachment point

Items attach three ways:
- **Zone items** — properties of the space (present from zone creation, composed by inheritance).
- **Component items** — properties of a thing (attach when a typed pin is created; travel with it). **Component types may themselves inherit** (v1.4).
- **Session items** — properties of the house or the visit as a whole (surface only in the session-close audit). Fewer than ten; an attachment point, not a third taxonomy.

**Zone inheritance:**
```
interior-base ──┬── living-space   (bedroom, living, dining, office, hall)
                ├── wet-space      (kitchen, bathroom, laundry) ── + wet-base
                └── unfinished     (basement, attic, crawlspace, garage) ── + rough-base
exterior-base ──┬── elevation
                └── site

mechanical-base ─── inherited by EVERY zone type; every item gated on
                    `zone.has_mechanicals`, so it renders only where the
                    mechanicals actually are — whatever the room is called
```

**Component inheritance (v1.4):**
```
appliance ──────┬── appliance-refrigerator · -dishwasher · -range
                ├── appliance-range-hood · -washer · -dryer
                └── appliance-microwave
water-treatment ┬── water-softener · sediment-filter
                └── uv-sterilizer · reverse-osmosis
```

## 2. Item semantics

**Tiers & rendering:** `core` surfaces loudly at the audit; `standard` lists quietly. Cap: ≤ ~8 core **per rendered group**. Every zone audit renders grouped; group keys are the inheritance source, the zone's own list (split by authored sub-headings where present), and each pin's component list. Satisfied groups collapse. Close is never blocked; unresolved state is recorded with the close note.

**Satisfy types:**
| type | satisfied by | records |
|---|---|---|
| `pin` | linking a pin of the named type(s) — new or existing | pinId |
| `check` | a plain confirmation | boolean + timestamp |
| `note` | free text | prose |
| `measure` | a numeric value with the declared unit | number + unit |
| `photo` | an image on the pin, or a zone-level image tagged to the item | mediaId |
| `choice` | selecting exactly one authored option | the option value |

**Choice discipline (amended v1.3.1):** options must be exhaustive for the realistic field cases, and **every choice carries an escape (`unknown`, `other`, or both) unless the option set is exhaustive *and* always determinable when the item is reachable.** The unreachable case already has its escape: the N/A path (`no-access`, `none-present`). An inspector who cannot determine a determinable-in-principle answer must be able to record *that*, not be forced into a wrong value.

*Escape-free by adjudication (2026-07-26):* `pnl.type` and `fc.orientation` — always determinable once you can see the thing. `att.access-honesty` and `crw.access-honesty` — `no access` **is** the answer, not an evasion; "unknown" would be incoherent, since the inspector always knows how far they went. Where `other` is selected, the UI should accept an accompanying note; where `unknown` is selected, it is a legitimate resolution and exports as such.

**Attest (always wins over satisfy kind):**
- `evidence` — the item is satisfied by something existing (nameplate photo, typed pin, entered value, an observable property). Matching evidence surfaces the item as *proposed* — one confirming human tap records it. Retiring the evidence reopens it.
- `action` — a **test** or an attestation of *what the inspector did*: satisfiable only by a deliberate human tap recording `pass | fail` (or the selected extent) + optional note. No software path may ever mark it. A *fail* prompts a concern so the finding lands on the canvas.

**Rendering rule (owner decision):** Documentation (`evidence`) and Tests (`action`) are separate sections in the zone panel and the close audit — never mixed. Tests are text-documented, not media-documented.

**Whole-unit photo items (v1.4):** ids ending `.unit` are the object's condition baseline — the whole thing, in place, framed so the same shot can be taken next year. Distinct from `.nameplate` (identity) and from close-ups of specific parts. Across visits these are what make condition comparable. Always `photo` + `evidence`.

**Id lifecycle — move keeps the id, redefine retires it (v1.4.1).** An item that *moves* to a different list but asks the same question, with the same text and the same `attest`, **keeps its id**; the prefix simply goes historical, and ids are opaque (`liv.egress`, `bsm.finished-behind`). An item that is *redefined* — a different question, or a different `attest`, even in the same slot — **retires**, and the replacement takes a new id. A retired id is never reissued for anything else. The reason is record continuity: a resolution recorded against a retired id becoming attached to a differently-meaning item is false continuity, and a stale test result silently vouching for something nobody checked is worse than an honest orphan.

**The pin-vs-item test (v1.5):** **does the thing need its own position on the map?** If someone must walk somewhere else to reach it, it is a **pin**. If it is on or immediately at another object, it is an **item** on that object's list. A curb stop is at the street while the main shutoff is in the basement — two positions, two pins. A water heater's shutoff is on the water heater — one position, so an item. Getting this wrong puts a thing on the emergency map at the wrong address, which is worse than omitting it.

**Derived values and their provenance (v1.9).** Two kinds of derived value, opposite rules:
- **Derivable from other values in the same record → do not record it.** Openable area is width × height; recording it creates a number that can contradict its own inputs, with no way to tell which side is wrong. The consumer computes it.
- **Derived from a physical artifact by applying expertise → record it, and name the artifact.** A serial-decoded install year is not reproducible downstream — decoding schemes are manufacturer-specific — so the field is the right place to record it. **What makes that safe is that the source artifact is captured alongside as the check**, and that is an invariant, not an assumption: **every item recording a value transcribed or decoded from an artifact must have a Table I entry naming the `photo` item that captures it.**

**Boundary test for Table I (v1.10):** *is there a **single artifact** a photograph could capture that would let someone else reach the same value?* **Yes → an entry is required. Partly, or the value includes testimony → do not claim provenance.** A row on a partly-verifiable value is worse than no row, because it asserts a check nobody can perform. Two shapes are easily confused and resolve oppositely:
- **An artifact value *and* testimony bundled in one field** — `wt.consumables` records size *and* last change; no single photograph reaches the whole value. **Excluded.**
- **One value that is *sometimes* evidenced** — `fp.sweep` reads a tag when a tag exists and the owner otherwise. **Included**, because that is a resolution state, not a split: the source resolves N/A `none-present` when no artifact exists, and the value is then *declared* unverifiable rather than silently so.

**Provenance is co-visibility on the same pin, not global existence (v1.10).** The source item must be capturable **on the same object**, resolved across component inheritance. A source item sitting on an unrelated component satisfies "exists" and still never gets photographed — under an existence-only check, a furnace nameplate would prove a water heater's age.

Without the entry the value is unverifiable forever — by the next visit, by a specialist, by the homeowner — while looking exactly as solid as a verified one. That is worst for the equipment registry (§10.3), which cannot distinguish the two and has no session to notice.

**Choice option values carry the id lifecycle (v1.7).** An option value is not display text — it is a **vocabulary another repo binds to.** The builder reads option values as its `answer.*` condition predicates; the equipment registry queries on them. So they follow the same rule as item ids: **never renamed, only retired and replaced**, with retirements recorded in **Table G**. Renaming `poly-B` to `polybutylene` would silently break every downstream condition matching the old string, with no error anywhere — the same shape as an id rename silently breaking a cross-visit series. Adding a new option is safe and needs no ceremony; changing or removing an existing one is a breaking change.

**Reserved item classes (v1.7).** Two id suffixes are **declared classes, not naming conventions**, because downstream consumers bind to them:
- **`.unit`** — a photograph of the whole object, in place, framed to be repeatable. The **condition baseline**: what makes year-over-year comparison possible. Always `photo` + `evidence`.
- **`.wide`** — a photograph framed to *locate* the object in its surroundings. The **locating shot**: what the emergency shutoff map and a returning operator use to find the thing.

An object may carry both (they answer different questions). Neither suffix may be used for anything else. This is declared rather than conventional because a suffix convention is prose pretending to be structure, which §2's declaration-site rule forbids — and the builder binds to both.

**Declaration sites (v1.6.2).** Every structural fact — what inherits what, what gates what, what defaults where — has **exactly one parsed home**, and prose never substitutes for it. Where this file states a structural fact in a sentence and nowhere else, that is a **defect in the dialect**, not a lapse in wording: the response is to add a declaration site (§0) and move the fact into it. Four consecutive revisions shipped this defect class before the rule took this form; writing it as "be careful" did not work.

**Retirement lineage (v1.6):** when an item retires because its content moved elsewhere, the successor ids are recorded in **Table F**, not only in prose. Software must not join a retired series to its successor — a false continuity is worse than an honest break, and the binder correctly treats a retired id as a discontinuity. Table F exists so a *person* reading a series that stops can find where it continued. **Every retirement records its successors, or `none` if the question was genuinely dropped.**

**States:** unresolved · satisfied (with evidence link) · **n/a** (reason from table C, optional note). "Confirmed absent" is real inspection data and exports in the manifest. `deferred` and `no-access` N/A land on the visit-two gap list.

**Suggestions:** deterministic zone-type priors and (Stage 2) RoomPlan candidates may propose pin types; on-demand AI may suggest when asked. Proposals touch `evidence` items only, and only as proposals. Never automatic per-photo classification.

## 3. Triggers

Closed vocabulary:
- **`property.*`** (Table A) — declared at intake, before the visit.
- **`zone.*`** (Table B) — an attribute of this zone, set at zone creation.
- **`pin.*`** — a pin of this type exists **in this zone**. Zone-scoped, strictly: **rejected by the validator at session scope** (v1.6.1). Before `house.*` existed, `pin.*` evaluated at session scope silently meant house-wide — one namespace with two meanings depending on where it was read, which is the ambiguity this section exists to prevent. No session item used it, so the restriction cost nothing to impose now and would not have stayed free.
- **`house.*`** (v1.6) — a pin of this type exists **anywhere in this visit**. House-scoped.

Combinators: allOf / anyOf / not.

**`pin.*` vs `house.*` — the distinction is which question is being asked.** A zone checklist asks *is there one here* (`pin.sump-pump` in the utility zone). A maintenance schedule asks *does this house have one* (`house.sump-pump`). Using the zone form for a house question silently under-fires; using the house form for a zone question over-fires. Neither is a superset of the other, which is why both exist.

*Timing note for implementers:* `property.*` and `zone.*` are stable once set. **`house.*` changes during a visit** as pins are created, so a house-triggered item can appear partway through. Stable at manifest time; the field UI should expect it.

**Deliberately absent: `answer.*`.** Conditions on a *recorded value* — `utl.drain-material-id in (clay, Orangeburg)` triggering a sewer camera, an elevated radon result triggering mitigation monitoring, `fc.width > 5` escalating a crack — are **not field-config triggers and will not be added.** Two reasons, and they point the same way: it needs an operator and a value rather than existence, which is materially more machinery; and **several of the inputs never exist in the field app at all** — a radon result arrives three months later, a permit date comes from a document. The field could never evaluate them, so a field-config item gated on one could never fire.

**That whole class belongs to the binder builder**, which holds every answer — field, lab and document — evaluates the condition once, and returns the resulting work as a carried item in the session plan. One evaluator, one namespace, no risk of the same condition resolving differently in two apps. It also fits Master Spec §15's *"customized, never blind"*: the schedule is re-derived each visit, so a crack that was 1.5 mm and is now 4 mm changes what the next visit carries.

**The field's narrow version of this stays, and is deliberately different.** §9.2's prompt-on-dangerous-value — selecting `foil flex` offers a pre-typed concern — is *in-visit concern raising*, not schedule derivation. It acts immediately, on a value the inspector just entered, and imposes nothing. Keeping the two apart is what stops one namespace meaning two things.

**Division of labour, stated once: the master declares vocabulary; the builder declares consequences.** The master says `utl.drain-material-id` can be `clay`. The builder says clay means a sewer camera at some interval. The prose notes in this file that name flag-worthy values (`poly-B`, `Orangeburg`, `underground`, `horizontal`) are **explanatory, not machine-read** — they tell a human why the value matters; they do not encode the downstream action.

## 4. Zone taxonomy

Typed zone + editable label; **labels are display-only and never drive logic.**

**Every zone type inherits `mechanical-base`** (v1.6.1). That is not a claim that every zone *has* mechanicals — every item in that list is gated on `zone.has_mechanicals`, so it renders only where the equipment actually is. **Inheritance attaches the list; the attribute gates the items.** Both are required; neither substitutes for the other. A house's mechanicals can be in a utility room, a basement corner, a hall closet, a garage, an attic, or outdoors on an elevation — and the checklist follows them rather than following what someone named the room.

| Type | Typical labels | Inherits |
|---|---|---|
| `utility` | mechanical room, furnace room | interior-base, rough-base, mechanical-base |
| `basement` | basement, cellar, rec room | interior-base, rough-base, mechanical-base |
| `crawlspace` | crawlspace | rough-base, mechanical-base |
| `attic` | attic, loft access | rough-base, mechanical-base |
| `kitchen` | kitchen, kitchenette | interior-base, wet-base, mechanical-base |
| `bathroom` | full bath, ensuite, powder room | interior-base, wet-base, mechanical-base |
| `laundry` | laundry, mudroom w/ washer | interior-base, wet-base, mechanical-base |
| `living-space` | bedroom, living, dining, office, den | interior-base, mechanical-base |
| `circulation` | hall, stairwell, entry, landing | interior-base, mechanical-base |
| `garage` | attached garage, carport | interior-base, rough-base, mechanical-base |
| `elevation` | north side, front, rear | exterior-base, mechanical-base |
| `site` | grounds, driveway, yard, shoreline | exterior-base, mechanical-base |
| `outbuilding` | shed, barn, workshop, boathouse | exterior-base, rough-base, mechanical-base |

## 5. Base checklists

### `interior-base`

| id | text | satisfy | tier | attest | scope | trigger |
|---|---|---|---|---|---|---|
| `int.canvas` | Zone has a canvas (plan scan or wide photos covering all walls) | check | core | evidence | baseline | — |
| `int.surfaces` | Ceiling, walls, floor scanned for stains, cracks, slope, separation | check | core | action | baseline | — |
| `int.moisture-suspect` | Any stain or suspect area metered and the reading recorded | measure | core | action | baseline, monthly | — |
| `int.windows` | Windows operated, locked, latched; seal-fog noted — pin defects | check | standard | action | baseline | — |
| `int.doors` | Doors operate, latch, no binding | check | standard | action | baseline | — |
| `int.receptacles` | Representative receptacles tested; every GFCI tripped and reset — pin failures as concerns | check | core | action | baseline | — |
| `int.lighting` | Switches and fixtures function | check | standard | action | baseline | — |
| `int.registers` | Supply/return registers unblocked, airflow confirmed — pin problem registers | check | standard | action | baseline | — |
| `int.alarms` | Smoke/CO alarms in this zone pinned (manufacture dates photographed) | pin `smoke-alarm\|co-alarm` | standard | evidence | baseline, monthly | — |
| `int.owner-quirks` | Anything the owner flagged in this room verified and captured | note | standard | action | baseline | — |

**Egress (sleeping rooms)**

| id | text | satisfy | tier | attest | scope | trigger |
|---|---|---|---|---|---|---|
| `liv.egress-opens` | Window opens fully and stays open without being held | check | core | action | baseline | `zone.sleeping` |
| `liv.egress-width` | Clear opening width | measure (in) | core | action | baseline | `zone.sleeping` |
| `liv.egress-height` | Clear opening height | measure (in) | core | action | baseline | `zone.sleeping` |
| `liv.egress-sill` | Sill height above finished floor | measure (in) | core | action | baseline | `zone.sleeping` |

*Four separate values because egress limits are per dimension. **Openable area is not recorded** — it is width × height, and a derived value that can disagree with its inputs is worse than no value. The binder computes it.*

### `wet-base`

| id | text | satisfy | tier | attest | scope |
|---|---|---|---|---|---|
| `wet.under-sink` | Every sink cabinet opened and inspected **while water runs**; meter if suspect | check | core | action | baseline, monthly |
| `wet.supply-stops` | Fixture shutoffs present, accessible, not weeping | check | standard | action | baseline |
| `wet.drain-speed` | Every drain run and flow observed | check | standard | action | baseline, monthly |
| `wet.fan` | Exhaust fan runs, tissue test passed, termination traced to exterior | check | core | action | baseline |
| `wet.caulk-grout` | Caulk and grout condition at all wet joints | check | standard | action | baseline |
| `wet.surround-moisture` | Tub/shower/backsplash surround metered | measure | core | action | baseline |

### `rough-base`

| id | text | satisfy | tier | attest | scope | trigger |
|---|---|---|---|---|---|---|
| `rgh.structure` | Visible framing, beams, posts, sill/rim inspected; movement noted | check | core | action | baseline | — |
| `rgh.foundation` | Foundation walls circuited; every crack pinned, measured, photographed with scale | pin `foundation-crack` | core | action | baseline | — |
| `rgh.comparison` | Comparison-photo positions established and pinned | pin `comparison-position` | core | evidence | baseline | — |
| `rgh.moisture` | Efflorescence, staining, damp lines metered | measure | core | action | baseline, monthly | — |
| `rgh.insulation` | Insulation type and depth recorded where visible | measure (in) | standard | action | baseline | — |
| `rgh.pests` | Droppings, frass, nesting, entry points | check | standard | action | baseline, monthly | — |
| `rgh.wiring-legacy` | Visible wiring types noted; knob-and-tube or aluminum flagged as concerns | note | core | action | baseline | — |
| `rgh.storage-hazard` | Fuel, solvent, paint storage conditions | check | standard | action | baseline | — |
| `bsm.finished-behind` | Concealed areas behind finished surfaces recorded as *not inspected* | note | core | action | baseline | `zone.finished` |

### `mechanical-base` — gated on `zone.has_mechanicals` (renders grouped by the sub-headings)

**Inherited by every zone type** (§4), and **gated at the list level in the heading above** — that gate is the authoritative declaration; this paragraph only explains it. The list renders only where the mechanicals actually are: utility room, basement corner, hall closet, garage, crawlspace, attic, or outdoors. `utility` sets the attribute true at creation (Table B); any other zone sets it with one tap.

*The Fuel table's items carry their own `property.*` triggers. Those AND with the list gate — a propane tank item fires only in a zone that has mechanicals **and** on a property that has propane. That AND is why the gate is at list level: a trigger cell cannot express it.*

*Ids retain the `utl.` prefix. That prefix is now **historical** — same as `liv.egress` inside `interior-base` and `bsm.finished-behind` inside `rough-base`. This is a **move**, so every id carries: downstream bindings by item id are unaffected.*


**Heating & air**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.heat-source` | Primary heat appliance pinned | pin `furnace\|boiler\|heat-pump` | core | evidence |
| `utl.heat-running` | Appliance observed running (thermostat called first) | check | core | action |
| `utl.venting` | Flue/venting traced from appliance to termination | check | core | action |
| `utl.combustion-air` | Combustion air provision present and unobstructed | check | core | action |
| `utl.vent-material` | Venting material and condition recorded | note | standard | evidence |

**Water**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.main-shutoff` | Main water shutoff pinned, photographed wide, tagged | pin `water-main` | core | evidence |
| `utl.pipe-material` | Supply pipe material photographed close-up | photo | core | evidence |
| `utl.pipe-material-id` | Supply pipe material identified | choice (copper\|PEX\|poly-B\|Kitec\|galvanized\|CPVC\|mixed\|unknown) | core | evidence |
| `utl.drain-material` | Drain/vent material photographed | photo | core | evidence |
| `utl.drain-material-id` | Drain/vent material identified | choice (ABS\|PVC\|cast iron\|clay\|Orangeburg\|copper\|mixed\|unknown) | core | evidence |
| `utl.pressure` | Static water pressure measured (gauge threads onto any hose bib) | measure (psi) | core | action |
| `utl.water-heater` | Water heater pinned | pin `water-heater` | core | evidence |

*Note: `poly-B`, `Kitec`, and `galvanized` are insurer and resale flags; `Orangeburg` and `clay` are sewer-camera triggers. The choice values are what make those flags queryable — the photo alone is not.*

**Drainage**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.sump` | Sump pump pinned if present | pin `sump-pump` | core | evidence |
| `utl.floor-drain` | Floor drain located, clear, trap primed | pin `floor-drain` | standard | evidence |
| `utl.backwater` | Backwater valve located or confirmed absent | pin `backwater-valve` | core | evidence |
| `utl.cleanout` | Sewer cleanout located | pin `cleanout` | standard | evidence |
| `utl.septic-alarm` | Septic/sewage-pump alarm panel pinned | pin `septic-alarm` | core | evidence |

*`utl.septic-alarm` resolves N/A `none-present` on municipal-sewer properties — a confirmed absence, which is real data. It is not trigger-gated because sewage-ejector alarms exist on municipal systems too.*

**Electrical**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.panel` | Main panel pinned; directory photographed | pin `electrical-panel` | core | evidence |
| `utl.panel-brand` | Panel make/model recorded; known-issue brands flagged | note | core | evidence |

**Fuel**
| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `utl.gas-shutoff` | Gas shutoff located and pinned | pin `gas-shutoff` | core | evidence | `property.gas` |
| `utl.sniffer` | Sniffer pass at accessible fittings completed | check | core | action | `property.gas\|propane` |
| `utl.fuel-tank` | Oil/propane tank pinned | pin `fuel-tank` | core | evidence | `property.oil\|propane` |

**Close-out**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.every-nameplate` | Every appliance in this room has a legible nameplate photo | photo | core | evidence |
| `utl.unidentified` | Anything unidentified pinned as freeform and chat-asked | check | standard | action |


### `exterior-base`

| id | text | satisfy | tier | attest | scope |
|---|---|---|---|---|---|
| `ext.wide` | Wide photo canvas covering the full elevation/area | photo | core | evidence | baseline |
| `ext.grade` | Grading slope away from foundation; standing water noted | check | core | action | baseline, seasonal:spring |
| `ext.cladding` | Cladding, trim, caulking condition | check | standard | action | baseline |
| `ext.penetrations` | Every wall penetration sealed | check | standard | action | baseline |
| `ext.foundation-ext` | Exterior visible foundation inspected; cracks pinned | pin `foundation-crack` | core | action | baseline |
| `ext.roofline` | Roofline captured by pole cam — slopes, valleys, flashing, edges | photo | core | evidence | baseline |
| `ext.terminations` | Every vent termination pinned and traced to its interior source | pin `vent-termination` | core | action | baseline |

## 6. Zone checklists

### `utility`

*No own items.* Every item formerly listed here moved to `mechanical-base` in v1.6 with its id intact.

A `utility` zone is an ordinary interior zone that **sets `zone.has_mechanicals` true by default at creation** (Table B). It inherits `mechanical-base` exactly as every other zone type does — **the type does not route the content; it only pre-answers the question.** Any other zone reaches the same list by ticking the same box.

### `basement`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `bsm.ceiling-wet-rooms` | Ceiling below every wet room above examined (pre-water-run look) | check | core | action |
| `bsm.windows-wells` | Basement windows and wells: drainage, security; egress if sleeping zone | check | standard | action |
| `bsm.humidity` | Humidity reading recorded | measure (%RH) | standard | action |
| `bsm.stairs` | Stair treads, rail, headroom, lighting | check | standard | action |

*(`bsm.finished-behind` moved to `rough-base` in v1.2 — fires in any finished rough zone.)*

### `kitchen`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `kit.sink` | Kitchen sink pinned | pin `sink` | core | evidence |
| `kit.appliances` | Every appliance pinned with its specific type | pin `appliance\|appliance-refrigerator\|appliance-dishwasher\|appliance-range\|appliance-range-hood\|appliance-microwave\|appliance-freezer` | core | evidence |
| `kit.hood-vent` | Range hood vents to exterior (not recirculating) — traced | check | core | action |
| `kit.counter-gfci` | Counter receptacles GFCI-protected | check | core | action |

*`kit.dw-connection`, `kit.fridge-line`, and `kit.fuel-range` retired in v1.4 — their content now lives on the appliance sub-types, where it belongs to the object rather than the room.*

### `bathroom`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `bth.toilet` | Toilet pinned | pin `toilet` | core | evidence |
| `bth.fixtures` | Sink, tub, and/or shower pinned | pin `sink\|bathtub\|shower` | core | evidence |
| `bth.fan-vs-window` | Ventilation adequate for the space | check | standard | action |

*`bth.toilet-secure` and `bth.tub-surround` retired in v1.4 (reclassified from "renamed" in v1.4.1) — their content now lives on the fixtures: `wc.secure`/`wc.base-dry` and `tub.surround`/`shw.surround`. Retired ids are never reissued.*

### `laundry`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `lnd.washer` | Washer pinned | pin `appliance-washer` | core | evidence |
| `lnd.dryer` | Dryer pinned | pin `appliance-dryer` | core | evidence |
| `lnd.dryer-duct` | Dryer duct pinned | pin `dryer-duct` | core | evidence |
| `lnd.tub` | Laundry tub pinned if present | pin `laundry-tub` | standard | evidence |
| `lnd.drain-standpipe` | Standpipe height and trap | check | standard | action |
| `lnd.floor-drain-pan` | Pan or floor drain present if above living space | check | standard | action |

*`lnd.hoses` retired in v1.4 — hose type and age now live on `appliance-washer`.*

### `living-space`

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `liv.fireplace` | Fireplace/stove pinned if present (N/A otherwise) | pin `fireplace` | standard | evidence | — |

### `circulation`

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `cir.stairs-rails` | Stair rails both sides, condition, lighting, contrast | check | core | action | `zone.has_stairs` |

### `garage`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gar.door-reverse` | Overhead door and opener pinned | pin `garage-door` | core | evidence |
| `gar.fire-separation` | House door self-closes and latches; separation intact | check | core | action |
| `gar.co-pathway` | CO pathway to living space assessed; alarm coverage | check | core | action |
| `gar.slab` | Slab condition, cracks, drainage | check | standard | action |
| `gar.storage` | Fuel/chemical storage; extension cords in permanent use | check | standard | action |

### `attic`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `att.access-honesty` | Extent of attic access achieved | choice (from hatch only\|partial traverse\|full traverse\|no access) | core | action |
| `att.vermiculite` | Vermiculite check — if present: STOP, photograph from hatch, disturb nothing, flag suspect ACM | check | core | action |
| `att.sheathing` | Sheathing condition captured: staining, frost, daylight | photo | core | evidence |
| `att.insulation-depth` | Insulation depth measured with ruler in frame | measure (in) | core | action |
| `att.duct-terminations` | Bath/kitchen/dryer ducts actually exit the attic | check | core | action |
| `att.ventilation` | Soffit/ridge/gable ventilation present and unblocked | check | standard | action |
| `att.pests` | Nesting, droppings, entry | check | standard | action |

*`att.access-honesty` is `action`, not `evidence`: it attests to how far the inspector actually went. Software must never infer it, and it is what the binder's "not inspected / not accessible" honesty label renders from.*

### `crawlspace`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `crw.access-honesty` | Extent of crawlspace access achieved | choice (from access point only\|partial entry\|full entry\|no access) | core | action |
| `crw.ground-cover` | Vapour barrier present and condition | check | core | action |
| `crw.standing-water` | Standing water, damp soil, drainage | check | core | action |
| `crw.ventilation` | Vents open/closed appropriately for season and type | check | standard | action |

### `elevation`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `elv.downspouts` | Every downspout pinned at its discharge point | pin `downspout` | core | evidence |
| `elv.hose-bibs` | Hose bibs pinned | pin `hose-bib` | core | evidence |
| `elv.windows-ext` | Windows/doors from outside: sills, flashing, seal fog | check | standard | action |
| `elv.deck` | Decks and steps pinned | pin `deck` | core | evidence |
| `elv.chimney` | Chimney pinned: cap, crown, flashing, mortar | pin `chimney` | core | evidence |
| `elv.service-entry` | Electrical service entry, mast, meter captured | photo | core | evidence |
| `elv.hvac-exterior` | AC/heat pump pinned: level, clearance, line insulation | pin `heat-pump` | core | evidence |

### `site`

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `sit.drainage-path` | Where water goes: swales, ditches, culverts | check | core | action | — |
| `sit.curbstop` | Municipal curb stop pinned if locatable | pin `curb-stop` | standard | evidence | `property.municipal_water` |
| `sit.wellhead` | Wellhead pinned: cap, grade, separations | pin `wellhead` | core | evidence | `property.well` |
| `sit.septic` | Septic lids and bed area pinned; surface condition | pin `septic-lid` | core | evidence | `property.septic` |
| `sit.septic-protection` | Bed area: nothing parked, built, or deep-rooted | check | core | action | `property.septic` |
| `sit.trees` | Trees overhanging structures pinned | pin `tree` | standard | evidence | — |
| `sit.retaining` | Retaining walls pinned: lean, drainage, condition | pin `retaining-wall` | standard | evidence | — |
| `sit.shoreline` | Shoreline/dock captured; erosion comparison positions established | pin `comparison-position\|dock` | core | evidence | `property.waterfront` |
| `sit.outbuildings` | Outbuildings identified; each gets a zone if substantial | check | standard | action | — |
| `sit.measurements` | Driveway/walkway dimensions captured | measure (in) | standard | action | — |

## 6b. Session items (session-close audit)

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `ses.shutoff-map` | Emergency shutoff map complete: every Master Spec §1 shutoff and control either pinned or explicitly recorded absent — water main, curb stop, gas, fuel, electrical, water heater, boiler, furnace switch, sump, septic/sewage alarm, solar disconnects, pool disconnect, irrigation, hose bibs, fireplace valve | check | core | action | — |
| `ses.alarm-coverage` | Alarm coverage judged against the pin set: smoke on every storey and outside sleeping areas; CO adjacent to sleeping areas where fuel-burning appliances, a fireplace, or an attached garage exist | check | core | action | — |
| `ses.below-recheck` | Ceilings below every wet room re-checked **after** all fixtures were run | check | core | action | — |
| `ses.termination-reconcile` | Every interior exhaust (bath fans, hood, dryer, HRV) matched to a pinned exterior termination | check | core | action | — |
| `ses.triggers-confirmed` | Intake-declared property flags confirmed or corrected on site | check | core | action | — |
| `ses.wood-heat-pinned` | Wood-burning appliance pinned and WETT flag recorded | pin `fireplace` | core | evidence | `property.wood_heat` |

*`ses.shutoff-map` is the safety net that survives any zone-naming choice — it is evaluated house-wide, so it fires whether the mechanicals were captured in a `utility` zone, a `basement`, or a garage. It is also a **human attestation sitting beside the builder's own audit of the same thing**: when the two disagree, one is wrong and neither is authoritative, which is exactly the disagreement worth surfacing rather than resolving silently.*

## 7. Component library

Dialect: `id | text | satisfy | tier | attest`. Inheritance declared in the heading.

### `water-heater`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wh.unit` | Whole unit photographed in place | photo | core | evidence |
| `wh.nameplate` | Nameplate photographed legibly | photo | core | evidence |
| `wh.age` | Install/manufacture year decoded from serial | measure (year) | core | evidence |
| `wh.tpr` | TPR valve present; discharge piped toward floor | check | core | action |
| `wh.fittings` | Fittings and base dry; no rust trails | check | core | action |
| `wh.venting` | Venting condition and connection | check | core | action |
| `wh.shutoff` | Water shutoff **and** fuel/power isolation located and photographed | check | core | action |
| `wh.pan` | Drain pan / location risk assessed | check | standard | action |
| `wh.ownership` | Ownership status | choice (owned\|rented\|unknown) | standard | evidence |
| `wh.anode` | Anode access noted | note | standard | evidence |

### `furnace`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fur.unit` | Whole unit photographed in place | photo | core | evidence |
| `fur.nameplate` | Nameplate photographed | photo | core | evidence |
| `fur.filter` | Filter size photographed; condition noted | photo | core | evidence |
| `fur.running` | Observed running through a heat call | check | core | action |
| `fur.condensate` | Condensate path/pump flowing | check | core | action |
| `fur.venting` | Venting condition and route | check | core | action |
| `fur.switch` | Emergency switch located | check | core | action |
| `fur.hx-area` | Visible heat-exchanger area condition | check | standard | action |
| `fur.service-tags` | Service-tag history photographed | photo | standard | evidence |

### `boiler`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `blr.unit` | Whole unit photographed in place | photo | core | evidence |
| `blr.nameplate` | Nameplate photographed | photo | core | evidence |
| `blr.pressure` | Operating pressure reading recorded | measure (psi) | core | action |
| `blr.relief` | Relief valve piped | check | core | action |
| `blr.venting` | Venting condition | check | core | action |
| `blr.switch` | Emergency switch and fuel shutoff located | check | core | action |
| `blr.expansion` | Expansion tank condition | check | standard | action |
| `blr.circulator` | Circulator condition/noise | check | standard | action |
| `blr.zones` | Zone valves/manifolds noted | note | standard | evidence |

### `heat-pump` (also serves AC condensers)
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `hp.unit` | Whole unit photographed in place | photo | core | evidence |
| `hp.nameplate` | Nameplate photographed | photo | core | evidence |
| `hp.level` | Unit level; clearance maintained | check | core | action |
| `hp.disconnect` | Service disconnect present | check | core | action |
| `hp.lineset` | Line insulation condition | check | standard | action |
| `hp.condensate` | Condensate handling | check | standard | action |
| `hp.snow` | Winter snow-clearance path noted | note | standard | evidence |

### `hrv-erv`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `hrv.unit` | Whole unit photographed in place | photo | core | evidence |
| `hrv.nameplate` | Nameplate photographed | photo | core | evidence |
| `hrv.filters` | Filters checked | check | core | action |
| `hrv.terminations` | Intake/exhaust terminations traced | check | core | action |
| `hrv.running` | Running/balanced observation | check | standard | action |
| `hrv.condensate` | Condensate drain flowing | check | standard | action |

### `electrical-panel`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `pnl.wide` | Location photographed wide | photo | core | evidence |
| `pnl.directory` | Directory photographed | photo | core | evidence |
| `pnl.label` | Manufacturer/rating label and main breaker amp marking photographed legibly (door open, dead front on) | photo | core | evidence |
| `pnl.brand` | Make/model recorded; known-issue brands flagged | note | core | evidence |
| `pnl.service` | Service size | choice (60A\|100A\|125A\|150A\|200A\|400A\|other\|unknown) | core | evidence |
| `pnl.type` | Overcurrent protection type | choice (breaker\|fuse\|mixed) | core | evidence |
| `pnl.exterior` | Dead-front on (policy: never removed); exterior condition — no heat, odour, corrosion | check | core | action |
| `pnl.clearance` | Working clearance in front | check | standard | action |
| `pnl.subs` | Subpanels noted | note | standard | evidence |

### `water-main`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wm.wide` | Photographed wide enough to locate | photo | core | evidence |
| `wm.type` | Valve type | choice (ball\|gate\|other\|unknown) | core | evidence |
| `wm.tag` | Valve tag installed | check | core | action |
| `wm.operate` | Operated if safe (ball, good condition); flagged if not | check | core | action |

*`wm.curbstop` retired in v1.5 — the curb stop is at the street, not at this pin. It is now the `curb-stop` component type. Redefinition, not a move: the id does not carry over.*

### `sump-pump`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sp.unit` | Sump located and photographed wide enough to find it | photo | core | evidence |
| `sp.pit` | Pit interior photographed | photo | core | evidence |
| `sp.bucket` | Bucket test run — pumps, discharges, shuts off | check | core | action |
| `sp.discharge` | Discharge route traced to exterior | check | core | action |
| `sp.breaker` | Sump breaker located | check | core | action |
| `sp.backup` | Backup pump/battery status | check | core | action |
| `sp.alarm` | High-water alarm present/tested | check | standard | action |
| `sp.lid` | Lid condition | check | standard | action |

### `well-pressure-tank`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wpt.unit` | Whole unit photographed in place | photo | core | evidence |
| `wpt.nameplate` | Nameplate photographed | photo | core | evidence |
| `wpt.settings` | Pressure switch settings recorded | note | core | evidence |
| `wpt.breaker` | Pump breaker located | check | core | action |
| `wpt.cycle` | Cut-in/cut-out observed | check | standard | action |
| `wpt.waterlog` | Waterlogging/short-cycling check | check | standard | action |

### `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wt.unit` | Whole unit photographed in place | photo | core | evidence |
| `wt.nameplate` | Nameplate photographed | photo | core | evidence |
| `wt.train` | Position in the treatment train recorded (order relative to other units) | note | core | evidence |
| `wt.settings` | Settings photographed | photo | core | evidence |
| `wt.consumables` | Consumable size and last change recorded | note | core | evidence |
| `wt.errors` | Error codes noted | note | standard | evidence |
| `wt.bypass` | Bypass located | check | standard | action |

*Use `water-treatment` only where the unit's function can't be determined. Where it can, use the sub-type below — that is what makes the regional equipment query possible.*

### `water-softener` — inherits `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wsf.salt` | Salt level checked; bridging checked | check | core | action |
| `wsf.age` | Install/manufacture year if determinable | measure (year) | core | evidence |
| `wsf.regen` | Regeneration schedule setting recorded | note | standard | evidence |
| `wsf.brine` | Brine tank condition; no standing water above salt | check | standard | action |

### `sediment-filter` — inherits `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sfl.cartridge` | Cartridge size and micron rating recorded | note | core | evidence |
| `sfl.changed` | Last change date recorded | note | core | evidence |
| `sfl.housing` | Housing condition; no weeping at the seal | check | standard | action |

### `uv-sterilizer` — inherits `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `uvs.lamp` | Lamp change due-date recorded | note | core | evidence |
| `uvs.alarm` | Alarm/indicator functioning | check | core | action |
| `uvs.sleeve` | Quartz sleeve condition noted | note | standard | evidence |

### `reverse-osmosis` — inherits `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `rov.membrane` | Membrane and pre/post filter change dates recorded | note | core | evidence |
| `rov.tank` | Storage tank condition | check | standard | action |
| `rov.drain` | Drain line connection and air gap | check | standard | action |

### `toilet`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wc.unit` | Fixture photographed whole | photo | core | evidence |
| `wc.secure` | Secure to floor; no rock | check | core | action |
| `wc.base-dry` | Base and surrounding floor dry; no staining | check | core | action |
| `wc.flush` | Flushes and refills correctly; no continuous run | check | core | action |
| `wc.stop` | Supply shutoff present, accessible, not weeping | check | core | action |
| `wc.supply-line` | Supply line type | choice (braided stainless\|plastic\|copper\|unknown) | standard | evidence |
| `wc.tank` | Tank internals condition | check | standard | action |

### `sink`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `snk.unit` | Fixture photographed whole | photo | core | evidence |
| `snk.stops` | Hot and cold shutoffs present, accessible, not weeping | check | core | action |
| `snk.trap` | Trap and drain connections dry; no corrosion | check | core | action |
| `snk.drain-flow` | Drains at a normal rate | check | core | action |
| `snk.cabinet` | Cabinet floor inspected while water runs; metered if suspect | check | core | action |
| `snk.faucet` | Faucet operates; no drip at spout or base | check | standard | action |

### `shower`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `shw.unit` | Enclosure photographed whole | photo | core | evidence |
| `shw.surround` | Surround condition; grout and caulk at all joints | check | core | action |
| `shw.drain-flow` | Drains at a normal rate | check | core | action |
| `shw.valve` | Mixing valve operates through its range | check | standard | action |
| `shw.door` | Door/curtain track and seals | check | standard | action |

### `bathtub`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `tub.unit` | Tub photographed whole | photo | core | evidence |
| `tub.surround` | Surround condition; grout and caulk | check | core | action |
| `tub.drain-overflow` | Drain and overflow function; no leak visible below | check | core | action |
| `tub.faucet` | Faucet and diverter operate | check | standard | action |
| `tub.support` | Tub support/deck condition where visible | check | standard | action |

### `laundry-tub`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `ltb.unit` | Tub photographed whole | photo | standard | evidence |
| `ltb.stops` | Shutoffs present, not weeping | check | standard | action |
| `ltb.drain` | Drains at a normal rate | check | standard | action |

### `smoke-alarm` / `co-alarm` (shared items)
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `alm.date` | Manufacture date photographed from back | photo | core | evidence |
| `alm.power` | Power source | choice (hardwired\|hardwired + battery backup\|battery only\|plug-in\|unknown) | core | evidence |
| `alm.test` | Test button — sounds | check | core | action |
| `alm.type` | Detector type | choice (smoke — ionization\|smoke — photoelectric\|smoke — dual sensor\|CO only\|combination smoke/CO\|heat\|unknown) | standard | evidence |
| `alm.interconnect` | Interconnection noted | note | standard | evidence |

### `gas-shutoff`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gs.wide` | Photographed wide enough to locate | photo | core | evidence |
| `gs.access` | Accessible, unobstructed | check | standard | action |

### `fuel-tank`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `ft.wide` | Tank photographed wide | photo | core | evidence |
| `ft.nameplate` | Data plate photographed legibly | photo | core | evidence |
| `ft.type` | Tank configuration | choice (above-ground indoor\|above-ground outdoor\|underground\|propane cylinder\|unknown) | core | evidence |
| `ft.age` | Manufacture year from the data plate | measure (year) | core | evidence |
| `ft.lines` | Lines and regulator condition | check | core | action |
| `ft.base` | Base/support condition | check | standard | action |
| `ft.fill` | Fill/vent configuration noted | note | standard | evidence |

*`ft.type = underground` is a material insurance and environmental flag and a soil-investigation trigger (Master Spec §13). It must be structured, never prose.*

### `fireplace`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fp.unit` | Appliance photographed whole, in place | photo | core | evidence |
| `fp.type` | Appliance type | choice (wood fireplace\|woodstove\|pellet stove\|gas fireplace\|gas insert\|electric\|decorative — non-functional\|unknown) | core | evidence |
| `fp.clearances` | Clearances to combustibles | check | core | action |
| `fp.wett` | Wood: WETT-class inspection flag recorded — never cleared by us | check | core | action |
| `fp.gas-valve` | Gas: valve located | check | core | action |
| `fp.chimney` | Associated chimney/flue pinned | pin `chimney` | standard | evidence |
| `fp.sweep-tag` | Sweep/service tag photographed if present | photo | standard | evidence |
| `fp.sweep` | Last sweep/service date recorded | note | standard | evidence |

### `dryer-duct`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `dd.material` | Duct material photographed | photo | core | evidence |
| `dd.material-id` | Duct material identified | choice (rigid metal\|semi-rigid metal\|foil flex\|plastic\|unknown) | core | evidence |
| `dd.route` | Route and approximate length recorded | note | core | evidence |
| `dd.flap` | Termination flap operates | check | core | action |
| `dd.lint` | Lint condition | check | standard | action |

*`foil flex` and `plastic` are fire-hazard findings and should prompt a concern (offer, don't impose — §9.2).*

### `garage-door`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gd.unit` | Door and opener photographed | photo | core | evidence |
| `gd.beam` | Beam reversal tested | check | core | action |
| `gd.pressure` | Pressure reversal tested | check | core | action |
| `gd.opener` | Opener nameplate photographed | photo | standard | evidence |
| `gd.hardware` | Springs/cables visual | check | standard | action |
| `gd.release` | Manual release accessible | check | standard | action |

### `generator`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gen.unit` | Whole unit photographed in place | photo | core | evidence |
| `gen.nameplate` | Nameplate photographed | photo | core | evidence |
| `gen.transfer` | Transfer switch located | check | core | action |
| `gen.fuel` | Fuel source | choice (natural gas\|propane\|diesel\|gasoline\|dual-fuel\|unknown) | core | evidence |
| `gen.exhaust` | Exhaust clearance from openings | check | core | action |
| `gen.log` | Exercise log noted | note | standard | evidence |

### `foundation-crack`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fc.photo` | Photographed with scale in frame | photo | core | evidence |
| `fc.width` | Maximum width measured | measure (mm) | core | action |
| `fc.orientation` | Crack orientation | choice (horizontal\|vertical\|diagonal\|stepped\|map/random) | core | evidence |
| `fc.activity` | Active vs. historical indicators assessed | check | core | action |
| `fc.moisture` | Damp/efflorescence at crack | check | core | action |
| `fc.comparison` | Comparison position established | pin `comparison-position` | core | evidence |

*Orientation is diagnostic, not cosmetic: horizontal cracks in a foundation wall indicate lateral pressure and are a different severity class from vertical shrinkage cracks. Structured value = the binder can sort by it.*

### `comparison-position`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `cp.reference` | Reference photo taken | photo | core | evidence |
| `cp.subject` | What it monitors recorded | note | core | evidence |
| `cp.interval` | Re-shoot interval recorded | note | core | evidence |
| `cp.framing` | Framing note for repeatability | note | core | evidence |

### `wellhead`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wlh.unit` | Wellhead photographed whole, with surroundings | photo | core | evidence |
| `wlh.cap` | Cap condition and seal | check | core | action |
| `wlh.grade` | Grade slopes away | check | core | action |
| `wlh.separation` | Separation from septic/fuel/drainage assessed | check | core | action |
| `wlh.casing` | Casing condition | check | standard | action |
| `wlh.record` | Well-record cross-reference noted | note | standard | evidence |
| `wlh.freeze` | Freeze protection noted | check | standard | action |

### `septic-lid`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sl.photo` | Photographed with landmark for relocation | photo | core | evidence |
| `sl.condition` | Lid condition and security | check | core | action |
| `sl.access` | Depth/access notes | note | standard | evidence |
| `sl.filter` | Effluent filter presence noted | note | standard | evidence |

### `downspout`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `ds.discharge` | Discharge point photographed | photo | core | evidence |
| `ds.distance` | Distance from foundation noted | note | core | evidence |
| `ds.extension` | Extension present/needed | check | standard | action |

### `hose-bib`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `hb.shutoff` | Interior shutoff located | check | core | action |
| `hb.type` | Bib type | choice (frost-free\|standard\|unknown) | standard | evidence |
| `hb.leak` | Leak/drip check | check | standard | action |

### `receptacle-gfci`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `rc.trip` | Tripped and reset | check | core | action |
| `rc.extent` | Protected circuit extent noted | note | standard | evidence |

### `window`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `win.operate` | Operates, locks, latches | check | standard | action |
| `win.seal` | Seal failure (fogging) noted | check | standard | action |

### `door`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `dr.operate` | Operates and latches | check | standard | action |
| `dr.seal` | Exterior seal/weatherstrip | check | standard | action |

### `deck`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `dk.unit` | Deck photographed whole from a repeatable position | photo | core | evidence |
| `dk.ledger` | Ledger attachment assessed | check | core | action |
| `dk.posts` | Post bases condition | check | core | action |
| `dk.rails` | Rail height; grab test | check | core | action |
| `dk.framing` | Framing condition | check | standard | action |
| `dk.stairs` | Stringers and treads | check | standard | action |

### `chimney`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `ch.unit` | Chimney photographed full height from the ground | photo | core | evidence |
| `ch.cap` | Cap and screen | check | core | action |
| `ch.crown` | Crown condition | check | core | action |
| `ch.flashing` | Flashing condition | check | core | action |
| `ch.masonry` | Masonry/mortar | check | standard | action |
| `ch.liner` | Liner type | choice (clay tile\|metal\|cast-in-place\|unlined\|unknown) | standard | evidence |

### `tree`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `tr.proximity` | Proximity to structures recorded | note | core | evidence |
| `tr.deadwood` | Deadwood/limbs over roof assessed | check | core | action |
| `tr.species` | Species recorded if known | note | standard | evidence |
| `tr.lean` | Lean or root heave | check | standard | action |

### `floor-drain`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fd.photo` | Located and photographed | photo | core | evidence |
| `fd.trap` | Clear; trap primed | check | standard | action |

### `cleanout`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `co.photo` | Located and photographed | photo | core | evidence |
| `co.access` | Accessible | check | standard | action |

### `backwater-valve`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `bw.photo` | Located and photographed | photo | core | evidence |
| `bw.service` | Service/operation history noted | note | standard | evidence |

### `vent-termination`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `vt.source` | Identified and traced to interior source | check | core | action |
| `vt.condition` | Flap/screen condition | check | standard | action |

### `register`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `reg.airflow` | Airflow confirmed | check | standard | action |

### `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `app.unit` | Appliance photographed whole, in place | photo | core | evidence |
| `app.nameplate` | Nameplate photographed | photo | core | evidence |
| `app.age` | Manufacture year if determinable | measure (year) | standard | evidence |
| `app.type` | Descriptive note where the sub-type doesn't fit | note | standard | evidence |
| `app.function` | Condition/function observation | check | standard | action |

*Use a sub-type below wherever one applies. Bare `appliance` is for anything the library doesn't yet cover — and freeform use of it is the telemetry that tells us which sub-type to add next.*

### `appliance-refrigerator` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apr.water-line` | Water line type and shutoff located (if plumbed) | check | core | action |
| `apr.seals` | Door seals condition | check | standard | action |
| `apr.coils` | Coils accessible and reasonably clear | check | standard | action |

### `appliance-dishwasher` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apd.airgap` | Air gap or high loop present | check | core | action |
| `apd.connections` | Supply and drain connections dry | check | core | action |
| `apd.base` | No staining at the base or in the adjacent cabinet | check | core | action |

### `appliance-range` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apg.fuel` | Fuel type | choice (natural gas\|propane\|electric\|induction\|dual-fuel\|unknown) | core | evidence |
| `apg.anti-tip` | Anti-tip bracket present | check | core | action |
| `apg.shutoff` | Gas: shutoff accessible behind the unit | check | core | action |
| `apg.connector` | Gas: flexible connector condition | check | standard | action |

### `appliance-range-hood` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `aph.vent` | Vent configuration | choice (ducted to exterior\|recirculating\|unknown) | core | evidence |
| `aph.fan` | Fan operates through its speeds | check | standard | action |
| `aph.filter` | Filter condition | check | standard | action |

### `appliance-washer` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apw.hoses` | Supply hose type | choice (braided stainless\|rubber\|unknown) | core | evidence |
| `apw.hose-label` | Hose date code photographed where legible | photo | standard | evidence |
| `apw.hose-age` | Hose year, from the date code | measure (year) | standard | evidence |
| `apw.stops` | Shutoffs present and accessible | check | core | action |
| `apw.pan` | Drain pan present if above living space | check | standard | action |

### `appliance-dryer` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apy.fuel` | Fuel type | choice (electric\|natural gas\|propane\|heat-pump\|unknown) | core | evidence |
| `apy.duct` | Dryer duct pinned | pin `dryer-duct` | core | evidence |
| `apy.gas-shutoff` | Gas: shutoff accessible | check | standard | action |

### `appliance-microwave` — inherits `appliance`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `apm.mount` | Mounting secure (over-range units) | check | standard | action |
| `apm.vent` | Vent configuration if over-range | choice (ducted to exterior\|recirculating\|n/a — countertop\|unknown) | standard | evidence |

### `dock`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `dck.unit` | Dock photographed whole from shore, from a repeatable position | photo | core | evidence |
| `dck.type` | Dock type | choice (fixed/crib\|floating\|pipe/removable\|cantilever\|unknown) | standard | evidence |
| `dck.decking` | Decking, fasteners and hardware condition | check | core | action |
| `dck.attachment` | Shore attachment and anchoring condition | check | core | action |
| `dck.season` | Current seasonal state | choice (in water\|removed for season\|permanent\|unknown) | standard | evidence |
| `dck.permit` | Shoreline/dock permit documentation noted | note | standard | evidence |

*Filled in v1.6 because it was a stub **actively referenced** — `sit.shoreline` names it as a pin alternative, so a waterfront property could produce a `dock` pin with nothing behind it. `dck.unit` is a repeatable-position shot: shoreline and dock condition are the Master Spec §10 comparison case.*

### `leak-sensor`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `lks.unit` | Sensor photographed in place | photo | core | evidence |
| `lks.covers` | What it protects recorded (which fixture or appliance) | note | core | evidence |
| `lks.type` | Sensor type | choice (standalone alarm\|hub-connected\|integrated with automatic shutoff\|unknown) | core | evidence |
| `lks.power` | Power source and battery state | choice (battery\|plug-in\|hardwired\|unknown) | standard | evidence |
| `lks.test` | Tested (per manufacturer method) | check | standard | action |

### `humidifier`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `hum.unit` | Unit photographed in place | photo | core | evidence |
| `hum.nameplate` | Nameplate photographed | photo | core | evidence |
| `hum.pad` | Pad/filter size recorded | note | core | evidence |
| `hum.water` | Supply line and drain condition | check | core | action |
| `hum.setting` | Humidistat setting recorded | note | standard | evidence |
| `hum.season` | Damper/bypass seasonal position | choice (winter/open\|summer/closed\|no damper\|unknown) | standard | evidence |

### `dehumidifier`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `deh.unit` | Unit photographed in place | photo | core | evidence |
| `deh.nameplate` | Nameplate photographed | photo | core | evidence |
| `deh.drainage` | Drainage method | choice (gravity to drain\|condensate pump\|bucket — manual\|unknown) | core | evidence |
| `deh.draining` | Draining correctly; no standing water at the unit | check | core | action |
| `deh.setting` | Humidistat setting recorded | note | standard | evidence |
| `deh.filter` | Filter condition | check | standard | action |

### `retaining-wall`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `rw.photo` | Photographed along its run | photo | core | evidence |
| `rw.lean` | Lean/bulge and drainage weeps assessed | check | core | action |

### `curb-stop`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `cs.photo` | Located and photographed with a permanent landmark in frame | photo | core | evidence |
| `cs.access` | Accessible — not paved over, buried, or obstructed | check | core | action |
| `cs.key` | Whether a curb key is required, and where one is | note | standard | evidence |

*The municipal shutoff, at the street. Distinct from `water-main` (the interior valve) because they are in different places and a homeowner in a flood needs the right one. Recording it as "noted if known" on the interior pin — the v1.4.1 arrangement — put it at the wrong address.*

### `septic-alarm`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sa.photo` | Alarm panel located and photographed | photo | core | evidence |
| `sa.test` | Alarm tested (test button) | check | core | action |
| `sa.silence` | Silence/reset control located | check | core | action |
| `sa.breaker` | Pump breaker located | check | core | action |
| `sa.meaning` | What the alarm indicates, recorded for the emergency sheet | note | standard | evidence |

*Separate from `septic-lid`: the panel is typically at or in the house, the lids are in the yard. Two positions, two pins — the §2 test.*

### `solar-inverter`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sol.unit` | Inverter photographed in place | photo | core | evidence |
| `sol.nameplate` | Nameplate photographed | photo | core | evidence |
| `sol.dc-disconnect` | DC disconnect located | check | core | action |
| `sol.ac-disconnect` | AC disconnect located | check | core | action |
| `sol.rapid-shutdown` | Rapid-shutdown device and label present | check | standard | action |
| `sol.storage` | Battery storage present | choice (none\|battery storage present\|unknown) | standard | evidence |
| `sol.esa` | ESA/inspection documentation noted | note | standard | evidence |

*Both disconnects are core because §1 needs them and because a first responder needs them. Solar is the one system where cutting the main does not de-energize everything.*

### `pool-equipment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `pol.unit` | Equipment pad photographed | photo | core | evidence |
| `pol.disconnect` | Electrical disconnect located | check | core | action |
| `pol.barrier` | Barrier and self-closing, self-latching gate operate | check | core | action |
| `pol.pump` | Pump nameplate photographed | photo | standard | evidence |
| `pol.heater` | Heater type | choice (natural gas\|propane\|electric\|heat pump\|none\|unknown) | standard | evidence |
| `pol.season` | Current seasonal state | choice (open/operating\|closed/winterized\|unknown) | standard | evidence |

*`pol.barrier` is core and is `action`: it is a life-safety test, and pool barrier requirements are municipal. **Confirmed present and operating — never assessed as compliant.** Compliance is an inspector's determination.*

### `irrigation-backflow`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `irr.unit` | Backflow device photographed | photo | core | evidence |
| `irr.shutoff` | Irrigation shutoff located | check | core | action |
| `irr.type` | Device type | choice (RPZ\|double check\|pressure vacuum breaker\|atmospheric vacuum breaker\|none observed\|unknown) | standard | evidence |
| `irr.test-tag` | Backflow test/certification tag photographed if present | photo | standard | evidence |
| `irr.test-record` | Last certification/test date recorded | note | standard | evidence |
| `irr.blowout` | Winterization/blow-out evidence noted | note | standard | evidence |

*Many jurisdictions require annual backflow certification. We record the date if documented; we never certify.*

### Stubs (ids reserved; items TBD in a later content pass)
`ev-charger` · `cistern` · `elevator-lift` · `outbuilding` · `radon-fan` · `backflow-preventer` · `boiler-zone-valve` · `appliance-freezer` · `iron-filter`

*Four stubs filled across v1.5–v1.6 (`dock` in v1.6 — it was referenced by `sit.shoreline`). Three filled in v1.5 (`solar-inverter`, `pool-equipment`, `irrigation-backflow`) — all three carried a §1 shutoff the library could not record. The remaining ten carry none, which is why they can wait.*

---

## A. Property flags (`property.*`)

| id | label | intake source |
|---|---|---|
| `municipal_water` | Municipal water | Water source |
| `well` | Private well | Water source |
| `municipal_sewer` | Municipal sewer | Sewage |
| `septic` | Septic system | Sewage |
| `gas` | Natural gas service | Fuel on property |
| `propane` | Propane on property | Fuel on property |
| `oil` | Oil on property | Fuel on property |
| `wood_heat` | Wood-burning appliance | Wood-burning appliance |
| `pool` | Pool or hot tub | Pool/hot tub |
| `generator` | Generator | Generator |
| `waterfront` | Waterfront/shoreline | Waterfront |
| `pre_1990` | Built before ~1990 | Year built |
| `solar` | Solar/battery | Solar/battery/EV |
| `ev` | EV charging | Solar/battery/EV |
| `seasonal_vacancy` | Seasonal or periodically vacant | Occupancy (v1.6) |
| `secondary_suite` | Secondary suite / in-law / rental unit | Secondary suite (v1.6) |
| `flat_roof` | Flat or low-slope roof section | ⚠ **not yet asked at intake** — see §9 |

*`seasonal_vacancy` drives Master Spec §16 departure, during-absence and return procedures. `secondary_suite` changes alarm coverage and egress requirements. Both were **already asked on the intake form** and had no flag — the question was collected and the vocabulary never received the answer. Worth a sweep of the intake form for others in that state.*

## B. Zone attributes (`zone.*`)

| id | label | askAtCreation | defaults true for |
|---|---|---|---|
| `finished` | Finished space | yes | — |
| `sleeping` | Used for sleeping | yes | — |
| `has_stairs` | Contains stairs | yes | — |
| `has_mechanicals` | Contains mechanical equipment (furnace, panel, water heater, main shutoff…) | yes | `utility` |
| `has_plumbing` | Contains plumbing | no (derived from pins/observation — **reserved**, not yet consumed) | — |
| `exterior_wall` | Has exterior wall(s) | no (**reserved**, not yet consumed) | — |

## C. N/A reasons

| id | label | note | effect |
|---|---|---|---|
| `none-present` | Confirmed absent | optional | Recorded as inspection data (a finding) |
| `no-access` | Not accessible today | recommended | Lands on visit-two gap list |
| `not-applicable` | Doesn't apply to this property/zone | optional | — |
| `deferred` | Deferred to visit two | optional | Lands on visit-two gap list |

## D. Layers

| id | label | predicate |
|---|---|---|
| `issues` | Issues | flag = issue |
| `monitor` | Monitoring | flag = monitor |
| `shutoffs` | Shutoffs & controls | types: water-main, gas-shutoff, fuel-tank, backwater-valve, electrical-panel, hose-bib, floor-drain |
| `alarms` | Alarms | types: smoke-alarm, co-alarm |
| `receptacles` | Receptacles | types: receptacle-gfci |
| `plumbing-fixtures` | Plumbing fixtures | types: toilet, sink, shower, bathtub, laundry-tub |
| `comparison` | Comparison positions | types: comparison-position, foundation-crack |
| `all` | All pins | — |

**⚠ `issues` and `monitor` are scheduled to break.** Both predicates read a pin flag that the Object/Concern model retires. They are **left unchanged here deliberately** — they work today, and rewriting them now would empty two layers for an entity that doesn't exist yet. They must be rewritten in the same pass that lands the concern entity: `issues` becomes "entity = concern", `monitor` becomes "concern severity = monitor". Failing to do so empties both silently, with no error. See §9.4.

## E. Component aliases (v1.5, expanded v1.5.1)

Search-only synonyms. An alias resolves to a canonical type in the type picker. **Aliases never create a component type, never appear in the manifest, and never carry items.**

**Authoring rule (v1.5.1) — write the alias the way a person says it out loud, not the way an id looks.** Separators are handled in code: hyphen, underscore and space all normalize to the same thing, so `heat-pump` is found by "heat pump" without an alias row. What code cannot do is guess a **different word** — "gutter" will never resolve to `downspout`, and "smoke detector" will never resolve to `smoke-alarm`, however the separators are treated. Those are the rows worth writing. Capitals and punctuation are also normalized, so `A/C` and `a/c` need only one row.

*This rule was earned: v1.5 authored `air-conditioner` in id style, so the one thing G7 asked for — that typing "air conditioner" finds something — still failed. The fix that recreates the bug it fixes is worth a written rule.*

| alias | resolves to |
|---|---|
| air conditioner | `heat-pump` |
| a/c | `heat-pump` |
| ac condenser | `heat-pump` |
| condenser | `heat-pump` |
| air handler | `furnace` |
| hot water tank | `water-heater` |
| hot water heater | `water-heater` |
| hwt | `water-heater` |
| breaker panel | `electrical-panel` |
| fuse box | `electrical-panel` |
| service panel | `electrical-panel` |
| main shutoff | `water-main` |
| water shutoff | `water-main` |
| curb valve | `curb-stop` |
| municipal shutoff | `curb-stop` |
| smoke detector | `smoke-alarm` |
| carbon monoxide detector | `co-alarm` |
| co detector | `co-alarm` |
| outlet | `receptacle-gfci` |
| plug | `receptacle-gfci` |
| gfi | `receptacle-gfci` |
| gutter | `downspout` |
| eavestrough | `downspout` |
| outdoor tap | `hose-bib` |
| garden tap | `hose-bib` |
| spigot | `hose-bib` |
| sillcock | `hose-bib` |
| propane tank | `fuel-tank` |
| oil tank | `fuel-tank` |
| septic tank | `septic-lid` |
| sprinkler | `irrigation-backflow` |
| sprinkler system | `irrigation-backflow` |
| hot tub | `pool-equipment` |
| spa | `pool-equipment` |
| solar panel | `solar-inverter` |
| pv | `solar-inverter` |
| genset | `generator` |
| transfer switch | `generator` |
| stove | `appliance-range` |
| oven | `appliance-range` |
| cooktop | `appliance-range` |
| fridge | `appliance-refrigerator` |
| washing machine | `appliance-washer` |
| exhaust fan | `appliance-range-hood` |
| hood fan | `appliance-range-hood` |
| softener | `water-softener` |
| uv | `uv-sterilizer` |
| ro | `reverse-osmosis` |
| wc | `toilet` |
| commode | `toilet` |
| lavatory | `sink` |
| vanity | `sink` |
| basin | `sink` |
| tub | `bathtub` |
| porch | `deck` |
| flue | `chimney` |

*New aliases are cheap; new types are not. **When freeform telemetry shows a repeated term, check whether an alias fixes it before adding a type** — a type carries items, appears in the manifest, and becomes a permanent vocabulary commitment. An alias is one row.*

## F. Retirement lineage (v1.6)

Where a retired item's content went. **Software must not use this to join a series** — a retired id is a discontinuity and stays one. This exists so a person reading a series that stops can find where it continued.

| retired id | version | successors | reason |
|---|---|---|---|
| `bth.toilet-secure` | v1.4 | `wc.secure`, `wc.base-dry` | Redefined: a check/action test became a pin/evidence linkage item when `toilet` became a component type |
| `bth.tub-surround` | v1.4 | `tub.surround`, `shw.surround` | Redefined: split across the new `bathtub` and `shower` types |
| `kit.dw-connection` | v1.4 | `apd.airgap`, `apd.connections`, `apd.base` | Content moved to `appliance-dishwasher` |
| `kit.fridge-line` | v1.4 | `apr.water-line` | Content moved to `appliance-refrigerator` |
| `kit.fuel-range` | v1.4 | `apg.fuel`, `apg.shutoff`, `apg.connector` | Content moved to `appliance-range` |
| `lnd.hoses` | v1.4 | `apw.hoses`, `apw.hose-age` | Content moved to `appliance-washer` |
| `liv.egress` | v1.8 | `liv.egress-opens`, `liv.egress-width`, `liv.egress-height`, `liv.egress-sill` | Redefined: one item recording one number for four different questions. Past readings are of unknown provenance — no successor may inherit the id |
| `wm.curbstop` | v1.5 | `cs.photo`, `cs.access`, `cs.key` | Redefined: an item became the `curb-stop` component type (pin-vs-item test — the curb stop is at the street) |

*One retirement in v1.8 (`liv.egress`). No retirements in v1.6. The `utl.*` mechanical items **moved** to `mechanical-base` and keep their ids, so none appear here.*

## G. Retired choice option values (v1.7)

Option values follow the item-id lifecycle (§2): never renamed, only retired and replaced. This table is where a downstream consumer finds what happened to a value its conditions used to match.

| item | retired value | version | replacement | reason |
|---|---|---|---|---|
| — | — | — | — | *No option values retired to date. This table exists so the first retirement has a home rather than being invented under pressure.* |

## H. Measure units (v1.7)

Units are declared inline on the item — `measure (psi)` — and this table is the closed set. **Three items are deliberately unitless and are listed below; every other `measure` item declares a unit.** **A unit is part of the item's identity: changing it is a breaking change, not a content edit.** A `fc.width` recorded in mm on visit one and cm on visit five would corrupt the comparison series, and **no existing check could catch it** — the drift gate, the schema validator and the round-trip test all compare the config to itself.

| unit | means | used by |
|---|---|---|
| `in` | inches | `rgh.insulation`, `att.insulation-depth` |
| `psi` | pounds per square inch | `utl.pressure`, `blr.pressure` |
| `%RH` | relative humidity, percent | `bsm.humidity` |
| `year` | four-digit calendar year (gated 1900–current) | `wh.age`, `ft.age`, `wsf.age`, `apw.hose-age` |
| `mm` | millimetres | `fc.width` |
| `in` | inches (lengths) | `liv.egress`, `sit.measurements` |

**Deliberately unitless (3), pending an instrument:** `int.moisture-suspect` · `rgh.moisture` · `wet.surround-moisture`. All three record a moisture-meter reading, and **the scale is a property of the meter, not of the checklist** — %WME, %MC and relative 0–100 are not interchangeable. Declaring one before the instrument exists would guarantee the corruption this table prevents. **Enforce the "every measure item declares a unit" rule once these three are answered, not before.**



## I. Derived-value provenance (v1.9)

Every item recording a value **transcribed or decoded from a physical artifact** names the `photo` item that captures that artifact. **Parser-enforceable:** the entry must exist, the source item must be a `photo`, and — the invariant that matters — **the source must be capturable on the same pin**, resolved across component inheritance. Global existence is not provenance: a source item on an unrelated component passes "exists" and is never actually taken. Without it, a recorded value can never be re-checked by anyone.

| item | value derived from | source artifact item |
|---|---|---|
| `wh.age` | Serial number, manufacturer-decoded | `wh.nameplate` |
| `ft.age` | Tank data plate | `ft.nameplate` |
| `apw.hose-age` | Hose date code | `apw.hose-label` |
| `wsf.age` | Nameplate or unit label | `wt.nameplate` *(inherited — resolves across the chain)* |
| `pnl.service` | Main breaker amp marking / rating label | `pnl.label` |
| `pnl.brand` | Panel manufacturer label | `pnl.label` |
| `fp.sweep` | Sweep/service tag date | `fp.sweep-tag` |
| `irr.test-record` | Backflow test tag date | `irr.test-tag` |

*Where the source item resolves N/A `none-present` — no legible date code on the hose, no readable plate — **the derived value is legitimately unverifiable, and recording that is real data.** It is the silent unverified value, not the declared one, that corrupts a series.*

***The declaration must travel.*** *An N/A-sourced value has to carry that fact through the manifest to every consumer. Dropped in an aggregation layer, an unverifiable value re-enters the fleet indistinguishable from a verified one — which is the exact failure Table I exists to prevent, reintroduced downstream of the fix.*

---

## 8. Deferred content passes

- **Guidance text** — the `guidance` field is authored in the schema and almost entirely empty. This is the layer that teaches a backup operator *why* an item matters and *how* to check it. Biggest remaining content task.
- **Monthly-scope coherence** — `scope: monthly` tags are seeded but the monthly list has never been reviewed as a standalone visit. Needed before the monthly visit can run on this engine.
- **Seasonal mapping** — Master Spec §15 seasonal lists not yet converted to items.
- **Stub components** — thirteen types reserved with no items.
- **Binder traceability** — no item currently carries its Master Spec section reference.
- **Apartment/condo** — parked: a unit-in-a-building inspection has a different envelope/common-element model and is not addressed by this master.
- **Further sub-types** — the taxonomy is now open rather than deferred. Freeform pin types and repeated nicknames remain the telemetry that says which type to add next.

## 9. Open decisions

1. **Choice escape values** — confirm the UI accepts a free-text note alongside `other`, and that `unknown` exports as a legitimate resolution rather than an unresolved item.
2. **Prompting on dangerous choice values** — `dd.material-id = foil flex|plastic`, `utl.pipe-material-id = poly-B|Kitec|galvanized`, `ft.type = underground`, `fc.orientation = horizontal`, `apw.hoses = rubber`. **Ruled: prompt, never impose.** Offer a pre-typed concern, one tap to accept, one to dismiss — and record the dismissal, so "we saw poly-B and chose not to raise it" is itself in the log. Reason: any answer that silently spawns work gets picked less often, and the whole value of `choice` is that the true answer is the cheapest to record.
3. **Choice vs. multi-select** — everything here is single-select. If a genuine multi case appears, it's a new type, not a widened `choice`.
4. **Table D layer rewrite** — must land with the concern entity, not before (see Table D note).
5. **Pin nicknames** — v1.4 removes most of the reason they existed: nicknames were covering for missing component types. Recommend keeping them through the next field walk, then reviewing whether they still earn their place. Don't retire them in the same pass that adds the types, or you remove the workaround and the gap together and can't tell which mattered.
6. **Intake form needs a question it does not ask.** `flat_roof` is declared in Table A because Master Spec §15's trigger table depends on it, but nothing sets it — the intake form has no flat/low-slope roof question. Add it there, or drop the flag; a flag no input can set is worse than an absent one. **And sweep the intake form the other way:** `seasonal_vacancy` and `secondary_suite` were asked for weeks and had no flag, which is how this class of gap hides.

7. **The moisture-meter decision — a purchase with a permanent schema consequence.** Three items (`int.moisture-suspect`, `rgh.moisture`, `wet.surround-moisture`) record a meter reading and stay unitless until an instrument exists. **The scale is set by the meter, and it is set once:** readings taken in %WME cannot be compared to readings in %MC or on a relative 0–100 scale, so switching instruments later corrupts every series retroactively. Decide the meter deliberately, declare its unit in Table H, and treat replacing it as a breaking change requiring a new item rather than a changed unit. *(A pinned meter reading %WME is the common inspection convention, but the choice is the owner's and the declaration follows the instrument, not the other way round.)*

8. **Table I sweep — closed (v1.11).** Seven values sourced. **One deliberate exclusion, on the record so it is never re-swept as an oversight:** `wt.consumables` bundles an artifact value and testimony in one field, so no single photograph reaches the whole value. `fp.sweep` and `irr.test-record`, deferred in v1.10, resolved into the table — they are one value *sometimes* evidenced, which the N/A path already models. **The invariant for any future item: if a recorded value can be read off something, name the photo of that something; if it can only sometimes be read off something, still name it and let N/A carry the honest case.**

*Note for whoever validates this: a check that enumerates the current provenance set fires on every legitimate addition. **State the invariant, not the inventory** — every item whose value is transcribed from an artifact has a row, and every row's source is a `photo` capturable on the same pin. That holds at seven rows and at seventy.*

9. **Sub-heading gates would remove a small duplication.** The four egress items each repeat `zone.sleeping` in their trigger cell. A list-level gate (§0) attaches to a `###` list, not to a bold sub-heading, so there is no way to gate a group. Four duplicated cells is tolerable; the pattern is worth watching if another sub-headed conditional group appears. Not worth new dialect for one case.

10. **Sweep for remaining prose-only structural claims.** v1.6.2 moved the last known one (the `mechanical-base` gate) into the dialect. **Anything else in this file that states a structural fact only in a sentence is an undetected instance of the same class.** Worth a deliberate pass by whoever next parses the file end to end — the generator sees the tables, so only a human reading the prose can find them, and only the parser can confirm they're absent from the config.

11. **Item-count reconciliation between sessions.** Component types (58) and `.unit` items (23) match exactly across both parses. The item total does not: 345 table rows vs 377 unique ids. Likely rows-in-§5/§6/§7 versus unique ids across base + zone + session + component lists. **The two sessions should reconcile directly with a per-section breakdown** rather than either adopting the other's number — a count that disagrees for an unexamined reason is a count neither should cite.

12. **The `answer.*` class is the binder's, and the binder must own its vocabulary too.** Conditions on recorded values are out of this file by design (§3). The builder reads this master's `choice` option values as its condition vocabulary — so **renaming or removing an option value is a breaking change for the builder**, not just a content edit. Worth the same care as an item id.

13. **§1 emergency-sheet coverage is the master's acceptance test.** Every entry on Master Spec §1's shutoff-and-control list must have somewhere in this library to land. v1.5 closes it; **any future component type should be checked against §1 before it is called done.** Remaining partial: propane appliance valves and oil-tank shutoff are covered only by `fuel-tank` generally, and a separate main electrical disconnect (where it exists apart from the panel) has no item. Both are candidates for v1.6 if the field shows they matter.

14. **Vocabulary — "pin" now means the marker, not the entity.** Per the Object/Concern design record: an Object has a pin; a Concern has a pin. This master says "pinned" throughout, which remains correct under that reading. Entity words are Object and Concern.

## 10. Governance (v1.7)

This file is a **governed cross-app contract**, alongside the Manifest Contract and the Object/Concern Model. Proposed by the binder session, amended and accepted here.

**Why.** The master was authored by Field because Field shipped first. But v1.5–v1.6.2's change log shows structural direction arriving from the consumer side: §1 as a standing acceptance test, the pin-vs-item rule, `mechanical-base`, the `house.*` namespace, three Table A flags. Field authored the custodial machinery — id lifecycle, Table F, aliases, validator, the declaration-site rule. That split is not accidental. **Development order ran Field → Builder; dependency order runs Builder → Field:** the Binder Schema defines done, this master defines what must be captured to reach it, the field UX defines how. The master sits at that joint, which is where the Manifest Contract sits.

**10.1 · Field is custodian.** The file, the validator, releases, item wording, ordering, tiering, gating ergonomics — everything that makes a visit runnable at hour three. None of that moves. **Pure content edits stay Field-autonomous**, subject to the standing acceptance tests.

**10.2 · Binding surfaces — edits route through the owner with builder review.** These are the parts where an edit is a breaking change downstream:
1. **Satisfy types** — a new one changes the resolution vocabulary
2. **Choice option values** — the builder's `answer.*` predicates and the registry's query vocabulary (§2, Table G)
3. **Item id lifecycle and Table F** — govern cross-visit joins and discontinuities
4. **Component types and inheritance** — the binding graph
5. **Trigger namespaces and Tables A/B** — shared with both builder schemas
6. **N/A reason semantics** — define the gap list and the findings stream
7. **`.unit` and `.wide` item classes** (§2) — condition baseline and locating photo
8. **Measure units** (Table H) — the longitudinal comparison backbone
9. **Table D layers** — the shutoffs layer *is* the §1 emergency map and the comparison layer *is* the §10 protocol; a predicate change silently changes a rendered binder artifact
10. **Attest semantics** — `evidence`/`action` ride in the manifest; a new class needs builder handling

**10.3 · Three consumers, and the blast radii differ in kind.**

| consumer | a bad change breaks |
|---|---|
| Field app | a visit |
| Binder builder | a binder |
| **Equipment registry** | **every client's longitudinal series, simultaneously and permanently** |

The registry reads component types (the fleet dimension), option values (the predicates), measure units (the comparison) and the `.unit`/nameplate photo classes (the evidence). It adds no surfaces beyond the ten above — but it raises the bar on four of them, because **it has no session and cannot argue for itself.** Renaming `water-softener` is not a two-app negotiation; it decides whether a fleet question is answerable in 2030.

**10.4 · Standing acceptance tests are a minimum, never a maximum.** §1 is the first: every shutoff entry must have somewhere to land. More will follow as the Binder Schema hardens. **The Binder Schema declares required capture; the master proves it can be captured — and may always capture more than the schema requires. It may never capture less.** The sub-type taxonomy arrived from freeform field telemetry, not from a binder expectation; Field discovers things the binder cannot anticipate, and the governance must not close that door.

**10.5 · Field keeps a real veto: "cannot reasonably capture."** The binder can require something the field cannot sensibly get at hour three. That answer routes back as a schema change or an explicitly recorded gap — **never a forced item.** The §1 partials still open (propane appliance valves, oil-tank shutoff, separate main disconnect) model this correctly: deliberately waiting on field evidence rather than guessed into existence.

**10.6 · What this does not change.** Field's autonomy over content, wording, ordering and UX · validator ownership · release cadence · **the manifest as the runtime boundary** — the master never ships to the builder at runtime; every import carries its own config snapshot and validation is per-import, fail-open on vocabulary · the owner as router on every cross-app change.

---

**Status:** v1.11 — **closes the Table I provenance sweep.** Seven values sourced (`wh.age`, `ft.age`, `apw.hose-age`, `wsf.age`, `pnl.service`, `pnl.brand`, `fp.sweep`, `irr.test-record`), one deliberately excluded and recorded as such, none deferred. Adds `fp.sweep-tag` and `irr.test-tag`. Carries v1.10's boundary test and co-visibility invariant, v1.9's Table I, v1.8's egress split, v1.7's governance (§10). **One id retired since v1.5 (`liv.egress`); no ids renamed; no option values retired ever.**

*Five stability rules share one cause — **a consistency check cannot catch a transformation applied uniformly.** Item ids, option values, measure units and derived-value provenance each needed a check against something external: the master's literal text, or a captured artifact. Corollaries earned across this run, each from a real failure: **a fix for that class must be tested on the class, not the instance** · **a number carries false precision** — a wrong pass/fail is visibly a category error, a wrong number just looks like a measurement · **an unverifiable value is indistinguishable from a verified one**, which is why provenance is an invariant and why the unverifiable declaration must survive aggregation · **existence is not provenance** — the artifact must be capturable on the same object · **proposing items is not separable from proposing where they render**, because the core cap is per rendered group · and **state the invariant, not the inventory** — a check that enumerates what exists fires on every legitimate addition.*
