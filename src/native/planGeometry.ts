/**
 * A floorplan as something a person can look at and disagree with.
 *
 * ⚑ **The point is confirmability, not prettiness.** A scan that reports *five walls* is unfalsifiable
 * — the concierge cannot tell a correct five from a wrong five, and neither can the desk until
 * somebody visits the house again. A plan drawn to scale with each wall's length on it can be
 * checked against the room the concierge is standing in, in about two seconds.
 *
 * ⛑ **And drawn LIVE it is the coverage answer too.** *Did I miss a wall* is invisible in a count
 * that goes 4 → 5, and obvious in an outline with a gap in it. Same drawing, during and after: one
 * thing to build, and the during-case is the one that can still be fixed.
 *
 * All pure. RoomPlan hands back a 4×4 for each surface; everything here is arithmetic on those, so
 * it is testable without a device and cannot drift from what the screen shows.
 */
import type { ZonePlan, ZoneSurface } from "./zone";

/** A wall, door, window or opening as it lies on the floor, in metres. */
export interface PlanSegment {
  kind: "wall" | "door" | "window" | "opening";
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  /** Along-floor run. The same number RoomPlan calls the surface's width. */
  length: number;
  /** Floor to head. Kept because a 0.9 m opening and a 2.1 m one are different things. */
  height: number;
  confidence: string;
}

/**
 * Where a surface sits on the floor.
 *
 * ⚑ **A surface's local X axis runs along it**, so its two ends are the centre plus and minus half
 * its width along that axis. The transform arrives column-major — `index = column * 4 + row` — and
 * getting that backwards silently rotates every wall by ninety degrees, which looks like a plausible
 * floorplan of a different room. That is why it is written down here rather than inferred at the
 * call site.
 */
export function segmentOf(surface: ZoneSurface, kind: PlanSegment["kind"]): PlanSegment | null {
  const m = surface.transform;
  if (!Array.isArray(m) || m.length < 16) return null;
  const ax = m[0] ?? 0;
  const az = m[2] ?? 0;
  const px = m[12] ?? 0;
  const pz = m[14] ?? 0;
  const half = surface.width / 2;
  return {
    kind,
    x1: px - ax * half,
    z1: pz - az * half,
    x2: px + ax * half,
    z2: pz + az * half,
    length: surface.width,
    height: surface.height,
    confidence: surface.confidence,
  };
}

export function planSegments(plan: ZonePlan): PlanSegment[] {
  const of = (list: ZoneSurface[] | undefined, kind: PlanSegment["kind"]) =>
    (list ?? []).map((s) => segmentOf(s, kind)).filter((s): s is PlanSegment => s !== null);
  return [
    ...of(plan.walls, "wall"),
    ...of(plan.doors, "door"),
    ...of(plan.windows, "window"),
    ...of(plan.openings, "opening"),
  ];
}

export interface PlanBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
}

/** ⚑ Null rather than a zero-sized box when there is nothing to bound — a plan of nothing drawn as
 *  a dot in the corner is a drawing that says a scan happened. */
export function planBounds(segments: PlanSegment[], pad = 0.3): PlanBounds | null {
  if (!segments.length) return null;
  const xs = segments.flatMap((s) => [s.x1, s.x2]);
  const zs = segments.flatMap((s) => [s.z1, s.z2]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad;
  const maxZ = Math.max(...zs) + pad;
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

/**
 * Metres as a tradesperson reads them.
 *
 * ⚑ **Feet and inches lead because that is what a quote is written in here**, and the metric value
 * rides alongside because that is what the sensor measured. ⛑ Rounded to the inch and no further:
 * indoor tracking drifts around a metre over a walk, so a sixteenth would be a claim the device
 * cannot support — the same rule that keeps *2.3 m from the panel* and rejects *2,438 mm*.
 */
export function feetInches(metres: number): string {
  const totalInches = Math.round(metres * 39.3700787);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

export function bothUnits(metres: number): string {
  return `${feetInches(metres)} (${metres.toFixed(2)} m)`;
}
