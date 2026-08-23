/**
 * The zone session's rules.
 *
 * ⚑ Asserted here is the INVARIANT — *a position is measured or absent, never inferred* — and not
 * the inventory of today's refusal reasons. A test that enumerates the reasons fires on every
 * legitimate addition; a test that states the rule holds at three reasons and at thirty.
 */
import { describe, expect, it } from "vitest";
import {
  ZONE_MODES,
  anchorAvailability,
  containerAnchorState,
  meshRecommendation,
  zoneMeasures,
  type ZonePosition,
} from "../../src/native/zone";

const at = (x: number): ZonePosition => ({
  positioned: true,
  zoneId: "z",
  tracking: "normal",
  mode: "positioning",
  at: "2026-08-20T00:00:00Z",
  x,
  y: 0,
  z: 0,
  transform: Array.from({ length: 16 }, () => 0),
});

const refused = (why: string): ZonePosition => ({ positioned: false, why });

describe("anchorAvailability", () => {
  it("refuses whenever a position could not be measured, for every reason it can have", () => {
    /* ⚑ The invariant. Each of these is a state in which no pose exists, and none of them may
       return `canAnchor` — because the failure is silent downstream: a container with no anchor
       arrives absent, and an absence looks exactly like a container nobody positioned on purpose. */
    const cannot = [
      { open: false, paused: false },
      { open: false, paused: true },
      { open: true, paused: true },
      { open: true, paused: false, tracking: "limited(initializing)" },
      { open: true, paused: false, tracking: "limited(relocalizing)" },
      { open: true, paused: false, tracking: "notAvailable" },
    ];
    for (const state of cannot) {
      const out = anchorAvailability(state);
      expect(out.canAnchor).toBe(false);
      // A refusal a concierge cannot act on is a refusal that gets ignored.
      expect(out.why).toBeTruthy();
      expect(out.fix).toBeTruthy();
    }
  });

  it("allows only an open, running session with settled tracking", () => {
    expect(anchorAvailability({ open: true, paused: false, tracking: "normal" }).canAnchor).toBe(true);
    expect(anchorAvailability({ open: true, paused: false }).canAnchor).toBe(true);
  });
});

describe("containerAnchorState", () => {
  it("one measured frame anchors the container and the rest inherit", () => {
    const out = containerAnchorState([
      { position: refused("paused") },
      { position: at(1) },
      {},
      { position: refused("tracking limited(initializing)") },
    ]);
    expect(out.anchored).toBe(true);
    expect(out.anchorIndex).toBe(1);
    expect(out.inheriting).toBe(3);
  });

  it("a container of refusals is NOT anchored, however many frames it has", () => {
    // ⚑ The case the wall exists for: ten good photographs and no position is a container the desk
    // cannot place, and it looks identical to a complete one in a filmstrip.
    const frames = Array.from({ length: 10 }, () => ({ position: refused("paused") }));
    const out = containerAnchorState(frames);
    expect(out.anchored).toBe(false);
    expect(out.anchorIndex).toBeNull();
    expect(out.inheriting).toBe(10);
  });

  it("an empty container is not anchored", () => {
    expect(containerAnchorState([]).anchored).toBe(false);
  });
});

describe("meshRecommendation", () => {
  it("recommends on what gets measured later, not only on what the room is called", () => {
    // Density earns it whatever the room is called…
    expect(meshRecommendation({ kind: "garage", containers: 6 }).recommend).toBe(true);
    // …and the equipment rooms earn it even when only one thing has been captured so far,
    // because the recommendation is offered before the zone is finished.
    expect(meshRecommendation({ kind: "Mechanical Room", containers: 1 }).recommend).toBe(true);
    expect(meshRecommendation({ kind: "Laundry", containers: 0 }).recommend).toBe(true);
  });

  it("recommends where the floorplan structurally cannot see the room's own surfaces", () => {
    /* ⛑ A kitchen's half-wall peninsula is absent from RoomPlan's output entirely — it models
       full-height walls, and the thing that closes the room stops at counter height. The mesh sees
       it because geometry needs no category. */
    expect(meshRecommendation({ kind: "kitchen", containers: 0 }).recommend).toBe(true);
    expect(meshRecommendation({ kind: "Main Bath", containers: 1 }).recommend).toBe(true);
  });

  it("does not recommend where nothing will be asked of the geometry", () => {
    expect(meshRecommendation({ kind: "Bedroom 2", containers: 1 }).recommend).toBe(false);
  });

  it("always says why, because a recommendation the concierge cannot weigh is an instruction", () => {
    for (const zone of [
      { kind: "mechanical", containers: 0 },
      { kind: "bedroom", containers: 1 },
      { kind: "garage", containers: 9 },
    ]) {
      expect(meshRecommendation(zone).because).toBeTruthy();
    }
  });
});

describe("ZONE_MODES", () => {
  it("carries the three bounded jobs and nothing that runs across a visit", () => {
    expect([...ZONE_MODES].sort()).toEqual(["mesh", "positioning", "roomplan"]);
  });
});

describe("zoneMeasures", () => {
  const surface = (width: number, height: number) => ({
    id: "s",
    width,
    height,
    x: 0,
    y: 0,
    z: 0,
    confidence: "high",
    transform: Array.from({ length: 16 }, () => 0),
  });

  const plan = {
    captured: true,
    walls: [surface(4, 2.4), surface(3, 2.4), surface(4, 2.4), surface(3, 2.4)],
    doors: [surface(0.8, 2.0)],
    windows: [surface(1.2, 1.4), surface(1.2, 1.4)],
    openings: [surface(1.0, 2.1)],
  };

  it("takes door openings out of the baseboard, because trim does not cross a doorway", () => {
    const m = zoneMeasures(plan);
    expect(m.perimeter).toBeCloseTo(14);
    // ⚑ The invariant: baseboard is strictly less than perimeter whenever a door exists, and is
    // exactly perimeter when none does. Quoting perimeter as baseboard over-counts by a door.
    expect(m.baseboard).toBeCloseTo(13.2);
    expect(zoneMeasures({ ...plan, doors: [] }).baseboard).toBeCloseTo(14);
  });

  it("nets the openings out of wall area, and never returns a negative", () => {
    const m = zoneMeasures(plan);
    expect(m.wallAreaGross).toBeCloseTo(33.6);
    expect(m.wallAreaNet!).toBeLessThan(m.wallAreaGross!);
    // A room whose openings exceed its walls is nonsense arithmetic, not a negative quantity.
    const silly = zoneMeasures({ ...plan, walls: [surface(1, 1)] });
    expect(silly.wallAreaNet).toBe(0);
  });

  it("counts and sizes the glazing, because a window count without sizes cannot be priced", () => {
    const m = zoneMeasures(plan);
    expect(m.windows.count).toBe(2);
    expect(m.windows.totalGlazing).toBeCloseTo(3.36);
    expect(m.windows.sizes).toHaveLength(2);
  });

  it("reports what the plan CANNOT give as null rather than omitting it", () => {
    /* ⛑ The distinction the whole type exists for: an absent key reads as *nobody computed this*,
       and null reads as *the plan does not carry it*. Flooring type and registers are not in
       RoomPlan's output at all, and floor area is left null rather than approximated — a rectangle
       assumption is wrong in every L-shaped room. */
    const m = zoneMeasures(plan);
    for (const key of ["flooringType", "registers", "floorArea"] as const) {
      expect(key in m).toBe(true);
      expect(m[key]).toBeNull();
    }
  });

  it("returns nulls rather than zeroes for a plan that captured nothing", () => {
    const m = zoneMeasures({ captured: false });
    expect(m.perimeter).toBeNull();
    expect(m.ceilingHeight).toBeNull();
    expect(m.windows.count).toBe(0);
  });
});
