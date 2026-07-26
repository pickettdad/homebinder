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

    for (const b of cfg.baseLists) groups.push({ name: `base:${b.id}`, core: countCore(b.items) });
    for (const zl of cfg.zoneLists) {
      const byGroup = new Map<string, ChecklistItem[]>();
      for (const item of zl.items) {
        const key = item.group ?? "(zone)";
        byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
      }
      for (const [key, items] of byGroup)
        groups.push({ name: `zone:${zl.zoneType}:${key}`, core: countCore(items) });
    }
    for (const c of cfg.componentLists.filter((c) => !c.stub))
      groups.push({ name: `component:${c.types.join("/")}`, core: countCore(c.items) });
    groups.push({ name: "session", core: countCore(cfg.sessionItems) });

    const over = groups.filter((g) => g.core > 8);
    expect(over, `groups over the core cap: ${over.map((g) => `${g.name}=${g.core}`).join(", ")}`).toEqual([]);
  });

  it("session items stay a small attachment point (< 10)", () => {
    expect(cfg.sessionItems.length).toBeGreaterThan(0);
    expect(cfg.sessionItems.length).toBeLessThan(10);
  });

  it("utility items carry their sub-heading groups", () => {
    const utility = cfg.zoneLists.find((z) => z.zoneType === "utility");
    expect(utility).toBeDefined();
    const heatSource = utility!.items.find((i) => i.id === "utl.heat-source");
    expect(heatSource?.group).toBe("Heating & air");
    expect(utility!.items.every((i) => i.group)).toBe(true);
  });

  it("trigger shorthand a|b parses as anyOf with prefix inheritance", () => {
    const utility = cfg.zoneLists.find((z) => z.zoneType === "utility")!;
    const sniffer = utility.items.find((i) => i.id === "utl.sniffer");
    expect(sniffer?.trigger).toEqual({ anyOf: ["property.gas", "property.propane"] });
    const fuelTank = utility.items.find((i) => i.id === "utl.fuel-tank");
    expect(fuelTank?.trigger).toEqual({ anyOf: ["property.oil", "property.propane"] });
  });

  it("pin alternatives parse from the satisfy cell", () => {
    const utility = cfg.zoneLists.find((z) => z.zoneType === "utility")!;
    const heat = utility.items.find((i) => i.id === "utl.heat-source");
    expect(heat?.satisfy).toBe("pin");
    expect(heat?.pinTypes).toEqual(["furnace", "boiler", "heat-pump"]);
  });

  it("measure units parse from the satisfy cell", () => {
    const utility = cfg.zoneLists.find((z) => z.zoneType === "utility")!;
    expect(utility.items.find((i) => i.id === "utl.pressure")?.unit).toBe("psi");
  });

  it("review verdicts hold: int.alarms demoted, egress in interior-base on zone.sleeping, alarm coverage at session close", () => {
    const interior = cfg.baseLists.find((b) => b.id === "interior-base")!;
    const alarms = interior.items.find((i) => i.id === "int.alarms");
    expect(alarms?.tier).toBe("standard");
    expect(alarms?.pinTypes).toEqual(["smoke-alarm", "co-alarm"]);

    // v1.2: liv.egress lives in interior-base so ANY sleeping zone gets the core
    // egress item (id retained per id-stability — the liv. prefix is historical).
    const egress = interior.items.find((i) => i.id === "liv.egress");
    expect(egress?.trigger).toEqual({ anyOf: ["zone.sleeping"] });
    expect(egress?.tier).toBe("core");

    expect(cfg.sessionItems.some((i) => i.id === "ses.alarm-coverage")).toBe(true);
  });

  it("v1.2 adjudications hold: test verbs out of evidence items, fp.chimney restored", () => {
    const utility = cfg.zoneLists.find((z) => z.zoneType === "utility")!;
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

  it("stub component types are referenceable (dock via sit.shoreline)", () => {
    const dock = cfg.componentLists.find((c) => c.types.includes("dock"));
    expect(dock?.stub).toBe(true);
    const site = cfg.zoneLists.find((z) => z.zoneType === "site")!;
    expect(site.items.find((i) => i.id === "sit.shoreline")?.pinTypes).toContain("dock");
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
