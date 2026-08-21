/**
 * The zone session, where the concierge is already looking.
 *
 * ⚑ **Can I anchor this container is a question that has to be answerable BEFORE the shutter.**
 * Afterwards it is a fact about a photograph nobody can retake, and a container that came out
 * unpositioned looks exactly like one nobody meant to position. So the state is in the frame, not in
 * a menu — the same rule the mode colour and the container marker already follow.
 *
 * Three bounded modes, and the strip says which one is running, whether it is paused, and whether a
 * position can be taken right now. Nothing here holds a session across the visit.
 */
import { useEffect, useState } from "react";
import {
  closeZone,
  onZone,
  openZone,
  pauseZone,
  resumeZone,
  setZoneMode,
  startRoomPlan,
  stopRoomPlan,
} from "../native/hsCamera";
import { anchorAvailability, meshRecommendation, type ZoneMode, type ZonePlan } from "../native/zone";

export function ZoneStrip({
  zoneId,
  zoneKind,
  containers,
  onPlan,
}: {
  zoneId: string;
  zoneKind?: string;
  containers: number;
  onPlan?: (plan: ZonePlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ZoneMode>("positioning");
  const [paused, setPaused] = useState(false);
  const [tracking, setTracking] = useState<string | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [meshOffered, setMeshOffered] = useState(false);

  useEffect(() => {
    const off = onZone((e) => {
      if (typeof e.tracking === "string") setTracking(e.tracking);
      if (typeof e.zoneError === "string") setNote(String(e.zoneError));
      if (typeof e.zoneMapSaved === "number") setNote(`space saved ×${e.zoneMapSaved}`);
    });
    return off;
  }, []);

  const enter = async () => {
    try {
      const out = await openZone(zoneId);
      setOpen(true);
      setMode(out.mode);
      setPaused(false);
      if (!out.roomPlanSupported) setNote("No floorplan on this device");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Zone refused to open");
    }
  };

  const leave = async () => {
    await closeZone().catch(() => {});
    setOpen(false);
    setPaused(false);
    setTracking(undefined);
  };

  const plan = async () => {
    if (scanning) {
      setScanning(false);
      const out = await stopRoomPlan().catch(() => ({ captured: false, why: "failed" }) as ZonePlan);
      setMode("positioning");
      onPlan?.(out);
      setNote(
        out.captured
          ? `plan · ${out.walls?.length ?? 0} walls · ${out.doors?.length ?? 0} doors · ${out.windows?.length ?? 0} windows`
          : (out.why ?? "no plan"),
      );
      // ⚑ The mesh question is asked HERE and not at zone entry, because the concierge has now seen
      // the room and the app has now seen a count. The app recommends; they decide.
      setMeshOffered(true);
      return;
    }
    const started = await startRoomPlan().catch(() => ({ started: false, why: "failed" }));
    if (started.started) {
      setScanning(true);
      setMode("roomplan");
    } else setNote(started.why ?? "floorplan refused");
  };

  const toMesh = async () => {
    setMeshOffered(false);
    const out = await setZoneMode("mesh").catch(() => null);
    if (out) {
      setMode("mesh");
      if (out.unmet.length) setNote(`unmet ${out.unmet.join(", ")}`);
    }
  };

  const togglePause = async () => {
    const out = paused ? await resumeZone() : await pauseZone();
    setPaused(out.paused);
  };

  const anchor = anchorAvailability({ open, paused, tracking });
  const rec = meshRecommendation({ kind: zoneKind, containers });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void enter()}
        className="rounded-lg bg-slate-900/70 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-600"
      >
        Enter zone
      </button>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      <p className="text-slate-300">
        zone · <span className="font-mono text-slate-100">{mode}</span>
        {paused && <span className="text-brass-400"> · paused</span>}
        {tracking && tracking !== "normal" && <span className="text-amber-400"> · {tracking}</span>}
        {/* ⚑ The answer to *can I anchor this* stated plainly, with the fix beside it. A refusal a
            concierge cannot act on is a refusal that gets ignored. */}
        {!anchor.canAnchor && (
          <span className="text-rose-400"> · cannot position — {anchor.fix}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void plan()} className="rounded bg-slate-800 px-2 py-1 text-slate-200">
          {scanning ? "Finish floorplan" : "Floorplan"}
        </button>
        <button type="button" onClick={() => void togglePause()} className="rounded bg-slate-800 px-2 py-1 text-slate-200">
          {paused ? "Resume" : "Pause"}
        </button>
        {mode === "mesh" ? (
          <button
            type="button"
            onClick={() => void setZoneMode("positioning").then(() => setMode("positioning"))}
            className="rounded bg-slate-800 px-2 py-1 text-slate-200"
          >
            Finish mesh
          </button>
        ) : (
          <button type="button" onClick={() => void toMesh()} className="rounded bg-slate-800 px-2 py-1 text-slate-200">
            Mesh
          </button>
        )}
        <button type="button" onClick={() => void leave()} className="rounded bg-slate-800 px-2 py-1 text-slate-400">
          Leave zone
        </button>
      </div>
      {/* The recommendation, offered once the room has been seen and never as an instruction. */}
      {meshOffered && rec.recommend && (
        <p className="text-brass-400">Mesh this zone? {rec.because}</p>
      )}
      {note && <p className="text-slate-400">{note}</p>}
    </div>
  );
}
