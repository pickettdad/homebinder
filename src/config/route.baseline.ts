/**
 * THE BASELINE ROUTE — transcribed from "The Baseline Inspection Process — Standard
 * Detached Home (v1, 2026-07-20)". The process doc is the source of truth; this file
 * renders it. Field-forced changes flow: process doc first, then this file, then a
 * configVersion bump in the same commit.
 *
 * This is PURE DATA (enforced by schema + a serialization round-trip test).
 * See docs/route-config.md for how to edit safely.
 */
import type { RouteConfigInput } from "../engine/schema/routeConfig";

export const baselineRoute = {
  routeId: "baseline-detached-v1",
  title: "Baseline Inspection — Standard Detached Home",
  configVersion: "1.0.0",

  profileFlags: [
    { id: "has-well", label: "Private well", hint: "Adds wellhead, pressure system, treatment train, and water sampling slots" },
    { id: "has-septic", label: "Septic system", hint: "Adds septic lids and bed-area slots to the exterior circuit" },
    { id: "has-wood-heat", label: "Wood heat", hint: "Adds stove/fireplace and chimney slots — WETT referral, never cleared by us" },
  ],

  roomKinds: [
    { id: "kitchen", label: "Kitchen" },
    { id: "bathroom", label: "Bathroom" },
    { id: "bedroom", label: "Bedroom" },
    { id: "living", label: "Living room" },
    { id: "dining", label: "Dining room" },
    { id: "office", label: "Office / den" },
    { id: "hallway", label: "Hallway / stairs" },
    { id: "laundry", label: "Laundry room" },
    { id: "other", label: "Other room" },
  ],

  exceptionReasons: [
    { id: "not-accessible", label: "Not accessible", requiresNote: true, feedsGapList: true },
    { id: "not-applicable", label: "Not applicable", requiresNote: false, feedsGapList: false },
    { id: "defer-visit-two", label: "Defer to visit two", requiresNote: true, feedsGapList: true },
  ],

  templates: [
    {
      // Phase 5 — the room routine, identical in every room.
      id: "room-routine",
      label: "Room routine",
      slots: [
        { key: "entry-wide", label: "{room} — entry wide shot", minCaptures: 1 },
        {
          key: "windows-doors", label: "{room} — windows & doors, operated",
          guidance: "Operate, lock, latch each. Note seal-failure fogging. One capture per window.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          key: "outlets", label: "{room} — outlet sample & GFCI test",
          guidance: "Receptacle tester on 2–3 outlets. Every GFCI tested for trip/reset.",
          minCaptures: 1, voiceNote: "recommended",
        },
        { key: "switches-fixtures", label: "{room} — switches & fixtures function", minCaptures: 1 },
        {
          key: "surfaces-scan", label: "{room} — ceiling · wall · floor scan",
          guidance: "Stains, cracks, slopes, separations. Moisture meter on anything suspicious — speak the reading.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          key: "register-airflow", label: "{room} — register airflow confirmed",
          guidance: "Furnace should be running (set to call for heat before the basement phase).",
          minCaptures: 1,
        },
        {
          key: "detector", label: "{room} — detector test + manufacture date",
          guidance: "Test button, then photograph the manufacture date on the back.",
          minCaptures: 1,
        },
        {
          key: "owner-quirks", label: "{room} — owner-reported quirks verified",
          guidance: "Anything the owner mentioned for this room: verify and capture.",
          required: false, voiceNote: "recommended",
        },
      ],
    },
    {
      id: "bedroom",
      label: "Bedroom (room routine + egress)",
      extends: "room-routine",
      slots: [
        {
          key: "egress", label: "{room} — window egress check",
          guidance: "Opens fully; size and sill height sane. Capture the open window.",
          minCaptures: 1, voiceNote: "recommended",
        },
      ],
    },
    {
      id: "kitchen",
      label: "Kitchen (room routine + kitchen adds + water run)",
      extends: "room-routine",
      slots: [
        {
          key: "under-sink", label: "{room} — under-sink while water runs",
          guidance: "Moisture meter on cabinet floor while hot+cold run. Note time-to-hot if furthest fixture.",
          minCaptures: 1, voiceNote: "recommended", tags: ["water-run"],
        },
        { key: "dishwasher", label: "{room} — dishwasher connection", minCaptures: 1 },
        { key: "fridge", label: "{room} — fridge coils & water line", minCaptures: 1 },
        {
          key: "range-hood", label: "{room} — range & hood, fan to termination",
          guidance: "Run the fan; cross-check the exterior termination finding.",
          minCaptures: 1,
        },
        { key: "counter-gfci", label: "{room} — counter GFCIs tested", minCaptures: 1 },
        { key: "appliance-nameplates", label: "{room} — appliance nameplates", minCaptures: 2 },
        {
          key: "drains", label: "{room} — fixtures run, drain speed watched",
          guidance: "Run hot and cold; watch every drain for speed.",
          minCaptures: 1, tags: ["water-run"],
        },
      ],
    },
    {
      id: "bathroom",
      label: "Bathroom (room routine + bath adds + water run)",
      extends: "room-routine",
      slots: [
        {
          key: "under-vanity", label: "{room} — vanity interior while water runs",
          guidance: "Moisture meter on cabinet floor while water runs.",
          minCaptures: 1, voiceNote: "recommended", tags: ["water-run"],
        },
        {
          key: "toilet", label: "{room} — toilet: flush, tank internals, knee test",
          guidance: "Flush; glance at tank internals; secure-to-floor knee test.",
          minCaptures: 1, tags: ["water-run"],
        },
        {
          key: "tub-shower", label: "{room} — tub/shower run + surround moisture",
          guidance: "Run briefly. Moisture meter at the surround; caulk and grout condition.",
          minCaptures: 1, voiceNote: "recommended", tags: ["water-run"],
        },
        {
          key: "fan-test", label: "{room} — fan tissue test",
          guidance: "Tissue test; cross-check termination against exterior findings.",
          minCaptures: 1,
        },
      ],
    },
    {
      id: "laundry",
      label: "Laundry (room routine + connections)",
      extends: "room-routine",
      slots: [
        {
          key: "connections", label: "{room} — washer hoses & dryer duct",
          guidance: "Hose type and age; dryer duct material and route.",
          minCaptures: 1, voiceNote: "recommended", tags: ["water-run"],
        },
      ],
    },
  ],

  zones: [
    {
      id: "arrival",
      label: "Arrival & interview",
      intro: "Phase 1 — kitchen-table sit-down. Consents confirmed before any capture.",
      slots: [
        {
          id: "arr.documents", label: "Documents — scan each on the spot",
          guidance: "Phone-scan every physical document. Originals stay in the house.",
          minCaptures: 1, voiceNote: "optional",
        },
        {
          id: "arr.show-me-tour", label: "Show-me tour — each shutoff, quirk, trouble spot",
          guidance: "Owner walks you to everything THEY know. One capture per stop. This never comes back if it isn't caught now.",
          minCaptures: 1, voiceNote: "required",
        },
        {
          id: "arr.air-monitor", label: "Air monitor deployed in main living area",
          guidance: "CO₂/PM2.5/RH monitor placed; logs from now through visit two.",
          minCaptures: 1,
        },
      ],
    },
    {
      id: "exterior",
      label: "Exterior circuit",
      intro: "Phase 2 — full perimeter, one direction, corner to corner. Weather-dependent: goes first.",
      slots: [
        { id: "ext.elevations", label: "All four elevations, wide", minCaptures: 4 },
        {
          id: "ext.foundation-corners", label: "All four foundation corners",
          guidance: "Grade line visible in each. Extra captures for any cracking — with scale.",
          minCaptures: 4,
        },
        {
          id: "ext.grading", label: "Grading & drainage at the foundation line",
          guidance: "Anywhere water would move toward the house.",
          minCaptures: 2, voiceNote: "recommended",
        },
        {
          id: "ext.downspouts", label: "Every downspout discharge point",
          guidance: "One capture per downspout; where does it discharge?",
          minCaptures: 2,
        },
        {
          id: "ext.cladding-trim", label: "Cladding, trim & caulking condition",
          minCaptures: 2,
        },
        {
          id: "ext.windows-doors", label: "Windows & doors from outside",
          guidance: "Sills, flashing, seal-failure fogging.",
          minCaptures: 2,
        },
        {
          id: "ext.hose-bibs", label: "Every hose bib + static pressure reading",
          guidance: "Thread the gauge on one bib. SPEAK the static pressure reading.",
          minCaptures: 1, voiceNote: "required",
        },
        { id: "ext.service-entry", label: "Electrical service entry, mast & meter", minCaptures: 1 },
        {
          id: "ext.gas-meter", label: "Gas meter & shutoff",
          guidance: "Wide enough to locate it from the photo alone.",
          minCaptures: 1,
        },
        {
          id: "ext.ac-heatpump", label: "AC / heat pump: unit + nameplate",
          guidance: "Level, clearance, line insulation; nameplate legible.",
          minCaptures: 2,
        },
        {
          id: "ext.decks-steps", label: "Decks, steps & railings",
          guidance: "Grab test on railings.",
          minCaptures: 1, voiceNote: "recommended",
        },
        { id: "ext.driveway-walks", label: "Driveway & walkways", minCaptures: 1 },
        {
          id: "ext.roofline", label: "Roofline by pole cam — every slope",
          guidance: "Valleys, flashings, plumbing stacks. One capture per slope minimum.",
          minCaptures: 4,
        },
        { id: "ext.chimney-top", label: "Chimney top", minCaptures: 1 },
        {
          id: "ext.vent-terminations", label: "Every exterior vent termination",
          guidance: "Furnace, HRV, dryer, bath fans. Cross-checked from inside later.",
          minCaptures: 2,
        },
        {
          id: "ext.trees-overhang", label: "Major trees & roof overhangs",
          required: false, minCaptures: 1,
        },
        {
          id: "ext.outbuildings", label: "Outbuildings exterior quick pass",
          required: false, minCaptures: 1,
        },
        {
          id: "ext.defects", label: "Exterior defects — with scale in frame",
          guidance: "Tape or coin in frame. Mark comparison-photo positions on the site sketch.",
          required: false, minCaptures: 1, needsScaleInFrame: true, voiceNote: "recommended",
        },
      ],
    },
    {
      id: "basement",
      label: "Basement & mechanical core",
      intro: "Phase 3 — densest zone. Set the thermostat to call for heat BEFORE descending.",
      slots: [
        {
          id: "bsmt.furnace-nameplate", label: "Furnace nameplate",
          guidance: "Fill the frame; model and serial legible.",
          minCaptures: 1,
        },
        {
          id: "bsmt.furnace-filter", label: "Furnace filter: size edge + condition",
          guidance: "Photograph the printed size on the filter edge.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.furnace-run", label: "Furnace firing — burn/run observation",
          guidance: "Venting, condensate path, visible heat-exchanger area while it runs.",
          minCaptures: 1, voiceNote: "recommended",
        },
        { id: "bsmt.hrv", label: "HRV nameplate + filter state", required: false, minCaptures: 1 },
        { id: "bsmt.humidifier", label: "Humidifier + pad size", required: false, minCaptures: 1 },
        {
          id: "bsmt.water-heater", label: "Water heater: nameplate + fittings + TPR",
          guidance: "Nameplate (serial decodes age) · fittings for rust · TPR valve present and piped · venting · pan.",
          minCaptures: 2,
        },
        {
          id: "bsmt.main-shutoff", label: "Main water shutoff — wide + tagged",
          guidance: "Wide enough to relocate. Operate ONLY if ball valve in good shape; crusty gate valves get flagged, never forced. Install the valve tag.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.supply-pipe", label: "Supply pipe material close-ups",
          guidance: "Copper / PEX / grey poly-B / Kitec (orange-blue, stamped fittings) / galvanized. SPEAK the identification.",
          minCaptures: 1, voiceNote: "required",
        },
        {
          id: "bsmt.drain-material", label: "Drain material + cleanout",
          guidance: "ABS / cast iron / clay cleanout evidence.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.sump", label: "Sump: lid off, bucket pour test",
          guidance: "Runs, discharges, shuts off. Backup pump/battery status. Discharge route ties to exterior finding.",
          minCaptures: 2, voiceNote: "recommended",
        },
        { id: "bsmt.floor-drain", label: "Floor drain + backwater valve located", minCaptures: 1 },
        {
          id: "bsmt.panel", label: "Electrical panel: exterior + directory",
          guidance: "Dead-front STAYS ON (policy). Brand, service size, directory photographed. No heat/odour/corrosion.",
          minCaptures: 2, voiceNote: "recommended",
        },
        {
          id: "bsmt.branch-wiring", label: "Visible branch wiring types",
          guidance: "Flag knob-and-tube ceramics, aluminum markings, uncovered junction boxes.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.gas-sniffer", label: "Gas sniffer pass at accessible fittings",
          guidance: "SCREENING ONLY. Any hit: photograph, ventilate, refer to TSSA-registered contractor. We never touch gas.",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.foundation-circuit", label: "Interior foundation wall circuit",
          guidance: "Every crack with tape in frame and MEASURED — speak the width. Moisture meter on stains and efflorescence.",
          minCaptures: 4, needsScaleInFrame: true, voiceNote: "recommended",
        },
        {
          id: "bsmt.sill-rim", label: "Sill plate & rim joist where open",
          minCaptures: 1,
        },
        {
          id: "bsmt.beams-posts", label: "Beams, posts, signs of movement",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "bsmt.ceiling-below-wet", label: "Ceiling below wet rooms — PRE-look",
          guidance: "BEFORE the water run. Compared again at final checks after fixtures have run.",
          minCaptures: 2, tags: ["ceiling-baseline"],
        },
        {
          id: "bsmt.moisture-readings", label: "Moisture meter readings — anything flagged",
          guidance: "Photo + SPEAK the reading and location.",
          required: false, minCaptures: 1, voiceNote: "required",
        },
      ],
    },
    {
      id: "main-floor",
      label: "Main floor",
      intro: "Phase 5 — the room routine in every room. Water run threads through wet rooms.",
      slots: [
        {
          id: "mf.smoke-co-audit", label: "Smoke/CO placement audit — this storey",
          guidance: "Smoke every storey + outside sleeping areas; CO adjacent to sleeping areas given fuel appliances or attached garage.",
          minCaptures: 1, voiceNote: "recommended",
        },
      ],
      rooms: [
        { template: "kitchen", roomKinds: ["kitchen"] },
        { template: "bathroom", roomKinds: ["bathroom"] },
        { template: "bedroom", roomKinds: ["bedroom"] },
        { template: "laundry", roomKinds: ["laundry"] },
        { template: "room-routine", roomKinds: ["living", "dining", "office", "hallway", "other"] },
      ],
    },
    {
      id: "upper-floor",
      label: "Upper floor",
      intro: "Phase 6 — same room routine; bedrooms add egress. Detector coverage map completes here.",
      slots: [
        {
          id: "uf.detector-map", label: "Detector coverage map — complete",
          guidance: "Verified against Ontario requirements: every storey + outside sleeping areas; CO near bedrooms.",
          minCaptures: 1, voiceNote: "recommended",
        },
      ],
      rooms: [
        { template: "bedroom", roomKinds: ["bedroom"] },
        { template: "bathroom", roomKinds: ["bathroom"] },
        { template: "room-routine", roomKinds: ["office", "hallway", "other"] },
      ],
    },
    {
      id: "attic",
      label: "Attic",
      intro: "Phase 6 — head-and-shoulders from the hatch plus pole camera. NEVER a walk on joists.",
      slots: [
        { id: "attic.hatch", label: "Hatch access + surround", minCaptures: 1 },
        {
          id: "attic.insulation", label: "Insulation type & depth — ruler in frame",
          minCaptures: 1, needsScaleInFrame: true, voiceNote: "required",
          guidance: "SPEAK type and measured depth.",
        },
        {
          id: "attic.sheathing", label: "Sheathing condition: staining, frost",
          minCaptures: 2, voiceNote: "recommended",
        },
        { id: "attic.vents-daylight", label: "Daylight at vents", minCaptures: 1 },
        {
          id: "attic.duct-terminations", label: "Bath/kitchen/dryer ducts actually leaving the attic",
          minCaptures: 1,
        },
        { id: "attic.pests", label: "Pest evidence", required: false, minCaptures: 1 },
        {
          id: "attic.vermiculite", label: "VERMICULITE — if visible: stop, shoot from hatch only",
          guidance: "Disturb nothing. Photograph from the hatch, close up, flag as suspect ACM requiring professional sampling. The attic label is 'inspected from hatch' either way.",
          required: false, minCaptures: 1, voiceNote: "required",
        },
      ],
    },
    {
      id: "garage",
      label: "Garage",
      intro: "Phase 7.",
      slots: [
        {
          id: "gar.door-reverse", label: "Door balance + BOTH auto-reverse tests",
          guidance: "Beam AND pressure reversal. Speak the results.",
          minCaptures: 1, voiceNote: "required",
        },
        { id: "gar.opener", label: "Opener condition", minCaptures: 1 },
        {
          id: "gar.fire-door", label: "Fire separation door: self-closes & latches",
          minCaptures: 1, voiceNote: "recommended",
        },
        { id: "gar.slab", label: "Slab condition", minCaptures: 1 },
        { id: "gar.outlets", label: "Outlets / GFCI tested", minCaptures: 1 },
        { id: "gar.storage", label: "Fuel & chemical storage", minCaptures: 1 },
        {
          id: "gar.co-pathway", label: "CO pathway: door seals, fuel equipment",
          minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "gar.subpanel", label: "Subpanel if present — same rules as main panel",
          guidance: "Dead-front stays on. Exterior + directory.",
          required: false, minCaptures: 1,
        },
      ],
    },
    {
      id: "final-checks",
      label: "Final checks — after the water run",
      intro: "Phase 4's last step: back to the basement AFTER every wet room has run.",
      slots: [
        {
          id: "fc.ceiling-recheck", label: "Ceiling below wet rooms — RE-CHECK",
          guidance: "Compare against the pre-look (shown side-by-side). New moisture, drips, stain growth — this catches the slow drip that only shows after fixtures have actually run.",
          minCaptures: 2,
          reCheckOf: "bsmt.ceiling-below-wet",
          constraints: [{ type: "afterAllTagged", tag: "water-run" }],
        },
      ],
    },
    {
      id: "deploy-tidy",
      label: "Deploy, tag & tidy",
      intro: "Phase 8 — instruments placed, tags installed, house returned to found state.",
      slots: [
        {
          id: "dep.radon", label: "Radon detector deployed + placement",
          guidance: "Lowest OCCUPIED level, away from drafts/windows/exterior walls/moisture. SPEAK device ID, start date, location. Stays ≥3 months.",
          minCaptures: 1, voiceNote: "required",
        },
        {
          id: "dep.loggers", label: "Temp/RH loggers placed (2–3)",
          guidance: "Basement, main living area, complaint room if one exists. SPEAK each location.",
          minCaptures: 2, voiceNote: "required",
        },
        {
          id: "dep.valve-tag", label: "Valve tag installed on water main",
          minCaptures: 1,
        },
        {
          id: "dep.batteries", label: "Detector batteries replaced where failed",
          guidance: "Any detector that chirped or failed gets a fresh battery on the spot — log it.",
          required: false, minCaptures: 1, voiceNote: "recommended",
        },
        {
          id: "dep.tidy", label: "Everything opened closed; everything moved returned",
          required: false, minCaptures: 1,
        },
      ],
    },
  ],

  conditionalBlocks: [
    {
      id: "well",
      label: "Private well",
      when: { allOf: ["has-well"] },
      inject: [
        {
          zoneId: "exterior",
          position: "end",
          slots: [
            {
              id: "well.head", label: "Wellhead: wide + cap close-up",
              guidance: "Cap condition, grade sloping away.",
              minCaptures: 2,
            },
            {
              id: "well.separation", label: "Wellhead separation context",
              guidance: "Distance context to septic, fuel, drainage.",
              minCaptures: 1, voiceNote: "recommended",
            },
          ],
        },
        {
          zoneId: "basement",
          position: "end",
          slots: [
            {
              id: "well.pressure-system", label: "Pressure tank + gauge + switch",
              guidance: "Tank, gauge reading, pressure switch, pump wiring.",
              minCaptures: 2, voiceNote: "recommended",
            },
            {
              id: "well.treatment", label: "Treatment train: nameplates + settings",
              guidance: "Softener, UV, filters, RO — nameplates and settings photos.",
              minCaptures: 1, voiceNote: "recommended",
            },
          ],
        },
        {
          zoneId: "main-floor",
          position: "end",
          slots: [
            {
              id: "well.bacteria-sample", label: "Bacteria sample — per public-health protocol",
              guidance: "Mid-visit, after lines have run. Aerator off, tap sanitized, cold run, sterile bottle, gloves, straight to cooler. SPEAK tap location and time.",
              minCaptures: 1, voiceNote: "required", tags: ["water-run"],
            },
            {
              id: "well.chemistry-samples", label: "Chemistry set: raw + treated",
              guidance: "Raw pre-treatment (bypass or outdoor tap), treated at kitchen tap. Chain-of-custody forms. Labelled, logged, cooled.",
              minCaptures: 2, voiceNote: "required",
            },
          ],
        },
      ],
    },
    {
      id: "septic",
      label: "Septic system",
      when: { allOf: ["has-septic"] },
      inject: [
        {
          zoneId: "exterior",
          position: "end",
          slots: [
            {
              id: "septic.lids", label: "Septic lids",
              guidance: "Surface condition at each lid.",
              minCaptures: 1,
            },
            {
              id: "septic.bed", label: "Bed area wide",
              guidance: "Wet or lush patches; what's parked or planted on it.",
              minCaptures: 1, voiceNote: "recommended",
            },
          ],
        },
      ],
    },
    {
      id: "wood-heat",
      label: "Wood heat",
      when: { allOf: ["has-wood-heat"] },
      inject: [
        {
          zoneId: "main-floor",
          position: "end",
          slots: [
            {
              id: "wood.stove", label: "Stove/fireplace + clearances",
              guidance: "Clearances noted — SPEAK measurements. Recorded as 'WETT-class inspection required', never cleared by us.",
              minCaptures: 2, voiceNote: "required",
            },
            {
              id: "wood.chimney", label: "Visible chimney + last-sweep evidence",
              guidance: "Interior chimney sections; any sweep tags or records.",
              minCaptures: 1, voiceNote: "recommended",
            },
          ],
        },
      ],
    },
  ],
} satisfies RouteConfigInput;
