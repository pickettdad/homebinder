/**
 * The device bench's rules — the half that must not live inside a component.
 *
 * ⚑ **Every rule here exists so the bench can come back negative.** Thermal state is a four-value
 * enum and battery moves in whole percents, so a fixed-length run reports *nominal, −3%* for every
 * mode and concludes all of them are survivable. That is a verdict formed with nothing present that
 * could refute it — the failure that has cost this project eight measures, arriving inside the test
 * built to check the architecture. So the bench has three ways to say *this run tells you nothing*
 * before it is ever allowed to say *this mode is fine*.
 */

export type BenchMode = "control" | "mesh" | "lowPower";

export interface BenchSample {
  /** Seconds since the run started. */
  t: number;
  /** 0–1, or -1 when the device declines to report. */
  battery: number;
  batteryState: "charging" | "full" | "unplugged" | "unknown";
  thermal: "nominal" | "fair" | "serious" | "critical" | "unknown";
  /** ⚑ Proof of work. A dead session is thermally superb; this is what stalls when one dies. */
  frames: number;
  meshAnchors: number;
  meshFaces: number;
  /** The load has stopped and only the sampling continues — the recovery half of the question. */
  cooling: boolean;
  tracking?: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface BenchRun {
  mode: BenchMode;
  startedAt: string;
  endedAt: string;
  conditions: Record<string, unknown>;
  startThermal: string;
  screenBrightness: number;
  capSeconds: number;
  coolSeconds: number;
  sampleSeconds: number;
  samples: BenchSample[];
  /** ⚑ WHICH of the two ended it. Without this, *held nominal* and *ran out of time* read alike. */
  endedBecause: "thermal" | "cap" | "stopped" | "running";
  /** Seconds to the first thermal transition, or -1 if it never came. */
  secondsToFirstTransition: number;
  loopClosure?: {
    closed: boolean;
    driftMetres?: number;
    t?: number;
    tracking?: string;
  };
}

/**
 * Did the session actually work for the whole run?
 *
 * ⚑ **A run that silently failed at minute three reads as the best result of the day.** The frame
 * counter is the cheapest thing that would visibly stop, so a stretch of samples where it does not
 * advance is a stalled run — and a stalled run is not a cool one, it is no run at all.
 *
 * Only the loaded part is checked. During cool-down the load is deliberately stopped and the frame
 * counter is *supposed* to freeze; treating that as a stall would reject every complete run.
 */
export function benchStalled(samples: BenchSample[]): boolean {
  const loaded = samples.filter((s) => !s.cooling);
  if (loaded.length < 2) return false;
  for (let i = 1; i < loaded.length; i += 1) {
    if (loaded[i]!.frames <= loaded[i - 1]!.frames) return true;
  }
  return false;
}

/**
 * Is the sampler telling the truth?
 *
 * ⚑ **The blank-input test, applied to the instrument rather than the measure.** Run the bench for
 * two minutes on charge: if it reports drain while charging, it is lying, and every other number it
 * produced is worthless. Thirty seconds of work, and it is the reason anyone should believe the
 * three runs that cost an afternoon.
 *
 * Deliberately not "battery went down" — a device can discharge while plugged into a weak supply.
 * The claim is narrower and cannot be argued with: **the state said charging and the level fell.**
 */
export function samplerLying(samples: BenchSample[]): boolean {
  const charging = samples.filter((s) => s.batteryState === "charging" || s.batteryState === "full");
  if (charging.length < 2) return false;
  const first = charging[0];
  const last = charging[charging.length - 1];
  if (!first || !last) return false;
  if (first.battery < 0 || last.battery < 0) return false;
  // One percent of slack: the level is quantised and a boundary sample can round the wrong way.
  return last.battery < first.battery - 0.01;
}

/**
 * Battery as a slope, reported with the number of samples behind it — never as a headline.
 *
 * ⚑ **Twenty minutes at roughly 10%/hour is about three one-percent steps.** A figure derived from
 * three steps is quoted as though it were derived from thirty unless the count travels with it, so
 * the count is not optional here and the caller cannot get the rate without it.
 */
export function batterySlope(samples: BenchSample[]): {
  percentPerHour: number | null;
  steps: number;
  spanSeconds: number;
} {
  const real = samples.filter((s) => !s.cooling && s.battery >= 0);
  const first = real[0];
  const last = real[real.length - 1];
  if (!first || !last || real.length < 2) return { percentPerHour: null, steps: 0, spanSeconds: 0 };
  const span = last.t - first.t;
  if (span <= 0) return { percentPerHour: null, steps: 0, spanSeconds: 0 };
  // How many times the reported level actually MOVED — the resolution the figure really has.
  let steps = 0;
  for (let i = 1; i < real.length; i += 1) {
    if (real[i]!.battery !== real[i - 1]!.battery) steps += 1;
  }
  return {
    percentPerHour: ((first.battery - last.battery) * 100 * 3600) / span,
    steps,
    spanSeconds: span,
  };
}

export type BenchVerdict =
  | "no-run"
  | "stalled"
  | "sampler-lying"
  | "transitioned"
  | "held"
  | "cut-short";

/**
 * What this run is allowed to claim.
 *
 * ⚑ **The three refusals come first and they are the point.** A stalled session, a lying sampler and
 * a run the operator stopped early are all *this tells you nothing*, and none of them may be
 * reported as a mode that stayed cool. Only after all three are ruled out does the run get to say
 * whether the state moved.
 *
 * `held` is the one to read carefully: it means the device stayed put **for the whole cap**, so it
 * is a claim about a duration and is worthless without one. `transitioned` carries its own number.
 */
export function benchVerdict(run: Pick<BenchRun, "samples" | "endedBecause" | "secondsToFirstTransition">): BenchVerdict {
  if (run.samples.length < 2) return "no-run";
  if (samplerLying(run.samples)) return "sampler-lying";
  if (benchStalled(run.samples)) return "stalled";
  if (run.endedBecause === "thermal" && run.secondsToFirstTransition >= 0) return "transitioned";
  if (run.endedBecause === "cap") return "held";
  // Stopped by hand, or still going. Either way it is not evidence about a duration.
  return "cut-short";
}

/**
 * ⚑ The order the runs are taken in, and it is not arbitrary.
 *
 * **The control goes first so a broken harness costs twenty minutes rather than three hours** — the
 * owner's time is the scarce resource, and three runs plus cool-downs is an afternoon of walking his
 * own house. The control is also the only run with a known answer (9.2%/hour, torch off, attested),
 * so it is the one that says whether anything else can be believed.
 *
 * `roomPlan` is absent because RoomPlan is not built. A mode that silently ran something else would
 * be worse than a mode that is missing.
 */
export const BENCH_ORDER: { mode: BenchMode; label: string; why: string }[] = [
  { mode: "control", label: "Control — today's camera", why: "known answer: 9.2%/hour. Run this first." },
  { mode: "lowPower", label: "Low power — tracking only", why: "the mode that would run for hours" },
  { mode: "mesh", label: "Mesh — world tracking + geometry", why: "the mode a mechanical room earns" },
];
