import { describe, expect, it } from "vitest";
import { loadChecklists } from "../../src/config/loadChecklists";
import { pinMatchesLayer, relevantLayers } from "../../src/engine/v2/layers";
import type { LayerDef } from "../../src/engine/schema/checklistConfig";
import type { PinStateV2 } from "../../src/engine/v2/fold";

const config = loadChecklists();
const layer = (id: string): LayerDef => config.layers.find((l) => l.id === id)!;
const pin = (over: Partial<PinStateV2>): PinStateV2 =>
  ({ pinId: "p", number: 1, flag: null, anchors: [], photos: [], voiceNotes: [], noteIds: [], chatThreadIds: [], ...over }) as PinStateV2;

describe("layer predicates", () => {
  it("flag layer matches on flag only", () => {
    expect(pinMatchesLayer(pin({ flag: "issue" }), layer("issues"))).toBe(true);
    expect(pinMatchesLayer(pin({ flag: "monitor" }), layer("issues"))).toBe(false);
    expect(pinMatchesLayer(pin({ flag: null }), layer("issues"))).toBe(false);
  });

  it("component-type layer matches on type only (freeform never matches a typed layer)", () => {
    expect(pinMatchesLayer(pin({ pinType: { kind: "component", componentType: "gas-shutoff" } }), layer("shutoffs"))).toBe(true);
    expect(pinMatchesLayer(pin({ pinType: { kind: "component", componentType: "water-heater" } }), layer("shutoffs"))).toBe(false);
    expect(pinMatchesLayer(pin({ pinType: { kind: "freeform", label: "mystery" } }), layer("shutoffs"))).toBe(false);
  });

  it("empty predicate is the all view", () => {
    const all: LayerDef = { id: "all", label: "All", predicate: {} };
    expect(pinMatchesLayer(pin({}), all)).toBe(true);
  });

  it("relevantLayers keeps only layers with a match, in config order", () => {
    const pins = [pin({ flag: "issue" }), pin({ pinType: { kind: "component", componentType: "smoke-alarm" } })];
    const ids = relevantLayers(config.layers, pins).map((l) => l.id);
    expect(ids).toContain("issues");
    expect(ids).toContain("alarms");
    expect(ids).not.toContain("shutoffs"); // no shutoff pin present
    // Order matches the config's authored order.
    const configOrder = config.layers.map((l) => l.id).filter((id) => ids.includes(id));
    expect(ids).toEqual(configOrder);
  });
});
