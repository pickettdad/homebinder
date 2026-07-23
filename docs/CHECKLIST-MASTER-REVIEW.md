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
