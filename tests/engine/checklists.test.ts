/**
 * Checklist config pipeline — the CI gate for the master → generated contract.
 *
 * 1. DRIFT: the committed checklists.generated.ts must byte-match a fresh
 *    regeneration from docs/CHECKLIST-MASTER.md (edit master → run gen → commit both).
 * 2. VALIDITY: the generated config passes the Zod schema (fail closed, readable).
 * 3. PURITY: pure serializable data, stable content hash (the pinning contract).
 * 4. CONTENT INVARIANTS: the discipline rules the master claims for itself —
 *    per-rendered-group core cap, session-item count, dialect decisions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseMaster, emitModule } from "../../scripts/lib/genChecklists";
import { componentItemsFor, deriveZoneItems, effectiveAttributes } from "../../src/engine/v2/checklist";
import { foldV2 } from "../../src/engine/v2/fold";
import type { Source } from "../../src/engine/schema/events";
import type { V2EventPayload, V2SessionEvent } from "../../src/engine/v2/events";

const _src: Source = { actor: "human", actorId: "t", device: "t", appVersion: "t" };
const mkEvents = (payloads: V2EventPayload[]): V2SessionEvent[] =>
  payloads.map((payload, i) => ({ ...payload, eventId: `e${i}`, sessionId: "s", seq: i + 1, at: new Date(Date.UTC(2026,6,27,0,0,i)).toISOString(), schemaVersion: 2, source: _src }) as V2SessionEvent);
import { normalizeAlias } from "../../src/engine/schema/checklistConfig";
import { checklistsBaseline } from "../../src/config/checklists.generated";
import {
  parseChecklistConfig,
  validateChecklistConfig,
  type ChecklistConfig,
  type ChecklistItem,
} from "../../src/engine/schema/checklistConfig";
import { canonicalJson, hashConfig } from "../../src/engine/canonical";

const root = join(__dirname, "..", "..");
const masterText = readFileSync(join(root, "docs", "CHECKLIST-MASTER.md"), "utf8");
const committedModule = readFileSync(join(root, "src", "config", "checklists.generated.ts"), "utf8");

function validConfig(): ChecklistConfig {
  const result = validateChecklistConfig(checklistsBaseline);
  if (!result.ok) throw new Error(`config invalid:\n${result.errors.join("\n")}`);
  return result.config;
}

describe("generator drift", () => {
  it("committed checklists.generated.ts byte-matches a fresh regeneration from the master", () => {
    const regenerated = emitModule(parseMaster(masterText));
    expect(committedModule).toBe(regenerated);
  });
});

describe("schema validity", () => {
  it("generated config passes the checklist schema", () => {
    const result = validateChecklistConfig(checklistsBaseline);
    if (!result.ok) expect.fail(`invalid config:\n${result.errors.join("\n")}`);
  });

  it("rejects an item whose satisfy:pin names no types", () => {
    const broken = structuredClone(checklistsBaseline);
    const item = broken.baseLists![0]!.items.find((i) => i.satisfy === "pin");
    if (!item) return; // base list without pin items — nothing to break here
    delete item.pinTypes;
    const result = validateChecklistConfig(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects a trigger referencing an undeclared flag", () => {
    const broken = structuredClone(checklistsBaseline);
    broken.sessionItems![0]!.trigger = { anyOf: ["property.does_not_exist"] };
    const result = validateChecklistConfig(broken);
    expect(result.ok).toBe(false);
  });
});

describe("pure-data + hashing contract", () => {
  it("config survives a JSON round-trip unchanged", () => {
    const parsed = parseChecklistConfig(checklistsBaseline);
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped).toEqual(parsed);
  });

  it("content hash is stable across parse and round-trip", async () => {
    const parsed = parseChecklistConfig(checklistsBaseline);
    const again = parseChecklistConfig(JSON.parse(JSON.stringify(checklistsBaseline)));
    expect(canonicalJson(parsed)).toBe(canonicalJson(again));
    expect(await hashConfig(parsed)).toBe(await hashConfig(again));
  });
});

describe("content invariants (master v1.1 discipline)", () => {
  const cfg = validConfig();

  it("core cap holds per rendered group (≤ 8)", () => {
    const groups: { name: string; core: number }[] = [];
    const countCore = (items: ChecklistItem[]) => items.filter((i) => i.tier === "core").length;

    // Base lists group by authored sub-heading too since v1.6.1 — mechanical-base carries
    // six. Counting a base list as one group reported it at 20 core against a cap of 8.
    for (const b of cfg.baseLists) {
      const byGroup = new Map<string, ChecklistItem[]>();
      for (const item of b.items) {
        const key = item.group ?? "(base)";
        byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
      }
      for (const [key, items] of byGroup) groups.push({ name: `base:${b.id}:${key}`, core: countCore(items) });
    }
    for (const zl of cfg.zoneLists) {
      const byGroup = new Map<string, ChecklistItem[]>();
      for (const item of zl.items) {
        const key = item.group ?? "(zone)";
        byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
      }
      for (const [key, items] of byGroup)
        groups.push({ name: `zone:${zl.zoneType}:${key}`, core: countCore(items) });
    }
    // componentItemsFor, NOT c.items: a sub-type renders as ONE group carrying its parent's
    // items plus its own (master v1.4). Counting only own items would let an inheriting type
    // blow the cap while this test reported clean — the cap exists per *rendered* group.
    for (const c of cfg.componentLists.filter((c) => !c.stub))
      groups.push({
        name: `component:${c.types.join("/")}`,
        core: countCore(componentItemsFor(cfg, c.types[0]!)),
      });
    groups.push({ name: "session", core: countCore(cfg.sessionItems) });

    const over = groups.filter((g) => g.core > 8);
    expect(over, `groups over the core cap: ${over.map((g) => `${g.name}=${g.core}`).join(", ")}`).toEqual([]);
  });

  it("session items stay a small attachment point (< 10)", () => {
    expect(cfg.sessionItems.length).toBeGreaterThan(0);
    expect(cfg.sessionItems.length).toBeLessThan(10);
  });

  it("mechanical items carry their sub-heading groups", () => {
    // v1.6 moved these from the `utility` zone list into `mechanical-base` — same ids, same
    // sub-headings, now inherited by every zone type and gated on zone.has_mechanicals.
    const utility = cfg.baseLists.find((b) => b.id === "mechanical-base");
    expect(utility).toBeDefined();
    const heatSource = utility!.items.find((i) => i.id === "utl.heat-source");
    expect(heatSource?.group).toBe("Heating & air");
    expect(utility!.items.every((i) => i.group)).toBe(true);
  });

  it("trigger shorthand a|b parses as anyOf with prefix inheritance", () => {
    const utility = cfg.baseLists.find((b) => b.id === "mechanical-base")!;
    const sniffer = utility.items.find((i) => i.id === "utl.sniffer");
    expect(sniffer?.trigger).toEqual({ anyOf: ["property.gas", "property.propane"] });
    const fuelTank = utility.items.find((i) => i.id === "utl.fuel-tank");
    expect(fuelTank?.trigger).toEqual({ anyOf: ["property.oil", "property.propane"] });
  });

  it("pin alternatives parse from the satisfy cell", () => {
    const utility = cfg.baseLists.find((b) => b.id === "mechanical-base")!;
    const heat = utility.items.find((i) => i.id === "utl.heat-source");
    expect(heat?.satisfy).toBe("pin");
    expect(heat?.pinTypes).toEqual(["furnace", "boiler", "heat-pump"]);
  });

  it("measure units parse from the satisfy cell", () => {
    const utility = cfg.baseLists.find((b) => b.id === "mechanical-base")!;
    expect(utility.items.find((i) => i.id === "utl.pressure")?.unit).toBe("psi");
  });

  it("review verdicts hold: int.alarms demoted, egress in interior-base on zone.sleeping, alarm coverage at session close", () => {
    const interior = cfg.baseLists.find((b) => b.id === "interior-base")!;
    const alarms = interior.items.find((i) => i.id === "int.alarms");
    expect(alarms?.tier).toBe("standard");
    expect(alarms?.pinTypes).toEqual(["smoke-alarm", "co-alarm"]);

    // v1.2: the egress items live in interior-base so ANY sleeping zone gets the core
    // egress item (id retained per id-stability — the liv. prefix is historical).
    // v1.8 split liv.egress into four per-dimension items; the placement rule is unchanged.
    const egress = interior.items.find((i) => i.id === "liv.egress-width");
    expect(egress?.trigger).toEqual({ anyOf: ["zone.sleeping"] });
    expect(egress?.tier).toBe("core");

    expect(cfg.sessionItems.some((i) => i.id === "ses.alarm-coverage")).toBe(true);
  });

  it("v1.2 adjudications hold: test verbs out of evidence items, fp.chimney restored", () => {
    const utility = cfg.baseLists.find((b) => b.id === "mechanical-base")!;
    expect(utility.items.find((i) => i.id === "utl.sump")?.text).not.toMatch(/bucket/i);
    const garage = cfg.zoneLists.find((z) => z.zoneType === "garage")!;
    expect(garage.items.find((i) => i.id === "gar.door-reverse")?.text).not.toMatch(/tested/i);
    const elevation = cfg.zoneLists.find((z) => z.zoneType === "elevation")!;
    expect(elevation.items.find((i) => i.id === "elv.hose-bibs")?.text).not.toMatch(/pressure/i);
    expect(elevation.items.find((i) => i.id === "elv.deck")?.text).not.toMatch(/grab/i);

    const fireplace = cfg.componentLists.find((c) => c.types.includes("fireplace"));
    const chimneyLink = fireplace?.items.find((i) => i.id === "fp.chimney");
    expect(chimneyLink?.pinTypes).toEqual(["chimney"]);
    expect(chimneyLink?.attest).toBe("evidence");
  });

  it("a satisfy:pin item may reference a stub type (stubs stay referenceable)", () => {
    // `dock` was the original example; v1.5 filled it because sit.shoreline referenced a
    // stub with nothing behind it. The invariant is unchanged: every remaining stub is a
    // legal pin type, and any item naming one still validates.
    const stubs = cfg.componentLists.filter((c) => c.stub);
    expect(stubs.length).toBeGreaterThan(0);
    for (const st of stubs) expect(st.items).toEqual([]);
    const site = cfg.zoneLists.find((z) => z.zoneType === "site")!;
    expect(site.items.find((i) => i.id === "sit.shoreline")?.pinTypes).toContain("dock");
    expect(cfg.componentLists.find((c) => c.types.includes("dock"))?.stub).toBe(false);
  });

  it("shared component tables serve multiple pin types", () => {
    const alarms = cfg.componentLists.find((c) => c.types.includes("smoke-alarm"));
    expect(alarms?.types).toEqual(["smoke-alarm", "co-alarm"]);
    expect(alarms?.items.some((i) => i.id === "alm.test" && i.attest === "action")).toBe(true);
  });

  it("N/A reasons carry their effects", () => {
    const byId = new Map(cfg.naReasons.map((r) => [r.id, r]));
    expect(byId.get("none-present")?.recordsFinding).toBe(true);
    expect(byId.get("no-access")?.feedsGapList).toBe(true);
    expect(byId.get("deferred")?.feedsGapList).toBe(true);
    expect(byId.get("no-access")?.note).toBe("recommended");
  });

  it("layers resolve and include the binder-contract views", () => {
    const byId = new Map(cfg.layers.map((l) => [l.id, l]));
    expect(byId.get("all")?.predicate).toEqual({});
    expect(byId.get("issues")?.predicate.flags).toEqual(["issue"]);
    expect(byId.get("shutoffs")?.predicate.componentTypes).toContain("water-main");
    expect(byId.get("alarms")?.predicate.componentTypes).toEqual(["smoke-alarm", "co-alarm"]);
  });

  it("every zone type's inheritance resolves to real base lists", () => {
    const baseIds = new Set(cfg.baseLists.map((b) => b.id));
    for (const zt of cfg.zoneTypes)
      for (const inh of zt.inherits) expect(baseIds.has(inh), `${zt.id} inherits ${inh}`).toBe(true);
  });
});

/**
 * `choice` satisfy type (master v1.3). The dialect carries options inline in the satisfy
 * cell — `choice (a|b|c)` — mirroring `measure (unit)`. Inside a markdown table those
 * pipes must be backslash-escaped, so the parser has to split on unescaped pipes only;
 * getting that wrong silently produces one giant option instead of many.
 */
describe("choice dialect (master v1.3)", () => {
  const allItems = () => {
    const out: { id: string; satisfy: string; options?: string[]; attest: string }[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        if (typeof rec.id === "string" && typeof rec.satisfy === "string")
          out.push(rec as unknown as (typeof out)[number]);
        Object.values(rec).forEach(walk);
      }
    };
    walk(checklistsBaseline);
    return out;
  };

  it("parses every authored choice item with 2+ options", () => {
    const choices = allItems().filter((i) => i.satisfy === "choice");
    expect(choices.length).toBeGreaterThan(0);
    for (const c of choices) {
      expect(c.options, `${c.id} has no options`).toBeDefined();
      expect(c.options!.length, `${c.id} has <2 options`).toBeGreaterThanOrEqual(2);
      expect(new Set(c.options!).size, `${c.id} has duplicate options`).toBe(c.options!.length);
    }
  });

  it("splits on escaped pipes rather than swallowing them into one option", () => {
    // utl.pipe-material-id is authored with 8 escaped-pipe alternatives.
    const pipe = allItems().find((i) => i.id === "utl.pipe-material-id");
    expect(pipe?.options).toEqual([
      "copper", "PEX", "poly-B", "Kitec", "galvanized", "CPVC", "mixed", "unknown",
    ]);
    // No option may still carry a stray backslash from the markdown escaping.
    for (const c of allItems().filter((i) => i.satisfy === "choice"))
      for (const o of c.options!) expect(o, `${c.id} option kept an escape`).not.toContain("\\");
  });

  it("carries options ONLY on choice items", () => {
    for (const i of allItems())
      if (i.satisfy !== "choice") expect(i.options, `${i.id} is ${i.satisfy} but has options`).toBeUndefined();
  });

  it("rejects malformed choice cells (fail closed)", () => {
    // Swap ONE real row in the real master rather than hand-rolling a fixture: a synthetic
    // master fails on the version header first, which would make every assertion here pass
    // for the wrong reason (verified — the first draft of this test was vacuous).
    const ROW = "| `hb.type` | Bib type | choice (frost-free\\|standard\\|unknown) | standard | evidence |";
    expect(masterText).toContain(ROW); // guard: if the row is reworded, fail loudly, not silently
    const withCell = (cell: string) =>
      masterText.replace(ROW, `| \`hb.type\` | Bib type | ${cell} | standard | evidence |`);

    // Control: a well-formed replacement must still parse, or the negatives prove nothing.
    expect(() => parseMaster(withCell("choice (a\\|b\\|unknown)"))).not.toThrow();

    expect(() => parseMaster(withCell("choice (only-one)"))).toThrow(/2\+ options/);
    expect(() => parseMaster(withCell("choice (a\\|a)"))).toThrow(/duplicate choice option/);
    expect(() => parseMaster(withCell("choice (a\\|)"))).toThrow(/empty choice option/);
    expect(() => parseMaster(withCell("choice ()"))).toThrow(/unparseable satisfy cell/);
  });

  it("keeps the two access-honesty items as attest:action — software must never infer extent", () => {
    for (const id of ["att.access-honesty", "crw.access-honesty"]) {
      const item = allItems().find((i) => i.id === id);
      expect(item?.satisfy).toBe("choice");
      expect(item?.attest).toBe("action");
    }
  });
});

/**
 * Escape-value adjudication (owner, 2026-07-26). §2 no longer demands an escape on every
 * choice — only where the option set isn't exhaustive-and-always-determinable. That makes
 * the escape-free set a deliberate, named four rather than an oversight, so it is pinned:
 * a future content pass that adds "unknown" to access-honesty (incoherent — you always
 * know how far you went) or drops it from fp.type must fail here, not in the field.
 */
describe("choice escape adjudication (master v1.3.1)", () => {
  const ESCAPE_FREE = ["att.access-honesty", "crw.access-honesty", "pnl.type", "fc.orientation"];
  const hasEscape = (opts: string[]) => opts.some((o) => /^(unknown|other)\b/i.test(o));

  const choices = () => {
    const out: { id: string; satisfy: string; options?: string[] }[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (r.satisfy === "choice") out.push(r as unknown as (typeof out)[number]);
        Object.values(r).forEach(walk);
      }
    };
    walk(checklistsBaseline);
    return out;
  };

  it("exactly the four adjudicated items are escape-free — no more, no fewer", () => {
    const actual = choices().filter((c) => !hasEscape(c.options!)).map((c) => c.id).sort();
    expect(actual).toEqual([...ESCAPE_FREE].sort());
  });

  it("fp.type and gen.fuel carry the unknown added by adjudication", () => {
    for (const id of ["fp.type", "gen.fuel"]) {
      const item = choices().find((c) => c.id === id);
      expect(item?.options, `${id} missing`).toBeDefined();
      expect(item!.options).toContain("unknown");
    }
  });
});

/**
 * `measure (year)` plausible range (master v1.3.1): 1900 → current year. Pinned at the
 * config level so the two registry-backbone items keep the unit the UI gate keys off —
 * rename the unit and the range check silently stops applying.
 */
describe("year-unit measures (master v1.3.1)", () => {
  it("wh.age and ft.age are measure (year)", () => {
    const found: Record<string, { satisfy: string; unit?: string }> = {};
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (r.id === "wh.age" || r.id === "ft.age")
          found[r.id as string] = r as unknown as { satisfy: string; unit?: string };
        Object.values(r).forEach(walk);
      }
    };
    walk(checklistsBaseline);
    for (const id of ["wh.age", "ft.age"]) {
      expect(found[id]?.satisfy, `${id} satisfy`).toBe("measure");
      expect(found[id]?.unit, `${id} unit`).toBe("year");
    }
  });
});

/**
 * Component inheritance (master v1.4). Sub-types carry a parent's items plus their own,
 * mirroring zone-type inheritance. Two things make this fragile enough to pin hard:
 *
 * 1. The heading syntax "### `child` — inherits `parent`" reuses backticks, and the
 *    *existing* meaning of two backticked ids on one component heading is a SHARED list
 *    (`smoke-alarm` / `co-alarm`). Parsed naively, every sub-type merges with its parent
 *    instead of inheriting from it. Verified by reverting the parser: it now fails closed at
 *    generation ("must name exactly one id"), but only because that guard exists — without
 *    it the symptom surfaces as a confusing duplicate-component-type error much later.
 * 2. Inheritance is stored declaratively and composed at derivation. Flattening it into the
 *    generated config would duplicate parent item ids and break the globally-unique-id rule.
 */
describe("component inheritance (master v1.4)", () => {
  const cfg = validConfig();
  const listFor = (t: string) => cfg.componentLists.find((c) => c.types.includes(t));

  it("an inheriting heading declares ONE type, not a shared list", () => {
    for (const c of cfg.componentLists.filter((c) => c.inherits))
      expect(c.types, `${c.types.join("/")} merged its parent into a shared list`).toHaveLength(1);
  });

  it("every declared parent exists and carries items", () => {
    for (const c of cfg.componentLists.filter((c) => c.inherits)) {
      const parent = listFor(c.inherits!);
      expect(parent, `${c.types[0]} inherits missing ${c.inherits}`).toBeDefined();
      expect(parent!.stub).toBe(false);
      expect(parent!.items.length).toBeGreaterThan(0);
    }
  });

  it("composes parent items FIRST, then the child's own", () => {
    const composed = componentItemsFor(cfg, "water-softener").map((i) => i.id);
    const parent = listFor("water-treatment")!.items.map((i) => i.id);
    const own = listFor("water-softener")!.items.map((i) => i.id);
    expect(composed).toEqual([...parent, ...own]);
  });

  it("does not flatten inheritance into the generated config", () => {
    // If the generator flattened, the child list would already contain the parent's ids —
    // duplicating them across lists and breaking the unique-id invariant.
    const own = listFor("appliance-dishwasher")!.items.map((i) => i.id);
    expect(own).not.toContain("app.nameplate");
    expect(own.every((id) => id.startsWith("apd."))).toBe(true);
  });

  it("a non-inheriting type composes to exactly its own items", () => {
    const t = "toilet";
    expect(componentItemsFor(cfg, t).map((i) => i.id)).toEqual(listFor(t)!.items.map((i) => i.id));
  });

  it("terminates on an unknown type instead of looping", () => {
    expect(componentItemsFor(cfg, "no-such-component")).toEqual([]);
  });

  it("the 16 v1.4 types are all present and reachable", () => {
    const added = [
      "toilet", "sink", "shower", "bathtub", "laundry-tub",
      "appliance-refrigerator", "appliance-dishwasher", "appliance-range",
      "appliance-range-hood", "appliance-washer", "appliance-dryer", "appliance-microwave",
      "water-softener", "sediment-filter", "uv-sterilizer", "reverse-osmosis",
    ];
    for (const t of added) {
      expect(listFor(t), `${t} missing`).toBeDefined();
      expect(componentItemsFor(cfg, t).length, `${t} has no items`).toBeGreaterThan(0);
    }
  });
});

/**
 * Id stability. CLAUDE.md: "config is data, ids are never renamed or reused", refined by the
 * v1.4.1 ruling — **move keeps the id; redefine retires it**. All six ids below were
 * REDEFINED (check/action tests became pin/evidence linkage items, or their content moved
 * onto a component), so retiring them is correct: restoring one would let a past pass/fail
 * render as satisfying a different question. False continuity is worse than an honest
 * orphan. What must never happen is REUSE — a dead id returning attached to a different
 * verification would silently re-point historical resolutions at new meaning.
 */
describe("id stability", () => {
  const cfg = validConfig();
  /** Retired in v1.4/v1.4.1. Existed in a shipped master; never re-issue for anything else. */
  const RETIRED = [
    "bth.toilet-secure", "bth.tub-surround",
    "kit.dw-connection", "kit.fridge-line", "kit.fuel-range", "lnd.hoses",
    // v1.8: one item recording one number for four per-dimension thresholds. Retired rather
    // than reused, because the recorded value's provenance is unknowable — and a NUMBER
    // carries false precision, so nothing about it would invite doubt.
    "liv.egress",
  ];

  it("no retired id has been reused", () => {
    const live = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (typeof r.id === "string" && typeof r.satisfy === "string") live.add(r.id);
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    const reused = RETIRED.filter((id) => live.has(id));
    expect(reused, `retired ids reissued: ${reused.join(", ")}`).toEqual([]);
  });

  it("every item id is globally unique across all lists", () => {
    const counts = new Map<string, number>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (typeof r.id === "string" && typeof r.satisfy === "string")
          counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    expect([...counts.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });
});

/**
 * Table E component aliases (master v1.5). Search-only synonyms: they never create a type,
 * never appear in the manifest, never carry items. Their whole purpose is that a concierge
 * searching "air conditioner" finds `heat-pump` — because finding NOTHING is what drives a
 * freeform entry, and freeform entries are the telemetry the taxonomy work depends on.
 */
describe("component aliases (master v1.5)", () => {
  const cfg = validConfig();
  const types = new Set(cfg.componentLists.flatMap((c) => c.types));

  it("every alias resolves to a real component type", () => {
    expect(cfg.componentAliases.length).toBeGreaterThan(0);
    for (const a of cfg.componentAliases)
      expect(types.has(a.type), `alias "${a.alias}" -> unknown ${a.type}`).toBe(true);
  });

  it("aliases never become component types themselves", () => {
    // The manifest and the picker both enumerate componentLists; an alias leaking in as a
    // type would create a phantom pin type carrying no items.
    for (const a of cfg.componentAliases)
      expect(types.has(normalizeAlias(a.alias)), `alias "${a.alias}" leaked in as a type`).toBe(false);
  });

  it("no duplicate aliases after normalisation", () => {
    const keys = cfg.componentAliases.map((a) => normalizeAlias(a.alias));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("preserves authored spacing rather than forcing an id shape", () => {
    // "hot water tank" is a search term, not an id — coercing it to kebab-case would make
    // it unmatchable against what a person actually types.
    expect(cfg.componentAliases.some((a) => a.alias.includes(" "))).toBe(true);
  });

  it("no alias is authored in id style — the rule G7 recurrence earned", () => {
    // v1.5 authored `air-conditioner`, so typing "air conditioner" with a space STILL found
    // nothing — G7 reappearing inside its own fix. normalizeAlias now makes hyphen and space
    // equivalent at match time, so a kebab alias would still work; this guards the authoring
    // rule the master states (v1.5.1 §E): write aliases the way a person speaks, not the way
    // an id looks. A kebab alias is a signal someone was thinking in ids again, and the next
    // one may differ by a whole word — which no normaliser can reach.
    const kebab = cfg.componentAliases.filter((a) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(a.alias));
    expect(kebab.map((a) => a.alias), "aliases authored id-style").toEqual([]);
  });

  it("resolves G7 — 'air conditioner' finds heat-pump", () => {
    const q = "air conditioner";
    const hit = cfg.componentAliases.find((a) => normalizeAlias(a.alias).includes(normalizeAlias(q)));
    expect(hit?.type).toBe("heat-pump");
    expect(types.has("air-conditioner")).toBe(false); // no phantom type was added
  });
});

/**
 * Master Spec §1 acceptance (v1.5): every emergency shutoff/control the binder's §1 page
 * must render has somewhere in the library to land. This is the gap class G1-G8 all shared.
 */
describe("§1 shutoff map coverage (master v1.5)", () => {
  const cfg = validConfig();
  const ids = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (typeof r.id === "string" && typeof r.satisfy === "string") ids.add(r.id);
      Object.values(r).forEach(walk);
    }
  };
  walk(cfg);
  const types = new Set(cfg.componentLists.filter((c) => !c.stub).flatMap((c) => c.types));

  it("carries the shutoff items the dry run found missing", () => {
    for (const id of ["wh.shutoff", "blr.switch", "fur.switch", "sp.breaker", "sp.unit"])
      expect(ids.has(id), `${id} missing`).toBe(true);
  });

  it("carries the shutoff-bearing component types as real (non-stub) types", () => {
    for (const t of ["curb-stop", "septic-alarm", "solar-inverter", "pool-equipment", "irrigation-backflow"])
      expect(types.has(t), `${t} missing or still a stub`).toBe(true);
  });

  it("wm.curbstop is retired, not reissued — the curb stop became a pin", () => {
    expect(ids.has("wm.curbstop")).toBe(false);
    expect(types.has("curb-stop")).toBe(true);
  });
});

/**
 * v1.6.1 dialect support, tested against fixtures because the v1.5.1 master in the repo
 * does not yet exercise it. Landing the engine ahead of the content keeps the two changes
 * reviewable apart — the master intake is blocked on one authoring fix (REVIEW §16).
 */
describe("v1.6.1 dialect support", () => {
  /** Swap one section of the real master so the fixture stays otherwise valid. */
  const withSection = (heading: string, body: string) => {
    const i = masterText.indexOf(heading);
    if (i === -1) throw new Error(`fixture anchor missing: ${heading}`);
    const j = masterText.indexOf("### ", i + 5);
    return masterText.slice(0, i) + body + masterText.slice(j);
  };

  it("a base list may span several tables under bold sub-headings", () => {
    // Before v1.6.1 a base list was one heading = one table; the second table errored with
    // "item table outside a ### heading". mechanical-base has six.
    const cfg = parseMaster(
      withSection(
        "### `wet-base`",
        [
          "### `wet-base`",
          "",
          "**Group A**",
          "| id | text | satisfy | tier | attest |",
          "|---|---|---|---|---|",
          "| `wet.under-sink` | A | check | core | action |",
          "",
          "**Group B**",
          "| id | text | satisfy | tier | attest |",
          "|---|---|---|---|---|",
          "| `wet.supply-stops` | B | check | standard | action |",
          "",
        ].join("\n"),
      ),
    );
    const wet = cfg.baseLists!.find((b) => b.id === "wet-base")!;
    expect(wet.items.map((i) => i.id)).toEqual(["wet.under-sink", "wet.supply-stops"]);
    expect(wet.items.map((i) => i.group)).toEqual(["Group A", "Group B"]);
  });

  it("strips markdown emphasis from id cells", () => {
    // v1.6.1 authored the new inherits entry as **mechanical-base**; unstripped, thirteen
    // zone types inherited a base list that did not exist — and the failure was a
    // validation error three steps from the cause.
    const cfg = parseMaster(
      masterText.replace(
        "| `utility` | mechanical room, furnace room | interior-base, rough-base, **mechanical-base** |",
        "| `utility` | mechanical room, furnace room | *interior-base*, **rough-base**, `mechanical-base` |",
      ),
    );
    const utility = cfg.zoneTypes!.find((z) => z.id === "utility")!;
    // Emphasis stripped from every entry, including the v1.6.1 `**mechanical-base**`.
    expect(utility.inherits).toEqual(["interior-base", "rough-base", "mechanical-base"]);
  });

  it("parses Table B's `defaults true for` column, and tolerates its absence", () => {
    const mech = parseMaster(masterText).zoneAttributes!.find((a) => a.id === "has_mechanicals")!;
    expect(mech.defaultsTrueFor).toEqual(["utility"]);

    // The 3-column form must still parse — regenerating a pre-v1.6.1 master is not a
    // breaking edit. Drop the 4th column from Table B's rows to prove it.
    const i = masterText.indexOf("## B. Zone attributes");
    const j = masterText.indexOf("## C.");
    const threeCol = masterText
      .slice(i, j)
      .replace("| id | label | askAtCreation | defaults true for |", "| id | label | askAtCreation |")
      .replace("|---|---|---|---|", "|---|---|---|")
      .replace(/^\|([^|]*)\|([^|]*)\|([^|]*)\|[^|]*\|$/gm, "|$1|$2|$3|");
    const plain = parseMaster(masterText.slice(0, i) + threeCol + masterText.slice(j));
    expect(plain.zoneAttributes!.find((a) => a.id === "has_mechanicals")!.defaultsTrueFor ?? []).toEqual([]);
  });
});

/**
 * house.* vs pin.* scoping (master v1.6.1 §3). pin.* asks "in THIS ZONE"; house.* asks
 * "anywhere this visit". Before v1.6.1, pin.* silently answered house-wide at session scope.
 */
describe("house.* trigger namespace (master v1.6.1)", () => {
  it("rejects pin.* on a session item and points at house.*", () => {
    const cfg = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    (cfg.sessionItems as { id: string; trigger?: unknown }[])[0]!.trigger = { anyOf: ["pin.sump-pump"] };
    const result = validateChecklistConfig(cfg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toMatch(/pin\.\* is zone-only; use house\.sump-pump/);
  });

  it("accepts house.* anywhere, and rejects an unknown house type", () => {
    const good = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    (good.sessionItems as { trigger?: unknown }[])[0]!.trigger = { anyOf: ["house.sump-pump"] };
    expect(validateChecklistConfig(good).ok).toBe(true);

    const bad = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    (bad.sessionItems as { trigger?: unknown }[])[0]!.trigger = { anyOf: ["house.no-such-thing"] };
    expect(validateChecklistConfig(bad).ok).toBe(false);
  });
});

/**
 * Snake_case ids survive cell cleaning. REGRESSION: the emphasis-stripper added for v1.6.1
 * stripped `_` as well as `*`, silently renaming `has_stairs` → `hasstairs`,
 * `has_plumbing` → `hasplumbing`, `exterior_wall` → `exteriorwall`. It shipped to main.
 *
 * Nothing caught it because the generator corrupted BOTH sides identically — the Table B id
 * and the `zone.has_stairs` trigger ref — so the config stayed internally consistent, the
 * validator was satisfied, and the drift gate compared a corrupt config against an equally
 * corrupt regeneration. Only the literal id was wrong, so only a literal assertion finds it.
 */
describe("id fidelity", () => {
  const cfg = validConfig();

  it("zone attribute ids keep their underscores", () => {
    const ids = cfg.zoneAttributes.map((a) => a.id);
    for (const expected of ["has_stairs", "has_plumbing", "exterior_wall"])
      expect(ids, `${expected} was mangled`).toContain(expected);
  });

  it("property flag ids keep their underscores", () => {
    const ids = cfg.propertyFlags.map((f) => f.id);
    for (const expected of ["wood_heat", "municipal_water", "pre_1990"])
      expect(ids, `${expected} was mangled`).toContain(expected);
  });

  it("every zone.* trigger ref resolves to a declared attribute", () => {
    const attrs = new Set(cfg.zoneAttributes.map((a) => a.id));
    const refs = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        for (const k of ["allOf", "anyOf", "not"])
          for (const ref of (Array.isArray(r[k]) ? r[k] : []) as string[])
            if (ref.startsWith("zone.")) refs.add(ref);
        if (typeof r.gate === "string" && r.gate.startsWith("zone.")) refs.add(r.gate);
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    for (const ref of refs) expect(attrs, `${ref} unresolvable`).toContain(ref.slice(5));
  });
});

/**
 * List gates (master v1.6.2 §0): every item in a gated list is conditioned on the gate, and
 * where an item carries its own trigger the effective condition is allOf(gate, trigger).
 */
describe("list gates (master v1.6.2)", () => {
  const cfg = validConfig();
  const mech = cfg.baseLists.find((b) => b.id === "mechanical-base")!;

  it("mechanical-base is gated on zone.has_mechanicals and inherited by every zone type", () => {
    expect(mech.gate).toBe("zone.has_mechanicals");
    expect(cfg.zoneTypes.every((z) => z.inherits.includes("mechanical-base"))).toBe(true);
  });

  it("a zone WITHOUT the attribute renders no mechanical items", () => {
    const state = foldV2(mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.6.2", configHash: "h", propertyFlags: ["gas"], propertyLabel: "H" },
      { type: "ZoneCreated", zoneId: "bed", zoneType: "living-space", label: "Bedroom", attributes: {}, level: "main" },
    ]));
    const ids = deriveZoneItems(cfg, state, "bed").map((d) => d.item.id);
    expect(ids.filter((i) => i.startsWith("utl."))).toEqual([]);
    expect(ids).toContain("int.surfaces"); // ungated base list still renders
  });

  it("a zone WITH the attribute renders them — regardless of zone type", () => {
    const state = foldV2(mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.6.2", configHash: "h", propertyFlags: ["gas"], propertyLabel: "H" },
      // A basement corner, not a utility room — the whole point of v1.6.
      { type: "ZoneCreated", zoneId: "bsm", zoneType: "basement", label: "Basement", attributes: { has_mechanicals: true }, level: "basement" },
    ]));
    const ids = deriveZoneItems(cfg, state, "bsm").map((d) => d.item.id);
    expect(ids).toContain("utl.heat-source");
    expect(ids).toContain("utl.main-shutoff");
  });

  it("ANDs the gate with an item's own trigger — the Fuel case", () => {
    const zone = (flags: string[], mech: boolean) =>
      deriveZoneItems(
        cfg,
        foldV2(mkEvents([
          { type: "SessionInitialized", configId: "cfg", configVersion: "1.6.2", configHash: "h", propertyFlags: flags, propertyLabel: "H" },
          { type: "ZoneCreated", zoneId: "z", zoneType: "basement", label: "B", attributes: mech ? { has_mechanicals: true } : {}, level: "basement" },
        ])),
        "z",
      ).map((d) => d.item.id);

    // gas + mechanicals => shows · mechanicals but no gas => hidden · gas but no mechanicals => hidden
    expect(zone(["gas"], true)).toContain("utl.gas-shutoff");
    expect(zone([], true)).not.toContain("utl.gas-shutoff");
    expect(zone(["gas"], false)).not.toContain("utl.gas-shutoff");
  });
});

/**
 * Zone-type attribute defaults resolve at DERIVATION, not at zone creation.
 *
 * The creation UI pre-ticks the default too, but a UI-only default is bypassed by every
 * other creation path — and the session-plan import is exactly such a path. An imported
 * `utility` zone arriving without `has_mechanicals` would hide the whole mechanical
 * checklist on visit two, silently: the v1.6 bug returning through a different door.
 */
describe("zone-type attribute defaults (master v1.6.1 Table B col 4)", () => {
  const cfg = validConfig();
  const zoneEvents = (attributes: Record<string, boolean>) =>
    mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.6.2", configHash: "h", propertyFlags: [], propertyLabel: "H" },
      { type: "ZoneCreated", zoneId: "z", zoneType: "utility", label: "Utility", attributes, level: "basement" },
    ]);
  const idsFor = (attributes: Record<string, boolean>) =>
    deriveZoneItems(cfg, foldV2(zoneEvents(attributes)), "z").map((d) => d.item.id);

  it("a utility zone created WITHOUT the attribute still renders mechanicals (the import path)", () => {
    expect(idsFor({})).toContain("utl.heat-source");
  });

  it("an explicit false is honoured — absent is not the same as false", () => {
    // The inspector's decision: a utility room whose mechanicals were moved out.
    expect(idsFor({ has_mechanicals: false })).not.toContain("utl.heat-source");
  });

  it("an explicit true works, and no default leaks into other zone types", () => {
    expect(idsFor({ has_mechanicals: true })).toContain("utl.heat-source");
    const bed = foldV2(
      mkEvents([
        { type: "SessionInitialized", configId: "cfg", configVersion: "1.6.2", configHash: "h", propertyFlags: [], propertyLabel: "H" },
        { type: "ZoneCreated", zoneId: "b", zoneType: "living-space", label: "Bed", attributes: {}, level: "main" },
      ]),
    );
    expect(deriveZoneItems(cfg, bed, "b").map((d) => d.item.id)).not.toContain("utl.heat-source");
  });

  it("effectiveAttributes fills only unset defaults, leaving everything else alone", () => {
    const zone = foldV2(zoneEvents({ finished: false })).zones[0]!;
    const eff = effectiveAttributes(cfg, zone);
    expect(eff.has_mechanicals).toBe(true); // unset → default
    expect(eff.finished).toBe(false); // explicit → untouched
  });
});

/**
 * v1.7 declared structure: Table G (option lifecycle), Table H (closed unit set), and the
 * `.unit`/`.wide` reserved item classes. All three exist because a downstream consumer binds
 * to them, so all three are now enforced rather than conventional.
 */
describe("v1.7 declared structure", () => {
  const cfg = validConfig();

  it("Table H is the closed set, and every declared unit is used by a real item", () => {
    const declared = new Set(cfg.measureUnits.map((u) => u.unit));
    expect(declared).toEqual(new Set(["in", "psi", "%RH", "year", "mm"]));
    const used = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (r.satisfy === "measure" && typeof r.unit === "string") used.add(r.unit);
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    for (const u of used) expect(declared, `unit '${u}' is not in Table H`).toContain(u);
  });

  it("rejects a measure unit Table H does not declare", () => {
    const bad = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    const item = (bad.baseLists as { items: { unit?: string; satisfy: string }[] }[])
      .flatMap((b) => b.items)
      .find((i) => i.satisfy === "measure" && i.unit)!;
    item.unit = "cm"; // the exact drift Table H exists to prevent: mm on visit one, cm on visit five
    const r = validateChecklistConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/unit 'cm', which Table H does not declare/);
  });

  it("reserved .unit / .wide classes are always photo + evidence", () => {
    const walk = (o: unknown, out: { id: string; satisfy: string; attest: string }[] = []) => {
      const rec = (x: unknown): void => {
        if (Array.isArray(x)) return x.forEach(rec);
        if (x && typeof x === "object") {
          const r = x as Record<string, unknown>;
          if (typeof r.id === "string" && typeof r.satisfy === "string")
            out.push(r as unknown as { id: string; satisfy: string; attest: string });
          Object.values(r).forEach(rec);
        }
      };
      rec(o);
      return out;
    };
    const reserved = walk(cfg).filter((i) => i.id.endsWith(".unit") || i.id.endsWith(".wide"));
    expect(reserved.length).toBeGreaterThan(20);
    for (const i of reserved) {
      expect(i.satisfy, `${i.id}`).toBe("photo");
      expect(i.attest, `${i.id}`).toBe("evidence");
    }
  });

  it("rejects a .unit item that is not photo/evidence", () => {
    const bad = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    const items = (bad.componentLists as { items: { id: string; satisfy: string }[] }[]).flatMap((c) => c.items);
    const unit = items.find((i) => i.id.endsWith(".unit"))!;
    unit.satisfy = "check";
    expect(validateChecklistConfig(bad).ok).toBe(false);
  });

  it("Table G is empty but parsed, and a retired value may not still be live", () => {
    expect(cfg.retiredOptions).toEqual([]);
    const bad = JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;
    // Claim a still-live option is retired — retirement means gone, not deprecated-in-place.
    (bad as { retiredOptions: unknown[] }).retiredOptions = [
      { itemId: "wm.type", value: "ball", version: "v1.8" },
    ];
    const r = validateChecklistConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/still a live option/);
  });

  it("the B5 component types exist so house.* conditions can resolve", () => {
    const types = new Set(cfg.componentLists.flatMap((c) => c.types));
    for (const t of ["leak-sensor", "humidifier", "dehumidifier"]) expect(types).toContain(t);
  });
});

/**
 * The v1.7 §0 emphasis ban, enforced by FAILING CLOSED rather than stripping. v1.7 itself
 * carried `**mechanical-base**` in all thirteen §4 Inherits cells and could not build until
 * v1.7.1 removed it — the rule catching its own file on first contact.
 */
describe("no markdown emphasis in parsed cells (master v1.7 §0)", () => {
  it("rejects emphasis in an id-bearing cell instead of silently stripping it", () => {
    const row = "| `utility` | mechanical room, furnace room | interior-base, rough-base, mechanical-base |";
    expect(masterText).toContain(row); // guard: if §4 is reworded, fail loudly
    expect(() =>
      parseMaster(masterText.replace(row, "| `utility` | mechanical room, furnace room | interior-base, rough-base, **mechanical-base** |")),
    ).toThrow(/no markdown emphasis in parsed cells/);
  });

  it("leaves snake_case ids alone — the corruption the ban replaces", () => {
    // The stripper this ban removed ate `_`, renaming has_stairs to hasstairs. Both the id
    // and every reference were corrupted identically, so nothing downstream disagreed.
    const cfg = parseMaster(masterText);
    expect(cfg.zoneAttributes!.map((a) => a.id)).toContain("has_stairs");
    expect(cfg.zoneAttributes!.map((a) => a.id)).toContain("has_mechanicals");
  });
});

/**
 * Egress split (master v1.8). One item asking for a check plus three numbers became four,
 * because egress thresholds are PER DIMENSION — one number cannot be compared against four
 * limits, and the binder cannot say which dimension failed.
 */
describe("egress split (master v1.8)", () => {
  const cfg = validConfig();
  const base = cfg.baseLists.find((b) => b.id === "interior-base")!;
  const egress = base.items.filter((i) => i.id.startsWith("liv.egress"));

  it("is four items — the check is not a measurement", () => {
    expect(egress.map((i) => i.id).sort()).toEqual([
      "liv.egress-height", "liv.egress-opens", "liv.egress-sill", "liv.egress-width",
    ]);
    expect(egress.find((i) => i.id === "liv.egress-opens")!.satisfy).toBe("check");
    for (const id of ["liv.egress-width", "liv.egress-height", "liv.egress-sill"]) {
      const i = egress.find((x) => x.id === id)!;
      expect(i.satisfy).toBe("measure");
      expect(i.unit).toBe("in");
    }
  });

  it("records no openable area — it is DERIVED from width × height", () => {
    // A recorded derived value can disagree with its own inputs. The binder computes it
    // from two measurements that cannot contradict each other.
    expect(egress.some((i) => /area/i.test(i.id) || /area/i.test(i.text))).toBe(false);
  });

  it("all four stay attest:action and gated on zone.sleeping", () => {
    for (const i of egress) {
      expect(i.attest, i.id).toBe("action");
      expect(JSON.stringify(i.trigger), i.id).toContain("zone.sleeping");
    }
  });

  it("keeps interior-base inside the per-group core cap via its own sub-heading", () => {
    // Four core items added to a list already carrying five would sit at exactly 8 — the cap,
    // with zero headroom. The authored sub-heading splits them into their own rendered group.
    const byGroup = new Map<string, number>();
    for (const i of base.items)
      if (i.tier === "core") byGroup.set(i.group ?? "(base)", (byGroup.get(i.group ?? "(base)") ?? 0) + 1);
    expect(egress.every((i) => i.group === "Egress (sleeping rooms)")).toBe(true);
    expect(Math.max(...byGroup.values())).toBeLessThanOrEqual(8);
    expect(byGroup.get("Egress (sleeping rooms)")).toBe(4);
  });
});

/**
 * Table I — derived-value provenance (master v1.9). An item recording a value transcribed or
 * decoded from a physical artifact names the photo item capturing that artifact, so the value
 * can be re-checked. An unverifiable value is indistinguishable from a verified one, and the
 * equipment registry — the consumer with no session and no vote — cannot notice the difference.
 */
describe("derived-value provenance (master v1.9)", () => {
  const cfg = validConfig();
  const clone = () => JSON.parse(JSON.stringify(checklistsBaseline)) as typeof checklistsBaseline;

  it("declares provenance for every artifact-derived value, and each source is a photo", () => {
    expect(cfg.provenance.map((p) => p.itemId).sort()).toEqual(
      ["apw.hose-age", "ft.age", "wh.age", "wsf.age"],
    );
    const all = new Map<string, { satisfy: string }>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (typeof r.id === "string" && typeof r.satisfy === "string")
          all.set(r.id, r as unknown as { satisfy: string });
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    for (const p of cfg.provenance) expect(all.get(p.sourceItemId)?.satisfy, p.itemId).toBe("photo");
  });

  it("resolves wsf.age's source ACROSS INHERITANCE — the false-gap case", () => {
    // wsf.age lives on `water-softener`; wt.nameplate lives on its parent `water-treatment`.
    // A validator that checked only the item's own list would report a gap that isn't there.
    const row = cfg.provenance.find((p) => p.itemId === "wsf.age")!;
    expect(row.sourceItemId).toBe("wt.nameplate");
    const softener = cfg.componentLists.find((c) => c.types.includes("water-softener"))!;
    expect(softener.items.map((i) => i.id)).not.toContain("wt.nameplate"); // not in its own list
    expect(componentItemsFor(cfg, "water-softener").map((i) => i.id)).toContain("wt.nameplate");
    expect(validateChecklistConfig(cfg as unknown as Record<string, unknown>).ok).toBe(true);
  });

  it("rejects a source that is not a photo", () => {
    const bad = clone();
    (bad as { provenance: { itemId: string; derivedFrom: string; sourceItemId: string }[] }).provenance = [
      { itemId: "wh.age", derivedFrom: "x", sourceItemId: "wh.tpr" }, // a check, not a photo
    ];
    const r = validateChecklistConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/which is check, not photo/);
  });

  it("rejects a source photo that lives on an UNRELATED component", () => {
    // Global existence is not enough: provenance means the photo is taken on the same pin.
    const bad = clone();
    (bad as { provenance: { itemId: string; derivedFrom: string; sourceItemId: string }[] }).provenance = [
      { itemId: "wh.age", derivedFrom: "x", sourceItemId: "fur.nameplate" }, // exists, wrong object
    ];
    const r = validateChecklistConfig(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/not reachable from the same list/);
  });

  it("the two v1.9 source items exist and are photos", () => {
    const all = new Map<string, string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (typeof r.id === "string" && typeof r.satisfy === "string") all.set(r.id, r.satisfy);
        Object.values(r).forEach(walk);
      }
    };
    walk(cfg);
    expect(all.get("ft.nameplate")).toBe("photo");
    expect(all.get("apw.hose-label")).toBe("photo");
  });
});
