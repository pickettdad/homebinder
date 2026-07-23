# HouseSteady Field Assistant — Checklist Master (v1.1)

**Version:** v1.1 · **Date:** 2026-07-22 · **Supersedes:** v1 (2026-07-22)
**What this is:** the source-of-truth content for v2's verification checklists — the human-editable master that `scripts/gen-checklists.mts` generates config from. Never edited downstream.
**This revision implements** `docs/CHECKLIST-MASTER-REVIEW.md`: all §2 errata; the §1 verdicts (cap restated per rendered group; grouped rendering generalized; alarm coverage moved to session level; zone-type + label ratified); the §3 runtime vocabulary as authored tables (attest, session items, property flags, zone attributes, N/A reasons, layers) so `overrides.ts` shrinks to whatever this file still cannot express.

**Changelog v1 → v1.1**
- Errata 1–9 fixed (review §2): `wet.under-sink` satisfy corrected; `property.gas` added; `liv.egress` retriggered on `zone.sleeping`; `cir.stairs-rails` on `zone.has_stairs`; `liv.fireplace` untriggered + demoted (N/A path; session catch added instead); pin-type alternatives use `a|b`; missing pin types added (`floor-drain`, `cleanout`, `backwater-valve`, `register`, `vent-termination`, `appliance`); all 18 unnamed `satisfy: pin` items resolved (typed, or re-authored as check/photo/note where the two-list model made that more honest); `binder` marked optional and dropped from tables (traceability is a later content pass).
- `attest` column authored on every item (review §3.3 + owner decision): `evidence` = software may propose satisfaction, one human tap confirms; `action` = a test — human attestation only, recorded as pass/fail + optional note, fail prompts an issue-flagged pin. Rendering: Documentation and Tests are separate sections, never mixed.
- Session items added (review §3.2 / verdict 6): alarm-coverage judgment, post-water-run re-checks (moved out of `wet-base`/`basement`), interior-exhaust ↔ exterior-termination reconciliation, intake-trigger confirmation, wood-heat pinned catch. `wet.below-check` removed; `bsm.ceiling-wet-rooms` reworded to the pre-look only.
- Tier discipline restated (verdicts 3–4): the core cap is **per rendered group** (≤ ~8 core per base list, zone list, or component list); **every** zone audit renders grouped (group keys = inheritance source + pin identity); satisfied groups collapse.
- §7 normalized to generator-parseable tables with ids; stubs carry reserved ids.

---

## 0. Table dialect (for the generator — v1.1)

- Base/zone/session tables: `id | text | satisfy | tier | attest [| scope] [| trigger]`. Scope defaults to `[baseline]` where the column is absent.
- Component tables (§7): `id | text | satisfy | tier | attest`.
- Satisfy cell sub-parses as before: pin types inline (`` pin `water-main` ``, alternatives `` pin `furnace|boiler|heat-pump` ``), measure units in parens (`measure (psi)`).
- Vocabulary tables (§§ A–E at end): columns as declared per table.
- Malformed rows fail closed.

---

## 1. The two-axis model, plus one attachment point

Items attach three ways:
- **Zone items** — properties of the space (present from zone creation, composed by inheritance).
- **Component items** — properties of a thing (attach when a typed pin is created; travel with it).
- **Session items** — properties of the house or the visit as a whole (surface only in the session-close audit; review §3.2). Fewer than ten; not a third taxonomy, an attachment point.

**Inheritance:**
```
interior-base ──┬── living-space   (bedroom, living, dining, office, hall)
                ├── wet-space      (kitchen, bathroom, laundry) ── + wet-base
                └── unfinished     (basement, attic, crawlspace, garage) ── + rough-base
exterior-base ──┬── elevation
                └── site
```

## 2. Item semantics

**Tiers & rendering:** `core` surfaces loudly at the audit; `standard` lists quietly. Cap: ≤ ~8 core **per rendered group**. Every zone audit renders grouped; satisfied groups collapse. Close is never blocked; unresolved state is recorded with the close note.

**Attest (always wins over satisfy kind):**
- `evidence` — the item is satisfied by something existing (nameplate photo, typed pin, entered value). Matching evidence surfaces the item as *proposed* — one confirming human tap records it. Retiring the evidence reopens it.
- `action` — a **test**: satisfiable only by a deliberate human tap recording `pass | fail` + optional note. No software path may ever mark it — not pin creation, not tagging, not AI. A *fail* prompts an issue-flagged pin so the finding lands on the canvas.

**Rendering rule (owner decision):** Documentation (`evidence`) and Tests (`action`) are separate sections in the zone panel and the close audit — never mixed. Tests are text-documented, not media-documented.

**States:** unresolved · satisfied (with evidence link) · **n/a** (reason from table E, optional note). "Confirmed absent" is real inspection data and exports in the manifest. `deferred` N/A lands on the visit-two gap list automatically.

**Suggestions:** deterministic zone-type priors and (Stage 2) RoomPlan candidates may propose pin types; on-demand AI may suggest when asked. Proposals touch `evidence` items only, and only as proposals. Never automatic per-photo classification.

## 3. Triggers

Closed vocabulary: `property.*` (table A) · `zone.*` (table B) · `pin.*` (presence of a pin type in the zone). Combinators: allOf / anyOf / not.

## 4. Zone taxonomy (ratified)

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

| id | text | satisfy | tier | attest | scope |
|---|---|---|---|---|---|
| `int.canvas` | Zone has a canvas (plan scan or wide photos covering all walls) | check | core | evidence | baseline |
| `int.surfaces` | Ceiling, walls, floor scanned for stains, cracks, slope, separation | check | core | action | baseline |
| `int.moisture-suspect` | Any stain or suspect area metered and the reading recorded | measure | core | action | baseline, monthly |
| `int.windows` | Windows operated, locked, latched; seal-fog noted — pin defects | check | standard | action | baseline |
| `int.doors` | Doors operate, latch, no binding | check | standard | action | baseline |
| `int.receptacles` | Representative receptacles tested; every GFCI tripped and reset — pin failures as issues | check | core | action | baseline |
| `int.lighting` | Switches and fixtures function | check | standard | action | baseline |
| `int.registers` | Supply/return registers unblocked, airflow confirmed — pin problem registers | check | standard | action | baseline |
| `int.alarms` | Smoke/CO alarms in this zone pinned (manufacture dates photographed) | pin `smoke-alarm\|co-alarm` | standard | evidence | baseline, monthly |
| `int.owner-quirks` | Anything the owner flagged in this room verified and captured | note | standard | action | baseline |

### `wet-base`

| id | text | satisfy | tier | attest | scope |
|---|---|---|---|---|---|
| `wet.under-sink` | Every sink cabinet opened and inspected **while water runs**; meter if suspect | check | core | action | baseline, monthly |
| `wet.supply-stops` | Fixture shutoffs present, accessible, not weeping | check | standard | action | baseline |
| `wet.drain-speed` | Every drain run and flow observed | check | standard | action | baseline, monthly |
| `wet.fan` | Exhaust fan runs, tissue test passed, termination traced to exterior | check | core | action | baseline |
| `wet.caulk-grout` | Caulk and grout condition at all wet joints | check | standard | action | baseline |
| `wet.surround-moisture` | Tub/shower/backsplash surround metered | measure | core | action | baseline |

*(v1's `wet.below-check` moved to session item `ses.below-recheck`.)*

### `rough-base`

| id | text | satisfy | tier | attest | scope |
|---|---|---|---|---|---|
| `rgh.structure` | Visible framing, beams, posts, sill/rim inspected; movement noted | check | core | action | baseline |
| `rgh.foundation` | Foundation walls circuited; every crack pinned, measured, photographed with scale | pin `foundation-crack` | core | action | baseline |
| `rgh.comparison` | Comparison-photo positions established and pinned | pin `comparison-position` | core | evidence | baseline |
| `rgh.moisture` | Efflorescence, staining, damp lines metered | measure | core | action | baseline, monthly |
| `rgh.insulation` | Insulation type and depth recorded where visible | measure (in) | standard | action | baseline |
| `rgh.pests` | Droppings, frass, nesting, entry points | check | standard | action | baseline, monthly |
| `rgh.wiring-legacy` | Visible wiring types noted; knob-and-tube or aluminum flagged as issue pins | note | core | action | baseline |
| `rgh.storage-hazard` | Fuel, solvent, paint storage conditions | check | standard | action | baseline |

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
| `utl.pipe-material` | Supply pipe material identified with close-up (copper/PEX/poly-B/Kitec/galv) | photo | core | evidence |
| `utl.drain-material` | Drain/vent material identified (ABS/cast iron/clay evidence) | photo | core | evidence |
| `utl.pressure` | Static water pressure measured | measure (psi) | core | action |
| `utl.water-heater` | Water heater pinned | pin `water-heater` | core | evidence |

**Drainage**
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `utl.sump` | Sump pinned and bucket-tested if present | pin `sump-pump` | core | evidence |
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
| `utl.fuel-tank` | Oil/propane tank pinned; age and condition | pin `fuel-tank` | core | evidence | `property.oil\|propane` |

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
| `bsm.finished-behind` | If finished: what's concealed recorded as *not inspected* | note | core | action |
| `bsm.humidity` | Humidity reading recorded | measure (%RH) | standard | action |
| `bsm.stairs` | Stair treads, rail, headroom, lighting | check | standard | action |

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
| `lnd.dryer-duct` | Dryer duct pinned — material, route, length; foil flex flagged | pin `dryer-duct` | core | evidence |
| `lnd.drain-standpipe` | Standpipe height and trap; laundry tub condition | check | standard | action |
| `lnd.floor-drain-pan` | Pan or floor drain present if above living space | check | standard | action |

### `living-space`

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `liv.egress` | Sleeping-room window egress: opens fully, size and sill height | measure | core | action | `zone.sleeping` |
| `liv.fireplace` | Fireplace/stove pinned if present (N/A otherwise) | pin `fireplace` | standard | evidence | — |

### `circulation`

| id | text | satisfy | tier | attest | trigger |
|---|---|---|---|---|---|
| `cir.stairs-rails` | Stair rails both sides, condition, lighting, contrast | check | core | action | `zone.has_stairs` |

### `garage`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `gar.door-reverse` | Overhead door pinned; auto-reverse tested — both beam and pressure | pin `garage-door` | core | evidence |
| `gar.fire-separation` | House door self-closes and latches; separation intact | check | core | action |
| `gar.co-pathway` | CO pathway to living space assessed; alarm coverage | check | core | action |
| `gar.slab` | Slab condition, cracks, drainage | check | standard | action |
| `gar.storage` | Fuel/chemical storage; extension cords in permanent use | check | standard | action |

### `attic`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `att.access-honesty` | Access method recorded — *inspected from hatch* vs. traversed | note | core | action |
| `att.vermiculite` | Vermiculite check — if present: STOP, photograph from hatch, disturb nothing, flag suspect ACM | check | core | action |
| `att.sheathing` | Sheathing condition captured: staining, frost, daylight | photo | core | evidence |
| `att.insulation-depth` | Insulation depth measured with ruler in frame | measure (in) | core | action |
| `att.duct-terminations` | Bath/kitchen/dryer ducts actually exit the attic | check | core | action |
| `att.ventilation` | Soffit/ridge/gable ventilation present and unblocked | check | standard | action |
| `att.pests` | Nesting, droppings, entry | check | standard | action |

### `crawlspace`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `crw.access-honesty` | Access method and extent recorded | note | core | action |
| `crw.ground-cover` | Vapour barrier present and condition | check | core | action |
| `crw.standing-water` | Standing water, damp soil, drainage | check | core | action |
| `crw.ventilation` | Vents open/closed appropriately for season and type | check | standard | action |

### `elevation`

| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `elv.downspouts` | Every downspout pinned at its discharge point | pin `downspout` | core | evidence |
| `elv.hose-bibs` | Hose bibs pinned; one pressure-tested | pin `hose-bib` | core | evidence |
| `elv.windows-ext` | Windows/doors from outside: sills, flashing, seal fog | check | standard | action |
| `elv.deck` | Decks/steps pinned; rails grab-tested; ledger connection | pin `deck` | core | evidence |
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
| `sit.shoreline` | Shoreline/dock captured; erosion comparison positions established | pin `comparison-position\|dock` | core | action | `property.waterfront` |
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

## 7. Component library (normalized tables)

Dialect: `id | text | satisfy | tier | attest`.

### `water-heater`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wh.nameplate` | Nameplate photographed legibly | photo | core | evidence |
| `wh.age` | Age decoded from serial and recorded | note | core | evidence |
| `wh.tpr` | TPR valve present; discharge piped toward floor | check | core | action |
| `wh.fittings` | Fittings and base dry; no rust trails | check | core | action |
| `wh.venting` | Venting condition and connection | check | core | action |
| `wh.pan` | Drain pan / location risk assessed | check | standard | action |
| `wh.ownership` | Owned vs. rented recorded | note | standard | evidence |
| `wh.anode` | Anode access noted | note | standard | action |

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
| `blr.pressure` | Operating pressure/temp reading recorded | measure (psi) | core | action |
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
| `hp.snow` | Winter snow-clearance path noted | note | standard | action |

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
| `pnl.service` | Service size recorded | note | core | evidence |
| `pnl.type` | Breaker vs. fuse recorded | note | core | evidence |
| `pnl.exterior` | Dead-front on (policy: never removed); exterior condition — no heat, odour, corrosion | check | core | action |
| `pnl.clearance` | Working clearance in front | check | standard | action |
| `pnl.subs` | Subpanels noted | note | standard | evidence |

### `water-main`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `wm.wide` | Photographed wide enough to locate | photo | core | evidence |
| `wm.type` | Valve type recorded (ball vs. gate) | note | core | evidence |
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

### `smoke-alarm` / `co-alarm` (shared items)
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `alm.date` | Manufacture date photographed from back | photo | core | evidence |
| `alm.power` | Power source recorded | note | core | evidence |
| `alm.test` | Test button — sounds | check | core | action |
| `alm.type` | Type recorded | note | standard | evidence |
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
| `ft.age` | Age/type recorded | note | core | evidence |
| `ft.lines` | Lines and regulator condition | check | core | action |
| `ft.base` | Base/support condition | check | standard | action |
| `ft.fill` | Fill/vent configuration noted | note | standard | evidence |

### `fireplace`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fp.type` | Type recorded (wood/gas/pellet) | note | core | evidence |
| `fp.clearances` | Clearances to combustibles | check | core | action |
| `fp.wett` | Wood: WETT-class inspection flag recorded — never cleared by us | check | core | action |
| `fp.gas-valve` | Gas: valve located | check | core | action |
| `fp.sweep` | Last-sweep evidence noted | note | standard | evidence |

### `dryer-duct`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `dd.material` | Material photographed — foil flex = finding | photo | core | evidence |
| `dd.route` | Route and approximate length recorded | note | core | evidence |
| `dd.flap` | Termination flap operates | check | core | action |
| `dd.lint` | Lint condition | check | standard | action |

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
| `gen.fuel` | Fuel source and supply recorded | note | core | evidence |
| `gen.exhaust` | Exhaust clearance from openings | check | core | action |
| `gen.log` | Exercise log noted | note | standard | evidence |

### `foundation-crack`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `fc.photo` | Photographed with scale in frame | photo | core | evidence |
| `fc.width` | Maximum width measured | measure (mm) | core | action |
| `fc.orientation` | Orientation recorded (horiz/vert/diag/stepped) | note | core | evidence |
| `fc.activity` | Active vs. historical indicators assessed | check | core | action |
| `fc.moisture` | Damp/efflorescence at crack | check | core | action |
| `fc.comparison` | Comparison position established | pin `comparison-position` | core | action |

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
| `hb.type` | Frost-free or standard recorded | note | standard | evidence |
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
| `ch.liner` | Liner type if known | note | standard | evidence |

### `tree`
| id | text | satisfy | tier | attest |
|---|---|---|---|---|
| `tr.proximity` | Proximity to structures recorded | note | core | evidence |
| `tr.deadwood` | Deadwood/limbs over roof assessed | check | core | action |
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
| `has_plumbing` | Contains plumbing | no (derived from pins/observation) |
| `exterior_wall` | Has exterior wall(s) | no |

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

## 8. Deferred content passes (unchanged from v1 §8)

Monthly-subset coherence · seasonal mapping · stub components · guidance text (schema field exists; old slot guidance is raw material) · binder traceability marks.

**Status:** v1.1 — implements CHECKLIST-MASTER-REVIEW in full. Generator note: dialect gains the `attest` column and tables A–D; `overrides.ts` should shrink to layers-only or empty.
