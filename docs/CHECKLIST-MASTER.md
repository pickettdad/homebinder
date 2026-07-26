# HouseSteady Field Assistant — Checklist Master (v1.3.1)

**Version:** v1.3.1 · **Date:** 2026-07-26 · **Supersedes:** v1.3 (2026-07-25)
**What this is:** the source-of-truth content for v2's verification checklists — the human-editable master that `scripts/gen-checklists.mts` generates config from. Never edited downstream.

**Why this revision exists:** field test (2026-07-25, 2 zones, TestFlight) produced a proof case. `alm.power` — "how is this smoke alarm powered" — was satisfied via a free-text **note** reading "Direct power". That is a fixed, enumerable answer being captured as prose. It can't be validated, can't be queried, and won't aggregate. The same defect exists across roughly a dozen items. v1.3 adds a `choice` satisfy type and converts them.

**Changelog v1.3 → v1.3.1** (owner adjudication 2026-07-26, applied at intake):
- **§2 choice-discipline rule amended** from *always* carry an escape to: carry one **unless the option set is exhaustive and always determinable when the item is reachable**. The N/A path (`no-access`, `none-present`) is already the escape for the unreachable case. The absolute form was too strict and the master violated it in six places.
- **`unknown` added to `fp.type`** — a sealed insert with no visible plate is real — **and to `gen.fuel`** — an unlabeled unit with a buried supply line is genuinely ambiguous.
- **Four items adjudicated escape-free and left alone:** `pnl.type`, `fc.orientation`, `att.access-honesty`, `crw.access-honesty` (rationale recorded in §2).
- **`measure (year)` range:** plausible years are **1900 → current year**, rejected at entry rather than caught downstream. Applies to `wh.age` and `ft.age`.
- **Process rule (not content):** the master is edited by producing the **complete file**, never by dictating edits for transcription. Dictated edits created the v1.2.1 fork this version reconciles. Before authoring a new version, the current repo copy is sent to the author.

**Changelog v1.2 → v1.3**

*Schema:*
- **New satisfy type `choice`** — single-select from authored options. Options ride inline in the satisfy cell, mirroring the existing `measure (unit)` convention: `` choice (hardwired|battery|plug-in) ``. Satisfied by selecting exactly one option; the selected value is recorded as structured data, not prose.
- **`attest` semantics for `choice`:** `evidence` where the choice records a *property of the thing* (valve type, panel type, pipe material) — software may propose from a photo/pin but a human confirms. `action` where the choice records *what the inspector did or how far they looked* (attic access extent). Default `evidence`.
- **No compound satisfy type.** Where an item needs both photographic evidence *and* a queryable value (pipe material, drain material, dryer duct), it is **split into two items** — a `photo` item and a `choice` item. Rationale: keeps one-satisfaction-per-item, needs no new machinery, and lets each half resolve independently. Three splits below.

*Converted to `choice` (13):* `alm.power` · `alm.type` · `wm.type` · `pnl.type` · `pnl.service` · `wh.ownership` · `att.access-honesty` · `crw.access-honesty` · `fp.type` · `hb.type` · `fc.orientation` · `ch.liner` · `gen.fuel`

*Split into photo + choice (3):* `utl.pipe-material` → + `utl.pipe-material-id` · `utl.drain-material` → + `utl.drain-material-id` · `dd.material` → + `dd.material-id`

*New `ft.type`* (fuel tank configuration) split out of `ft.age` — underground tanks are a material insurance and environmental flag and must be structured, not buried in prose.

*Converted to `measure` (2) — equipment-registry backbone:* `wh.age` and `ft.age` become `measure (year)`. **Scope note, flagged deliberately:** this goes beyond the `choice` brief. Reason: the regional fleet query ("100 water softeners in the region, 15 are ~15 years old, negotiate a bulk supplier deal") requires install year as a *number*. Captured as prose it is unqueryable, and age is the single most valuable field the registry needs. Converting now costs nothing; retrofitting after a year of inspections costs the year.

*Field-test defects addressed elsewhere (not master content):* the deleted-anchor ghost pin, untyped ghost pins, and the missing zone-media viewer are app defects, tracked with Code. The component-item dialog missing "create/link pin" is likewise a UI gap — the data model already supports pin-linked resolution (`{"via":"pin","evidence":{"pinId":…}}`, observed in the field-test manifest).

*Reconciliation with v1.2.1 (added at intake, 2026-07-25).* v1.3 was authored against v1.2 and did not see v1.2.1, so three ratified v1.2.1 decisions arrived reverted. They are **carried forward**, not re-litigated:
- `fc.comparison` attest restored to **evidence** (v1.2.1 flipped it from action; establishing a comparison position is documentation, not a test — `rgh.comparison` is the precedent).
- `wh.anode` attest restored to **evidence** (same v1.2.1 rule: a note recording a property of the thing is evidence; only notes attesting to what the inspector *did* are action).
- §8 apartment/condo parked marker restored.
- Table B `askAtCreation` for `has_plumbing` / `exterior_wall` restored to the v1.2.1 `no (…)` form. v1.3 dropped the leading `no`, which the §0 dialect requires — the generator failed closed on it. Same meaning, parseable form.
The other two v1.2.1 flips (`sit.shoreline`, `hp.snow`) survived v1.3 unchanged. Everything else in v1.3 is taken as authored. If any of these three reverts was deliberate, say so and it flips back in one line.

*Carried forward, still open (unchanged from v1.2.1):* guidance text is an authored field with almost no content · monthly-scope subset has never been checked for standalone coherence · stub components remain stubs · component sub-type taxonomy (§8) still awaits telemetry.

---

## 0. Table dialect (for the generator — v1.3)

- Base/zone/session tables: `id | text | satisfy | tier | attest [| scope] [| trigger]`. Scope defaults to `[baseline]` where the column is absent.
- Component tables (§7): `id | text | satisfy | tier | attest`.
- Satisfy cell sub-parses:
  - pin types inline — `` pin `water-main` ``, alternatives `` pin `furnace|boiler|heat-pump` ``
  - measure units in parens — `measure (psi)`, `measure (year)`
  - **choice options in parens, pipe-separated — `choice (ball|gate|other|unknown)`**
- **Trigger cells:** `|` means anyOf; ids after the first inherit the prefix of the first (`property.gas|propane` ⇒ `property.gas` OR `property.propane`).
- Vocabulary tables (A–D at end): columns as declared per table.
- Malformed rows fail closed.

---

## 1. The two-axis model, plus one attachment point

Items attach three ways:
- **Zone items** — properties of the space (present from zone creation, composed by inheritance).
- **Component items** — properties of a thing (attach when a typed pin is created; travel with it).
- **Session items** — properties of the house or the visit as a whole (surface only in the session-close audit). Fewer than ten; an attachment point, not a third taxonomy.

**Inheritance:**
```
interior-base ──┬── living-space   (bedroom, living, dining, office, hall)
                ├── wet-space      (kitchen, bathroom, laundry) ── + wet-base
                └── unfinished     (basement, attic, crawlspace, garage) ── + rough-base
exterior-base ──┬── elevation
                └── site
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
| **`choice`** | **selecting exactly one authored option** | **the option value** |

**Choice discipline (amended v1.3.1):** options must be exhaustive for the realistic field cases, and **every choice carries an escape (`unknown`, `other`, or both) unless the option set is exhaustive *and* always determinable when the item is reachable.** The unreachable case already has its escape: the N/A path (`no-access`, `none-present`). An inspector who cannot determine a determinable-in-principle answer must be able to record *that*, not be forced into a wrong value.

*Escape-free by adjudication (2026-07-26):* `pnl.type` and `fc.orientation` — always determinable once you can see the thing. `att.access-honesty` and `crw.access-honesty` — `no access` **is** the answer, not an evasion; "unknown" would be incoherent, since the inspector always knows how far they went. Where `other` is selected, the UI should accept an accompanying note; where `unknown` is selected, it is a legitimate resolution and exports as such.

**Attest (always wins over satisfy kind):**
- `evidence` — the item is satisfied by something existing (nameplate photo, typed pin, entered value, an observable property). Matching evidence surfaces the item as *proposed* — one confirming human tap records it. Retiring the evidence reopens it.
- `action` — a **test** or an attestation of *what the inspector did*: satisfiable only by a deliberate human tap recording `pass | fail` (or the selected extent) + optional note. No software path may ever mark it. A *fail* prompts an issue-flagged pin so the finding lands on the canvas.

**Rendering rule (owner decision):** Documentation (`evidence`) and Tests (`action`) are separate sections in the zone panel and the close audit — never mixed. Tests are text-documented, not media-documented.

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
| `int.receptacles` | Representative receptacles tested; every GFCI tripped and reset — pin failures as issues | check | core | action | baseline | — |
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
| `rgh.wiring-legacy` | Visible wiring types noted; knob-and-tube or aluminum flagged as issue pins | note | core | action | baseline | — |
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
| `kit.appliances` | Every appliance pinned with nameplate | pin `appliance` | core | evidence |
| `kit.hood-vent` | Range hood vents to exterior (not recirculating) — traced | check | core | action |
| `kit.dw-connection` | Dishwasher supply, drain, air gap / high loop | check | standard | action |
| `kit.fridge-line` | Fridge water line type and shutoff located | check | standard | action |
| `kit.counter-gfci` | Counter receptacles GFCI-protected | check | core | action |
| `kit.fuel-range` | If gas range: shutoff accessible, connector type | check | standard | action |

### `bathroom`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `bth.toilet-secure` | Toilet secure to floor, no rock, base dry | check | core | action |
| `bth.tub-surround` | Surround, enclosure, door seals | check | standard | action |
| `bth.fan-vs-window` | Ventilation adequate for the space | check | standard | action |

### `laundry`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `lnd.hoses` | Washer hoses: type (rubber vs braided) and age documented | photo | core | evidence |
| `lnd.dryer-duct` | Dryer duct pinned | pin `dryer-duct` | core | evidence |
| `lnd.drain-standpipe` | Standpipe height and trap; laundry tub condition | check | standard | action |
| `lnd.floor-drain-pan` | Pan or floor drain present if above living space | check | standard | action |

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

Dialect: `id | text | satisfy | tier | attest`.

### `water-heater`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
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
| `hp.nameplate` | Nameplate photographed | photo | core | evidence |
| `hp.level` | Unit level; clearance maintained | check | core | action |
| `hp.disconnect` | Service disconnect present | check | core | action |
| `hp.lineset` | Line insulation condition | check | standard | action |
| `hp.condensate` | Condensate handling | check | standard | action |
| `hp.snow` | Winter snow-clearance path noted | note | standard | evidence |

### `hrv-erv`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
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
| `wpt.nameplate` | Nameplate photographed | photo | core | evidence |
| `wpt.settings` | Pressure switch settings recorded | note | core | evidence |
| `wpt.breaker` | Pump breaker located | check | core | action |
| `wpt.cycle` | Cut-in/cut-out observed | check | standard | action |
| `wpt.waterlog` | Waterlogging/short-cycling check | check | standard | action |

### `water-treatment`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wt.nameplate` | Nameplate photographed | photo | core | evidence |
| `wt.train` | Type and position in treatment train recorded | note | core | evidence |
| `wt.settings` | Settings photographed | photo | core | evidence |
| `wt.consumables` | Consumable size and last change recorded | note | core | evidence |
| `wt.errors` | Error codes noted | note | standard | evidence |
| `wt.bypass` | Bypass located | check | standard | action |

*`wt.train` stays a note pending the §8 sub-type split — once `water-softener` / `sediment-filter` / `uv` / `ro` are real component types, the "type" half becomes the pin type and only "position in train" remains.*

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

*`foil flex` and `plastic` are fire-hazard findings and should auto-prompt an issue flag.*

### `garage-door`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gd.beam` | Beam reversal tested | check | core | action |
| `gd.pressure` | Pressure reversal tested | check | core | action |
| `gd.opener` | Opener nameplate photographed | photo | standard | evidence |
| `gd.hardware` | Springs/cables visual | check | standard | action |
| `gd.release` | Manual release accessible | check | standard | action |

### `generator`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
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
| `dk.ledger` | Ledger attachment assessed | check | core | action |
| `dk.posts` | Post bases condition | check | core | action |
| `dk.rails` | Rail height; grab test | check | core | action |
| `dk.framing` | Framing condition | check | standard | action |
| `dk.stairs` | Stringers and treads | check | standard | action |

### `chimney`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
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
| `app.nameplate` | Nameplate photographed | photo | core | evidence |
| `app.type` | Type/subtype recorded | note | core | evidence |
| `app.function` | Condition/function observation | check | standard | action |

*`app.type` stays a note pending the §8 sub-type split — appliance subtypes (refrigerator, dishwasher, range…) are the clearest telemetry candidate from the field test.*

### `retaining-wall`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `rw.photo` | Photographed along its run | photo | core | evidence |
| `rw.lean` | Lean/bulge and drainage weeps assessed | check | core | action |

### Stubs (ids reserved; items TBD in a later content pass)
`ev-charger` · `solar-inverter` · `pool-equipment` · `irrigation-backflow` · `cistern` · `elevator-lift` · `dock` · `outbuilding` · `radon-fan` · `backflow-preventer` · `boiler-zone-valve`

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
| `comparison` | Comparison positions | types: comparison-position, foundation-crack |
| `all` | All pins | — |

---

## 8. Deferred content passes

- **Guidance text** — the `guidance` field is authored in the schema and almost entirely empty. This is the layer that teaches a backup operator *why* an item matters and *how* to check it. Biggest remaining content task.
- **Monthly-scope coherence** — `scope: monthly` tags are seeded but the monthly list has never been reviewed as a standalone visit. Needed before the monthly visit can run on this engine.
- **Seasonal mapping** — Master Spec §15 seasonal lists not yet converted to items.
- **Component sub-type taxonomy** (§8 change-request) — driven by nickname/freeform telemetry, not invented. `appliance` and `water-treatment` are the leading candidates; both have interim `note` items above that collapse once the split lands.
- **Stub components** — eleven types reserved with no items.
- **Binder traceability** — no item currently carries its Master Spec section reference.
- **Apartment/condo** — parked: a unit-in-a-building inspection has a different envelope/common-element model and is not addressed by this master.

## 9. Open decisions

1. **Choice escape values** — every choice includes `unknown` and/or `other`. Confirm the UI accepts a free-text note alongside `other`, and that `unknown` exports as a legitimate resolution rather than an unresolved item.
2. **Auto-flagging on choice values** — `dd.material-id = foil flex|plastic`, `utl.pipe-material-id = poly-B|Kitec|galvanized`, `ft.type = underground`, `fc.orientation = horizontal`. Should selecting these auto-prompt an issue-flagged pin, or merely record? Recommend prompt-not-force: offer, don't impose.
3. **Choice vs. multi-select** — everything here is single-select. No current item needs multi. If one appears, it's a new type, not a widened `choice`.

---

**Status:** v1.3 — adds `choice`, converts 13 items, splits 3, structures 2 ages for the equipment registry. Generator note: dialect gains `choice (a|b|c)` parsing in the satisfy cell, mirroring `measure (unit)`. Expected item count change: +4 (three splits, one `ft.type`).
