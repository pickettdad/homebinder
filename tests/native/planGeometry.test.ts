/**
 * The arithmetic that turns RoomPlan's transforms into a drawing somebody can disagree with.
 *
 * ⚑ Asserted here is the INVARIANT — *a segment's endpoints are its centre plus and minus half its
 * width along its own axis* — rather than the pixel coordinates of one worked example. A test that
 * pins coordinates breaks when the drawing changes; this one holds whatever the drawing does.
 */
import { describe, expect, it } from "vitest";
import { bothUnits, feetInches, planBounds, planSegments, segmentOf } from "../../src/native/planGeometry";
import type { ZoneSurface } from "../../src/native/zone";

/** Column-major 4×4: index = column * 4 + row. Identity, then translated. */
const surface = (width: number, x: number, z: number, yawX = 1, yawZ = 0): ZoneSurface => {
  const m = Array.from({ length: 16 }, () => 0);
  m[0] = yawX; m[2] = yawZ;   // the surface's own X axis, which runs ALONG it
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  m[12] = x; m[14] = z;       // translation
  return { id: "s", width, height: 2.4, x, y: 0, z, confidence: "high", transform: m };
};

describe("segmentOf", () => {
  it("puts the ends half a width either side of the centre, along the surface's own axis", () => {
    const s = segmentOf(surface(4, 10, 5), "wall")!;
    expect(s.x1).toBeCloseTo(8);
    expect(s.x2).toBeCloseTo(12);
    expect(s.z1).toBeCloseTo(5);
    expect(s.z2).toBeCloseTo(5);
    // The invariant, stated rather than the numbers: the span equals the width, always.
    expect(Math.hypot(s.x2 - s.x1, s.z2 - s.z1)).toBeCloseTo(s.length);
  });

  it("respects the axis, so a wall turned ninety degrees runs the other way", () => {
    /* ⛑ This is the failure worth a test: reading the transform column-major backwards rotates
       every wall by ninety degrees and produces a plausible floorplan OF A DIFFERENT ROOM. */
    const s = segmentOf(surface(4, 0, 0, 0, 1), "wall")!;
    expect(s.x1).toBeCloseTo(0);
    expect(s.x2).toBeCloseTo(0);
    expect(s.z1).toBeCloseTo(-2);
    expect(s.z2).toBeCloseTo(2);
    expect(Math.hypot(s.x2 - s.x1, s.z2 - s.z1)).toBeCloseTo(4);
  });

  it("refuses a surface whose transform is not a 4x4, rather than drawing it at the origin", () => {
    const broken = { ...surface(4, 1, 1), transform: [1, 2, 3] };
    expect(segmentOf(broken, "wall")).toBeNull();
  });
});

describe("planSegments", () => {
  it("keeps every kind and labels each, because a door is not a wall on a drawing", () => {
    const plan = {
      captured: true,
      walls: [surface(4, 0, 0), surface(3, 0, 2)],
      doors: [surface(0.8, 1, 0)],
      windows: [surface(1.2, 2, 0)],
      openings: [surface(1, 3, 0)],
    };
    const segs = planSegments(plan);
    expect(segs).toHaveLength(5);
    for (const kind of ["wall", "door", "window", "opening"] as const) {
      expect(segs.some((s) => s.kind === kind)).toBe(true);
    }
  });

  it("survives a plan with nothing in it", () => {
    expect(planSegments({ captured: false })).toEqual([]);
  });
});

describe("planBounds", () => {
  it("returns null for nothing, rather than a dot in the corner that looks like a scan", () => {
    expect(planBounds([])).toBeNull();
  });

  it("contains every endpoint it was given", () => {
    const segs = planSegments({ captured: true, walls: [surface(4, 0, 0), surface(4, 0, 3, 0, 1)] });
    const b = planBounds(segs, 0)!;
    for (const s of segs) {
      for (const [x, z] of [[s.x1, s.z1], [s.x2, s.z2]] as const) {
        expect(x).toBeGreaterThanOrEqual(b.minX);
        expect(x).toBeLessThanOrEqual(b.maxX);
        expect(z).toBeGreaterThanOrEqual(b.minZ);
        expect(z).toBeLessThanOrEqual(b.maxZ);
      }
    }
  });
});

describe("units", () => {
  it("reads as a tradesperson writes a quote, and never finer than the sensor can support", () => {
    expect(feetInches(3.6576)).toBe("12'0\"");
    expect(feetInches(0.9144)).toBe("3'0\"");
    // ⛑ Rounded to the inch on purpose: indoor drift is around a metre over a walk, so a sixteenth
    // would be a claim the device cannot support — the rule that rejects "2,438 mm".
    expect(feetInches(3.6600)).toBe("12'0\"");
    expect(bothUnits(3.6576)).toContain("3.66 m");
  });

  it("rolls twelve inches into a foot rather than printing 11'12\"", () => {
    expect(feetInches(3.6449)).toBe("11'11\"");
    expect(feetInches(3.6483)).toBe("12'0\"");
  });
});
