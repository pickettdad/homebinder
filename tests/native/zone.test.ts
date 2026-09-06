/**
 * The zone session's rules.
 *
 * ⚑ Asserted here is the INVARIANT — *a position is measured or absent, never inferred* — and not
 * the inventory of today's refusal reasons. A test that enumerates the reasons fires on every
 * legitimate addition; a test that states the rule holds at three reasons and at thirty.
 */
import { describe, expect, it } from "vitest";
import {
  zoneGaps,
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

  it("does NOT recommend on room type — a fitted room earns a mesh by what is missing, not by name", () => {
    /* ⛑ Withdrawn by owner ruling 2026-08-23. A kitchen's missing peninsula is a reason to mesh
       ONE FEATURE for twenty seconds, not a whole room for two minutes — and the trigger for that
       is the concierge comparing the drawn plan to the room, which needs no rule here. */
    expect(meshRecommendation({ kind: "kitchen", containers: 1 }).recommend).toBe(false);
    expect(meshRecommendation({ kind: "Main Bath", containers: 1 }).recommend).toBe(false);
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

/**
 * ⛑ **The full bath left the house with 34 photographs and nothing to place them on.**
 *
 * Its floorplan was lost to a sensor failure mid-stop and the room looked finished from inside the
 * app; nobody knew until the desk opened the file two days later. ⚑ *A gap found at the desk costs
 * a second visit; the same gap named in the room costs a minute.*
 *
 * The invariant under test is **not** the list of things that can be missing — that list will grow.
 * It is that **a zone somebody photographed reports what it cannot deliver, and a zone nobody
 * touched reports nothing**, because a warning that fires on every unstarted room is one nobody
 * reads by the third room.
 */
describe("what a zone is missing, said while the concierge is still in it", () => {
  const anchored = { number: 1, frames: [{ position: { positioned: true } as never }] };
  const floating = (number: number) => ({ number, frames: [{ position: undefined }, { position: undefined }] });

  it("says nothing about a room nobody has started", () => {
    // Unstarted is not incomplete. This is the case that decides whether the banner is readable.
    expect(zoneGaps({ photos: 0, hasFloorplan: false, containers: [] }).complete).toBe(true);
  });

  it("says nothing about a room that delivered both", () => {
    expect(zoneGaps({ photos: 12, hasFloorplan: true, containers: [anchored] }).complete).toBe(true);
  });

  it("names a missing floorplan — the full bath's actual failure", () => {
    const g = zoneGaps({ photos: 34, hasFloorplan: false, containers: [anchored] });
    expect(g.complete).toBe(false);
    expect(g.missing.join(" ")).toMatch(/floorplan/);
  });

  /**
   * ⛑ **Named, not counted** (field 2026-09-05: *"it says 3 objects the desk cannot place, but then
   * doesn't really say what they are or what to do"*).
   *
   * ⚑ A number is a verdict; a list is an instruction. **The concierge is standing in the room and
   * can fix an object they can identify — they cannot fix a count.**
   */
  it("names the objects the desk cannot place, and only those", () => {
    const g = zoneGaps({ photos: 34, hasFloorplan: true, containers: [anchored, floating(4), floating(7)] });
    expect(g.missing.join(" ")).toContain("#4");
    expect(g.missing.join(" ")).toContain("#7");
    // The anchored one is fine and must not be named — a warning listing working objects is one
    // nobody reads by the third room.
    expect(g.missing.join(" ")).not.toContain("#1");
  });

  it("says what to do about it, not only that it is wrong", () => {
    const g = zoneGaps({ photos: 4, hasFloorplan: false, containers: [floating(2)] });
    expect(g.missing.join(" ")).toMatch(/scan the room/);
    expect(g.missing.join(" ")).toMatch(/take one more photo/);
  });

  /**
   * ⛑ **Geometry accumulates for free and is kept only on request** — so the room that never asked
   * is indistinguishable from the room that had nothing to keep.
   *
   * ⚑ Since positioning runs reconstruction continuously, `harvestMesh` reads everything the zone
   * built, and it runs at one moment only: Finish mesh. **The button is not "start scanning", it is
   * the only "keep it".** A zone left without it discards a deliverable that already existed.
   */
  it("says when a room's geometry was never kept, and only for a room somebody worked in", () => {
    const worked = { photos: 12, hasFloorplan: true, containers: [anchored] };
    expect(zoneGaps({ ...worked, meshFiled: false }).missing.join(" ")).toMatch(/Finish mesh/);
    expect(zoneGaps({ ...worked, meshFiled: true }).complete).toBe(true);
    // ⛑ Absent is not false. A caller that cannot answer the question must not trip the warning —
    // that is how a diagnostic starts firing on every room and stops being read.
    expect(zoneGaps(worked).complete).toBe(true);
    // And never on a room nobody has started, whatever the mesh says.
    expect(zoneGaps({ photos: 0, hasFloorplan: false, containers: [], meshFiled: false }).complete).toBe(true);
  });

  it("names both when both are missing, and does not stop at the first", () => {
    const g = zoneGaps({ photos: 4, hasFloorplan: false, containers: [floating(3)] });
    expect(g.missing).toHaveLength(2);
  });
});
