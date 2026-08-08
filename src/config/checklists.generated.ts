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
  "configVersion": "1.12.0",
  "propertyFlags": [
    {
      "id": "municipal_water",
      "label": "Municipal water",
      "intakeSource": "Water source",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "well",
      "label": "Private well",
      "intakeSource": "Water source",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "municipal_sewer",
      "label": "Municipal sewer",
      "intakeSource": "Sewage",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "septic",
      "label": "Septic system",
      "intakeSource": "Sewage",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "gas",
      "label": "Natural gas service",
      "intakeSource": "Fuel on property",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "propane",
      "label": "Propane on property",
      "intakeSource": "Fuel on property",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "oil",
      "label": "Oil on property",
      "intakeSource": "Fuel on property",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "wood_heat",
      "label": "Wood-burning appliance",
      "intakeSource": "Wood-burning appliance",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "pool",
      "label": "Pool or hot tub",
      "intakeSource": "Pool/hot tub",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "generator",
      "label": "Generator",
      "intakeSource": "Generator",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "waterfront",
      "label": "Waterfront/shoreline",
      "intakeSource": "Waterfront",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "pre_1990",
      "label": "Built before ~1990",
      "intakeSource": "Year built",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "solar",
      "label": "Solar/battery",
      "intakeSource": "Solar/battery/EV",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "ev",
      "label": "EV charging",
      "intakeSource": "Solar/battery/EV",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "seasonal_vacancy",
      "label": "Seasonal or periodically vacant",
      "intakeSource": "Occupancy (v1.6)",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "secondary_suite",
      "label": "Secondary suite / in-law / rental unit",
      "intakeSource": "Secondary suite (v1.6)",
      "consumers": [
        "field",
        "binder"
      ]
    },
    {
      "id": "flat_roof",
      "label": "Flat or low-slope roof section",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "attached_garage",
      "label": "Attached garage",
      "intakeSource": "Garage (attached/detached/carport/none)",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "prior_water_entry",
      "label": "Prior water entry in the building",
      "intakeSource": "Water history",
      "consumers": [
        "binder"
      ]
    },
    {
      "id": "year_built_unknown",
      "label": "Year built not established",
      "intakeSource": "Year built",
      "consumers": [
        "binder"
      ]
    }
  ],
  "naEquivalents": [
    {
      "itemId": "att.access-honesty",
      "value": "no access",
      "reasonId": "no-access"
    },
    {
      "itemId": "crw.access-honesty",
      "value": "no access",
      "reasonId": "no-access"
    }
  ],
  "zoneAttributes": [
    {
      "id": "finished",
      "label": "Finished space",
      "askAtCreation": true,
      "defaultsTrueFor": []
    },
    {
      "id": "sleeping",
      "label": "Used for sleeping",
      "askAtCreation": true,
      "defaultsTrueFor": []
    },
    {
      "id": "has_stairs",
      "label": "Contains stairs",
      "askAtCreation": true,
      "defaultsTrueFor": []
    },
    {
      "id": "has_mechanicals",
      "label": "Contains mechanical equipment (furnace, panel, water heater, main shutoff…)",
      "askAtCreation": true,
      "defaultsTrueFor": [
        "utility"
      ]
    },
    {
      "id": "has_plumbing",
      "label": "Contains plumbing",
      "askAtCreation": false,
      "defaultsTrueFor": []
    },
    {
      "id": "exterior_wall",
      "label": "Has exterior wall(s)",
      "askAtCreation": false,
      "defaultsTrueFor": []
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
        "rough-base",
        "mechanical-base"
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
        "rough-base",
        "mechanical-base"
      ]
    },
    {
      "id": "crawlspace",
      "typicalLabels": [
        "crawlspace"
      ],
      "inherits": [
        "rough-base",
        "mechanical-base"
      ]
    },
    {
      "id": "attic",
      "typicalLabels": [
        "attic",
        "loft access"
      ],
      "inherits": [
        "rough-base",
        "mechanical-base"
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
        "wet-base",
        "mechanical-base"
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
        "wet-base",
        "mechanical-base"
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
        "wet-base",
        "mechanical-base"
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
        "interior-base",
        "mechanical-base"
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
        "interior-base",
        "mechanical-base"
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
        "rough-base",
        "mechanical-base"
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
        "exterior-base",
        "mechanical-base"
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
        "exterior-base",
        "mechanical-base"
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
        "rough-base",
        "mechanical-base"
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
          "text": "Representative receptacles tested; every GFCI tripped and reset — pin failures as concerns",
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
          "id": "int.owner-quirks",
          "text": "Anything the owner flagged in this room verified and captured",
          "satisfy": "note",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "liv.egress-opens",
          "text": "Window opens fully and stays open without being held",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.sleeping"
            ]
          },
          "group": "Egress (sleeping rooms)"
        },
        {
          "id": "liv.egress-width",
          "text": "Clear opening width",
          "satisfy": "measure",
          "unit": "in",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.sleeping"
            ]
          },
          "group": "Egress (sleeping rooms)"
        },
        {
          "id": "liv.egress-height",
          "text": "Clear opening height",
          "satisfy": "measure",
          "unit": "in",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.sleeping"
            ]
          },
          "group": "Egress (sleeping rooms)"
        },
        {
          "id": "liv.egress-sill",
          "text": "Sill height above finished floor",
          "satisfy": "measure",
          "unit": "in",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.sleeping"
            ]
          },
          "group": "Egress (sleeping rooms)"
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
          "text": "Visible wiring types noted; knob-and-tube or aluminum flagged as concerns",
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
        },
        {
          "id": "bsm.finished-behind",
          "text": "Concealed areas behind finished surfaces recorded as *not inspected*",
          "satisfy": "note",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "zone.finished"
            ]
          }
        }
      ]
    },
    {
      "id": "mechanical-base",
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
          "text": "Supply pipe material photographed close-up",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.pipe-material-id",
          "text": "Supply pipe material identified",
          "satisfy": "choice",
          "options": [
            "copper",
            "PEX",
            "poly-B",
            "Kitec",
            "galvanized",
            "CPVC",
            "mixed",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.drain-material",
          "text": "Drain/vent material photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "group": "Water"
        },
        {
          "id": "utl.drain-material-id",
          "text": "Drain/vent material identified",
          "satisfy": "choice",
          "options": [
            "ABS",
            "PVC",
            "cast iron",
            "clay",
            "Orangeburg",
            "copper",
            "mixed",
            "unknown"
          ],
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
          "id": "utl.septic-alarm",
          "text": "Septic/sewage-pump alarm panel pinned",
          "satisfy": "pin",
          "pinTypes": [
            "septic-alarm"
          ],
          "tier": "core",
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
          "text": "Oil/propane tank pinned",
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
      ],
      "gate": "zone.has_mechanicals"
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
          "id": "kit.sink",
          "text": "Kitchen sink pinned",
          "satisfy": "pin",
          "pinTypes": [
            "sink"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "kit.appliances",
          "text": "Every appliance pinned with its specific type",
          "satisfy": "pin",
          "pinTypes": [
            "appliance",
            "appliance-refrigerator",
            "appliance-dishwasher",
            "appliance-range",
            "appliance-range-hood",
            "appliance-microwave",
            "appliance-freezer"
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
          "id": "kit.counter-gfci",
          "text": "Counter receptacles GFCI-protected",
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
      "zoneType": "bathroom",
      "items": [
        {
          "id": "bth.toilet",
          "text": "Toilet pinned",
          "satisfy": "pin",
          "pinTypes": [
            "toilet"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "bth.fixtures",
          "text": "Sink, tub, and/or shower pinned",
          "satisfy": "pin",
          "pinTypes": [
            "sink",
            "bathtub",
            "shower"
          ],
          "tier": "core",
          "attest": "evidence",
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
          "id": "lnd.washer",
          "text": "Washer pinned",
          "satisfy": "pin",
          "pinTypes": [
            "appliance-washer"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.dryer",
          "text": "Dryer pinned",
          "satisfy": "pin",
          "pinTypes": [
            "appliance-dryer"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.dryer-duct",
          "text": "Dryer duct pinned",
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
          "id": "lnd.tub",
          "text": "Laundry tub pinned if present",
          "satisfy": "pin",
          "pinTypes": [
            "laundry-tub"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lnd.drain-standpipe",
          "text": "Standpipe height and trap",
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
          "text": "Extent of attic access achieved",
          "satisfy": "choice",
          "options": [
            "from hatch only",
            "partial traverse",
            "full traverse",
            "no access"
          ],
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
          "text": "Extent of crawlspace access achieved",
          "satisfy": "choice",
          "options": [
            "from access point only",
            "partial entry",
            "full entry",
            "no access"
          ],
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
          "id": "sit.curbstop",
          "text": "Municipal curb stop pinned if locatable",
          "satisfy": "pin",
          "pinTypes": [
            "curb-stop"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ],
          "trigger": {
            "anyOf": [
              "property.municipal_water"
            ]
          }
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
          "attest": "evidence",
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
          "unit": "in",
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
      "id": "ses.shutoff-map",
      "text": "Emergency shutoff map complete: every Master Spec §1 shutoff and control either pinned or explicitly recorded absent — water main, curb stop, gas, fuel, electrical, water heater, boiler, furnace switch, sump, septic/sewage alarm, solar disconnects, pool disconnect, irrigation, hose bibs, fireplace valve",
      "satisfy": "check",
      "tier": "core",
      "attest": "action",
      "scope": [
        "baseline"
      ]
    },
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
          "id": "wh.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Install/manufacture year decoded from serial",
          "satisfy": "measure",
          "unit": "year",
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
          "id": "wh.shutoff",
          "text": "Water shutoff **and** fuel/power isolation located and photographed",
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
          "text": "Ownership status",
          "satisfy": "choice",
          "options": [
            "owned",
            "rented",
            "unknown"
          ],
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
          "attest": "evidence",
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
          "id": "fur.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "blr.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Operating pressure reading recorded",
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
          "id": "blr.switch",
          "text": "Emergency switch and fuel shutoff located",
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
          "id": "hp.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "attest": "evidence",
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
          "id": "hrv.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "pnl.label",
          "text": "Manufacturer/rating label and main breaker amp marking photographed legibly (door open, dead front on)",
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
          "text": "Service size",
          "satisfy": "choice",
          "options": [
            "60A",
            "100A",
            "125A",
            "150A",
            "200A",
            "400A",
            "other",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pnl.type",
          "text": "Overcurrent protection type",
          "satisfy": "choice",
          "options": [
            "breaker",
            "fuse",
            "mixed"
          ],
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
          "text": "Valve type",
          "satisfy": "choice",
          "options": [
            "ball",
            "gate",
            "other",
            "unknown"
          ],
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
        }
      ]
    },
    {
      "types": [
        "sump-pump"
      ],
      "items": [
        {
          "id": "sp.unit",
          "text": "Sump located and photographed wide enough to find it",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "sp.breaker",
          "text": "Sump breaker located",
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
          "id": "wpt.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "wt.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Position in the treatment train recorded (order relative to other units)",
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
        "water-softener"
      ],
      "items": [
        {
          "id": "wsf.salt",
          "text": "Salt level checked; bridging checked",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wsf.age",
          "text": "Install/manufacture year if determinable",
          "satisfy": "measure",
          "unit": "year",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wsf.regen",
          "text": "Regeneration schedule setting recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wsf.brine",
          "text": "Brine tank condition; no standing water above salt",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "water-treatment"
    },
    {
      "types": [
        "sediment-filter"
      ],
      "items": [
        {
          "id": "sfl.cartridge",
          "text": "Cartridge size and micron rating recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sfl.changed",
          "text": "Last change date recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sfl.housing",
          "text": "Housing condition; no weeping at the seal",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "water-treatment"
    },
    {
      "types": [
        "uv-sterilizer"
      ],
      "items": [
        {
          "id": "uvs.lamp",
          "text": "Lamp change due-date recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "uvs.alarm",
          "text": "Alarm/indicator functioning",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "uvs.sleeve",
          "text": "Quartz sleeve condition noted",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "water-treatment"
    },
    {
      "types": [
        "reverse-osmosis"
      ],
      "items": [
        {
          "id": "rov.membrane",
          "text": "Membrane and pre/post filter change dates recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rov.tank",
          "text": "Storage tank condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "rov.drain",
          "text": "Drain line connection and air gap",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "water-treatment"
    },
    {
      "types": [
        "toilet"
      ],
      "items": [
        {
          "id": "wc.unit",
          "text": "Fixture photographed whole",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.secure",
          "text": "Secure to floor; no rock",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.base-dry",
          "text": "Base and surrounding floor dry; no staining",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.flush",
          "text": "Flushes and refills correctly; no continuous run",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.stop",
          "text": "Supply shutoff present, accessible, not weeping",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.supply-line",
          "text": "Supply line type",
          "satisfy": "choice",
          "options": [
            "braided stainless",
            "plastic",
            "copper",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "wc.tank",
          "text": "Tank internals condition",
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
        "sink"
      ],
      "items": [
        {
          "id": "snk.unit",
          "text": "Fixture photographed whole",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "snk.stops",
          "text": "Hot and cold shutoffs present, accessible, not weeping",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "snk.trap",
          "text": "Trap and drain connections dry; no corrosion",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "snk.drain-flow",
          "text": "Drains at a normal rate",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "snk.cabinet",
          "text": "Cabinet floor inspected while water runs; metered if suspect",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "snk.faucet",
          "text": "Faucet operates; no drip at spout or base",
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
        "shower"
      ],
      "items": [
        {
          "id": "shw.unit",
          "text": "Enclosure photographed whole",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "shw.surround",
          "text": "Surround condition; grout and caulk at all joints",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "shw.drain-flow",
          "text": "Drains at a normal rate",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "shw.valve",
          "text": "Mixing valve operates through its range",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "shw.door",
          "text": "Door/curtain track and seals",
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
        "bathtub"
      ],
      "items": [
        {
          "id": "tub.unit",
          "text": "Tub photographed whole",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tub.surround",
          "text": "Surround condition; grout and caulk",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tub.drain-overflow",
          "text": "Drain and overflow function; no leak visible below",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tub.faucet",
          "text": "Faucet and diverter operate",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "tub.support",
          "text": "Tub support/deck condition where visible",
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
        "laundry-tub"
      ],
      "items": [
        {
          "id": "ltb.unit",
          "text": "Tub photographed whole",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ltb.stops",
          "text": "Shutoffs present, not weeping",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ltb.drain",
          "text": "Drains at a normal rate",
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
          "text": "Power source",
          "satisfy": "choice",
          "options": [
            "hardwired",
            "hardwired + battery backup",
            "battery only",
            "plug-in",
            "unknown"
          ],
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
          "text": "Detector type",
          "satisfy": "choice",
          "options": [
            "smoke — ionization",
            "smoke — photoelectric",
            "smoke — dual sensor",
            "CO only",
            "combination smoke/CO",
            "heat",
            "unknown"
          ],
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
          "id": "ft.nameplate",
          "text": "Data plate photographed legibly",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.type",
          "text": "Tank configuration",
          "satisfy": "choice",
          "options": [
            "above-ground indoor",
            "above-ground outdoor",
            "underground",
            "propane cylinder",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "ft.age",
          "text": "Manufacture year from the data plate",
          "satisfy": "measure",
          "unit": "year",
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
          "id": "fp.unit",
          "text": "Appliance photographed whole, in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.type",
          "text": "Appliance type",
          "satisfy": "choice",
          "options": [
            "wood fireplace",
            "woodstove",
            "pellet stove",
            "gas fireplace",
            "gas insert",
            "electric",
            "decorative — non-functional",
            "unknown"
          ],
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
          "id": "fp.sweep-tag",
          "text": "Sweep/service tag photographed if present",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "fp.sweep",
          "text": "Last sweep/service date recorded",
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
          "text": "Duct material photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dd.material-id",
          "text": "Duct material identified",
          "satisfy": "choice",
          "options": [
            "rigid metal",
            "semi-rigid metal",
            "foil flex",
            "plastic",
            "unknown"
          ],
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
          "id": "gd.unit",
          "text": "Door and opener photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "gen.unit",
          "text": "Whole unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Fuel source",
          "satisfy": "choice",
          "options": [
            "natural gas",
            "propane",
            "diesel",
            "gasoline",
            "dual-fuel",
            "unknown"
          ],
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
          "text": "Crack orientation",
          "satisfy": "choice",
          "options": [
            "horizontal",
            "vertical",
            "diagonal",
            "stepped",
            "map/random"
          ],
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
          "attest": "evidence",
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
          "id": "wlh.unit",
          "text": "Wellhead photographed whole, with surroundings",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Bib type",
          "satisfy": "choice",
          "options": [
            "frost-free",
            "standard",
            "unknown"
          ],
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
          "id": "dk.unit",
          "text": "Deck photographed whole from a repeatable position",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "ch.unit",
          "text": "Chimney photographed full height from the ground",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "text": "Liner type",
          "satisfy": "choice",
          "options": [
            "clay tile",
            "metal",
            "cast-in-place",
            "unlined",
            "unknown"
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
          "id": "tr.species",
          "text": "Species recorded if known",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
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
          "id": "app.unit",
          "text": "Appliance photographed whole, in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
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
          "id": "app.age",
          "text": "Manufacture year if determinable",
          "satisfy": "measure",
          "unit": "year",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "app.type",
          "text": "Descriptive note where the sub-type doesn't fit",
          "satisfy": "note",
          "tier": "standard",
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
        "appliance-refrigerator"
      ],
      "items": [
        {
          "id": "apr.water-line",
          "text": "Water line type and shutoff located (if plumbed)",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apr.seals",
          "text": "Door seals condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apr.coils",
          "text": "Coils accessible and reasonably clear",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-dishwasher"
      ],
      "items": [
        {
          "id": "apd.airgap",
          "text": "Air gap or high loop present",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apd.connections",
          "text": "Supply and drain connections dry",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apd.base",
          "text": "No staining at the base or in the adjacent cabinet",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-range"
      ],
      "items": [
        {
          "id": "apg.fuel",
          "text": "Fuel type",
          "satisfy": "choice",
          "options": [
            "natural gas",
            "propane",
            "electric",
            "induction",
            "dual-fuel",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apg.anti-tip",
          "text": "Anti-tip bracket present",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apg.shutoff",
          "text": "Gas: shutoff accessible behind the unit",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apg.connector",
          "text": "Gas: flexible connector condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-range-hood"
      ],
      "items": [
        {
          "id": "aph.vent",
          "text": "Vent configuration",
          "satisfy": "choice",
          "options": [
            "ducted to exterior",
            "recirculating",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "aph.fan",
          "text": "Fan operates through its speeds",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "aph.filter",
          "text": "Filter condition",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-washer"
      ],
      "items": [
        {
          "id": "apw.hoses",
          "text": "Supply hose type",
          "satisfy": "choice",
          "options": [
            "braided stainless",
            "rubber",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apw.hose-label",
          "text": "Hose date code photographed where legible",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apw.hose-age",
          "text": "Hose year, from the date code",
          "satisfy": "measure",
          "unit": "year",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apw.stops",
          "text": "Shutoffs present and accessible",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apw.pan",
          "text": "Drain pan present if above living space",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-dryer"
      ],
      "items": [
        {
          "id": "apy.fuel",
          "text": "Fuel type",
          "satisfy": "choice",
          "options": [
            "electric",
            "natural gas",
            "propane",
            "heat-pump",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apy.duct",
          "text": "Dryer duct pinned",
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
          "id": "apy.gas-shutoff",
          "text": "Gas: shutoff accessible",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "appliance-microwave"
      ],
      "items": [
        {
          "id": "apm.mount",
          "text": "Mounting secure (over-range units)",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "apm.vent",
          "text": "Vent configuration if over-range",
          "satisfy": "choice",
          "options": [
            "ducted to exterior",
            "recirculating",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        }
      ],
      "inherits": "appliance"
    },
    {
      "types": [
        "dock"
      ],
      "items": [
        {
          "id": "dck.unit",
          "text": "Dock photographed whole from shore, from a repeatable position",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dck.type",
          "text": "Dock type",
          "satisfy": "choice",
          "options": [
            "fixed/crib",
            "floating",
            "pipe/removable",
            "cantilever",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dck.decking",
          "text": "Decking, fasteners and hardware condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dck.attachment",
          "text": "Shore attachment and anchoring condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dck.season",
          "text": "Current seasonal state",
          "satisfy": "choice",
          "options": [
            "in water",
            "removed for season",
            "permanent",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "dck.permit",
          "text": "Shoreline/dock permit documentation noted",
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
        "leak-sensor"
      ],
      "items": [
        {
          "id": "lks.unit",
          "text": "Sensor photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lks.covers",
          "text": "What it protects recorded (which fixture or appliance)",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lks.type",
          "text": "Sensor type",
          "satisfy": "choice",
          "options": [
            "standalone alarm",
            "hub-connected",
            "integrated with automatic shutoff",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lks.power",
          "text": "Power source and battery state",
          "satisfy": "choice",
          "options": [
            "battery",
            "plug-in",
            "hardwired",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "lks.test",
          "text": "Tested (per manufacturer method)",
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
        "humidifier"
      ],
      "items": [
        {
          "id": "hum.unit",
          "text": "Unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hum.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hum.pad",
          "text": "Pad/filter size recorded",
          "satisfy": "note",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hum.water",
          "text": "Supply line and drain condition",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hum.setting",
          "text": "Humidistat setting recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "hum.season",
          "text": "Damper/bypass seasonal position",
          "satisfy": "choice",
          "options": [
            "winter/open",
            "summer/closed",
            "unknown"
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
      "types": [
        "dehumidifier"
      ],
      "items": [
        {
          "id": "deh.unit",
          "text": "Unit photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "deh.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "deh.drainage",
          "text": "Drainage method",
          "satisfy": "choice",
          "options": [
            "gravity to drain",
            "condensate pump",
            "bucket — manual",
            "unknown"
          ],
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "deh.draining",
          "text": "Draining correctly; no standing water at the unit",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "deh.setting",
          "text": "Humidistat setting recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "deh.filter",
          "text": "Filter condition",
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
        "curb-stop"
      ],
      "items": [
        {
          "id": "cs.photo",
          "text": "Located and photographed with a permanent landmark in frame",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "cs.access",
          "text": "Accessible — not paved over, buried, or obstructed",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "cs.key",
          "text": "Whether a curb key is required, and where one is",
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
        "septic-alarm"
      ],
      "items": [
        {
          "id": "sa.photo",
          "text": "Alarm panel located and photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sa.test",
          "text": "Alarm tested (test button)",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sa.silence",
          "text": "Silence/reset control located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sa.breaker",
          "text": "Pump breaker located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sa.meaning",
          "text": "What the alarm indicates, recorded for the emergency sheet",
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
        "solar-inverter"
      ],
      "items": [
        {
          "id": "sol.unit",
          "text": "Inverter photographed in place",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.nameplate",
          "text": "Nameplate photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.dc-disconnect",
          "text": "DC disconnect located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.ac-disconnect",
          "text": "AC disconnect located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.rapid-shutdown",
          "text": "Rapid-shutdown device and label present",
          "satisfy": "check",
          "tier": "standard",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.storage",
          "text": "Battery storage present",
          "satisfy": "choice",
          "options": [
            "none",
            "battery storage present",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "sol.esa",
          "text": "ESA/inspection documentation noted",
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
        "pool-equipment"
      ],
      "items": [
        {
          "id": "pol.unit",
          "text": "Equipment pad photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pol.disconnect",
          "text": "Electrical disconnect located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pol.barrier",
          "text": "Barrier and self-closing, self-latching gate operate",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pol.pump",
          "text": "Pump nameplate photographed",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pol.heater",
          "text": "Heater type",
          "satisfy": "choice",
          "options": [
            "natural gas",
            "propane",
            "electric",
            "heat pump",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "pol.season",
          "text": "Current seasonal state",
          "satisfy": "choice",
          "options": [
            "open/operating",
            "closed/winterized",
            "unknown"
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
      "types": [
        "irrigation-backflow"
      ],
      "items": [
        {
          "id": "irr.unit",
          "text": "Backflow device photographed",
          "satisfy": "photo",
          "tier": "core",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "irr.shutoff",
          "text": "Irrigation shutoff located",
          "satisfy": "check",
          "tier": "core",
          "attest": "action",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "irr.type",
          "text": "Device type",
          "satisfy": "choice",
          "options": [
            "RPZ",
            "double check",
            "pressure vacuum breaker",
            "atmospheric vacuum breaker",
            "unknown"
          ],
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "irr.test-tag",
          "text": "Backflow test/certification tag photographed if present",
          "satisfy": "photo",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "irr.test-record",
          "text": "Last certification/test date recorded",
          "satisfy": "note",
          "tier": "standard",
          "attest": "evidence",
          "scope": [
            "baseline"
          ]
        },
        {
          "id": "irr.blowout",
          "text": "Winterization/blow-out evidence noted",
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
        "ev-charger"
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
    },
    {
      "types": [
        "appliance-freezer"
      ],
      "stub": true,
      "items": []
    },
    {
      "types": [
        "iron-filter"
      ],
      "stub": true,
      "items": []
    }
  ],
  "componentAliases": [
    {
      "alias": "air conditioner",
      "type": "heat-pump"
    },
    {
      "alias": "a/c",
      "type": "heat-pump"
    },
    {
      "alias": "ac condenser",
      "type": "heat-pump"
    },
    {
      "alias": "condenser",
      "type": "heat-pump"
    },
    {
      "alias": "air handler",
      "type": "furnace"
    },
    {
      "alias": "hot water tank",
      "type": "water-heater"
    },
    {
      "alias": "hot water heater",
      "type": "water-heater"
    },
    {
      "alias": "hwt",
      "type": "water-heater"
    },
    {
      "alias": "breaker panel",
      "type": "electrical-panel"
    },
    {
      "alias": "fuse box",
      "type": "electrical-panel"
    },
    {
      "alias": "service panel",
      "type": "electrical-panel"
    },
    {
      "alias": "main shutoff",
      "type": "water-main"
    },
    {
      "alias": "water shutoff",
      "type": "water-main"
    },
    {
      "alias": "curb valve",
      "type": "curb-stop"
    },
    {
      "alias": "municipal shutoff",
      "type": "curb-stop"
    },
    {
      "alias": "smoke detector",
      "type": "smoke-alarm"
    },
    {
      "alias": "carbon monoxide detector",
      "type": "co-alarm"
    },
    {
      "alias": "co detector",
      "type": "co-alarm"
    },
    {
      "alias": "outlet",
      "type": "receptacle-gfci"
    },
    {
      "alias": "plug",
      "type": "receptacle-gfci"
    },
    {
      "alias": "gfi",
      "type": "receptacle-gfci"
    },
    {
      "alias": "gutter",
      "type": "downspout"
    },
    {
      "alias": "eavestrough",
      "type": "downspout"
    },
    {
      "alias": "outdoor tap",
      "type": "hose-bib"
    },
    {
      "alias": "garden tap",
      "type": "hose-bib"
    },
    {
      "alias": "spigot",
      "type": "hose-bib"
    },
    {
      "alias": "sillcock",
      "type": "hose-bib"
    },
    {
      "alias": "propane tank",
      "type": "fuel-tank"
    },
    {
      "alias": "oil tank",
      "type": "fuel-tank"
    },
    {
      "alias": "septic tank",
      "type": "septic-lid"
    },
    {
      "alias": "sprinkler",
      "type": "irrigation-backflow"
    },
    {
      "alias": "sprinkler system",
      "type": "irrigation-backflow"
    },
    {
      "alias": "hot tub",
      "type": "pool-equipment"
    },
    {
      "alias": "spa",
      "type": "pool-equipment"
    },
    {
      "alias": "solar panel",
      "type": "solar-inverter"
    },
    {
      "alias": "pv",
      "type": "solar-inverter"
    },
    {
      "alias": "genset",
      "type": "generator"
    },
    {
      "alias": "transfer switch",
      "type": "generator"
    },
    {
      "alias": "stove",
      "type": "appliance-range"
    },
    {
      "alias": "oven",
      "type": "appliance-range"
    },
    {
      "alias": "cooktop",
      "type": "appliance-range"
    },
    {
      "alias": "fridge",
      "type": "appliance-refrigerator"
    },
    {
      "alias": "washing machine",
      "type": "appliance-washer"
    },
    {
      "alias": "exhaust fan",
      "type": "appliance-range-hood"
    },
    {
      "alias": "hood fan",
      "type": "appliance-range-hood"
    },
    {
      "alias": "softener",
      "type": "water-softener"
    },
    {
      "alias": "uv",
      "type": "uv-sterilizer"
    },
    {
      "alias": "ro",
      "type": "reverse-osmosis"
    },
    {
      "alias": "wc",
      "type": "toilet"
    },
    {
      "alias": "commode",
      "type": "toilet"
    },
    {
      "alias": "lavatory",
      "type": "sink"
    },
    {
      "alias": "vanity",
      "type": "sink"
    },
    {
      "alias": "basin",
      "type": "sink"
    },
    {
      "alias": "tub",
      "type": "bathtub"
    },
    {
      "alias": "porch",
      "type": "deck"
    },
    {
      "alias": "flue",
      "type": "chimney"
    }
  ],
  "retiredOptions": [
    {
      "itemId": "apm.vent",
      "value": "n/a — countertop",
      "version": "v1.12",
      "reason": "**No replacement option: resolve the item N/A with reason `not-applicable`.** An inapplicability inside a value list. The N/A path already carries it, with a reason id the manifest can route"
    },
    {
      "itemId": "pol.heater",
      "value": "none",
      "version": "v1.12",
      "reason": "**No replacement option: resolve the item N/A with reason `none-present`.** An absence inside a value list. `none-present` records it as a finding; the option recorded it as satisfied"
    },
    {
      "itemId": "irr.type",
      "value": "none observed",
      "version": "v1.12",
      "reason": "**No replacement option: resolve the item N/A with reason `none-present`.** As above — and *observed* made it read as a reading rather than an absence"
    },
    {
      "itemId": "hum.season",
      "value": "no damper",
      "version": "v1.12",
      "reason": "**No replacement option: resolve the item N/A with reason `none-present`.** As above"
    }
  ],
  "measureUnits": [
    {
      "unit": "in",
      "means": "inches"
    },
    {
      "unit": "psi",
      "means": "pounds per square inch"
    },
    {
      "unit": "%RH",
      "means": "relative humidity, percent"
    },
    {
      "unit": "year",
      "means": "four-digit calendar year (gated 1900–current)"
    },
    {
      "unit": "mm",
      "means": "millimetres"
    },
    {
      "unit": "m",
      "means": "metres — linear runs"
    },
    {
      "unit": "m2",
      "means": "square metres — areas"
    },
    {
      "unit": "deg",
      "means": "degrees — slope and pitch"
    }
  ],
  "provenance": [
    {
      "itemId": "wh.age",
      "derivedFrom": "Serial number, manufacturer-decoded",
      "sourceItemId": "wh.nameplate"
    },
    {
      "itemId": "ft.age",
      "derivedFrom": "Tank data plate",
      "sourceItemId": "ft.nameplate"
    },
    {
      "itemId": "apw.hose-age",
      "derivedFrom": "Hose date code",
      "sourceItemId": "apw.hose-label"
    },
    {
      "itemId": "wsf.age",
      "derivedFrom": "Nameplate or unit label",
      "sourceItemId": "wt.nameplate"
    },
    {
      "itemId": "pnl.service",
      "derivedFrom": "Main breaker amp marking / rating label",
      "sourceItemId": "pnl.label"
    },
    {
      "itemId": "pnl.brand",
      "derivedFrom": "Panel manufacturer label",
      "sourceItemId": "pnl.label"
    },
    {
      "itemId": "fp.sweep",
      "derivedFrom": "Sweep/service tag date",
      "sourceItemId": "fp.sweep-tag"
    },
    {
      "itemId": "irr.test-record",
      "derivedFrom": "Backflow test tag date",
      "sourceItemId": "irr.test-tag"
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
      "id": "plumbing-fixtures",
      "label": "Plumbing fixtures",
      "predicate": {
        "componentTypes": [
          "toilet",
          "sink",
          "shower",
          "bathtub",
          "laundry-tub"
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
