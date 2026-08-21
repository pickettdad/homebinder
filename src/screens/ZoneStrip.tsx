/**
 * The positioning session's state, where the concierge is already looking.
 *
 * ⛑ **This had an *Enter zone* button and that was a design error, corrected 2026-08-20.** The zone
 * is entered on the zone screen by tapping its chip; the viewfinder header already says which room
 * it is. A second entry gesture asked the concierge to declare something the app already knew —
 * ⚑ **and it put a second meaning on a word this product had already spent.** *Zone* meant *the room
 * captures file into*; this made it also mean *a tracking session*, so "enter the zone" inside a
 * zone reads as a zone inside a zone. Two things sharing one word is the collision that retired
 * *pan* and renamed the Text mode, arriving a third time.
 *
 * ⚑ **So there is nothing to press.** The session opens with the viewfinder and closes with it. What
 * remains is the one thing a concierge cannot see for themselves and must know **before** the
 * shutter: whether a position can be taken right now. Afterwards it is a fact about a photograph
 * nobody can retake.
 */
import { anchorAvailability, type ZoneMode } from "../native/zone";

export function ZoneStrip({
  open,
  mode,
  paused,
  tracking,
  scanning,
  meshing,
  onFinishScan,
  onFinishMesh,
  onTogglePause,
  onRetry,
  failure,
  note,
}: {
  open: boolean;
  mode: ZoneMode;
  paused: boolean;
  tracking?: string;
  scanning: boolean;
  meshing: boolean;
  onFinishScan: () => void;
  onFinishMesh: () => void;
  onTogglePause: () => void;
  onRetry: () => void;
  /** ⚑ The session DIED. Distinct from "cannot position right now" — one is a state the concierge
   *  can walk out of, the other is a corpse that everything after it inherits. */
  failure: string | null;
  note: string | null;
}) {
  if (!open) return null;
  const anchor = anchorAvailability({ open, paused, tracking });

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 flex flex-col items-center gap-1 px-3 text-xs">
      {/*
        ⚑ Only speaks when there is something to say. A line reading *position ready* on every frame
        is the alarm-on-the-majority-case failure: it would be ignored by the time it mattered, and
        the case that matters is twenty containers filed with no position at all.
      */}
      {/*
        ⛑ **A dead session says so, and offers the way out** (field report 2026-08-21).

        Before this it fell through silently: positioning became a plain viewfinder, every mode
        entered afterwards inherited the corpse, and only an app restart cleared it. ⚑ **That is a
        silent fallback to no-position capture — the exact thing the shutter's refusal exists to
        prevent, one layer above it.** `sensorFailed` is transient often enough that a retry is a
        real answer, so the retry is offered here rather than requiring a relaunch.
      */}
      {failure && (
        <button
          type="button"
          onClick={onRetry}
          className="pointer-events-auto rounded-full bg-rose-900/90 px-4 py-1.5 text-rose-100 ring-1 ring-rose-400"
        >
          positioning stopped — tap to restart it
        </button>
      )}
      {!failure && !anchor.canAnchor && (
        <span className="pointer-events-auto rounded-full bg-rose-900/80 px-3 py-1 text-rose-100 ring-1 ring-rose-500">
          no position — {anchor.fix}
        </span>
      )}
      {scanning && (
        <button
          type="button"
          onClick={onFinishScan}
          className="pointer-events-auto rounded-full bg-brass-500 px-4 py-1.5 font-medium text-slate-950"
        >
          Finish floorplan
        </button>
      )}
      {meshing && (
        <button
          type="button"
          onClick={onFinishMesh}
          className="pointer-events-auto rounded-full bg-brass-500 px-4 py-1.5 font-medium text-slate-950"
        >
          Finish mesh
        </button>
      )}
      {/* Pause is offered only when there is a session worth pausing and no action running — the
          duty cycle is between containers, not in the middle of a scan. */}
      {!scanning && !meshing && (
        <button
          type="button"
          onClick={onTogglePause}
          className="pointer-events-auto rounded-full bg-slate-900/80 px-3 py-1 text-slate-300 ring-1 ring-slate-600"
        >
          {paused ? "resume positioning" : "pause positioning"}
        </button>
      )}
      {note && <span className="pointer-events-auto text-slate-300">{note}</span>}
      {mode !== "positioning" && !scanning && !meshing && (
        <span className="text-slate-500">{mode}</span>
      )}
    </div>
  );
}
