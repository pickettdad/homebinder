# HouseSteady Field Assistant — Checklist Master (v1)

**Date:** 2026-07-22
**What this is:** the source-of-truth content for v2's verification checklists — the human-editable master that the app's config is generated from. Not a port of the v0.5 slot list; a rework in the "verify this thing" voice per REDESIGN-v2 §4.
**Relationship to other docs:** Master Spec v1 defines what the binder must contain; the Baseline Process v1 defines how the visit runs; **this file defines what must be true before a zone closes.** REDESIGN-v2 governs the app model.
**Editing discipline:** this file is edited by humans and versioned; config is generated from it, never edited independently. Same rule as always — if it isn't in the file, it didn't happen.

---

## 1. The two-axis model (ratify before content work continues)

Checklist items attach from two directions:

- **Zone items** — properties of the *space*. "Ceiling/wall/floor scanned for stains and cracks." True of a bedroom whatever is in it.
- **Component items** — properties of a *thing*. "TPR valve piped to within 6 in of floor." Travels with the water heater into whatever zone it occupies.

Creating a typed pin auto-attaches its component items to the current zone's audit (already specified in REDESIGN-v2 §3). Zone items are present from zone creation.

**Why this matters:** it kills duplication and drift. Every equipment check is authored once, in one place. A zone checklist stays short and readable because it only contains genuinely space-level checks.

**Composition (inheritance):** zone types inherit from base lists rather than repeating them.

```
interior-base ──┬── living-space   (bedroom, living, dining, office, hall)
                ├── wet-space      (kitchen, bathroom, laundry) ── inherits wet-base
                └── unfinished     (basement, attic, crawlspace, garage) ── inherits rough-base
exterior-base ──┬── elevation
                └── site
```

A bathroom's audit = `interior-base` + `wet-base` + `bathroom` + component items for every pin dropped in it.

---

## 2. Item schema (config contract)

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, `<scope>.<slug>` — never renamed; retirement is a status change, not a delete |
| `text` | string | The verification, in "is this true?" voice |
| `satisfy` | enum | `pin` · `check` · `note` · `measure` · `photo` |
| `tier` | enum | `core` (audit surfaces loudly) · `standard` (audit lists quietly) |
| `scope` | array | `baseline` · `monthly` · `seasonal:spring|summer|fall|winter` |
| `pin_type` | string? | For `satisfy: pin` — which component type satisfies it |
| `guidance` | string? | The "how/why," shown on tap. Old slot guidance is raw material here |
| `binder` | array | Master Spec section(s) this feeds, e.g. `MS§1`, `MS§7` |
| `trigger` | object? | Conditional presence (see §3) |
| `unit` | string? | For `satisfy: measure` |

**Two additions to REDESIGN-v2 §3's list** (flagging, not sneaking):
- **`measure`** — some checks are a number, not a yes: static water pressure, crack width, insulation depth. A bare check loses the value that the binder and the year-over-year comparison need.
- **`photo`** — a few items are genuinely "the photograph *is* the deliverable": nameplates, comparison positions, the shutoff map. Satisfied by an image on a pin, not by the pin existing.

**Tier discipline (the anti-noise rule):** `core` is capped at roughly 5–8 items per zone. A 12-room house at 20 loud items per room is 240 alarms and the advisory audit becomes wallpaper — the exact failure mode that makes people click through. Core = "leaving without this means a return trip or a hole in the binder." Everything else is `standard`.

**Scope tags** let one master list serve every visit type: the monthly visit runs the same engine with `scope: monthly`, seasonal items surface in their season. This is the field-OS claim made literal, and it's why the tag belongs in the schema now rather than being retrofitted.

---

## 3. Triggers (conditional presence)

Replaces the old route-level conditional blocks. Three trigger sources:

- `property.*` — from session setup: `property.well`, `property.septic`, `property.wood_heat`, `property.propane`, `property.oil`, `property.pool`, `property.generator`, `property.pre_1990`, `property.waterfront`, `property.municipal_water`, `property.municipal_sewer`
- `zone.*` — zone attributes: `zone.finished`, `zone.has_plumbing`, `zone.exterior_wall`
- `pin.*` — presence of a pin type in the zone (this is how component items attach)

---

## 4. Zone taxonomy (resolves REDESIGN-v2 §8)

**Decision: typed zone + editable label.** The type drives checklist attachment; the label is whatever the owner calls it. "Utility room" (type: `utility`) / "Mom's sewing room" (type: `living-space`).

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

Multiples are normal — four `elevation` zones, three `bathroom` zones. Pin numbers stay globally sequential across all of them.

---

## 5. Base checklists

### `interior-base` — every interior zone

| id | text | satisfy | tier | scope |
|---|---|---|---|---|
| `int.canvas` | Zone has a canvas (plan scan or wide photos covering all walls) | check | core | baseline |
| `int.surfaces` | Ceiling, walls, floor scanned for stains, cracks, slope, separation | check | core | baseline |
| `int.moisture-suspect` | Any stain or suspect area metered and the reading recorded | measure | core | baseline, monthly |
| `int.windows` | Every window operated, locked, latched; seal-fog noted | pin | standard | baseline |
| `int.doors` | Doors operate, latch, no binding | check | standard | baseline |
| `int.receptacles` | Sample of receptacles tested; every GFCI tripped and reset | pin | core | baseline |
| `int.lighting` | Switches and fixtures function | check | standard | baseline |
| `int.registers` | Supply and return registers present, unblocked, airflow confirmed | pin | standard | baseline |
| `int.alarms` | Smoke/CO coverage for this zone confirmed against requirement | pin | core | baseline, monthly |
| `int.owner-quirks` | Anything the owner flagged in this room verified and captured | note | standard | baseline |

`guidance` on `int.alarms`: smoke on every storey and outside sleeping areas; CO adjacent to sleeping areas where fuel-burning appliances, a fireplace, or an attached garage exist. Absence is a finding — pin it.

### `wet-base` — kitchen, bathroom, laundry

| id | text | satisfy | tier | scope |
|---|---|---|---|---|
| `wet.under-sink` | Every sink cabinet opened, inspected **while water runs**, floor metered | core | core | baseline, monthly |
| `wet.supply-stops` | Fixture shutoffs present, accessible, not weeping | pin | standard | baseline |
| `wet.drain-speed` | Every drain run and flow observed | check | standard | baseline, monthly |
| `wet.fan` | Exhaust fan runs, tissue test passed, termination traced to exterior | pin | core | baseline |
| `wet.caulk-grout` | Caulk and grout condition at all wet joints | check | standard | baseline |
| `wet.surround-moisture` | Tub/shower/backsplash surround metered | measure | core | baseline |
| `wet.below-check` | Ceiling in the space below re-checked **after** fixtures were run | check | core | baseline |

`wet.below-check` is the sequencing item that catches slow drips — it's why the water run threads through the visit rather than finishing in one room.

### `rough-base` — unfinished/utility spaces

| id | text | satisfy | tier | scope |
|---|---|---|---|---|
| `rgh.structure` | Visible framing, beams, posts, sill/rim inspected; movement noted | check | core | baseline |
| `rgh.foundation` | Foundation walls circuited; every crack pinned, measured, photographed with scale | pin | core | baseline |
| `rgh.comparison` | Comparison-photo positions established and pinned | pin | core | baseline |
| `rgh.moisture` | Efflorescence, staining, damp lines metered | measure | core | baseline, monthly |
| `rgh.insulation` | Insulation type and depth recorded where visible | measure | standard | baseline |
| `rgh.pests` | Droppings, frass, nesting, entry points | check | standard | baseline, monthly |
| `rgh.wiring-legacy` | Visible wiring types noted; knob-and-tube or aluminum flagged | pin | core | baseline |
| `rgh.storage-hazard` | Fuel, solvent, paint storage conditions | check | standard | baseline |

### `exterior-base`

| id | text | satisfy | tier | scope |
|---|---|---|---|---|
| `ext.wide` | Wide photo canvas covering the full elevation/area | photo | core | baseline |
| `ext.grade` | Grading slope away from foundation; standing water noted | check | core | baseline, seasonal:spring |
| `ext.cladding` | Cladding, trim, caulking condition | check | standard | baseline |
| `ext.penetrations` | Every wall penetration sealed | check | standard | baseline |
| `ext.foundation-ext` | Exterior foundation visible portion; cracks pinned | pin | core | baseline |
| `ext.roofline` | Roofline captured by pole cam — slopes, valleys, flashing, edges | photo | core | baseline |
| `ext.terminations` | Every vent termination identified and traced to its interior source | pin | core | baseline |

---

## 6. Zone checklists

Only genuinely space-level items appear here — equipment lives in §7.

### `utility` (the dense one — grouped by system for audit readability)

The field-test-2 miss happened here. This zone's audit renders **grouped**, not as a flat list.

**Heating & air**
| id | text | satisfy | tier |
|---|---|---|---|
| `utl.heat-source` | Primary heat appliance pinned | pin `furnace|boiler|heat-pump` | core |
| `utl.heat-running` | Appliance observed running (thermostat called before entering) | check | core |
| `utl.venting` | Flue/venting traced from appliance to termination | check | core |
| `utl.combustion-air` | Combustion air provision present and unobstructed | check | core |
| `utl.vent-material` | Venting material and condition recorded | note | standard |

**Water**
| id | text | satisfy | tier |
|---|---|---|---|
| `utl.main-shutoff` | Main water shutoff pinned, photographed wide, **tagged** | pin `water-main` | core |
| `utl.pipe-material` | Supply pipe material identified with close-up (copper/PEX/poly-B/Kitec/galv) | photo | core |
| `utl.drain-material` | Drain/vent material identified (ABS/cast iron/clay evidence) | photo | core |
| `utl.pressure` | Static water pressure measured | measure (psi) | core |
| `utl.water-heater` | Water heater pinned | pin `water-heater` | core |

**Drainage**
| id | text | satisfy | tier |
|---|---|---|---|
| `utl.sump` | Sump pinned and bucket-tested if present | pin `sump-pump` | core |
| `utl.floor-drain` | Floor drain located, clear, trap primed | pin `floor-drain` | standard |
| `utl.backwater` | Backwater valve located or confirmed absent | pin `backwater-valve` | core |
| `utl.cleanout` | Sewer cleanout located | pin `cleanout` | standard |

**Electrical**
| id | text | satisfy | tier |
|---|---|---|---|
| `utl.panel` | Main panel pinned; **directory photographed** | pin `electrical-panel` | core |
| `utl.panel-brand` | Panel make/model recorded; known-issue brands flagged | note | core |

**Fuel**
| id | text | satisfy | tier | trigger |
|---|---|---|---|---|
| `utl.gas-shutoff` | Gas shutoff located and pinned | pin `gas-shutoff` | core | `property.gas` |
| `utl.sniffer` | Sniffer pass at accessible fittings completed | check | core | `property.gas\|propane` |
| `utl.fuel-tank` | Oil/propane tank pinned; age and condition | pin `fuel-tank` | core | `property.oil\|propane` |

**Close-out**
| id | text | satisfy | tier |
|---|---|---|---|
| `utl.every-nameplate` | Every appliance in this room has a legible nameplate photo | photo | core |
| `utl.unidentified` | Anything unidentified pinned as freeform + chat-asked | check | standard |

### `basement`

| id | text | satisfy | tier |
|---|---|---|---|
| `bsm.ceiling-wet-rooms` | Ceiling below every wet room above examined (pre- and post-water-run) | check | core |
| `bsm.windows-wells` | Basement windows and wells; drainage, security, egress if bedroom | pin | standard |
| `bsm.finished-behind` | If finished: what's concealed noted as *not inspected* | note | core |
| `bsm.humidity` | Humidity reading recorded | measure (%RH) | standard |
| `bsm.stairs` | Stair treads, rail, headroom, lighting | check | standard |

### `kitchen`

| id | text | satisfy | tier |
|---|---|---|---|
| `kit.appliances` | Every appliance pinned with nameplate | pin | core |
| `kit.hood-vent` | Range hood vents to exterior (not recirculating) — traced | check | core |
| `kit.dw-connection` | Dishwasher supply, drain, air gap / high loop | check | standard |
| `kit.fridge-line` | Fridge water line type and shutoff | pin | standard |
| `kit.counter-gfci` | Counter receptacles GFCI-protected | check | core |
| `kit.fuel-range` | If gas range: shutoff accessible, connector type | check | standard |

### `bathroom`

| id | text | satisfy | tier |
|---|---|---|---|
| `bth.toilet-secure` | Toilet secure to floor, no rock, base dry | check | core |
| `bth.tub-surround` | Surround, enclosure, door seals | check | standard |
| `bth.fan-vs-window` | Ventilation adequate for the space | check | standard |

### `laundry`

| id | text | satisfy | tier |
|---|---|---|---|
| `lnd.hoses` | Washer hoses: type (rubber vs braided) and age | pin | core |
| `lnd.dryer-duct` | Dryer duct material, route, length, condition — **foil flex flagged** | pin `dryer-duct` | core |
| `lnd.drain-standpipe` | Standpipe height and trap; laundry tub condition | check | standard |
| `lnd.floor-drain-pan` | Pan or floor drain present if above living space | check | standard |

### `living-space` / `circulation`

Inherits `interior-base`; adds:

| id | text | satisfy | tier | trigger |
|---|---|---|---|---|
| `liv.egress` | Bedroom window egress: opens fully, size and sill height | check | core | label contains bedroom |
| `liv.fireplace` | Fireplace/stove pinned | pin `fireplace` | core | present |
| `cir.stairs-rails` | Stair rails both sides, condition, lighting, contrast | check | core | stairs |
| `cir.smoke-placement` | Smoke alarm placement vs. sleeping areas confirmed | check | core | — |

### `garage`

| id | text | satisfy | tier |
|---|---|---|---|
| `gar.door-reverse` | Overhead door auto-reverse tested — **both** beam and pressure | pin `garage-door` | core |
| `gar.fire-separation` | House door self-closes and latches; separation intact | check | core |
| `gar.co-pathway` | CO pathway to living space assessed; alarm coverage | check | core |
| `gar.slab` | Slab condition, cracks, drainage | check | standard |
| `gar.storage` | Fuel/chemical storage; extension cords in permanent use | check | standard |

### `attic`

| id | text | satisfy | tier |
|---|---|---|---|
| `att.access-honesty` | Access method recorded — *inspected from hatch* vs. traversed | note | core |
| `att.vermiculite` | **Vermiculite check — if present, STOP, photograph from hatch, disturb nothing, flag suspect ACM** | check | core |
| `att.sheathing` | Sheathing condition: staining, frost, daylight | photo | core |
| `att.insulation-depth` | Insulation depth measured with ruler in frame | measure (in) | core |
| `att.duct-terminations` | Bath/kitchen/dryer ducts actually exit the attic | check | core |
| `att.ventilation` | Soffit/ridge/gable ventilation present and unblocked | check | standard |
| `att.pests` | Nesting, droppings, entry | check | standard |

### `crawlspace`

| id | text | satisfy | tier |
|---|---|---|---|
| `crw.access-honesty` | Access method and extent recorded | note | core |
| `crw.ground-cover` | Vapour barrier present and condition | check | core |
| `crw.standing-water` | Standing water, damp soil, drainage | check | core |
| `crw.ventilation` | Vents open/closed appropriately for season and type | check | standard |

### `elevation`

| id | text | satisfy | tier |
|---|---|---|---|
| `elv.downspouts` | Every downspout pinned at its **discharge point** | pin `downspout` | core |
| `elv.hose-bibs` | Hose bibs pinned; one pressure-tested | pin `hose-bib` | core |
| `elv.windows-ext` | Windows/doors from outside: sills, flashing, seal fog | check | standard |
| `elv.deck` | Decks, steps, rails grab-tested; ledger connection | pin `deck` | core |
| `elv.chimney` | Chimney captured: cap, crown, flashing, mortar | pin `chimney` | core |
| `elv.service-entry` | Electrical service entry/mast/meter | pin | core |
| `elv.hvac-exterior` | AC/heat pump: level, clearance, line insulation | pin `ac-condenser` | core |

### `site`

| id | text | satisfy | tier | trigger |
|---|---|---|---|---|
| `sit.drainage-path` | Where water goes: swales, ditches, culverts | check | core | — |
| `sit.wellhead` | Wellhead pinned: cap, grade, separations | pin `wellhead` | core | `property.well` |
| `sit.septic` | Septic lids and bed area pinned; surface condition | pin `septic-lid` | core | `property.septic` |
| `sit.septic-protection` | Bed area: nothing parked, built, or deep-rooted | check | core | `property.septic` |
| `sit.trees` | Trees overhanging structures pinned | pin `tree` | standard | — |
| `sit.retaining` | Retaining walls: lean, drainage, condition | pin | standard | — |
| `sit.shoreline` | Shoreline/dock; erosion comparison positions established | pin | core | `property.waterfront` |
| `sit.outbuildings` | Outbuildings identified; each gets a zone if substantial | check | standard | — |
| `sit.measurements` | Driveway/walkway dimensions captured | measure | standard | — |

---

## 7. Component library — pin types and their items

Format: **`pin-type`** → items that attach when this pin is created. `[C]` = core, `[S]` = standard.

**`water-heater`** — nameplate photo `[C]` · age decoded from serial `[C]` · TPR valve present and discharge piped `[C]` · drain pan / location risk `[S]` · fittings and base dry `[C]` · venting condition `[C]` · owned vs. rented `[S]` · anode access noted `[S]`

**`furnace`** — nameplate `[C]` · filter size photographed and condition `[C]` · observed running `[C]` · heat exchanger area visible condition `[S]` · condensate path/pump `[C]` · venting `[C]` · emergency switch located `[C]` · service tag history `[S]`

**`boiler`** — nameplate `[C]` · pressure/temp gauge reading `[C]` · expansion tank `[S]` · relief valve piped `[C]` · circulator condition `[S]` · zone valves `[S]` · venting `[C]`

**`heat-pump` / `ac-condenser`** — nameplate `[C]` · level and clearance `[C]` · line insulation `[S]` · disconnect present `[C]` · condensate handling `[S]` · winter snow clearance path `[S]`

**`hrv-erv`** — nameplate `[C]` · filters checked `[C]` · balanced/running `[S]` · intake/exhaust terminations traced `[C]` · condensate drain `[S]`

**`electrical-panel`** — location photo wide `[C]` · **directory photographed** `[C]` · make/model recorded `[C]` · service size `[C]` · breaker vs. fuse `[C]` · dead-front condition (**not removed — policy**) `[C]` · no heat/odour/corrosion `[C]` · clearance in front `[S]` · subpanel presence `[S]`

**`water-main`** — wide location photo `[C]` · valve type (ball vs. gate) `[C]` · **valve tag installed** `[C]` · operated if safe / flagged if not `[C]` · curb-stop location noted `[S]`

**`sump-pump`** — pit interior photo `[C]` · **bucket test run** `[C]` · discharge route traced to exterior `[C]` · backup pump/battery status `[C]` · high-water alarm `[S]` · lid condition `[S]`

**`well-pressure-tank`** — nameplate `[C]` · pressure switch settings `[C]` · cut-in/cut-out observed `[S]` · tank condition/waterlogging `[S]` · pump breaker located `[C]`

**`water-treatment`** (softener / UV / filter / RO) — nameplate `[C]` · type and stage in train `[C]` · settings photographed `[C]` · consumable size and last change `[C]` · error codes `[S]` · bypass located `[S]`

**`smoke-alarm` / `co-alarm`** — location `[C]` · **manufacture date photographed from back** `[C]` · type `[S]` · power source `[C]` · interconnected `[S]` · test-button result `[C]`

**`gas-shutoff` / `fuel-tank`** — wide location photo `[C]` · tank age/type `[C]` · lines and regulator condition `[C]` · tank base/support `[S]` · fill/vent config `[S]`

**`fireplace`** (wood/gas/pellet) — type `[C]` · clearances to combustibles `[C]` · last sweep evidence `[S]` · **WETT-class inspection flag if wood — never cleared by us** `[C]` · gas valve located `[C]` · chimney linkage pin `[S]`

**`dryer-duct`** — material (**foil flex = finding**) `[C]` · route and approximate length `[C]` · termination flap operates `[C]` · lint condition `[S]`

**`garage-door`** — opener nameplate `[S]` · **beam reversal tested** `[C]` · **pressure reversal tested** `[C]` · springs/cables visual `[S]` · manual release accessible `[S]`

**`generator`** — nameplate `[C]` · transfer switch located `[C]` · fuel source and supply `[C]` · exercise log `[S]` · exhaust clearance `[C]`

**`foundation-crack`** — photo with scale in frame `[C]` · **width measured** `[C]` · orientation (horizontal/vertical/diagonal/stepped) `[C]` · active vs. historical indicators `[C]` · damp/efflorescence `[C]` · **comparison position established** `[C]`

**`comparison-position`** — reference photo `[C]` · what it monitors `[C]` · re-shoot interval `[C]` · framing note for repeatability `[C]`

**`wellhead`** — cap condition and seal `[C]` · grade slopes away `[C]` · separation from septic/fuel/drainage `[C]` · casing condition `[S]` · well record cross-ref `[S]` · freeze protection `[S]`

**`septic-lid`** — location photo with landmark `[C]` · lid condition and security `[C]` · depth/access notes `[S]` · effluent filter presence `[S]`

**`downspout`** — discharge point photo `[C]` · distance from foundation `[C]` · extension present `[S]` · ties to grading finding `[S]`

**`hose-bib`** — type (frost-free?) `[S]` · interior shutoff located `[C]` · leak/drip `[S]`

**`receptacle-gfci`** — location `[S]` · **trip and reset tested** `[C]` · protected circuit extent `[S]`

**`window` / `door`** — operates and latches `[S]` · seal failure `[S]` · egress dimensions if bedroom `[C]`

**`deck`** — ledger attachment `[C]` · post bases `[C]` · rail height and grab test `[C]` · framing condition `[S]` · stair stringers `[S]`

**`chimney`** — cap and screen `[C]` · crown condition `[C]` · flashing `[C]` · mortar/masonry `[S]` · liner type if known `[S]`

**`tree`** — proximity to structure `[C]` · deadwood/limbs over roof `[C]` · lean or root heave `[S]` · species if known `[S]`

**Stub types** (item lists thin, need a pass): `boiler-zone-valve`, `ev-charger`, `solar-inverter`, `pool-equipment`, `irrigation-backflow`, `cistern`, `elevator-lift`, `dock`, `retaining-wall`, `outbuilding`, `radon-fan`, `backflow-preventer`.

---

## 8. What this doesn't cover yet

- **Monthly-visit subset** — the `scope: monthly` tags are seeded but not audited as a set. A pass to confirm the monthly list is coherent standalone is its own task.
- **Seasonal items** — tagged sparsely; the Master Spec §15 seasonal lists need mapping into item form.
- **Apartment/condo zones** — parked, consistent with Scope.
- **The stub component types** above.
- **Guidance text** — schema field exists, content mostly empty. The old slot guidance is the raw material; it needs rewriting from "capture this" to "verify this, here's why."

## 9. Open decisions

1. **Ratify the two-axis model** — everything above depends on it.
2. **`measure` and `photo` satisfy types** — additions to REDESIGN-v2 §3.
3. **Core cap at 5–8/zone** — is that the right noise threshold? Field test 3 answers it.
4. **Grouped audit rendering for dense zones** (utility) — UI implication.
5. **Zone-type + editable label** — resolves §8's zone taxonomy question.
6. **Does `int.alarms` belong to the zone or to a house-level coverage audit?** Currently per-zone; a house-level "alarm coverage map" audit at session close may be the better home for the requirement check.

---

**Status:** v1 master content. Generates config; never edited downstream. Next content pass: guidance text, monthly subset coherence, stub components.
