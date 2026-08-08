# Checklist Master v1 — review (2026-07-22)

**What this is:** the implementation review of `docs/CHECKLIST-MASTER.md` (v1), requested
alongside Stage 0/1 planning. The master is committed **verbatim** — per its own editing
discipline, content edits belong to the owner. This file is the change-request list: what
to ratify, what to fix before config generation, and what the app schema must add that
the master doesn't (and shouldn't) specify.

**Overall verdict:** sound and implementable. The two-axis model matches REDESIGN-v2 §3
exactly; the taxonomy resolves REDESIGN-v2 §8's zone question the way the redesign doc
already leaned; the content is at the right altitude ("verify this," not "capture this").
Stage 1 builds against it. The items below are fixes and additions, not objections to the
structure.

---

## 1. Verdicts on §9 open decisions

1. **Two-axis model — RATIFY.** It is exactly REDESIGN-v2 §3's "creating a typed pin
   auto-attaches matching checklist items," with the zone-item side made explicit.
   Composition-by-inheritance (`interior-base` → `wet-base` → `bathroom`) maps cleanly to
   config generation; nothing in the engine plan resists it.

2. **`measure` and `photo` satisfy types — ACCEPT.** Both earn their place (`measure`
   feeds year-over-year comparison; `photo` marks items where the image is the
   deliverable). One semantic gap: several `photo` items are not tied to any pin
   (`utl.pipe-material`, `ext.wide`, `att.sheathing`). Satisfaction must accept **either**
   a photo on a linked pin **or** a zone-level photo tagged to the item. Stage 1's state
   model handles this (see PLAN-STAGE-1).

3. **Core cap at 5–8/zone — the cap as written is already broken by the master's own
   composition, so restate it.** A bathroom inherits 5 core items from `interior-base`
   + 4–5 from `wet-base` + 1 of its own ≈ 10 core before a single pin lands. The utility
   zone reaches ~24–27 core items once `interior-base` + `rough-base` + its own groups
   compose — 3–5× the stated cap. The cap is still the right instinct; it just applies at
   the wrong level. **Proposed restatement:** the cap is **per rendered group** (each base
   list, the zone's own list, and each pin's component list is a group of ≤ ~8 core
   items), and *every* zone audit renders grouped — the §6 note that only utility renders
   grouped should generalize. The anti-noise defense is then: per-group caps + collapsed
   satisfied groups + the core/standard split, not a per-zone total that composition
   arithmetic can't honor.

4. **Grouped audit rendering — ACCEPT, and generalize** (see 3). Grouping falls out of
   the data for free: inheritance source + pin identity are the group keys. No zone
   should render a flat list; utility is just the proof case.

5. **Zone-type + editable label — RATIFY.** Matches REDESIGN-v2 §8's "likely: type +
   editable label." One consequence the master already absorbs: labels are display-only
   and **must never drive logic** — which is why the `liv.egress` trigger is an erratum
   (below).

6. **`int.alarms` per-zone vs house-level — move the requirement check to a
   session-level audit; keep per-zone capture.** A 12-room house with a core alarm item
   in every room is the exact wallpaper failure §2 warns about. Proposed shape: pinning
   `smoke-alarm` / `co-alarm` stays per-zone (that's capture); the *coverage judgment*
   runs once at session close against the pin set + zone attributes, using the
   `int.alarms` guidance line as the authoritative rule — smoke on every storey and
   outside sleeping areas; **CO adjacent to sleeping areas** where fuel-burning
   appliances, a fireplace, or an attached garage exist. This needs a third attachment
   point — **session items** — which is an addition to the two-axis model (§3 below).
   With that in place, demote `int.alarms` to `standard` ("alarms in this zone pinned")
   or drop it.

---

## 2. Errata — fix in master v1.1 before config generation

Errata 1–6 and 9 will make the generator or the trigger engine fail closed; 7–8 produce
ambiguous runtime semantics rather than generation failures. None is controversial.

1. **`wet.under-sink` has `satisfy: core`** — a tier value in the satisfy column.
   Recommend `check` (the meter reading, when a stain is suspect, already lands under
   `int.moisture-suspect`); use `measure` instead if a per-sink reading is wanted.
2. **`property.gas` is not in the §3 trigger vocabulary**, but `utl.gas-shutoff` triggers
   on it and `utl.sniffer` on `property.gas|propane`. Add `property.gas` (natural gas
   service) to the property-flag list.
3. **`liv.egress` triggers on "label contains bedroom"** — string-matching a free-form
   label contradicts the master's own §4 decision that the label is display-only ("Mom's
   sewing room" may sleep a grandchild). Replace with a zone attribute set at zone
   creation: `zone.sleeping` (one tap: "used for sleeping?"). This same attribute feeds
   the session-level alarm-coverage audit (verdict 6).
4. **`liv.fireplace` ("present") and `cir.stairs-rails` ("stairs") use trigger values
   outside the §3 vocabulary.** These are *discovered-on-site* facts, not setup facts.
   Two clean options: add `zone.*` attributes (`zone.has_stairs`) asked at zone creation,
   or drop the trigger and rely on the N/A resolution path (§3.1 below) — a fireplace
   item that doesn't apply gets one tap of "N/A — none present." Recommend N/A for
   fireplace (rare), attribute for stairs (predictable at creation).
5. **`pin_type` must allow alternatives** — `utl.heat-source` satisfies on
   `furnace|boiler|heat-pump`. Schema §2 declares `pin_type: string`; make it `string[]`
   (any listed type satisfies).
6. **Pin types referenced but missing from §7:** `floor-drain`, `cleanout`,
   `backwater-valve` (all referenced by `utl.*` items — note §7's `backflow-preventer`
   stub is a *different device*, potable-water cross-connection, and does not cover
   `backwater-valve`). Add at least stub entries so generation doesn't dangle.
7. **Eighteen `satisfy: pin` items name no `pin_type`** — the full list:
   `int.windows`, `int.receptacles`, `int.registers`, `int.alarms`, `wet.supply-stops`,
   `wet.fan`, `rgh.foundation`, `rgh.comparison`, `rgh.wiring-legacy`,
   `ext.foundation-ext`, `ext.terminations`, `bsm.windows-wells`, `kit.appliances`,
   `kit.fridge-line`, `lnd.hoses`, `elv.service-entry`, `sit.retaining`,
   `sit.shoreline`. Several have obvious types already in §7 (`window`,
   `receptacle-gfci`, `retaining-wall`, `comparison-position`; `rgh.foundation` and
   `ext.foundation-ext` → `foundation-crack`, `rgh.comparison` → `comparison-position`);
   `int.registers` wants a new `register` type (stub it in §7 alongside erratum 6's).
   Fill them in, or mark the item as satisfied by *any* pin link. `int.alarms` is
   listed for completeness but is pending verdict 6's session-level move.
8. **Minor:** `int.registers` as `satisfy: pin` means a pin per register in every room —
   consider `check` with pins only for problem registers, or accept the pin noise
   deliberately (it does build the registers layer).
9. **`binder` is declared without the `?` optional marker in §2, but no §5/§6 table
   carries a binder column** and §7's prose has no binder marks — generation cannot
   populate a nominally required field. Mark it optional in v1.1 (Master-Spec
   traceability becomes a later content pass), or add binder columns when §7 is
   normalized to tables.

---

## 3. Additions the app schema needs (not defects in the master)

The master defines *content*; these are *runtime* semantics Stage 1 must add. Flagged
here so the master's next edit can stay consistent with them.

### 3.1 Item state model — N/A is first-class

Many items are conditional in prose ("if present," "if bedroom," "sump … if present").
Without an explicit not-applicable resolution, every such item nags forever and the
audit becomes wallpaper. Runtime states: **unresolved · satisfied (with evidence link:
pin / check / note / measure value / photo) · n/a (reason, optional note)**. N/A is a
recorded event like everything else — it appears in the manifest, and "confirmed absent"
is real inspection data (a backwater valve confirmed absent is a finding).

### 3.2 Session items — a third attachment point

Two-axis (zone + component) covers almost everything, but a few checks are properties of
the *house or the visit*, not any zone: the alarm-coverage judgment (verdict 6), and the
post-water-run re-checks (`wet.below-check`, `bsm.ceiling-wet-rooms` "post") which in a
free walk can't be sequenced by route order — the session-close audit is the only
gate that can hold them. Add a small `session` scope to the schema: items that surface
in the session-close audit rather than any zone's. Expected count: < 10 items; this is
not a third parallel taxonomy, just an attachment point.

### 3.3 Attestation class — the auto-satisfy safety rule

(From the owner's auto-tag note, generalized.) Add one field to the item schema:

- **`attest: evidence`** — the item is satisfied by something *existing*: a nameplate
  photo, a typed pin, a measured value. Software may **propose** satisfaction when
  matching evidence appears (a `water-heater` pin with a photo suggests its nameplate
  item), but a human tap always confirms.
- **`attest: action`** — the item asserts a human *performed* something: GFCI tripped
  and reset, sump bucket-tested, garage door reversal tested, valve operated, fan
  tissue-tested. **No software path may ever mark these** — not auto-tagging, not AI
  suggestions, not pin creation. Explicit human attestation only, every time.

Default: `action` (fail safe — an unlabeled item can't be auto-suggested). This is the
crisp mechanical rule for "serious items": seriousness isn't a judgment call at
suggestion time; it's authored into the master once, per item.

**Owner decision (2026-07-22): the two classes are also two separate LISTS.**
Documentation items (evidence) and test items (action — door reversal, GFCI trip/reset,
tissue test, bucket test, valve operation…) never render mixed in one list: the zone
checklist and the close audit show a **Documentation** section and a **Tests** section.
Tests are text-documented, not picture-documented: performing one records a
**result (pass / fail + optional note)** rather than expecting media; a *fail* prompts
an issue-flagged pin so the finding lands spatially. Master v1.1 should mark test items
explicitly (the `attest` column) so the split is authored, not inferred.

### 3.4 Auto-tag suggestions — where they fit without breaking Decision 2

REDESIGN-v2 Decision 2 is "AI on demand only … no automatic reviews," so photo-triggered
background AI tagging is out. Three suggestion sources fit within the decisions log:

1. **Deterministic, on-device, free:** zone-type priors (a pin created in a `utility`
   zone offers water-heater/panel/furnace first) — Stage 1; RoomPlan detected objects as
   auto-pin *candidates* (confirm/dismiss) — already Stage 2 scope.
2. **On-demand AI:** a "suggest type/tags" affordance on a photo or pin — one tap, runs
   through the same chat transport, returns suggested pin type + tags ("utility room,
   hot water tank, nameplate visible"). It's the user asking, so it's within Decision 2.
3. **Never:** automatic per-photo AI classification, however tempting the UX.

Suggestions interact with checklists only through §3.3: an accepted type suggestion may
surface "this pin could satisfy `utl.water-heater` — confirm?" for `evidence` items, and
must stay silent for `action` items.

---

## 4. Generation pipeline (how the master becomes config)

Per the master's own discipline (human-edited markdown → generated config, never edited
downstream), Stage 1 adds:

- `scripts/gen-checklists.mts` — parses the master's tables with a strict,
  fail-closed dialect matching what the master actually contains:
  `id | text | satisfy | tier [| scope] [| trigger]` — **scope columns exist only in
  the §5 base tables**; §6 zone tables omit scope (default `[baseline]`) and some add
  a trigger column. The satisfy cell needs sub-parsing: pin types ride inline
  (``pin `water-main` ``, alternatives ``pin `furnace|boiler|heat-pump` ``) and
  measure units ride in parens (`measure (psi)`), mapping to the schema's separate
  `pin_type`/`unit` fields. Emits `src/config/checklists.generated.ts` typed against
  a Zod schema (`ChecklistConfig`), with semver + content hash, mirroring
  `route.baseline.ts` discipline. Malformed tables **fail closed** with the
  offending line.
- CI drift check: regeneration must be byte-identical to the committed generated file
  (same pattern as `validate:config`).
- §7's component library is prose, not tables — normalize it to tables in master v1.1
  (each component item needs `id`/`satisfy`/`tier` for generation; the `[C]`/`[S]`
  marks already carry tier).
- **Not everything the runtime needs can come from v1's tables.** The §3 additions
  (`attest` per item, session items, zone attributes, N/A reasons) and the property
  flags (§3 prose today) have no home in the current table dialect. The v1.1 ask,
  beyond the §2 errata: add an optional `attest` column, a session-items table, and
  small tables for property flags / zone attributes / N/A reasons. Until then the
  generator's companion `overrides.ts` seeds them explicitly (each entry citing the
  review section it implements) — see PLAN-STAGE-1 §2.

## 5. Deferred (agreeing with the master's §8)

Monthly-subset coherence, seasonal mapping, stub components, and guidance text are
content passes, not build blockers. Stage 1 implements `scope` filtering so the monthly
pass is pure content work when it comes.

---

## 6. v1.1 intake review (2026-07-23)

Master v1.1 landed and **implements this review in full** — verified item-by-item
against v1 and the review: all 9 errata, the §1 verdicts (cap per rendered group,
grouped rendering generalized, alarm coverage at session level, `int.alarms` demoted),
`attest` on all 264 item rows, session items (5), and the vocabulary as authored tables
(A–D). The generator (`scripts/gen-checklists.mts`) parses v1.1 directly and the
config validates; the planned `overrides.ts` is unnecessary and was never created.
Everything below is a **change-request list for master v1.2** — the master stays
owner-edited, and none of it blocks generation.

### Dialect decisions the generator implements, pending §0 ratification

1. **Trigger-cell `a|b` shorthand** parses as `anyOf` with namespace-prefix
   inheritance: `property.gas|propane` ≡ anyOf(property.gas, property.propane);
   `—` = no trigger. §0 declares sub-parsing for the satisfy cell only — v1.2 should
   add this one line so the fail-closed claim is honest.
2. **Bold sub-headings are rendered-group keys** (items carry `group`). This is
   load-bearing for the cap: without it the utility zone list is a single 14–17-core
   group. The §2/changelog group-key formula ("inheritance source + pin identity")
   should gain "+ declared sub-headings". With it, no group exceeds 6 core (CI asserts
   ≤ 8).

### The one to fix soonest

3. **`elv.hose-bibs` — "one pressure-tested" is `evidence` and no `hose-bib`
   component item carries a pressure test.** Unlike the parallel cases (sump →
   `sp.bucket`, garage door → `gd.beam`/`gd.pressure`, deck → `dk.rails`, all action),
   the only record of this test in the whole system is an item software may
   propose-satisfy from pin creation — exactly what §3.3 forbids. v1.2: reword the
   zone item to "Hose bibs pinned" and add `hb.pressure` (check, action) — or flip
   the item to `action`.

### Silent content loss v1 → v1.1 (confirm or restore, then changelog)

4. `alm.location` [C] dropped from smoke/co-alarm — other components kept their
   locate-photo items (`wm.wide`, `gs.wide`, `pnl.wide`, `sl.photo`), and alarm
   locations feed `ses.alarm-coverage`'s judgment.
5. `cir.smoke-placement` (core) removed — plausibly subsumed by `ses.alarm-coverage`,
   but undocumented.
6. Window/door **"egress dimensions if bedroom [C]"** dropped, and `liv.egress` lives
   only in `living-space` — a sleeping basement rec-room or bunkie gets no core egress
   item (only standard `bsm.windows-wells`). Recommend moving `liv.egress` into
   `interior-base` with its `zone.sleeping` trigger (costs nothing where false).
7. Four standard fragments dropped in the §7 normalization: `receptacle-gfci`
   location, fireplace **chimney-linkage pin**, downspout **grading-tie**, tree
   species. The two cross-links have no v1.1 successor of any kind.
8. Changelog gaps: `ac-condenser` → `heat-pump` merge unmentioned; §8 claims
   "unchanged from v1" but drops the parked apartment/condo bullet.

### Minor consistency notes

9. **"Table E" dangles**: §0 says "§§ A–E", §2 says "reason from table E" — tables
   run A–D and N/A reasons are table C. (The generator anchors on real headings, so
   this misleads only human readers.)
10. Stale test language in three `evidence` zone items — `utl.sump` ("bucket-tested"),
    `gar.door-reverse` ("auto-reverse tested"), `elv.deck` ("grab-tested"). Each test
    IS separately gated by a core action component item, so the data has a backstop,
    but the zone item renders under Documentation while its text claims a test.
    Reword to pure pin-documentation text in v1.2.
11. Attest-direction inconsistencies (fail-safe direction, no data risk):
    `sit.shoreline`/`fc.comparison` are `action` while the equivalent
    `rgh.comparison` is `evidence`; `wh.anode`/`hp.snow` are notes marked `action`.
    Align or declare deliberate.
12. Unconsumed zone attributes: `finished` is asked at every zone creation and drives
    nothing (`bsm.finished-behind`'s "If finished:" is prose, untriggered — it nags in
    unfinished basements); `has_plumbing`/`exterior_wall` are declared but unused.
    Either trigger `bsm.finished-behind` on `zone.finished` or mark the attributes
    reserved.

---

## 7. v1.2 adjudication record (2026-07-23)

v1.2 landed and adjudicates §6; the generator regenerated **drift-clean on the first
parse** (v1.2.0, 265 items — the +1 is the restored `fp.chimney`). Rulings accepted as
final: egress → `interior-base` (any sleeping zone now carries the core item, id
retained); hose-bib remedy via `utl.pressure` as the test's single home (right call —
a per-pin `hb.pressure` would demand the test at every bib for a once-per-house
measurement); stale test verbs stripped from the three evidence items; table refs and
the group-key formula fixed; both generator dialect readings ratified as authored;
`alm.location` / `rc.location` / `cir.smoke-placement` rejected as intentional (the
pin's anchor is the location record; coverage lives in `ses.alarm-coverage`);
downspout↔grading deferred to the guidance pass.

**§6 items v1.2 did not adjudicate** (carried forward; none block anything):
- §6.11 attest-direction inconsistencies — `sit.shoreline`/`fc.comparison` are
  `action` while the equivalent `rgh.comparison` is `evidence`; `wh.anode`/`hp.snow`
  are notes marked `action`. Fail-safe direction, cosmetic only.
- §6.12 unconsumed zone attributes — `finished` is asked at every zone creation and
  drives nothing (`bsm.finished-behind` remains untriggered prose); `has_plumbing` /
  `exterior_wall` declared but unused.
- `tr.species` (dropped v1 fragment, unmentioned) and the v1 "apartment/condo —
  parked" marker, which now exists nowhere in the master.

---

## 8. Field-test-2 change-requests (2026-07-24)

Owner-originated; recorded here for the post-field-test content pass. Not acted on
unilaterally — the master is owner-edited and the component vocabulary is master content.

### 8.1 Component sub-type taxonomy — split broad types into specific ones (owner)

Standard home equipment should carry **specific, consistent component sub-types** rather
than one broad bucket, each opening its own checklist items:

- `water-treatment` → `water-softener`, `sediment-filter`, (RO unit, UV, etc.)
- `appliance` → `refrigerator`, `dishwasher`, `range`, `washer`, `dryer`, …

Rationale (owner):
1. **Consistency + right checks.** A softener wants salt-bridge / resin / regeneration
   items; a sediment filter wants cartridge/date items — different lists, same today's
   flat `water-treatment` can't express. Same for appliances.
2. **Field legibility.** Six pins reading `#N appliance` are indistinguishable in the
   audit (the immediate pain that prompted the nickname feature — nicknames are the
   stopgap; typed sub-types are the real fix).
3. **Regional fleet analytics (future HouseSteady play).** Specific types + captured
   ages let the business look across a region — "100 water softeners, ~15 of them ~15
   years old" — and broker a bulk-supplier deal that saves clients money. This only works
   if the type is specific and structured, not a freeform nickname.

**Process (config discipline):** the taxonomy is **not invented here**. It lands in the
master as a component **vocabulary table** during the content pass, with ids that are
never renamed/reused (same rule as every component id). The empirical input is the
**vocabulary telemetry** now specified in `PLAN-STAGE-1.md` §7: recurring **nicknames**
under one type are the concrete split signal, and recurring **freeform** types are the
"new type wanted" signal. So the sequence is: ship telemetry (Stage 1 step 7) → field use
accumulates real labels → content pass promotes the frequent ones into typed sub-types
with their own item lists.

**Cross-refs:** nickname/freeform manifest fields (`PLAN-STAGE-1.md` §7); the
type-scoped plan-anchor rule that will also read off these types (`PLAN-STAGE-2-NOTES.md`).

**Owner adjudication (2026-07-25) — sub-types INHERIT the parent's item list.** A
component sub-type does not restate its parent's items; it inherits them and adds only
its distinctive ones, mirroring the zone-type→base-list inheritance already in the master:

- `water-treatment` becomes a **base** component list: nameplate, position in train,
  settings, consumables, bypass.
- `water-softener` **inherits** that and adds only: salt level & bridging, resin age,
  regeneration cycle.
- `sediment-filter` inherits and adds: cartridge spec, change date.

Consequences (why this is the right shape): a split is **three or four new lines, not a
restated eight**; shared checks stay **byte-identical** across sub-types (no drift); and
**no split can silently drop a parent item** (inheritance guarantees the base is always
present). Vocabulary still lands in the master during the content pass, telemetry-driven —
not invented now.

**Generator effort (flagged per owner request): moderate, not trivial, low-risk.** No
component-list inheritance exists today — component lists are standalone (`genChecklists.ts`
parses `types` + `items` per heading; only *zone types* carry `inherits`). Adding it means:
(1) a `inherits?` field on `componentListSchema`; (2) the generator reads an "inherits"
annotation on a component heading, same dialect as the zone-type table's inherits column;
(3) `deriveComponentItems` walks the chain and composes parent-then-own items (dedup by id,
own wins), exactly as `deriveZoneItems` already composes base lists; (4) tests. The pattern
is established (zone-type inheritance), so this is a focused, well-bounded change to land
alongside the content pass — not a blocker, and nothing to build until the vocabulary is
authored.

---

## 9. v1.3 intake adjudication (2026-07-25)

v1.3 adds the `choice` satisfy type and converts 13 items off free-text `note`, splits 3
items into photo+choice pairs, adds `ft.type`, and structures 2 ages as `measure (year)`.
**Accepted as authored.** The diagnosis is right: `alm.power = "Direct power"` as prose is
a fixed enumerable answer stored where it can never be validated, queried, or aggregated.

Implemented this turn: `choice` in the schema (with `options`), `choice (a|b|c)` parsing in
the generator dialect, and a single-select control in the checklist panel. 270 items,
17 of them `choice`. Config regenerated; drift gate green.

### 9.1 Reconciliation — v1.3 was authored against v1.2, not v1.2.1

v1.3's header read "Supersedes: v1.2", and four v1.2.1 decisions arrived reverted or
broken. All four are **carried forward** (restored), annotated in the master's changelog.
None is re-litigated here; if any revert was deliberate, say so and it flips back.

| # | What | v1.2.1 | v1.3 as received | Action |
|---|---|---|---|---|
| 1 | `fc.comparison` attest | evidence | action | restored to evidence |
| 2 | `wh.anode` attest | evidence | action | restored to evidence |
| 3 | §8 apartment/condo parked marker | present | dropped | restored |
| 4 | Table B `askAtCreation` for `has_plumbing` / `exterior_wall` | `no (…)` | `reserved — …` | restored to `no (…)` |

(4) was not cosmetic: §0 requires `askAtCreation` to start with yes/no, so the generator
**failed closed** and v1.3 could not be built at all until the cell was restored. The other
two v1.2.1 attest flips (`sit.shoreline`, `hp.snow`) survived v1.3 unchanged.

### 9.2 Defect — six choice items violate the master's own escape rule

§2 "choice discipline" states options must "always include an escape (`unknown`, `other`,
or both)". Six authored items have none:

| item | options | reading |
|---|---|---|
| `pnl.type` | breaker / fuse / mixed | plausibly exhaustive |
| `fc.orientation` | horizontal / vertical / diagonal / stepped / map/random | a crack always has one |
| `gen.fuel` | natural gas / propane / diesel / gasoline / dual-fuel | plausibly exhaustive |
| `fp.type` | 7 appliance types | **an unknown is realistic** — a sealed insert with no visible plate |
| `att.access-honesty` | … / no access | `no access` is a real terminal answer, not an escape |
| `crw.access-honesty` | … / no access | same |

**Not enforced in code, deliberately.** A hard check would fail the build on the owner's
own content, and choosing between "add escapes" and "relax the rule" is a content decision.
Recommendation: relax §2 from *always* to *wherever the enumeration is not exhaustive*, and
add `unknown` to `fp.type` only. The two access-honesty items are correctly escape-free —
their whole point is that every outcome including "couldn't get in" is a real answer.

### 9.3 Verdicts on v1.3 §9 open decisions

**1. Choice escape values — confirmed.** The UI's note field is live alongside every choice,
and its placeholder changes to demand detail when an `other`-prefixed option is selected.
`unknown` records as a normal satisfied resolution with `evidence.value = "unknown"`, and
exports as such — it is a legitimate answer, not an unresolved item. See 9.2 for the six
items that offer no escape at all.

**2. Auto-flagging on dangerous choice values — agree: prompt, never impose.** Two reasons
beyond the adjudication-seat argument, both concrete:

- *The value and the finding are different records.* `dd.material-id = foil flex` is a fact
  about the duct. "This is a fire hazard requiring remediation" is a judgement about this
  house. Auto-creating the second from the first puts an assertion in the binder that no
  human made — and the binder is the liability document.
- *It would train the inspector to avoid the honest value.* Any selection that silently
  spawns work gets picked less often. The rule that makes `choice` worth having is that the
  true answer is always the cheapest one to record.

Implementation when it lands: offer the issue pin, pre-typed and pre-labelled, one tap to
accept and one to dismiss — and record the dismissal, so "we saw poly-B and chose not to
flag it" is itself in the event log. **Not built this turn** (no prompting exists yet in the
resolve flow); it is a small, well-bounded follow-up.

**3. Choice vs multi-select — agree, no action.** Nothing authored needs multi. Recorded so
the next person doesn't widen `choice` by reflex: widening it would silently change every
existing single-select resolution's value type from string to array. A new type is correct.

### 9.4 Note on `wh.age` / `ft.age` → `measure (year)`

Flagged in v1.3 as beyond the stated brief. **Endorsed.** A year is the only field the fleet
query can group on, and the retrofit cost is asymmetric in exactly the way the changelog
says. One caveat for the content pass: `measure (year)` has no validation that the value is
a plausible year — an inspector can type `19` or `2205`. Worth a range check when the
equipment registry is built; not worth blocking on now.

---

## 10. v1.3.1 adjudication record (2026-07-26)

Owner rulings on §9's open items, applied. Master bumped v1.3 → **v1.3.1**.

### 10.1 Escape values — rule amended, two cells changed

§2's "always include an escape" was **too absolute**, and the master violated it six times.
Amended to: *every choice carries an escape unless the option set is exhaustive **and**
always determinable when the item is reachable* — because the N/A path (`no-access`,
`none-present`) is already the escape for the unreachable case.

- `unknown` **added** to `fp.type` (sealed insert, no visible plate) and `gen.fuel`
  (unlabeled unit, buried supply line).
- **Left escape-free, by adjudication:** `pnl.type` and `fc.orientation` (always
  determinable once the thing is visible); `att.access-honesty` and `crw.access-honesty`
  (`no access` **is** the answer — adding "unknown" would be incoherent, since the inspector
  always knows how far they went).

13/17 choice items now carry an escape. The escape-free four are **pinned by test**
(`choice escape adjudication`) as an exact set, so a later content pass that adds "unknown"
to access-honesty or drops it from `fp.type` fails CI rather than the field.

### 10.2 `measure (year)` range — 1900 → current year, rejected at entry

Implemented in the resolve sheet: 4-digit numeric entry, red ring plus an inline reason when
out of range, and **every** recording path blocked while invalid (Mark satisfied *and*
Pass/Fail — a `measure`+`action` item could otherwise record a bad year through the test
buttons). Rejecting at entry rather than downstream matters because these feed the equipment
registry: one bad year is worse than a missing one, since it silently skews an aggregate
instead of just shrinking the sample.

Config-level guard: `wh.age` / `ft.age` are pinned as `measure (year)` by test, since the UI
gate keys off `unit === "year"` and a rename would silently disable it.

### 10.3 Auto-flagging — argument selected, and the dismissal record

Owner adopts the sharper argument as the one to lead with: **any answer that silently spawns
work gets picked less often**, and the entire value of `choice` over prose is that the true
answer is the cheapest to record. Auto-flagging taxes honesty.

**Dismissal logging is accepted as a requirement, not a nicety.** When the prompt lands it
must record the *declined* judgement — "poly-B was seen and not flagged" — on the same
principle that makes `none-present` real inspection data: a decision made and recorded is
evidence; a decision made and discarded is a hole. Not built this turn; no prompting exists
in the resolve flow yet.

### 10.4 Process — the actual fix for the v1.2.1 fork

Recorded as a standing rule in `CLAUDE.md`, not just here, because it binds both sides:

> Whoever authors a master version produces the **complete file**. No dictated edits.
> Before the owner authors a new version, the current repo copy is sent to them.
> After any owner-adjudicated cell change applied here, bump the patch version and send the
> file back.

The v1.2.1 fork was not a content mistake — it was a *transport* mistake. Six edits dictated
for transcription existed only in the repo; the owner's copy stayed at v1.2; v1.3 was written
on top of that and reverted all six, one of which broke the generator outright. Whole-file
transfer in both directions removes the class of error, not the instance.

**v1.3.1 is being sent to the owner with this change** — first application of the new rule.

---

## 11. Field-test-3 change-requests (2026-07-26) — master content, for the v1.4 pass

Two content gaps found by walking the app. Both are owner-edited master content, recorded
here rather than changed downstream.

### 11.1 No plumbing-fixture component types exist

Pinning a toilet, sink or shower forced **freeform entry** — exactly the path that poisons
the component taxonomy the §8 sub-type work is meant to grow from real usage. Verified: of
**52 component types**, none is a plumbing fixture. No `toilet`, `sink`, `shower`, `tub`,
`faucet`, `vanity`.

This is a coverage gap rather than a taxonomy question: these are the most common objects in
a wet zone, they recur in every house, and their items are largely already written elsewhere
(`wet.under-sink`, `wet.supply-stops`, `bth.toilet-secure`, `wet.surround-moisture` are all
zone items that would read better as component items on the fixture they describe).

Recommend: add `toilet`, `sink`, `shower-tub`, and consider `faucet` folded into `sink`
rather than split. Worth deciding whether the existing wet-zone items *move* onto the new
components or stay duplicated at zone level — moving is cleaner but changes zone lists.

### 11.2 Whole-unit photo items — the `.unit` gap (carried from §9, now measured)

Only **4 of 36** component types with items carry a whole-unit/wide photo (`electrical-panel`,
`water-main`, `gas-shutoff`, `fuel-tank`). **10** carry a nameplate photo. **32 have no
whole-object capture at all.**

Whole-unit shots are what make year-over-year condition comparison possible, and a photo not
taken cannot be retrofitted — every visit without them is a permanently missing baseline.

Scope it to equipment plus anything whose condition visibly changes (deck, chimney, retaining
wall, dryer duct); a `window`, `door`, `tree` or `register` does not need one. A blanket
`.unit` on all 36 would be noise, and noise in the checklist is the thing the field test
already complained about.

### 11.3 Nickname — owner asks whether it still earns its place

With component types carrying the identity, the free-text nickname may be redundant. Owner's
call is to **legacy it for now** and watch. No change requested; recorded so the question
isn't lost. Note that 11.1 is likely the real cause: nicknames were doing the work missing
component types should have been doing.

---

## 12. v1.4 intake adjudication (2026-07-26)

v1.4 closes the sub-type taxonomy that had been "awaiting telemetry" since v1.1, on the
correct reading that the owner's freeform fixtures and repeated appliance nicknames **were**
the telemetry. **Accepted as authored**, with one defect recorded below.

Landed: 16 new component types (5 plumbing fixtures standalone, 7 appliance sub-types,
4 water-treatment sub-types), component inheritance in the schema and generator, 14 whole-unit
photo items, zone items re-pointed, `plumbing-fixtures` layer. **270 → 346 items**
(+76, master predicted ~+75); 47 → 65 component lists; 7 → 8 layers.

### 12.1 Component inheritance — implemented, with one trap worth recording

Inheritance is stored **declaratively** (`inherits` on the component list) and composed at
derivation, mirroring how zone-type inheritance already works. It is deliberately *not*
flattened into the generated config: flattening would copy parent items into every child
list, duplicating item ids and breaking the invariant that an item exists exactly once.

**The trap:** the heading syntax `` ### `child` — inherits `parent` `` reuses backticks, and
two backticked ids on a component heading *already meant* a shared list (`smoke-alarm` /
`co-alarm`). A naive parse merges every sub-type with its parent instead of inheriting.
The parser strips the clause before collecting ids, and a guard rejects an inheriting heading
that names more than one id. Verified by reverting the strip: generation now fails closed
with a clear message. Without the guard it would still have failed, but as a confusing
"duplicate component type" three steps downstream.

Also fixed: the **core-cap invariant test was silently under-counting**. It measured each
list's own items, but a sub-type renders as one group carrying parent + own. It now composes
before counting. No type currently exceeds the cap (worst is `water-softener` at 7 core).

### 12.2 DEFECT — v1.4 renames two item ids, against the master's own precedent

`CLAUDE.md`: *config is data, ids are never renamed or reused.* Six ids disappear in v1.4:

| id | v1.4 disposition | verdict |
|---|---|---|
| `bth.toilet-secure` | renamed → `bth.toilet` | **rename — against the rule** |
| `bth.tub-surround` | renamed → `bth.fixtures` | **rename — against the rule** |
| `kit.dw-connection` | retired; content → `apd.airgap` | legitimate retirement |
| `kit.fridge-line` | retired; content → `apr.water-line` | legitimate retirement |
| `kit.fuel-range` | retired; content → `apg.shutoff` | legitimate retirement |
| `lnd.hoses` | retired; content → `apw.hoses` | legitimate retirement |

The four retirements are fine — the content genuinely moved onto the object it belongs to,
and that is a lifecycle event, not a rename.

**The two renames contradict the master's own established practice.** When `liv.egress` moved
into `interior-base` (v1.2) and `bsm.finished-behind` moved into `rough-base` (v1.2.1), both
changelogs explicitly kept the id and recorded *"the prefix is now historical, which is fine —
ids are opaque."* `bth.toilet-secure` is the same case: it is still "the toilet item in the
bathroom list," now satisfied by a pin rather than a check. Nothing required a new id.

**Consequence:** a resolution recorded against `bth.toilet-secure` in an existing session no
longer matches any item after regeneration. The event log is append-only so nothing is lost,
but the resolution stops rendering and stops counting in the audit. With one archived field
export the blast radius is small — the rule exists so it stays small.

**Recommendation (owner's call):** restore `bth.toilet-secure` and `bth.tub-surround` as the
ids, keeping v1.4's new text and satisfy types. Two cells. If instead the renames are
deliberate, record them as retirements-with-successors so the binder can map old to new.

**Pinned by test either way:** `id stability` now asserts that none of the six retired ids is
ever reissued. Reuse is the genuinely dangerous half — a dead id returning attached to a
different verification would silently re-point historical resolutions at new meaning.

### 12.3 Carried, unchanged

Table D's `issues`/`monitor` break is correctly flagged and correctly **not** fixed here —
rewriting those predicates now empties two working layers for an entity that doesn't exist.
They land with the concern entity. Nicknames stay through the next walk, per §9.5: retiring
the workaround in the same pass that fixes the gap makes it impossible to tell which mattered.

---

## 13. v1.4.1 — owner ruling on the id finding (2026-07-26)

**§12.2's recommendation is overruled, correctly.** I proposed restoring `bth.toilet-secure`
and `bth.tub-surround`. That would have been wrong, and the reasoning that replaces it is
better than mine.

**Both were redefined, not renamed.** The old items were `check`/`action` — physical tests
the inspector performs ("Toilet secure to floor, no rock, base dry"). The new `bth.toilet`
and `bth.fixtures` are `pin`/`evidence` linkage items ("Toilet pinned"). Different question,
different attest. Restoring the id would let a past **pass** from a physical test render as
satisfying a pin-linkage question — a stale test result silently vouching for something
nobody checked. **False continuity is worse than an honest orphan**, and I had weighed only
the orphan side.

The old content is not lost: it moved to `wc.secure` / `wc.base-dry` and `tub.surround` /
`shw.surround` — the same pattern as `kit.dw-connection` → `apd.connections`, which §12.2
already called a legitimate retirement. **All six v1.4 departures are retirements.** The
authoring error was mis-filing two of them as renames in the changelog, not the change itself.

### 13.1 The rule this produces

> **Move keeps the id; redefine retires it.**
> *Move* — same question, same text, same `attest`, different list — keeps its id; the prefix
> goes historical, and ids are opaque (`liv.egress`, `bsm.finished-behind`).
> *Redefine* — different question, or different `attest`, even in the same slot — retires,
> and the replacement takes a new id.

This is decidable at a glance and would have caught the error at authoring time. My §12.2
analysis cited `liv.egress` and `bsm.finished-behind` as precedent *against* v1.4 — but those
are moves, and these are redefinitions. The precedent was real; the classification was the
missing distinction.

Recorded in `CLAUDE.md` (config discipline) and master §2 (id lifecycle).

### 13.2 Applied as v1.4.1

Changelog reclassifies the two as retirements joining the other four; the v1.4 entry's `→`
notation is corrected in place; the bathroom section gains a retirement note matching the
kitchen/laundry pattern; §2 gains the rule. **No cell values change** — 346 items, unchanged
content, `configVersion` 1.4.0 → 1.4.1.

The no-reuse tests stay exactly as written: reuse is the guarantee that actually protects the
record, and it is orthogonal to this ruling.

### 13.3 Process note — v1.4 was not in main when it was merged

PR #48 merged at `708f608` (media fixes). The v1.4 commit `714064d` was pushed to the branch
afterwards and **was not included in the merge**, so main sat at master v1.3.1 while both
sides believed v1.4 was live. Recovered by cherry-pick; v1.4 and v1.4.1 ship together here.

Worth a habit on both sides: a PR that gains commits after review needs a fresh look at the
head SHA before merging, since GitHub merges what the button saw.

---

## 14. v1.5 intake adjudication (2026-07-27)

**Accepted as authored.** The framing is the valuable part: six of the eight dry-run gaps
were not scattered misses but one hole — the library could not populate Master Spec §1, the
emergency shutoff map. Making §1 the master's acceptance test is the right structural move,
and the pin-vs-item rule (*does the thing need its own position on the map?*) is teachable in
a way that "use judgement" is not.

Landed: 5 new component types · 4 new items on existing components · 2 zone items ·
`wm.curbstop` retired · Table E (30 aliases). **346 → 377 items** (+32, −1). 57 real
component types + 10 stubs.

### 14.1 Generator bug found by v1.5 — mine, not the master's

Generation failed on `duplicate component type: solar-inverter` (and two more). The master
was **correct**: the Stubs line properly lists only the ten remaining stubs, and the three
promoted types appear as real sections. The fault was in my stubs parser, which treated
*every* backticked token in the stubs section as a stub id — including the new explanatory
prose beneath the list ("*Three stubs filled in v1.5 (`solar-inverter`, …)*"), re-registering
them on top of their real sections.

Fixed: a line registers stubs only if nothing but ids and separators remains once the
backticked ids are stripped. Prose has words outside the ticks and is skipped. The fail-closed
design did its job — a silently-doubled type would have been much worse than a build error.

### 14.2 G7 recurred inside its own fix — caught by test

Table E authors the alias as `air-conditioner`, in id style. A concierge types
**"air conditioner"**, with a space, and finds nothing — which is precisely the failure the
alias exists to prevent, reintroduced one layer down.

Fixed in code rather than by doubling every row: `normalizeAlias` now treats hyphens,
underscores and whitespace as one separator, and the picker normalises the query, the alias
and the type name through it. So "air conditioner", "air-conditioner" and "AC" are one
search — and "heat pump" now finds `heat-pump` directly, which it previously did not.

This is worth remembering when authoring Table E: **aliases are typed by humans, so author
them the way a person speaks, not the way an id looks.** The normaliser now covers the
separator case; it cannot cover a genuinely different word.

### 14.3 Aliases in the picker

`TypePicker` folds alias hits into the same result list and labels them — *heat-pump ·
matched "air conditioner"* — because a search for one word returning a differently-named row
is confusing without saying why. Aliases stay out of `componentLists`, out of the manifest,
and carry no items, exactly as authored; tests assert all three.

### 14.4 Cosmetic defects in v1.5, for the next version (no action taken)

Left verbatim per the never-edited-downstream rule; none affects generation:
1. The header carries **two** "Authored from:" lines — a stale `v1.3.1` above the correct
   `v1.4.1`. Worth deleting, since that line exists specifically to prevent version confusion.
2. §0 is still titled "(for the generator — **v1.4**)".
3. §0 still says "Vocabulary tables (**A–D** at end)" — now A–E.

---

## 15. v1.5.1 intake (2026-07-27)

**Accepted as authored.** Three cosmetic fixes plus the substantive half my §14.2 finding
actually called for. 377 items unchanged; aliases **30 → 56**.

### 15.1 The alias rewrite is the right response, and it goes further than my fix

My separator normaliser was the correct layer for *spelling* — "air conditioner" vs
`air-conditioner` vs "AC". It cannot reach a **different word**, and that is where the real
misses live. v1.5.1 rewrites the table on exactly that principle: `gutter` → downspout ·
`smoke detector` → smoke-alarm · `carbon monoxide detector` → co-alarm · `outlet`/`plug`/`gfi`
→ receptacle-gfci · `propane tank`/`oil tank` → fuel-tank · `septic tank` → septic-lid ·
`sprinkler` → irrigation-backflow · `hot tub`/`spa` → pool-equipment · `washing machine` →
appliance-washer · `porch` → deck · `flue` → chimney.

Twenty-six words a person would actually say that no normaliser will ever reach. All 56
verified resolving to real types. The id-style entries are gone — `air-conditioner` is now
`air conditioner`, which was the whole point.

### 15.2 One of my tests was over-specified — replaced

`preserves authored spacing and case` asserted that *some* alias carries capitals. That was
never a rule; it was a fact about v1.5's data ("UV", "RO", "WC"). v1.5.1 lowercased the table,
correctly, and my test failed for no good reason. **A test that pins incidental data rather
than a rule is a false alarm waiting to happen**, and it cost a build failure here.

Replaced with the rule the master now states: **no alias is authored in id style.** A kebab
alias would still *work* — `normalizeAlias` makes hyphen and space equivalent at match time —
but it signals someone thinking in ids again, and the next one may differ by a whole word,
which no normaliser can reach. Verified by mutating `air conditioner` back to
`air-conditioner`: the test fails.

### 15.3 The three cosmetic fixes, confirmed

Duplicate `Authored from:` gone (one line, naming v1.5) · §0 retitled v1.5.1 · vocabulary
tables now "A–E", with the Table E row shape declared in the dialect. All three verified in
the installed file.

---

## 16. v1.6 → v1.6.1 intake — engine landed, content BLOCKED on one fix (2026-07-27)

All three v1.6 blockers are fixed in v1.6.1 and verified: `mechanical-base` in all 13
Inherits cells · §0 documents base-list sub-headings · Table B gains `defaults true for`
(`has_mechanicals` → `utility`) · `pin.*` ruled zone-only.

**Engine support is built and landed against the v1.5.1 master. The v1.6.1 master is NOT
installed**, because one authoring gap would ship a defect worse than the one v1.6 fixed.

### 16.1 BLOCKER — the `has_mechanicals` gate exists only in prose

`mechanical-base`'s heading states: *"Every item below is gated on `zone.has_mechanicals`."*
**No item table carries a trigger column.** Five of the six sub-heading tables are
`id | text | satisfy | tier | attest`; only *Fuel* has a trigger column, and it is used for
`property.gas|propane`.

Measured on a generated v1.6.1 config: **21 of 24 mechanical items carry no trigger at all,
17 of them core.** Combined with universal inheritance, that means:

> every zone — bedroom, hallway, bathroom, every elevation — renders all 24 mechanical items,
> 17 core among them. A bedroom checklist would demand a furnace and a main water shutoff.

This is worse than the v1.6 defect it follows. v1.6 made the shutoff map vanish; this makes
it appear everywhere, and it is the wall-of-items problem the accordion work exists to
prevent, reproduced in every room of the house.

**It is also the fourth instance of the class v1.6.1's own status line names** — *"the prose
asserting something the machine-read tables did not say."* Recorded without irony: the lesson
is correct, it was written the same day, and it recurred inside the change that introduced
it. That is evidence the rule needs a mechanical check, not more care.

**Two fixes, owner's call:**

1. **Add a `trigger` column to the five mechanical-base tables**, `zone.has_mechanicals` in
   21 rows. The Fuel table's three rows need `zone.has_mechanicals` combined with the
   existing property trigger — note the dialect's trigger cell is `anyOf` only, so an
   `allOf` of two refs is not currently expressible in a cell. Those three would need either
   dialect support for allOf or acceptance that fuel items are gated on property alone.
2. **Declare a list-level gate in the dialect** — e.g. a base-list heading may carry
   `gated on \`zone.attr\``, applied to every item in the list. Twenty-one identical cells
   are noise, and the master already expresses the intent at list level.

**Recommend (2)**, with (1) as the fallback. It matches how the content is actually authored,
it cannot drift row-by-row, and it makes the Fuel `allOf` case fall out naturally: the list
gate ANDs with each item's own trigger. Either way the dialect declaration belongs in §0 —
I have not invented it here.

### 16.2 Engine work landed this turn (against v1.5.1, fully backward compatible)

- **Base lists may span several tables under bold sub-headings.** Previously one heading =
  one table; the second table errored "outside a ### heading". Base items now also carry
  their sub-heading as the rendered-group key. Without this `mechanical-base`'s 24 items
  collapse into one group of 20 core — 2.5× the §2 cap. With it: 6 groups, max 7 core.
- **Markdown emphasis is stripped from id cells.** v1.6.1 authored `**mechanical-base**`;
  unstripped, the asterisks became part of the id and 13 zone types inherited a list that
  did not exist — surfacing as a validation error three steps from the cause.
- **Table B `defaults true for`** parsed into `zoneAttributes[].defaultsTrueFor`, validated
  against real zone types. Both the 3- and 4-column headers parse, so regenerating an older
  master is not a breaking edit.
- **`house.*` namespace** added; `activeRefs` emits it at every scope. **`pin.*` is now
  zone-only** and the validator rejects it on a session item, naming the `house.*` form.
  Nothing used it there, so the ambiguity was removed rather than documented.

Tested against fixtures rather than the shipped master, since v1.5.1 does not exercise any
of it — the engine and the content stay reviewable apart.

### 16.3 Still open from §15

The 345-vs-377 item-count reconciliation (now v1.6.1 §9.7) is not addressed here. My figure
counts **unique item ids across base + zone + session + component lists**. Happy to produce
the per-section breakdown whenever the binder session wants to run it side by side.

---

## 17. v1.6.2 intake — list gates land, plus a regression I shipped (2026-07-27)

**Accepted and installed.** The list gate is adopted as declared. `mechanical-base` carries
`gated on zone.has_mechanicals`, is inherited by all 13 zone types, and renders as **6 groups,
max 7 core** — the §2 cap holds. **384 items**, 59 real component types + 9 stubs, 56 aliases.

Gate semantics implemented exactly as §0 declares: `allOf(list gate, item trigger)`. Verified
three ways on the Fuel case — gas + mechanicals shows `utl.gas-shutoff`; mechanicals without
gas hides it; gas without mechanicals hides it. Component lists apply their **own** gate to
their own items, so a parent's gate never silently conditions a child's.

`defaultsTrueFor` is wired into zone creation: picking `utility` pre-ticks `has_mechanicals`,
read from config and never hardcoded — one tap to turn off, one tap to turn on anywhere else.

### 17.1 REGRESSION I SHIPPED — snake_case ids were being mangled

The emphasis-stripper added for v1.6.1 (`stripTicks`) stripped `_` as well as `*`. Zone
attribute and property flag ids are **snake_case**. PR #52 therefore shipped
`has_stairs → hasstairs`, `has_plumbing → hasplumbing`, `exterior_wall → exteriorwall` into
main.

**Why nothing caught it.** The generator corrupted *both sides identically* — the Table B id
**and** the `zone.has_stairs` trigger ref — so the config stayed internally consistent, the
validator was satisfied, and the drift gate compared a corrupt config against an equally
corrupt regeneration. Every existing test asked "do these agree?"; none asked "is this the
id the master actually wrote?"

**Found by v1.6.2's new gate validation**, which failed with *"gate on unknown zone attribute
has_mechanicals"* — the first check that compared a parsed id against a *different* parsed
id rather than against itself.

Fixed: underscores are no longer stripped (underscore emphasis is unsupported in id cells;
asterisks are). New `id fidelity` tests assert the literal ids and that every `zone.*` ref —
trigger or gate — resolves to a declared attribute. That is the assertion class that was
missing: **consistency checks cannot catch a transformation applied uniformly.**

Impact was limited: the ids were self-consistent, so no session recorded wrong data. But the
manifest's zone-attribute vocabulary was wrong, and any future session data would not have
matched pre-#52 sessions.

### 17.2 Prose sweep (their §9.7 request)

Ran the pass they asked for: every backticked token in non-table lines, checked against the
generated config — 242 tokens. **Seven do not resolve, and all seven are correct**:
`bth.toilet-secure`, `bth.tub-surround`, `kit.dw-connection`, `kit.fridge-line`,
`kit.fuel-range`, `lnd.hoses`, `wm.curbstop` — the deliberately retired ids, named in
retirement notes.

**No prose-only structural claim survives in v1.6.2.** The sweep is cheap and worth repeating
at each intake; it is now scripted in this turn's history rather than described.

### 17.3 Test fixtures updated, and why that is the gate working

Three pre-existing tests failed on install because their `utility` zones were created with
`attributes: {}`. Under v1.6.2 that correctly hides every mechanical item. Fixtures now set
`has_mechanicals: true`, matching what the app does via `defaultsTrueFor` — the failures were
the feature, not a defect.

Also updated: the core-cap test now groups **base** lists by authored sub-heading (it reported
`mechanical-base` at 20 core against a cap of 8), and the `utl.*` assertions moved from the
`utility` zone list to `mechanical-base`, where those ids now live.

### 17.4 Correction — zone-type defaults now resolve at derivation, not at creation

**Owner pushback, and it was right.** I wired `defaultsTrueFor` into the zone-creation UI
only. Every *other* creation path bypasses it — and the session-plan import is exactly such a
path. An imported `utility` zone arriving without `has_mechanicals` would have hidden the
entire mechanical checklist on **visit two, silently**: the v1.6 bug returning through a
different door, in the one place nobody would be watching for it.

Moved to `activeRefs` via `effectiveAttributes(config, zone)` — the single choke point every
derivation path already runs through, so no creation path can bypass it. Verified by mutation:
reverting to raw `zone.attributes` fails the import test.

**ABSENT is not FALSE**, and the distinction is load-bearing. An explicit `false` is the
inspector's decision — a utility room whose mechanicals were moved out — and it is honoured.
Only an *unset* attribute falls back to the zone-type default. The creation UI still pre-ticks
the default so it is visible and untickable; because it writes an explicit value, the two
never disagree.

The tell the owner named is worth recording: **their fixtures failing was the signal.** Three
tests broke because they created `utility` zones with `attributes: {}` — which is precisely
the shape an importer produces. I read that as fixtures needing updating; it was also the bug
reporting itself.

### 17.5 Change-request for the next master pass — no markdown emphasis in parsed cells

Owner's own diagnosis, recorded so it lands in a version rather than a chat log: `**bold**`
inside the Inherits cells is what forced emphasis-stripping into the generator, and that
stripper is what ate the underscores in `has_stairs`. **Emphasis inside a parsed cell is
decoration for humans and a hazard for machines.**

A §0 dialect line — *no markdown emphasis in parsed cells* — belongs in the next pass. Not
worth a version bump on its own. The `id fidelity` tests defend the specific failure now, so
it cannot recur silently, but the rule removes the class rather than the instance.

---

## 18. v1.7 / v1.7.1 intake (2026-07-28)

**Accepted.** §10 Governance ratified; four generator-visible changes built; three B5 component
types land. **401 items** (384 → 401), 70 component lists, 5 declared units, 32 reserved-class
items. Table G parsed and empty, as authored.

**Confirmation requested and given: the master was untouched during #53/#54/#55.** `git log`
on `docs/CHECKLIST-MASTER.md` since v1.6.2 landed is empty. v1.7's "authored from v1.6.2" is
clean.

### 18.1 The new §0 emphasis ban caught its own file on first contact

v1.7 §0 bans markdown emphasis in parsed cells. **v1.7's own §4 carried `**mechanical-base**`
in all thirteen Inherits cells**, so it could not build:

```
CHECKLIST-MASTER.md:281: no markdown emphasis in parsed cells (v1.7 §0)
```

This is the rule working exactly as designed. The generator now **fails closed** rather than
stripping — and a stripper would have swallowed this silently, precisely as it swallowed the
underscores in `has_stairs`. Applied as **v1.7.1**: thirteen cells, emphasis removed, values
otherwise identical.

Emphasis remaining in *label*, *intake source*, *askAtCreation* and Table G prose cells is
untouched — those are read as free text, never as ids. The ban is on **parsed** cells, and
scoping it that way is what makes it enforceable rather than a style preference.

### 18.2 My own first attempt at the ban reproduced the bug it bans

Worth recording, because it is the same failure a third time. My first `stripTicks` rewrite
rejected emphasis only when a line number was passed — and still ran `.replace(/[*_]/g, "")`
on the other path. So `has_stairs` became `hasstairs` again.

It surfaced only because Table B's ids then failed to resolve against `mechanical-base`'s
**gate** — again the cross-reference check, not any self-consistency check. Fixed: emphasis is
rejected unconditionally, and underscores are never touched.

The lesson compounds: *a consistency check cannot catch a transformation applied uniformly*,
and **a fix for that class must be tested on the class, not on the instance.** I tested that
the ban rejected emphasis; I did not re-test that ids survived it.

### 18.3 Counts and the §9 question

- **Master untouched during #53–#55** — confirmed by git history.
- **Five unitless `measure` items, not six**: `int.moisture-suspect`, `rgh.moisture`,
  `wet.surround-moisture`, `liv.egress`, `sit.measurements`. The five named in §9 are exactly
  the five that exist; the count "six" is the only slip.
- Table H's prose says *"Every `measure` item declares its unit inline."* **Five do not** — so
  that sentence is, today, a structural claim the tables contradict. Not enforced as a rule
  (it would fail the build on the owner's own open question); recorded here instead. Once §9
  is answered it becomes enforceable, and **should** be: it is exactly the check Table H was
  created to make possible.

**The §9 question is not mine to answer.** What a moisture meter reads — %WME, %MC, or a
relative 0–100 scale — depends on the instrument in the owner's hand, and guessing would
corrupt the comparison series in the precise way Table H exists to prevent. Routed to the
owner. `liv.egress` and `sit.measurements` are separate and simpler: both are lengths, and
`in` is already declared.

---

## 19. v1.7.2 intake (2026-07-28)

**Accepted and installed.** 401 items, unchanged from v1.7.1 — this version corrects claims
and assigns two units, adding no content. All four changes verified:

| claim | verified |
|---|---|
| Table H reworded to three deliberate exceptions | ✅ no blanket claim remains |
| `liv.egress` + `sit.measurements` declare `in` | ✅ both |
| emphasis removed from §4 Inherits | ✅ zero occurrences |
| count corrected to five | ✅ "six" no longer claimed |

Unitless `measure` items are now exactly three, all moisture: `int.moisture-suspect`,
`rgh.moisture`, `wet.surround-moisture`.

**The meter answer settles it correctly.** The owner does not own one yet, so the scale is
genuinely undetermined — not merely unrecorded. §9.7's framing is the right one: the
instrument sets the scale permanently, and switching later corrupts every prior series
retroactively. Enforce *every-measure-declares-a-unit* when the instrument exists, not before.

### 19.1 On splitting `liv.egress` — agreed, with two refinements

Recommendation accepted. Two things to get right when it lands:

**(1) It is four things, not three.** The current row reads *"Sleeping-room window egress:
opens fully; size and sill height measured"* — that is one **check** (opens fully) plus
**three** numbers (width, height, sill height). Splitting into three measures leaves "opens
fully" homeless or silently bundled into one of them. Proposed shape:

| id | text | satisfy | attest |
|---|---|---|---|
| `liv.egress-opens` | Sleeping-room egress window opens fully | check | action |
| `liv.egress-width` | Clear opening width | measure (in) | action |
| `liv.egress-height` | Clear opening height | measure (in) | action |
| `liv.egress-sill` | Sill height above finished floor | measure (in) | action |

This is also what the assessment actually needs: egress thresholds are **per dimension** —
minimum width, minimum height, minimum openable area, maximum sill height. One number cannot
be compared against four different limits, and the binder cannot flag *which* dimension fails.

**(2) `liv.egress` must RETIRE, not carry over to one of the four.** Per §2's own rule this is
a redefinition, not a move: one ambiguous number becomes several specific ones. Keeping the id
for, say, sill height would let a past reading — recorded when the item meant "size", and
nobody now knows which dimension the inspector measured — render as satisfying "sill height
above finished floor". That is textbook false continuity, and the id has a real recorded value
behind it, which makes it worse than the `bth.toilet-secure` case.

**Cost, stated honestly:** one `action` tap becomes four. For a life-safety item in a sleeping
room that is proportionate, and it is the only item in the master where a single `measure`
carries more than one number — so the fix does not generalise into a wave of splits.

### 19.2 Carried

The every-measure-declares-a-unit rule remains **recorded, not enforced** (§18.3), now for a
better-stated reason: the instrument does not exist yet. When it does, three cells and one
validator rule close it.

---

## 20. v1.8 intake — the egress split (2026-07-28)

**Accepted and installed.** 401 → 404 items (one retired, four added). `liv.egress` retired
with a Table F entry naming all four successors; the four are `action`, `zone.sleeping`-gated,
and grouped under the authored sub-heading *Egress (sleeping rooms)*.

### 20.1 Two corrections to my recommendation, both right

**(1) I listed four thresholds and proposed four items, and the mapping is not 1:1.**
Openable area is **derived** — width × height — so recording it would create a value that can
disagree with its own inputs. My phrasing ("egress thresholds are per dimension: minimum
width, minimum height, minimum openable area, maximum sill height") invited exactly the wrong
inference. The principle is worth keeping general: **a derived value must be computed by the
consumer, never recorded by the field**, or the record can contradict itself and there is no
way to tell which side is wrong.

**(2) I did not check the cap impact of my own proposal — a real miss.** `interior-base`
carried 5 core; retiring one and adding four takes it to **8, exactly the §2 limit with zero
headroom.** v1.8 solves it with a bold sub-heading, so the four render as their own group and
the main group drops to four. Measured: max core per rendered group is now **4**.

That machinery is the base-list sub-heading support I built in v1.6.1 — and I still failed to
apply it as a lens to my own recommendation. Proposing items is not separable from proposing
where they render; the cap is per rendered group, so any multi-item proposal has to state its
grouping or it is incomplete.

### 20.2 On the `zone.sleeping` duplication (§9.8) — agree, do nothing

Four cells repeat `zone.sleeping` because list gates attach to `###` lists, not to bold
sub-headings. Extending gates to sub-headings for a single case would be new dialect earning
its keep once. The judgement to tolerate it at four and watch for a second conditional
sub-headed group is correct — and if that second case appears, the right fix is a
sub-heading-level gate reusing the existing `allOf(gate, trigger)` semantics, not a new
mechanism.

### 20.3 Test fixtures updated

Three tests referenced `liv.egress` directly. They assert *trigger placement* — egress
surfaces in sleeping zones only — which is unchanged; only the id moved. Repointed to
`liv.egress-width`. `liv.egress` is added to the `id stability` no-reuse list, so it can never
be reissued for anything else.

---

## 21. The derived-value rule, corrected — and what it surfaces (2026-07-28)

**My rule was too broad and would have flagged `wh.age` as a defect.** The correction is right,
and the qualifier is the whole rule:

> **Derivable from other values in the same record → must NOT be recorded.** Openable area is
> width × height; recording it creates a number that can contradict its own inputs.
>
> **Derived from an artifact by applying expertise → SHOULD be recorded**, because the
> derivation is not reproducible downstream (serial-decoding schemes are manufacturer-specific)
> — *and the source artifact is captured alongside it as the check.*

Recorded here rather than in the master, since the rule is not in the file. **If it ever enters
§2 it needs the qualifier**, or it flags `wh.age`.

### 21.1 The second half is an invariant, and it does not currently hold

The clause *"the source artifact is captured alongside it as the check"* is what makes
recording an expertise-derived value safe. That is checkable, so I checked it — inheritance
included. Three items in the config derive a value by reading an artifact:

| item | text | source artifact captured? |
|---|---|---|
| `wh.age` | "decoded from serial" | ✅ `wh.nameplate` — "Nameplate photographed legibly" |
| `ft.age` | "Manufacture year from **data plate**" | ⚠️ only `ft.wide`, a *locating* shot. `fuel-tank` has **no nameplate/data-plate item at all** |
| `apw.hose-age` | "**Hose** year if marked" | ⚠️ `app.unit` and `app.nameplate` photograph the *washer*, not the hose marking |

So the safeguard holds for one of three. Nobody's data is wrong today — but an age with no
photograph of the thing it was read from **cannot be re-checked**, by a reviewer, by a later
visit, or by anyone questioning it.

**This matters most to the consumer that cannot argue for itself.** §10 names the equipment
registry as the third consumer, whose blast radius is permanent corruption of longitudinal
series. An unverifiable install year is exactly that failure mode: it enters the fleet
aggregate looking identical to a verified one, and nothing downstream can tell them apart.

### 21.2 Change-request for the next master pass

1. **`fuel-tank` needs a data-plate photo item** (`ft.nameplate`, photo/evidence) — `ft.wide`
   is declared a *locating* class (v1.7 §2) and cannot double as the legibility record.
2. **`apw.hose-age`**: either add a hose-marking photo, or accept the year as unverifiable and
   say so in the text. Recording it silently as if it were verifiable is the option to avoid.
3. **Consider the general form as an authored rule:** *any item deriving a value from an
   artifact must name the item that photographs that artifact.* That would be enforceable —
   the parser could require the pairing — and would have caught both of these at authoring
   time rather than two years into a comparison series.

### 21.3 On the cap lesson

Agreed that it lands more on the authoring side, but it is not only there: I proposed the four
items *and* their tier without stating their grouping. **Any proposal that adds core items
states where they render, or it is incomplete** — I will treat that as binding on my
recommendations, not just on the file.

---

## 22. v1.9 intake — Table I, derived-value provenance (2026-07-28)

**Accepted and installed.** 404 → 406 items. All three change-requests applied:
`ft.nameplate` (core — it is the source of a core value), `apw.hose-label` (standard), and the
rule promoted to **Table I**, parser-enforced.

### 22.1 The `wsf.age` warning was right, and it changed the check

The flag — *"it passes by inheritance, which your check would need to resolve"* — is correct
and was worth stating. It also pushed the check further than the warning asked.

My first implementation tested **global existence**: does `wt.nameplate` exist anywhere in the
config? `wsf.age` passes that trivially, so the warning would have looked satisfied. But global
existence is the **wrong check**. Provenance means the photo is captured **on the same pin**;
a source living on an unrelated component would pass existence and still never be taken.

The check is now **co-visibility with the inheritance chain composed**: the source must be
reachable from the item's own list, walking `inherits`. Pinned by two tests —
`wsf.age → wt.nameplate` resolves *because* the chain is walked (`water-softener`'s own list
does not contain it), and `wh.age → fur.nameplate` is **rejected**: it exists, it is a photo,
and it is on the wrong object.

### 22.2 The N/A `none-present` semantics are right, and the distinction is the point

*"Where the source resolves N/A `none-present` — no legible date code, no readable plate — the
derived value is legitimately unverifiable, and recording that is real data."*

Agreed, and it is the same principle as *confirmed absent is a finding*. The failure mode is
not the unverifiable value; it is the **silently** unverifiable one. A declared "plate
illegible" is a fact a reviewer can act on. An age with no photograph and no explanation is
indistinguishable from a verified one, which is precisely what the registry cannot detect.

No code needed today: this is derivation-time behaviour, and `none-present` already carries
`recordsFinding`. Worth confirming when the registry consumes it that an N/A source is
propagated alongside the value rather than dropped — otherwise the declaration is lost in
exactly the layer that needed it.

### 22.3 On the §9.8 sweep — my read, with the items in hand

**`pnl.service` and `pnl.brand` are real.** Both are transcribed from a panel label; the only
photo on `electrical-panel` is `pnl.wide` (declared a *locating* class, v1.7 §2) and
`pnl.directory` (the circuit directory, a different artifact). Service size and panel brand are
both insurance-relevant — a known-issue brand is the reason `pnl.brand` exists — and both are
currently unverifiable. **Recommend a `pnl.label` photo item and two Table I rows.**

**`wt.consumables` I would leave.** "Consumable size and last change recorded" is part
transcription (a filter size off a housing) and part testimony (when it was last changed —
often what the owner says, which no photograph can verify). Table I would half-apply, and a
provenance row implying the whole value is verifiable would be worse than none. If it is
split later — size from the artifact, last-change as testimony — the size half earns a row.

**The general test I would apply:** *is there a single artifact a photograph could capture that
would let someone else reach the same value?* Yes → Table I. Partly, or the value includes
testimony → do not claim provenance for it.

---

## 23. v1.10 intake — §9.8 resolved (2026-07-28)

**Accepted and installed.** 406 → 407 items. `pnl.label` added (photo/core) and sourced for
both `pnl.service` and `pnl.brand`; `wt.consumables` deliberately excluded and **recorded as an
exclusion**. Six provenance rows, all resolving.

Recording the exclusion is the right call and worth naming: **an explicit exclusion is
evidence of a decision; a silent absence is indistinguishable from an oversight.** That is the
same principle as `none-present` being real data, applied one level up — to the master's own
authoring history rather than to a house.

### 23.1 The downstream requirement is already satisfiable — verified

Table I now says an N/A-sourced value must carry that fact through the manifest. Checked
whether the export can support that today, since a requirement that needs a schema change is a
different conversation from one that needs a consumer to do the join:

- **Table I ships in the manifest.** `ExportV2Screen` passes `configSnapshot: v2Config` — the
  whole config, so `provenance` rides along. Confirmed present in the generated config.
- **N/A reasons ship too.** `resolutions[]` carries the full `ItemResolution`, including
  `{kind:"na", reasonId}`, per scope.

So the join is available: for a derived value resolved on pin X, look up its Table I source
item's resolution on pin X. **No manifest change is needed.** What remains is a consumer
obligation — and the failure mode if it is skipped is the one Table I exists to prevent,
reintroduced past the fix, so it is worth an acceptance test on the binder side rather than an
assumption.

### 23.2 `fp.sweep` and `irr.test-record` — the deferral can be dissolved

Both read as the `pnl.service` class, and both are phrased as *evidence noted*:

| item | text |
|---|---|
| `fp.sweep` | Last-sweep evidence noted |
| `irr.test-record` | Last certification/test date if documented |

The judgment being deferred is *"is the record the tag, or the concierge's reading of it?"*
**It does not have to be made at authoring time**, because v1.9's own N/A semantics already
cover both worlds:

- A sweep tag or a backflow test report **exists** → photograph it, and the provenance row is
  honest.
- No tag, owner's recollection only → the source item resolves N/A `none-present`, and the
  value is **declared unverifiable**, which v1.9 established is real data.

So the shape that works is the same one used everywhere else: add the artifact photo item, add
the Table I row, and let `none-present` carry the testimony case. The alternative — leaving
them unsourced — silently records testimony and artifact-read values in the same field with no
way to tell them apart, which is precisely what Table I was built to stop.

This differs from `wt.consumables`, and the difference is the boundary test: `wt.consumables`
bundles an artifact value (filter size) *and* testimony (last change) **in one field**, so no
single photograph reaches the whole value. `fp.sweep` and `irr.test-record` are one value each,
sometimes evidenced and sometimes not — which is a *resolution* state, not a split.

**Recommendation:** `fp.sweep-tag` and `irr.test-tag` (photo/standard), two Table I rows.
Owner's call, and it is a field judgment about what is actually photographable.

### 23.3 My provenance test was over-specified — same mistake, new place

It asserted the **exact** four provenance rows, so v1.10 adding two — an improvement — failed
it. Identical in shape to the alias-capitals test in §15.2: pinning incidental membership
rather than the rule.

Rewritten as a **floor**: the known rows must be present (removing one still fails — a value
silently losing its provenance), while adding rows is free. The rule itself — every source is a
photo, co-visible across inheritance — was already asserted separately and is what actually
guards the invariant.

Twice now the same failure has cost a build. The pattern to watch: **a test that enumerates
what exists will fire on every addition; a test that states what must hold will not.**

---

## 24. Is the master churn blocking the binder? Measured, 2026-07-28

The owner asked whether nine master versions in four days were warranted, given the binder
build is waiting. Straight answer, with the data.

### 24.1 The binder's actual contract has not moved once

`src/engine/export/manifestV3.ts` — the file that *is* the binder contract — has been touched
**twice in its life**:

| commit | what |
|---|---|
| `06696bb` | original build (Stage 1 §7) |
| `94f7dbe` | video as a media kind (capture-screen work) |

**Zero commits during the entire v1.3 → v1.10 master sequence.** Nine master versions, ~140
items added, three new tables, and the manifest shape the binder consumes did not change.

**Conclusion: the binder was not blocked by master churn — unless it hardcodes item ids.**
Everything version-dependent (item ids, Table D layers, Table I provenance, units) ships
*inside* the config snapshot the manifest already carries. A binder that reads the snapshot is
immune to master versions; a binder that hardcodes `wh.age` is not, and would break on the next
retirement regardless of how long we wait.

**That is the unblock, and it is worth sending:** build against manifest v3 + the config
snapshot now. Do not wait for the master to settle, because it will not — it is content, and
content grows.

### 24.2 Which rounds earned their keep — honest split

**Field-driven, clearly necessary (4):** v1.3 `choice` (prose answers unqueryable — proven by
a field export), v1.4 sub-types (freeform fixtures, proven by the owner's own entries), v1.5 §1
shutoff coverage (the emergency map could not be populated), v1.6.x `mechanical-base` (a
bungalow's shutoff map was empty).

**Guardrails — cheaper now than later, but not field-driven (4):** v1.7 Tables G/H + item
classes + emphasis ban, v1.9–v1.10 Table I provenance.

**Rework caused by defects, not by content (4):** v1.3.1, v1.4.1, v1.6.1, v1.7.1. Every one
was a fix to the previous version, and three of the four were the same root cause — a
structural fact stated in prose that the tables did not carry.

So roughly a third of the versions were rework. The guardrails added since v1.7 exist
specifically to convert that class into build failures, and they have already caught four
defects (the emphasis ban caught its own file, the gate validation caught my underscore
regression, the co-visibility check caught a wrong-object source, Table H caught nothing yet
but would catch a unit change).

### 24.3 Recommendation

**The content work is done for now.** What remains on the list — `fp.sweep-tag`,
`irr.test-tag` — is a refinement worth one more small version, not a blocker for anything.

**The next genuinely blocking item is manifest v4** for the object/concern model. That is a
shape change to the binder's contract, it is bigger than everything since v1.5 combined, and it
has not started. It is also sequenced behind the five-zone field test by the design record.

**So: freeze the master, run the walk, and unblock the binder with the v3 contract it already
has.** Master versions after that should be driven by what the walk finds, which is how v1.3
through v1.6 earned their place.

---

## 25. v1.11 intake — §9.8 closed (2026-07-28)

**Accepted and installed.** 407 → 409 items. `fp.sweep-tag` and `irr.test-tag` added
(photo/standard) with Table I rows. **Eight values sourced, one deliberately excluded and on
the record, none deferred.**

All eight resolve under the co-visibility check, inheritance composed. The two new rows are the
straightforward case — source and value on the same component — so they exercise the rule
rather than its edges.

### 25.1 The boundary distinction is now testable, which is the point

§2 carries both shapes, and they are the reason the test is a rule rather than a coin flip:

| shape | example | verdict | why |
|---|---|---|---|
| one value, sometimes evidenced | `fp.sweep` | **included** | the N/A path already models the unevidenced case |
| artifact value **and** testimony in one field | `wt.consumables` | **excluded** | no single photograph reaches the whole value |

Pinned by test. The exclusion is asserted explicitly, so `wt.consumables` remaining unsourced
is a recorded decision rather than a gap someone re-discovers.

### 25.2 Test written to the new rule

The floor now names eight items and asserts **containment**; the invariant — *every provenance
source is a photo reachable on the same object* — is asserted separately and once. Adding a
ninth row passes; removing one fails. That is the shape CLAUDE.md now requires, applied to the
test that taught the lesson.

### 25.3 Status

Master content is **complete for this cycle**. Nothing is deferred, nothing is flagged, and the
guardrails that would catch the next authoring defect are in place and have each fired at least
once on real content.

Per §24: the binder is unblocked by the manifest v3 contract it already has. The next
blocking work is manifest v4 for the object/concern model, sequenced behind the field test.

---

## 26. Design-session harvest sweep — measured against v1.11 (2026-08-08)

Seven harvested items routed here for verify-or-kill, plus two rulings. Everything below was
**measured against `src/config/checklists.generated.ts` at configVersion 1.11.0** (409 items,
18 property flags, 6 zone attributes, 33 choice items), not recalled.

### 26.1 The option-list sweep — the defect is real, and it points the other way

**Killed as stated:** *"an option reaching no flag."* There is no such mechanism. A choice
item's `options` are **plain strings** (`z.array(z.string().min(1))`, schema line 82) and
nothing anywhere maps an option value to a property flag. An option cannot reach a flag, so it
cannot fail to. No intake question is a choice item either: intake is a flat **multi-select of
the 18 flags**, grouped by Table A's `intakeSource` column (`SetupV2Screen.tsx:23–29`). "Water
source", "Sewage", "Generator" and "Cooling" are **intake groups or absent**, not option lists —
there is no cooling intake group at all.

**Confirmed, in the flag direction, and larger than reported.** A flag asked at intake that
nothing consumes is the same defect the harvest was reaching for, and there are **eight of
eighteen** — the concierge answers, and the answer changes nothing:

| flag | intake group | item triggers | list gates |
|---|---|---|---|
| `municipal_sewer` | Sewage | 0 | 0 |
| `pool` | Pool/hot tub | 0 | 0 |
| `generator` | Generator | 0 | 0 |
| `pre_1990` | Year built | 0 | 0 |
| `solar` | Solar/battery/EV | 0 | 0 |
| `ev` | Solar/battery/EV | 0 | 0 |
| `seasonal_vacancy` | Occupancy (v1.6) | 0 | 0 |
| `secondary_suite` | Secondary suite (v1.6) | 0 | 0 |

So `seasonal_vacancy` and `secondary_suite` are **not a separate finding** — they are two rows
of this table. The other ten flags are consumed (`septic` ×2, `gas` ×2, `propane` ×2,
`municipal_water`, `well`, `oil`, `wood_heat`, `waterfront`).

Some of the eight are defensible as **binder-side** facts that never need to gate a field item —
`pre_1990` conditions asbestos/knob-and-tube language in the report, not a checklist row. That is
a real answer, but it has to be *stated*, because from inside the config the two cases are
identical. **Recommendation: Table A gains a fourth column declaring each flag's consumer** —
`field` (something triggers on it) or `binder` (it travels in the manifest and is read
downstream). Then "consumed by nothing" becomes a checkable claim instead of a silence, and the
validator guard can land against the declaration rather than against a hardcoded allow-list.

**`flat_roof` — corrected.** It is *not* "declared with no intake question." It renders as a
**live toggle a client can see**, under the sanitized heading `not yet asked at intake`
(issue #63; the `heading()` sanitizer strips `⚠`, `**` and `— see §9`, and the invariant is
pinned by `captureDefects.test.ts` §7.3). Nothing triggers on it either, so it is the ninth row
of the table above with a broken heading on top. The master fix is one Table A cell.

**Also dead, and not in the harvest: two zone attributes.** `has_plumbing` and `exterior_wall`
are `askAtCreation: false` — so nothing asks them — and nothing triggers on them, so nothing
reads them. They are declared and inert at both ends. (`has_mechanicals` ×24, `sleeping` ×4,
`finished` ×1, `has_stairs` ×1 are live.)

### 26.2 The mixed-class option list — confirmed, and the consequence is measurable

**Confirmed.** Six option lists carry an escape that duplicates Table C's `naReasons`:

| item | in-list escape | duplicates |
|---|---|---|
| `att.access-honesty` | `no access` | `no-access` (**`feedsGapList: true`**) |
| `crw.access-honesty` | `no access` | `no-access` (**`feedsGapList: true`**) |
| `apm.vent` | `n/a — countertop` | `not-applicable` |
| `pol.heater` | `none` | `none-present` (**`recordsFinding: true`**) |
| `irr.type` | `none observed` | `none-present` (**`recordsFinding: true`**) |
| `hum.season` | `no damper` | `none-present` |

**Why it is a defect rather than a style question, measured.** `statusOf`
(`checklist.ts:111–118`) returns `{kind: "satisfied"}` for *any* recorded resolution that is not
`na`. So an attic answered `att.access-honesty = no access` is a **satisfied item**: it carries
no `reasonId`, it is not counted in `naCount`, and nothing marks it. The same inspector at the
same sealed hatch who instead resolves the item N/A with reason `no-access` produces an `na`
status carrying `feedsGapList: true`. **Same field fact, opposite downstream record, and the
concierge picks by which affordance they happened to tap.** That is the strongest form of the
defect: not a missing value, a *silently divergent* one.

Deliberately **not** on that list, and worth saying so: `sol.storage`'s `none` (the honest
answer to "battery storage present"), `ch.liner`'s `unlined` (a real and reportable liner
state), `deh.drainage`'s `bucket — manual`, `fp.type`'s `decorative — non-functional`. An option
naming a *state of the thing* is not an escape; only an option naming *the question's own
inapplicability* is.

**Recommendation for the bundle:** drop the six escapes and let Table C carry those cases. The
option lists get an `unknown` where they lack one; `att.access-honesty` and `crw.access-honesty`
keep their three degrees of access and lose the fourth pseudo-degree. This retires option values,
so it needs **Table G rows** (`retiredOptions`) — the schema already enforces that a retired
value is not still live, and Table G is currently empty, so this would be its first use.

### 26.3 Table H — ruling recorded, and the duplicate rides with it

**Ruling accepted and recorded for the bundle:** `m2`, `m` and `deg` are added **regardless of
the canvas/anchor decision**, because §5.4's exterior/access measurement set needs them
independently. v1.11 declares five units and no more:

```
in · psi · %RH · year · mm          (+ a second `in` row — issue #64)
```

Items actually use `in ×6, year ×5, psi ×2, %RH ×1, mm ×1`. The duplicate `in`
(`"inches"` / `"inches (lengths)"`) is issue #64 and **must land in the same pass** as the three
new rows: the generator has no uniqueness guard on Table H, so a fourth row added beside a
duplicate would be added to a table that already proves the guard is missing.

### 26.4 The three vocabulary items — specified here, deliberately NOT applied

None of the three exist in v1.11. They are Table A rows, and Table A is authored in the master —
so per CLAUDE.md's whole-file rule these are **change-requests, not edits**. Applying three
dictated cells here is exactly the shape that forked v1.2.1.

| proposed flag | label | intakeSource | notes |
|---|---|---|---|
| `attached_garage` | Attached garage | Attached garage | see the correction below |
| `prior_water_entry` | Known prior water entry | History | nothing comparable exists in v1.11 |
| `year_built_unknown` | Year built unknown | Year built | joins `pre_1990` in an existing group |

**`year_built_unknown` — verified as a real fix, and for a reason already on the record.**
"Year built" today renders as a **single toggle** (`pre_1990`). Leaving it off means *either*
"built 1990 or later" *or* "we never found out", and nothing distinguishes them. That is
precisely `PLAN-STAGE-1` §7a-iii(2): *"`false` means the box was not ticked, which is weaker
than the inspector said no."* Same class, new place.

**`attached_garage` — one correction, and it changes what the bundle has to contain.**
The claim was that its absence *"blocks `ses.alarm-coverage` from evaluating a life-safety
condition."* The premise is right — the app has names for fuel-burning appliances
(`property.gas/propane/oil`) and for a fireplace (`fireplace` pin type), but **no name for an
attached garage**: `garage` is a zone *type*, and a zone typed `garage` may be detached. The
conclusion needs one more step, though:

> **`ses.alarm-coverage` carries no trigger at all** (`trigger: undefined`) — it is a session
> item that fires on every visit, and the three CO conditions live in its prose. Adding the flag
> does not connect to it, because there is nothing there to connect to.

So the flag alone would become the **ninth** unconsumed flag in §26.1's table. To actually cash
the life-safety intent, the bundle needs the flag **and** a consumer — the straightforward one
being a CO-alarm item gated on `property.attached_garage`, so the coverage question is *asked*
where the condition holds rather than left inside a sentence a human has to re-read. That is an
owner content decision, which is why it is written here rather than built.

### 26.5 The zone-close ruling — landed in code this turn

*"An uncaptured zone is a gap — reuse `naReasons` at zone scope so the close carries a reason id
beside the free text; the candidate mechanism stays."* Built:

- `ZoneClosed` gains `reasonId?`; folds to `zone.closeReasonId`; cleared on reopen.
- The empty-zone block renders **Table C's four reasons from the config**, never a list written
  into the screen; `feedsGapList` rows are marked "→ visit two".
- The candidate button now carries **both halves** — the sentence *and* the reason id. The
  one-tap path was otherwise the only path producing an unroutable close.
- The close gate moved from `!closeNote.trim()` to `!closeReasonId`. **Stricter, not looser:**
  the old gate accepted any keystroke and produced a record nothing downstream could route.
  Free text stays optional beside it, following each reason's own `note` policy.
- `manifestV3` emits `zones[].closeReasonId` — the **id only**, never a pre-resolved gap flag.
  Per §7a-iii the emitter cannot know the receiving config, so the binder resolves the id
  against the config snapshot travelling in the same manifest. Additive and optional, exactly
  as `session.visitKind` was; no schema-version bump.

### 26.6 One finding nobody asked for: `recordsFinding` is consumed nowhere

Table C declares `feedsGapList` and `recordsFinding`. In v2, `feedsGapList` reaches the UI as a
label only (`ChecklistPanel.tsx:243`, and now the zone-close picker); **`recordsFinding` is read
by nothing at all** outside the schema. The only code that filters on `feedsGapList` is
`selectors.ts`, and that reads `config.exceptionReasons` — the **v1 route config**, a different
vocabulary (`not-accessible` / `not-applicable` / `defer-visit-two`).

This is the same shape as `guidance` (schema + renderer, no producer) and as `ZoneAttributesSet`
before #77 (fold case, no dispatcher): **a declared field with no consumer reads as working.**
It is not urgent — the manifest carries the reason ids and the binder derives — but "confirmed
absent" being real inspection data (§22.2) currently has no effect anywhere in the field app,
and that was an explicit design intent.
