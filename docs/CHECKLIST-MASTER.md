# HouseSteady Field Assistant — Checklist Master (v1.4.1)

**Version:** v1.4.1 · **Date:** 2026-07-26 · **Supersedes:** v1.4 (2026-07-26)
**What this is:** the source-of-truth content for v2's verification checklists — the human-editable master that `scripts/gen-checklists.mts` generates config from. Never edited downstream.
**Authored from:** the v1.3.1 repo copy, per the whole-file transfer rule.

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

## 0. Table dialect (for the generator — v1.4)

- Base/zone/session tables: `id | text | satisfy | tier | attest [| scope] [| trigger]`. Scope defaults to `[baseline]` where the column is absent.
- Component tables (§7): `id | text | satisfy | tier | attest`.
- **Component inheritance** is declared in the heading: ``### `child-type` — inherits `parent-type` ``. The child's rendered list is the parent's items followed by its own. Ids remain globally unique.
- Satisfy cell sub-parses:
  - pin types inline — `` pin `water-main` ``, alternatives `` pin `furnace|boiler|heat-pump` ``
  - measure units in parens — `measure (psi)`, `measure (year)`
  - choice options in parens, pipe-separated — `choice (ball|gate|other|unknown)`
- **Trigger cells:** `|` means anyOf; ids after the first inherit the prefix of the first (`property.gas|propane` ⇒ `property.gas` OR `property.propane`).
- Vocabulary tables (A–D at end): columns as declared per table.
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

**States:** unresolved · satisfied (with evidence link) · **n/a** (reason from table C, optional note). "Confirmed absent" is real inspection data and exports in the manifest. `deferred` and `no-access` N/A land on the visit-two gap list.

**Suggestions:** deterministic zone-type priors and (Stage 2) RoomPlan candidates may propose pin types; on-demand AI may suggest when asked. Proposals touch `evidence` items only, and only as proposals. Never automatic per-photo classification.

## 3. Triggers

Closed vocabulary: `property.*` (table A) · `zone.*` (table B) · `pin.*` (presence of a pin type in the zone). Combinators: allOf / anyOf / not.

## 4. Zone taxonomy

Typed zone + editable label; **labels are display-only and never drive logic.**

| Type | Typical labels | Inherits |
|---|---|---|
| `utility` | mechanical room, furnace room | interior-base, rough-base |
| `basement` | basement, cellar, rec room | interior-base, rough-base |
| `crawlspace` | crawlspace | rough-base |
| `attic` | attic, loft access | rough-base |
| `kitchen` | kitchen, kitchenette | interior-base, wet-base |
| `bathroom` | full bath, ensuite, powder room | interior-base, wet-base |
| `laundry` | laundry, mudroom w/ washer | interior-base, wet-base |
| `living-space` | bedroom, living, dining, office, den | interior-base |
| `circulation` | hall, stairwell, entry, landing | interior-base |
| `garage` | attached garage, carport | interior-base, rough-base |
| `elevation` | north side, front, rear | exterior-base |
| `site` | grounds, driveway, yard, shoreline | exterior-base |
| `outbuilding` | shed, barn, workshop, boathouse | exterior-base, rough-base |

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
| `liv.egress` | Sleeping-room window egress: opens fully; size and sill height measured | measure | core | action | baseline | `zone.sleeping` |
| `int.owner-quirks` | Anything the owner flagged in this room verified and captured | note | standard | action | baseline | — |

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

### `utility` (renders grouped by the sub-headings)

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
| `sit.wellhead` | Wellhead pinned: cap, grade, separations | pin `wellhead` | core | evidence | `property.well` |
| `sit.septic` | Septic lids and bed area pinned; surface condition | pin `septic-lid` | core | evidence | `property.septic` |
| `sit.septic-protection` | Bed area: nothing parked, built, or deep-rooted | check | core | action | `property.septic` |
| `sit.trees` | Trees overhanging structures pinned | pin `tree` | standard | evidence | — |
| `sit.retaining` | Retaining walls pinned: lean, drainage, condition | pin `retaining-wall` | standard | evidence | — |
| `sit.shoreline` | Shoreline/dock captured; erosion comparison positions established | pin `comparison-position\|dock` | core | evidence | `property.waterfront` |
| `sit.outbuildings` | Outbuildings identified; each gets a zone if substantial | check | standard | action | — |
| `sit.measurements` | Driveway/walkway dimensions captured | measure | standard | action | — |

## 6b. Session items (session-close audit)

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `ses.alarm-coverage` | Alarm coverage judged against the pin set: smoke on every storey and outside sleeping areas; CO adjacent to sleeping areas where fuel-burning appliances, a fireplace, or an attached garage exist | check | core | action | — |
| `ses.below-recheck` | Ceilings below every wet room re-checked **after** all fixtures were run | check | core | action | — |
| `ses.termination-reconcile` | Every interior exhaust (bath fans, hood, dryer, HRV) matched to a pinned exterior termination | check | core | action | — |
| `ses.triggers-confirmed` | Intake-declared property flags confirmed or corrected on site | check | core | action | — |
| `ses.wood-heat-pinned` | Wood-burning appliance pinned and WETT flag recorded | pin `fireplace` | core | evidence | `property.wood_heat` |

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
| `wm.curbstop` | Curb-stop location noted if known | note | standard | evidence |

### `sump-pump`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `sp.pit` | Pit interior photographed | photo | core | evidence |
| `sp.bucket` | Bucket test run — pumps, discharges, shuts off | check | core | action |
| `sp.discharge` | Discharge route traced to exterior | check | core | action |
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
| `ft.type` | Tank configuration | choice (above-ground indoor\|above-ground outdoor\|underground\|propane cylinder\|unknown) | core | evidence |
| `ft.age` | Manufacture year from data plate | measure (year) | core | evidence |
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
| `fp.sweep` | Last-sweep evidence noted | note | standard | evidence |

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
| `apw.hose-age` | Hose year if marked | measure (year) | standard | evidence |
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

### `retaining-wall`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `rw.photo` | Photographed along its run | photo | core | evidence |
| `rw.lean` | Lean/bulge and drainage weeps assessed | check | core | action |

### Stubs (ids reserved; items TBD in a later content pass)
`ev-charger` · `solar-inverter` · `pool-equipment` · `irrigation-backflow` · `cistern` · `elevator-lift` · `dock` · `outbuilding` · `radon-fan` · `backflow-preventer` · `boiler-zone-valve` · `appliance-freezer` · `iron-filter`

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

## B. Zone attributes (`zone.*`)

| id | label | askAtCreation |
|---|---|---|
| `finished` | Finished space | yes |
| `sleeping` | Used for sleeping | yes |
| `has_stairs` | Contains stairs | yes |
| `has_plumbing` | Contains plumbing | no (derived from pins/observation — **reserved**, not yet consumed) |
| `exterior_wall` | Has exterior wall(s) | no (**reserved**, not yet consumed) |

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
6. **Vocabulary — "pin" now means the marker, not the entity.** Per the Object/Concern design record: an Object has a pin; a Concern has a pin. This master says "pinned" throughout, which remains correct under that reading. Entity words are Object and Concern.

---

**Status:** v1.4 — 16 new component types (5 plumbing fixtures, 7 appliance sub-types, 4 water-treatment sub-types), component inheritance added to the schema, 14 whole-unit photo items, zone items re-pointed to fixtures, Table D layer break flagged. Generator note: dialect gains heading-declared component inheritance. Expected item count change: roughly +75.
