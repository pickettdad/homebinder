/**
 * The floorplan, drawn to scale, with the lengths on it.
 *
 * ⚑ **A scan that reports *five walls* is unfalsifiable.** Nobody in the room can tell a correct five
 * from a wrong five, and neither can the desk until somebody drives back. A plan drawn to scale with
 * each wall's length written on it is checkable in two seconds by the person standing in the room —
 * which is the only moment a wrong answer is cheap.
 *
 * ⛑ **Live, it is also the coverage answer.** *Did I miss a wall* is invisible in a count that goes
 * 4 → 5 and obvious in an outline with a gap in it. Same component during and after: one thing to
 * build, and the during-case is the one that can still be fixed by walking three more steps.
 */
import { bothUnits, planBounds, planSegments, type PlanSegment } from "../native/planGeometry";
import type { ZonePlan } from "../native/zone";

const STROKE: Record<PlanSegment["kind"], string> = {
  wall: "#e2e8f0",
  door: "#f0b429",
  window: "#38bdf8",
  opening: "#94a3b8",
};

export function FloorPlanView({
  plan,
  height = 260,
  labels = true,
}: {
  plan: ZonePlan;
  height?: number;
  /** Off while scanning: a length that is still changing is noise, and the shape is the signal. */
  labels?: boolean;
}) {
  const segments = planSegments(plan);
  const bounds = planBounds(segments);
  if (!bounds) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">
        Nothing scanned yet.
      </p>
    );
  }

  // Metres to pixels, uniform on both axes so the drawing stays square to the room.
  const pad = 12;
  const width = Math.round((bounds.width / bounds.depth) * height) || height;
  const scale = Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.depth);
  const px = (x: number) => pad + (x - bounds.minX) * scale;
  // ⚑ Z grows away from where the scan began; screen y grows downward. Flipping here keeps the
  // drawing the way up the concierge is standing, which is the whole point of showing it to them.
  const py = (z: number) => height - pad - (z - bounds.minZ) * scale;

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-lg bg-slate-950 ring-1 ring-slate-700"
        style={{ maxHeight: height }}
      >
        {segments.map((s, i) => (
          <g key={i}>
            <line
              x1={px(s.x1)}
              y1={py(s.z1)}
              x2={px(s.x2)}
              y2={py(s.z2)}
              stroke={STROKE[s.kind]}
              strokeWidth={s.kind === "wall" ? 3 : 5}
              strokeLinecap="round"
              // Doors and windows sit ON a wall, so they are drawn over it and slightly heavier.
              opacity={s.kind === "wall" ? 1 : 0.9}
            />
            {labels && s.kind === "wall" && s.length >= 0.4 && (
              <text
                x={px((s.x1 + s.x2) / 2)}
                y={py((s.z1 + s.z2) / 2) - 4}
                fill="#cbd5e1"
                fontSize={9}
                textAnchor="middle"
              >
                {bothUnits(s.length).split(" (")[0]}
              </text>
            )}
          </g>
        ))}
      </svg>
      {/* ⚑ A scale bar rather than a claim of accuracy. It says how big the drawing is; it does not
          say the sensor was right, which is what the concierge is being asked to judge. */}
      <p className="text-center text-[10px] text-slate-500">
        {bothUnits(bounds.width)} across · {bothUnits(bounds.depth)} deep
        {" · "}
        <span className="text-slate-400">walls</span>{" "}
        <span className="text-brass-400">doors</span>{" "}
        <span className="text-sky-400">windows</span>{" "}
        <span className="text-slate-500">openings</span>
      </p>
    </div>
  );
}
