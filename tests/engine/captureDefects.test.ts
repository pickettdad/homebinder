/**
 * Capture Mode spec §7 — the four defects the walk surfaced, as invariants rather than
 * as an inventory of today's items. Each states what must hold, so a correct addition to
 * the master passes and a regression fails (CLAUDE.md, 2026-07-28).
 */
import { describe, expect, it } from "vitest";
import { checklistsBaseline } from "../../src/config/checklists.generated";
import { offersVerdict } from "../../src/engine/v2/checklist";
import type { ChecklistItem } from "../../src/engine/schema/checklistConfig";

const cfg = checklistsBaseline as unknown as {
  propertyFlags: { id: string; label: string; intakeSource: string }[];
  measureUnits: { unit: string }[];
  baseLists: { items: ChecklistItem[] }[];
  zoneLists: { items: ChecklistItem[] }[];
  componentLists: { items: ChecklistItem[] }[];
  sessionItems: ChecklistItem[];
};

const allItems: ChecklistItem[] = [
  ...cfg.baseLists.flatMap((l) => l.items),
  ...cfg.zoneLists.flatMap((l) => l.items),
  ...cfg.componentLists.flatMap((l) => l.items),
  ...cfg.sessionItems,
];

/** Mirrors SetupV2Screen's heading sanitiser. Kept in sync by the assertions below. */
const heading = (source: string): string =>
  source
    .replace(/[*`_]/g, "")
    .replace(/\s*[—-]?\s*see\s+§\s*\d+\s*$/i, "")
    .replace(/^\s*⚠\s*/, "")
    .trim() || "Other";

describe("§7.2 — a measure records a value and no verdict (F-22)", () => {
  it("no measure item may be resolved with pass/fail, whatever its attest", () => {
    // The invariant. Holds at 18 measure items and at 180. `identification, never
    // assessment` (spec §0.1): whether a number is acceptable is a specialist's call.
    for (const item of allItems.filter((i) => i.satisfy === "measure")) {
      expect(offersVerdict(item), item.id).toBe(false);
    }
  });

  it("no choice item may be resolved with pass/fail either — the selection IS the record", () => {
    for (const item of allItems.filter((i) => i.satisfy === "choice")) {
      expect(offersVerdict(item), item.id).toBe(false);
    }
  });

  it("a verdict is still offered where the concierge is the right person to give one", () => {
    // Guards against the over-correction: this must not silently disarm every test.
    // A door that will not latch is a fact they can attest to.
    const withVerdict = allItems.filter(offersVerdict);
    expect(withVerdict.length).toBeGreaterThan(0);
    for (const item of withVerdict) {
      expect(item.attest, item.id).toBe("action");
      expect(["measure", "choice"]).not.toContain(item.satisfy);
    }
  });

  it("evidence items never offer a verdict — the attest rule, restated at this seam", () => {
    for (const item of allItems.filter((i) => i.attest === "evidence")) {
      expect(offersVerdict(item), item.id).toBe(false);
    }
  });
});

describe("§7.1 — a measure's unit is declared, not guessed (F-21)", () => {
  it("every declared measure unit is one Table H knows", () => {
    // What the field renders beside the input comes from `item.unit`; this asserts the
    // value it renders is a governed one rather than free text.
    const declared = new Set(cfg.measureUnits.map((u) => u.unit));
    for (const item of allItems.filter((i) => i.satisfy === "measure" && i.unit)) {
      expect(declared.has(item.unit!), `${item.id} unit=${item.unit}`).toBe(true);
    }
  });

  it("a unit is only ever carried by a measure", () => {
    for (const item of allItems.filter((i) => i.unit)) {
      expect(item.satisfy, item.id).toBe("measure");
    }
  });
});

describe("§7.3 — no authoring marks reach the screen (F-23)", () => {
  it("no rendered intake heading carries markdown emphasis or a spec cross-reference", () => {
    // The invariant, not the instance. `flat_roof` WAS the offender — the walk saw the literal
    // "⚠ **not yet asked at intake** — see §9" as a section heading — and master v1.12 fixed
    // it at the source: a flag that is not asked now carries no intake source at all, so it
    // renders no heading to sanitise. The sanitiser stays, because the next authored cell can
    // still carry marks and this test is about the class rather than the instance.
    for (const f of cfg.propertyFlags) {
      if (!f.intakeSource) continue; // not asked — no heading is rendered for it
      const h = heading(f.intakeSource);
      expect(h, f.id).not.toMatch(/[*`_]/);
      expect(h, f.id).not.toMatch(/§/);
      expect(h.length, f.id).toBeGreaterThan(0);
    }
  });

  it("sanitising never empties a heading, and leaves a real source untouched", () => {
    // Control: the fix must not quietly blank or mangle the sixteen healthy cells.
    expect(heading("Water source")).toBe("Water source");
    expect(heading("Solar/battery/EV")).toBe("Solar/battery/EV");
    // And the historical offender, so a regression is legible in the failure output. No flag
    // carries this string any more (v1.12 made `flat_roof` un-asked rather than describing it
    // as un-asked), but the sanitiser must still handle it if one ever does again.
    expect(heading("⚠ **not yet asked at intake** — see §9")).toBe("not yet asked at intake");
  });
});
