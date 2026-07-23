/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: docs/CHECKLIST-MASTER.md (human-edited, versioned).
 * Regenerate with: npm run gen:checklists
 * CI fails if this file does not byte-match a fresh regeneration (tests/engine/checklists.test.ts).
 */
import type { ChecklistConfigInput } from "../engine/schema/checklistConfig";

export const checklistsBaseline: ChecklistConfigInput = {
  "configId": "checklists-baseline",
  "configVersion": "1.2.0",
  "propertyFlags": [
    {
      "id": "municipal_water",
      "label": "Municipal water",
      "intakeSource": "Water source"
    },
    {
      "id": "well",
      "label": "Private well",
      "intakeSource": "Water source"
    },
    {
      "id": "municipal_sewer",
      "label": "Municipal sewer",
      "intakeSource": "Sewage"
    },
    {
      "id": "septic",
      "label": "Septic system",
      "intakeSource": "Sewage"
    },
    {
      "id": "gas",
      "label": "Natural gas service",
      "intakeSource": "Fuel on property"
    },
    {
      "id": "propane",
      "label": "Propane on property",
      "intakeSource": "Fuel on property"
    },
    {
      "id": "oil",
      "label": "Oil on property",
      "intakeSource": "Fuel on property"
    },
    {
      "id": "wood_heat",
      "label": "Wood-burning appliance",
      "intakeSource": "Wood-burning appliance"
    },
    {
      "id": "pool",
      "label": "Pool or hot tub",
      "intakeSource": "Pool/hot tub"
    },
    {
      "id": "generator",
      "label": "Generator",
      "intakeSource": "Generator"
    },
    {
      "id": "waterfront",
      "label": "Waterfront/shoreline",
      "intakeSource": "Waterfront"
    },
    {
      "id": "pre_1990",
      "label": "Built before ~1990",
      "intakeSource": "Year built"
    },
    {
      "id": "solar",
      "label": "Solar/battery",
      "intakeSource": "Solar/battery/EV"
    },
    {
      "id": "ev",
      "label": "EV charging",
      "intakeSource": "Solar/battery/EV"
    }
  ],
  "zoneAttributes": [
    {
      "id": "finished",
      "label": "Finished space",
      "askAtCreation": true
    },
    {
      "id": "sleeping",
      "label": "Used for sleeping",
      "askAtCreation": true
    },
    {
      "id": "has_stairs",
      "label": "Contains stairs",
      "askAtCreation": true
    },
    {
      "id": "has_plumbing",
      "label": "Contains plumbing",
      "askAtCreation": false
    },
    {
      "id": "exterior_wall",
      "label": "Has exterior wall(s)",
      "askAtCreation": false
    }
  ],
  "zoneTypes": [
    {
      "id": "utility",
      "typicalLabels": [
        "mechanical room",
        "furnace room"
      ],
      "inherits": [
        "interior-base",
        "rough-base"
      ]
    },
    {
      "id": "basement",
      "typicalLabels": [
        "basement",
        "cellar",
        "rec room"
      ],
      "inherits": [
        "interior-base",
        "rough-base"
      ]
    },
    {
      "id": "crawlspace",
      "typicalLabels": [
        "crawlspace"
      ],
      "inherits": [
        "rough-base"
      ]
    },
    {
      "id": "attic",
      "typicalLabels": [
        "attic",
        "loft access"
      ],
      "inherits": [
        "rough-base"
      ]
    },
    {
      "id": "kitchen",
      "typicalLabels": [
        "kitchen",
        "kitchenette"
      ],
      "inherits": [
        "interior-base",
        "wet-base"
      ]
    },
    {
      "id": "bathroom",
      "typicalLabels": [
        "full bath",
        "ensuite",
        "powder room"
      ],
      "inherits": [
        "interior-base",
        "wet-base"
      ]
    },
    {
      "id": "laundry",
      "typicalLabels": [
        "laundry",
        "mudroom w/ washer"
      ],
      "inherits": [
        "interior-base",
        "wet-base"
      ]
    },
    {
      "id": "living-space",
      "typicalLabels": [
        "bedroom",
        "living",
        "dining",
        "office",
        "den"
      ],
      "inherits": [
        "interior-base"
      ]
    },
    {
      "id": "circulation",
      "typicalLabels": [
        "hall",
        "stairwell",
        "entry",
        "landing"
      ],
      "inherits": [
        "interior-base"
      ]
    },
    {
      "id": "garage",
      "typicalLabels": [
        "attached garage",
        "carport"
      ],
      "inherits": [
        "interior-base",
        "rough-base"
      ]
    },
    {
      "id": "elevation",
      "typicalLabels": [
        "north side",
        "front",
        "rear"
      ],
      "inherits": [
        "exterior-base"
      ]
    },
    {
      "id": "site",
      "typicalLabels": [
        "grounds",
        "driveway",
        "yard",
        "shoreline"
      ],
      "inherits": [
        "exterior-base"
      ]
    },
    {
      "id": "outbuilding",
      "typicalLabels": [
        "shed",
        "barn",
        "workshop",
        "boathouse"
      ],
      "inherits": [
        "exterior-base",
        "rough-base"
      ]
    }
  ],
  "baseLists": [
    {
      "id": "interior-base",
      "items": [
        {
          "id": "int.canvas",
          "text": "Zone has a canvas (plan scan or wide photos covering all walls)",
          "satisfy": "check",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.surfaces",
          "text": "Ceiling, walls, floor scanned for stains, cracks, slope, separation",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.moisture-suspect",
          "text": "Any stain or suspect area metered and the reading recorded",
          "satisfy": "measure",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "int.windows",
          "text": "Windows operated, locked, latched; seal-fog noted — pin defects",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.doors",
          "text": "Doors operate, latch, no binding",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.receptacles",
          "text": "Representative receptacles tested; every GFCI tripped and reset — pin failures as issues",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.lighting",
          "text": "Switches and fixtures function",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.registers",
          "text": "Supply/return registers unblocked, airflow confirmed — pin problem registers",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "int.alarms",
          "text": "Smoke/CO alarms in this zone pinned (manufacture dates photographed)",
          "satisfy": "pin",
          "pinTypes": [
            "smoke-alarm",
            "co-alarm"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "liv.egress",
          "text": "Sleeping-room window egress: opens fully; size and sill height measured",
          "satisfy": "measure",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.sleeping"
            ]
          }
        },
        {
          "id": "int.owner-quirks",
          "text": "Anything the owner flagged in this room verified and captured",
          "satisfy": "note",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "id": "wet-base",
      "items": [
        {
          "id": "wet.under-sink",
          "text": "Every sink cabinet opened and inspected **while water runs**; meter if suspect",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "wet.supply-stops",
          "text": "Fixture shutoffs present, accessible, not weeping",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wet.drain-speed",
          "text": "Every drain run and flow observed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "wet.fan",
          "text": "Exhaust fan runs, tissue test passed, termination traced to exterior",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wet.caulk-grout",
          "text": "Caulk and grout condition at all wet joints",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wet.surround-moisture",
          "text": "Tub/shower/backsplash surround metered",
          "satisfy": "measure",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "id": "rough-base",
      "items": [
        {
          "id": "rgh.structure",
          "text": "Visible framing, beams, posts, sill/rim inspected; movement noted",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rgh.foundation",
          "text": "Foundation walls circuited; every crack pinned, measured, photographed with scale",
          "satisfy": "pin",
          "pinTypes": [
            "foundation-crack"
          ],
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rgh.comparison",
          "text": "Comparison-photo positions established and pinned",
          "satisfy": "pin",
          "pinTypes": [
            "comparison-position"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rgh.moisture",
          "text": "Efflorescence, staining, damp lines metered",
          "satisfy": "measure",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "rgh.insulation",
          "text": "Insulation type and depth recorded where visible",
          "satisfy": "measure",
          "unit": "in",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rgh.pests",
          "text": "Droppings, frass, nesting, entry points",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline",
            "monthly"
          ]
        },
        {
          "id": "rgh.wiring-legacy",
          "text": "Visible wiring types noted; knob-and-tube or aluminum flagged as issue pins",
          "satisfy": "note",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rgh.storage-hazard",
          "text": "Fuel, solvent, paint storage conditions",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "id": "exterior-base",
      "items": [
        {
          "id": "ext.wide",
          "text": "Wide photo canvas covering the full elevation/area",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ext.grade",
          "text": "Grading slope away from foundation; standing water noted",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline",
            "seasonal:spring"
          ]
        },
        {
          "id": "ext.cladding",
          "text": "Cladding, trim, caulking condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ext.penetrations",
          "text": "Every wall penetration sealed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ext.foundation-ext",
          "text": "Exterior visible foundation inspected; cracks pinned",
          "satisfy": "pin",
          "pinTypes": [
            "foundation-crack"
          ],
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ext.roofline",
          "text": "Roofline captured by pole cam — slopes, valleys, flashing, edges",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ext.terminations",
          "text": "Every vent termination pinned and traced to its interior source",
          "satisfy": "pin",
          "pinTypes": [
            "vent-termination"
          ],
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    }
  ],
  "zoneLists": [
    {
      "zoneType": "utility",
      "items": [
        {
          "id": "utl.heat-source",
          "text": "Primary heat appliance pinned",
          "satisfy": "pin",
          "pinTypes": [
            "furnace",
            "boiler",
            "heat-pump"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Heating & air"
        },
        {
          "id": "utl.heat-running",
          "text": "Appliance observed running (thermostat called first)",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "group": "Heating & air"
        },
        {
          "id": "utl.venting",
          "text": "Flue/venting traced from appliance to termination",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "group": "Heating & air"
        },
        {
          "id": "utl.combustion-air",
          "text": "Combustion air provision present and unobstructed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "group": "Heating & air"
        },
        {
          "id": "utl.vent-material",
          "text": "Venting material and condition recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Heating & air"
        },
        {
          "id": "utl.main-shutoff",
          "text": "Main water shutoff pinned, photographed wide, tagged",
          "satisfy": "pin",
          "pinTypes": [
            "water-main"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.pipe-material",
          "text": "Supply pipe material identified with close-up (copper/PEX/poly-B/Kitec/galv)",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.drain-material",
          "text": "Drain/vent material identified (ABS/cast iron/clay evidence)",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.pressure",
          "text": "Static water pressure measured (gauge threads onto any hose bib)",
          "satisfy": "measure",
          "unit": "psi",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.water-heater",
          "text": "Water heater pinned",
          "satisfy": "pin",
          "pinTypes": [
            "water-heater"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.sump",
          "text": "Sump pump pinned if present",
          "satisfy": "pin",
          "pinTypes": [
            "sump-pump"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Drainage"
        },
        {
          "id": "utl.floor-drain",
          "text": "Floor drain located, clear, trap primed",
          "satisfy": "pin",
          "pinTypes": [
            "floor-drain"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Drainage"
        },
        {
          "id": "utl.backwater",
          "text": "Backwater valve located or confirmed absent",
          "satisfy": "pin",
          "pinTypes": [
            "backwater-valve"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Drainage"
        },
        {
          "id": "utl.cleanout",
          "text": "Sewer cleanout located",
          "satisfy": "pin",
          "pinTypes": [
            "cleanout"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Drainage"
        },
        {
          "id": "utl.panel",
          "text": "Main panel pinned; directory photographed",
          "satisfy": "pin",
          "pinTypes": [
            "electrical-panel"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Electrical"
        },
        {
          "id": "utl.panel-brand",
          "text": "Panel make/model recorded; known-issue brands flagged",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Electrical"
        },
        {
          "id": "utl.gas-shutoff",
          "text": "Gas shutoff located and pinned",
          "satisfy": "pin",
          "pinTypes": [
            "gas-shutoff"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.gas"
            ]
          },
          "group": "Fuel"
        },
        {
          "id": "utl.sniffer",
          "text": "Sniffer pass at accessible fittings completed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.gas",
              "property.propane"
            ]
          },
          "group": "Fuel"
        },
        {
          "id": "utl.fuel-tank",
          "text": "Oil/propane tank pinned; age and condition",
          "satisfy": "pin",
          "pinTypes": [
            "fuel-tank"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.oil",
              "property.propane"
            ]
          },
          "group": "Fuel"
        },
        {
          "id": "utl.every-nameplate",
          "text": "Every appliance in this room has a legible nameplate photo",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Close-out"
        },
        {
          "id": "utl.unidentified",
          "text": "Anything unidentified pinned as freeform and chat-asked",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "group": "Close-out"
        }
      ]
    },
    {
      "zoneType": "basement",
      "items": [
        {
          "id": "bsm.ceiling-wet-rooms",
          "text": "Ceiling below every wet room above examined (pre-water-run look)",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bsm.windows-wells",
          "text": "Basement windows and wells: drainage, security; egress if sleeping zone",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bsm.finished-behind",
          "text": "If finished: what's concealed recorded as *not inspected*",
          "satisfy": "note",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bsm.humidity",
          "text": "Humidity reading recorded",
          "satisfy": "measure",
          "unit": "%RH",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bsm.stairs",
          "text": "Stair treads, rail, headroom, lighting",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "kitchen",
      "items": [
        {
          "id": "kit.appliances",
          "text": "Every appliance pinned with nameplate",
          "satisfy": "pin",
          "pinTypes": [
            "appliance"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.hood-vent",
          "text": "Range hood vents to exterior (not recirculating) — traced",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.dw-connection",
          "text": "Dishwasher supply, drain, air gap / high loop",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.fridge-line",
          "text": "Fridge water line type and shutoff located",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.counter-gfci",
          "text": "Counter receptacles GFCI-protected",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.fuel-range",
          "text": "If gas range: shutoff accessible, connector type",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "bathroom",
      "items": [
        {
          "id": "bth.toilet-secure",
          "text": "Toilet secure to floor, no rock, base dry",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bth.tub-surround",
          "text": "Surround, enclosure, door seals",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bth.fan-vs-window",
          "text": "Ventilation adequate for the space",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "laundry",
      "items": [
        {
          "id": "lnd.hoses",
          "text": "Washer hoses: type (rubber vs braided) and age documented",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.dryer-duct",
          "text": "Dryer duct pinned — material, route, length; foil flex flagged",
          "satisfy": "pin",
          "pinTypes": [
            "dryer-duct"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.drain-standpipe",
          "text": "Standpipe height and trap; laundry tub condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.floor-drain-pan",
          "text": "Pan or floor drain present if above living space",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "living-space",
      "items": [
        {
          "id": "liv.fireplace",
          "text": "Fireplace/stove pinned if present (N/A otherwise)",
          "satisfy": "pin",
          "pinTypes": [
            "fireplace"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "circulation",
      "items": [
        {
          "id": "cir.stairs-rails",
          "text": "Stair rails both sides, condition, lighting, contrast",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.has_stairs"
            ]
          }
        }
      ]
    },
    {
      "zoneType": "garage",
      "items": [
        {
          "id": "gar.door-reverse",
          "text": "Overhead door and opener pinned",
          "satisfy": "pin",
          "pinTypes": [
            "garage-door"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gar.fire-separation",
          "text": "House door self-closes and latches; separation intact",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gar.co-pathway",
          "text": "CO pathway to living space assessed; alarm coverage",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gar.slab",
          "text": "Slab condition, cracks, drainage",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gar.storage",
          "text": "Fuel/chemical storage; extension cords in permanent use",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "attic",
      "items": [
        {
          "id": "att.access-honesty",
          "text": "Access method recorded — *inspected from hatch* vs. traversed",
          "satisfy": "note",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.vermiculite",
          "text": "Vermiculite check — if present: STOP, photograph from hatch, disturb nothing, flag suspect ACM",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.sheathing",
          "text": "Sheathing condition captured: staining, frost, daylight",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.insulation-depth",
          "text": "Insulation depth measured with ruler in frame",
          "satisfy": "measure",
          "unit": "in",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.duct-terminations",
          "text": "Bath/kitchen/dryer ducts actually exit the attic",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.ventilation",
          "text": "Soffit/ridge/gable ventilation present and unblocked",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "att.pests",
          "text": "Nesting, droppings, entry",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "crawlspace",
      "items": [
        {
          "id": "crw.access-honesty",
          "text": "Access method and extent recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "crw.ground-cover",
          "text": "Vapour barrier present and condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "crw.standing-water",
          "text": "Standing water, damp soil, drainage",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "crw.ventilation",
          "text": "Vents open/closed appropriately for season and type",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "elevation",
      "items": [
        {
          "id": "elv.downspouts",
          "text": "Every downspout pinned at its discharge point",
          "satisfy": "pin",
          "pinTypes": [
            "downspout"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.hose-bibs",
          "text": "Hose bibs pinned",
          "satisfy": "pin",
          "pinTypes": [
            "hose-bib"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.windows-ext",
          "text": "Windows/doors from outside: sills, flashing, seal fog",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.deck",
          "text": "Decks and steps pinned",
          "satisfy": "pin",
          "pinTypes": [
            "deck"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.chimney",
          "text": "Chimney pinned: cap, crown, flashing, mortar",
          "satisfy": "pin",
          "pinTypes": [
            "chimney"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.service-entry",
          "text": "Electrical service entry, mast, meter captured",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "elv.hvac-exterior",
          "text": "AC/heat pump pinned: level, clearance, line insulation",
          "satisfy": "pin",
          "pinTypes": [
            "heat-pump"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "zoneType": "site",
      "items": [
        {
          "id": "sit.drainage-path",
          "text": "Where water goes: swales, ditches, culverts",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sit.wellhead",
          "text": "Wellhead pinned: cap, grade, separations",
          "satisfy": "pin",
          "pinTypes": [
            "wellhead"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.well"
            ]
          }
        },
        {
          "id": "sit.septic",
          "text": "Septic lids and bed area pinned; surface condition",
          "satisfy": "pin",
          "pinTypes": [
            "septic-lid"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.septic"
            ]
          }
        },
        {
          "id": "sit.septic-protection",
          "text": "Bed area: nothing parked, built, or deep-rooted",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.septic"
            ]
          }
        },
        {
          "id": "sit.trees",
          "text": "Trees overhanging structures pinned",
          "satisfy": "pin",
          "pinTypes": [
            "tree"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sit.retaining",
          "text": "Retaining walls pinned: lean, drainage, condition",
          "satisfy": "pin",
          "pinTypes": [
            "retaining-wall"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sit.shoreline",
          "text": "Shoreline/dock captured; erosion comparison positions established",
          "satisfy": "pin",
          "pinTypes": [
            "comparison-position",
            "dock"
          ],
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.waterfront"
            ]
          }
        },
        {
          "id": "sit.outbuildings",
          "text": "Outbuildings identified; each gets a zone if substantial",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sit.measurements",
          "text": "Driveway/walkway dimensions captured",
          "satisfy": "measure",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    }
  ],
  "sessionItems": [
    {
      "id": "ses.alarm-coverage",
      "text": "Alarm coverage judged against the pin set: smoke on every storey and outside sleeping areas; CO adjacent to sleeping areas where fuel-burning appliances, a fireplace, or an attached garage exist",
      "satisfy": "check",
      "tier": "core",
      "attest": "action",
      "scope": [
        "baseline"
      ]
    },
    {
      "id": "ses.below-recheck",
      "text": "Ceilings below every wet room re-checked **after** all fixtures were run",
      "satisfy": "check",
      "tier": "core",
      "attest": "action",
      "scope": [
        "baseline"
      ]
    },
    {
      "id": "ses.termination-reconcile",
      "text": "Every interior exhaust (bath fans, hood, dryer, HRV) matched to a pinned exterior termination",
      "satisfy": "check",
      "tier": "core",
      "attest": "action",
      "scope": [
        "baseline"
      ]
    },
    {
      "id": "ses.triggers-confirmed",
      "text": "Intake-declared property flags confirmed or corrected on site",
      "satisfy": "check",
      "tier": "core",
      "attest": "action",
      "scope": [
        "baseline"
      ]
    },
    {
      "id": "ses.wood-heat-pinned",
      "text": "Wood-burning appliance pinned and WETT flag recorded",
      "satisfy": "pin",
      "pinTypes": [
        "fireplace"
      ],
      "tier": "core",
      "attest": "evidence",
      "scope": [
        "baseline"
      ],
      "trigger": {
        "anyOf": [
          "property.wood_heat"
        ]
      }
    }
  ],
  "componentLists": [
    {
      "types": [
        "water-heater"
      ],
      "items": [
        {
          "id": "wh.nameplate",
          "text": "Nameplate photographed legibly",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.age",
          "text": "Age decoded from serial and recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.tpr",
          "text": "TPR valve present; discharge piped toward floor",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.fittings",
          "text": "Fittings and base dry; no rust trails",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.venting",
          "text": "Venting condition and connection",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.pan",
          "text": "Drain pan / location risk assessed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.ownership",
          "text": "Owned vs. rented recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wh.anode",
          "text": "Anode access noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "furnace"
      ],
      "items": [
        {
          "id": "fur.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.filter",
          "text": "Filter size photographed; condition noted",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.running",
          "text": "Observed running through a heat call",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.condensate",
          "text": "Condensate path/pump flowing",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.venting",
          "text": "Venting condition and route",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.switch",
          "text": "Emergency switch located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.hx-area",
          "text": "Visible heat-exchanger area condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fur.service-tags",
          "text": "Service-tag history photographed",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "boiler"
      ],
      "items": [
        {
          "id": "blr.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.pressure",
          "text": "Operating pressure/temp reading recorded",
          "satisfy": "measure",
          "unit": "psi",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.relief",
          "text": "Relief valve piped",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.venting",
          "text": "Venting condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.expansion",
          "text": "Expansion tank condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.circulator",
          "text": "Circulator condition/noise",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "blr.zones",
          "text": "Zone valves/manifolds noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "heat-pump"
      ],
      "items": [
        {
          "id": "hp.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hp.level",
          "text": "Unit level; clearance maintained",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hp.disconnect",
          "text": "Service disconnect present",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hp.lineset",
          "text": "Line insulation condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hp.condensate",
          "text": "Condensate handling",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hp.snow",
          "text": "Winter snow-clearance path noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "note": "also serves AC condensers"
    },
    {
      "types": [
        "hrv-erv"
      ],
      "items": [
        {
          "id": "hrv.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hrv.filters",
          "text": "Filters checked",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hrv.terminations",
          "text": "Intake/exhaust terminations traced",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hrv.running",
          "text": "Running/balanced observation",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hrv.condensate",
          "text": "Condensate drain flowing",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "electrical-panel"
      ],
      "items": [
        {
          "id": "pnl.wide",
          "text": "Location photographed wide",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.directory",
          "text": "Directory photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.brand",
          "text": "Make/model recorded; known-issue brands flagged",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.service",
          "text": "Service size recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.type",
          "text": "Breaker vs. fuse recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.exterior",
          "text": "Dead-front on (policy: never removed); exterior condition — no heat, odour, corrosion",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.clearance",
          "text": "Working clearance in front",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.subs",
          "text": "Subpanels noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "water-main"
      ],
      "items": [
        {
          "id": "wm.wide",
          "text": "Photographed wide enough to locate",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wm.type",
          "text": "Valve type recorded (ball vs. gate)",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wm.tag",
          "text": "Valve tag installed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wm.operate",
          "text": "Operated if safe (ball, good condition); flagged if not",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wm.curbstop",
          "text": "Curb-stop location noted if known",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "sump-pump"
      ],
      "items": [
        {
          "id": "sp.pit",
          "text": "Pit interior photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sp.bucket",
          "text": "Bucket test run — pumps, discharges, shuts off",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sp.discharge",
          "text": "Discharge route traced to exterior",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sp.backup",
          "text": "Backup pump/battery status",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sp.alarm",
          "text": "High-water alarm present/tested",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sp.lid",
          "text": "Lid condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "well-pressure-tank"
      ],
      "items": [
        {
          "id": "wpt.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wpt.settings",
          "text": "Pressure switch settings recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wpt.breaker",
          "text": "Pump breaker located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wpt.cycle",
          "text": "Cut-in/cut-out observed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wpt.waterlog",
          "text": "Waterlogging/short-cycling check",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "water-treatment"
      ],
      "items": [
        {
          "id": "wt.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wt.train",
          "text": "Type and position in treatment train recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wt.settings",
          "text": "Settings photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wt.consumables",
          "text": "Consumable size and last change recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wt.errors",
          "text": "Error codes noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wt.bypass",
          "text": "Bypass located",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "smoke-alarm",
        "co-alarm"
      ],
      "items": [
        {
          "id": "alm.date",
          "text": "Manufacture date photographed from back",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "alm.power",
          "text": "Power source recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "alm.test",
          "text": "Test button — sounds",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "alm.type",
          "text": "Type recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "alm.interconnect",
          "text": "Interconnection noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ],
      "note": "shared items"
    },
    {
      "types": [
        "gas-shutoff"
      ],
      "items": [
        {
          "id": "gs.wide",
          "text": "Photographed wide enough to locate",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gs.access",
          "text": "Accessible, unobstructed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "fuel-tank"
      ],
      "items": [
        {
          "id": "ft.wide",
          "text": "Tank photographed wide",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.age",
          "text": "Age/type recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.lines",
          "text": "Lines and regulator condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.base",
          "text": "Base/support condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.fill",
          "text": "Fill/vent configuration noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "fireplace"
      ],
      "items": [
        {
          "id": "fp.type",
          "text": "Type recorded (wood/gas/pellet)",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.clearances",
          "text": "Clearances to combustibles",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.wett",
          "text": "Wood: WETT-class inspection flag recorded — never cleared by us",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.gas-valve",
          "text": "Gas: valve located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.chimney",
          "text": "Associated chimney/flue pinned",
          "satisfy": "pin",
          "pinTypes": [
            "chimney"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.sweep",
          "text": "Last-sweep evidence noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "dryer-duct"
      ],
      "items": [
        {
          "id": "dd.material",
          "text": "Material photographed — foil flex = finding",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dd.route",
          "text": "Route and approximate length recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dd.flap",
          "text": "Termination flap operates",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dd.lint",
          "text": "Lint condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "garage-door"
      ],
      "items": [
        {
          "id": "gd.beam",
          "text": "Beam reversal tested",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gd.pressure",
          "text": "Pressure reversal tested",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gd.opener",
          "text": "Opener nameplate photographed",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gd.hardware",
          "text": "Springs/cables visual",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gd.release",
          "text": "Manual release accessible",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "generator"
      ],
      "items": [
        {
          "id": "gen.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gen.transfer",
          "text": "Transfer switch located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gen.fuel",
          "text": "Fuel source and supply recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gen.exhaust",
          "text": "Exhaust clearance from openings",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "gen.log",
          "text": "Exercise log noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "foundation-crack"
      ],
      "items": [
        {
          "id": "fc.photo",
          "text": "Photographed with scale in frame",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fc.width",
          "text": "Maximum width measured",
          "satisfy": "measure",
          "unit": "mm",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fc.orientation",
          "text": "Orientation recorded (horiz/vert/diag/stepped)",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fc.activity",
          "text": "Active vs. historical indicators assessed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fc.moisture",
          "text": "Damp/efflorescence at crack",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fc.comparison",
          "text": "Comparison position established",
          "satisfy": "pin",
          "pinTypes": [
            "comparison-position"
          ],
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "comparison-position"
      ],
      "items": [
        {
          "id": "cp.reference",
          "text": "Reference photo taken",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "cp.subject",
          "text": "What it monitors recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "cp.interval",
          "text": "Re-shoot interval recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "cp.framing",
          "text": "Framing note for repeatability",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "wellhead"
      ],
      "items": [
        {
          "id": "wlh.cap",
          "text": "Cap condition and seal",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wlh.grade",
          "text": "Grade slopes away",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wlh.separation",
          "text": "Separation from septic/fuel/drainage assessed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wlh.casing",
          "text": "Casing condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wlh.record",
          "text": "Well-record cross-reference noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wlh.freeze",
          "text": "Freeze protection noted",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "septic-lid"
      ],
      "items": [
        {
          "id": "sl.photo",
          "text": "Photographed with landmark for relocation",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sl.condition",
          "text": "Lid condition and security",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sl.access",
          "text": "Depth/access notes",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sl.filter",
          "text": "Effluent filter presence noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "downspout"
      ],
      "items": [
        {
          "id": "ds.discharge",
          "text": "Discharge point photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ds.distance",
          "text": "Distance from foundation noted",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ds.extension",
          "text": "Extension present/needed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "hose-bib"
      ],
      "items": [
        {
          "id": "hb.shutoff",
          "text": "Interior shutoff located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hb.type",
          "text": "Frost-free or standard recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hb.leak",
          "text": "Leak/drip check",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "receptacle-gfci"
      ],
      "items": [
        {
          "id": "rc.trip",
          "text": "Tripped and reset",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rc.extent",
          "text": "Protected circuit extent noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "window"
      ],
      "items": [
        {
          "id": "win.operate",
          "text": "Operates, locks, latches",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "win.seal",
          "text": "Seal failure (fogging) noted",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "door"
      ],
      "items": [
        {
          "id": "dr.operate",
          "text": "Operates and latches",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dr.seal",
          "text": "Exterior seal/weatherstrip",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "deck"
      ],
      "items": [
        {
          "id": "dk.ledger",
          "text": "Ledger attachment assessed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dk.posts",
          "text": "Post bases condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dk.rails",
          "text": "Rail height; grab test",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dk.framing",
          "text": "Framing condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dk.stairs",
          "text": "Stringers and treads",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "chimney"
      ],
      "items": [
        {
          "id": "ch.cap",
          "text": "Cap and screen",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ch.crown",
          "text": "Crown condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ch.flashing",
          "text": "Flashing condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ch.masonry",
          "text": "Masonry/mortar",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ch.liner",
          "text": "Liner type if known",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "tree"
      ],
      "items": [
        {
          "id": "tr.proximity",
          "text": "Proximity to structures recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tr.deadwood",
          "text": "Deadwood/limbs over roof assessed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tr.lean",
          "text": "Lean or root heave",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "floor-drain"
      ],
      "items": [
        {
          "id": "fd.photo",
          "text": "Located and photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fd.trap",
          "text": "Clear; trap primed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "cleanout"
      ],
      "items": [
        {
          "id": "co.photo",
          "text": "Located and photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "co.access",
          "text": "Accessible",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "backwater-valve"
      ],
      "items": [
        {
          "id": "bw.photo",
          "text": "Located and photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bw.service",
          "text": "Service/operation history noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "vent-termination"
      ],
      "items": [
        {
          "id": "vt.source",
          "text": "Identified and traced to interior source",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "vt.condition",
          "text": "Flap/screen condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "register"
      ],
      "items": [
        {
          "id": "reg.airflow",
          "text": "Airflow confirmed",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "appliance"
      ],
      "items": [
        {
          "id": "app.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "app.type",
          "text": "Type/subtype recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "app.function",
          "text": "Condition/function observation",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "retaining-wall"
      ],
      "items": [
        {
          "id": "rw.photo",
          "text": "Photographed along its run",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rw.lean",
          "text": "Lean/bulge and drainage weeps assessed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ]
    },
    {
      "types": [
        "ev-charger"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "solar-inverter"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "pool-equipment"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "irrigation-backflow"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "cistern"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "elevator-lift"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "dock"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "outbuilding"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "radon-fan"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "backflow-preventer"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "boiler-zone-valve"
      ],
      "stub": true,
      "items": []
    }
  ],
  "naReasons": [
    {
      "id": "none-present",
      "label": "Confirmed absent",
      "note": "optional",
      "feedsGapList": false,
      "recordsFinding": true
    },
    {
      "id": "no-access",
      "label": "Not accessible today",
      "note": "recommended",
      "feedsGapList": true,
      "recordsFinding": false
    },
    {
      "id": "not-applicable",
      "label": "Doesn't apply to this property/zone",
      "note": "optional",
      "feedsGapList": false,
      "recordsFinding": false
    },
    {
      "id": "deferred",
      "label": "Deferred to visit two",
      "note": "optional",
      "feedsGapList": true,
      "recordsFinding": false
    }
  ],
  "layers": [
    {
      "id": "issues",
      "label": "Issues",
      "predicate": {
        "flags": [
          "issue"
        ]
      }
    },
    {
      "id": "monitor",
      "label": "Monitoring",
      "predicate": {
        "flags": [
          "monitor"
        ]
      }
    },
    {
      "id": "shutoffs",
      "label": "Shutoffs & controls",
      "predicate": {
        "componentTypes": [
          "water-main",
          "gas-shutoff",
          "fuel-tank",
          "backwater-valve",
          "electrical-panel",
          "hose-bib",
          "floor-drain"
        ]
      }
    },
    {
      "id": "alarms",
      "label": "Alarms",
      "predicate": {
        "componentTypes": [
          "smoke-alarm",
          "co-alarm"
        ]
      }
    },
    {
      "id": "receptacles",
      "label": "Receptacles",
      "predicate": {
        "componentTypes": [
          "receptacle-gfci"
        ]
      }
    },
    {
      "id": "comparison",
      "label": "Comparison positions",
      "predicate": {
        "componentTypes": [
          "comparison-position",
          "foundation-crack"
        ]
      }
    },
    {
      "id": "all",
      "label": "All pins",
      "predicate": {}
    }
  ]
};
