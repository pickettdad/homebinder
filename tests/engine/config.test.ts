/**
 * Config validation gate — this file IS `npm run validate:config`, run in CI on every
 * route edit. A config that fails here never reaches a tablet.
 */
import { describe, expect, it } from "vitest";
import { baselineRoute } from "../../src/config/route.baseline";
import { parseRouteConfig, validateRouteConfig } from "../../src/engine/schema/routeConfig";
import { compilePlan, planSlots } from "../../src/engine/plan";
import { canonicalJson, hashConfig } from "../../src/engine/canonical";

describe("baseline route config", () => {
  it("validates against the schema", () => {
    const result = validateRouteConfig(baselineRoute);
    if (!result.ok) throw new Error(`config invalid:\n${result.errors.join("\n")}`);
    expect(result.ok).toBe(true);
  });

  it("is pure serializable data (no functions, no undefined-holes, survives round-trip)", () => {
    const roundTripped = JSON.parse(JSON.stringify(baselineRoute));
    expect(roundTripped).toEqual(baselineRoute);
  });

  it("has a stable content hash", async () => {
    const config = parseRouteConfig(baselineRoute);
    const h1 = await hashConfig(config);
    const h2 = await hashConfig(JSON.parse(canonicalJson(config)));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("compiles under every flag combination without empty zones of required slots", () => {
    const config = parseRouteConfig(baselineRoute);
    const flagIds = config.profileFlags.map((f) => f.id);
    // Exhaustive 2^N sweep — cheap at N=3, catches injection into nonexistent zones.
    for (let mask = 0; mask < 1 << flagIds.length; mask++) {
      const flags = flagIds.filter((_, i) => mask & (1 << i));
      const plan = compilePlan(config, flags, []);
      expect(plan.zones.length).toBe(config.zones.length);
      for (const zone of plan.zones) {
        const hasRooms = config.zones.find((z) => z.id === zone.zoneId)!.rooms.length > 0;
        if (!hasRooms) expect(zone.slots.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every slot instance id unique under a realistic house", () => {
    const config = parseRouteConfig(baselineRoute);
    const rooms = [
      { roomInstanceId: "r1", zoneId: "main-floor", kind: "kitchen", label: "Kitchen" },
      { roomInstanceId: "r2", zoneId: "main-floor", kind: "living", label: "Living room" },
      { roomInstanceId: "r3", zoneId: "upper-floor", kind: "bedroom", label: "Bedroom 1" },
      { roomInstanceId: "r4", zoneId: "upper-floor", kind: "bedroom", label: "Bedroom 2" },
      { roomInstanceId: "r5", zoneId: "upper-floor", kind: "bathroom", label: "Bathroom" },
    ];
    const slots = planSlots(compilePlan(config, ["has-well", "has-septic", "has-wood-heat"], rooms));
    const ids = slots.map((s) => s.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects a conditional block that injects into an unknown zone", () => {
    const broken = JSON.parse(JSON.stringify(baselineRoute));
    broken.conditionalBlocks[0].inject[0].zoneId = "no-such-zone";
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("no-such-zone");
  });

  it("rejects a reCheckOf pointing at a missing slot", () => {
    const broken = JSON.parse(JSON.stringify(broken2()));
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects circular template inheritance (would stack-overflow the plan compiler)", () => {
    const broken = JSON.parse(JSON.stringify(baselineRoute));
    // bedroom extends room-routine; point room-routine back at bedroom -> cycle
    broken.templates.find((t: { id: string }) => t.id === "room-routine").extends = "bedroom";
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("circular");
  });

  it("rejects duplicate template ids", () => {
    const broken = JSON.parse(JSON.stringify(baselineRoute));
    broken.templates.push(JSON.parse(JSON.stringify(broken.templates[0])));
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("duplicate template");
  });

  it("rejects a template that extends itself", () => {
    const broken = JSON.parse(JSON.stringify(baselineRoute));
    broken.templates.find((t: { id: string }) => t.id === "room-routine").extends = "room-routine";
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate slot ids", () => {
    const broken = JSON.parse(JSON.stringify(baselineRoute));
    broken.zones[1].slots[1].id = broken.zones[1].slots[0].id;
    const result = validateRouteConfig(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("duplicate");
  });
});

function broken2() {
  const b = JSON.parse(JSON.stringify(baselineRoute));
  const finalChecks = b.zones.find((z: { id: string }) => z.id === "final-checks");
  finalChecks.slots[0].reCheckOf = "bsmt.does-not-exist";
  return b;
}
