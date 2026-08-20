/**
 * The device bench, as three buttons and a conditions form.
 *
 * ⚑ **A general bench whose first client is the thermal question.** Hold one configuration, sample
 * over time, share a JSON — the same shape answers tracking quality against walking speed,
 * relocalisation cost and loop-closure drift, and a harness built for one question has to be rebuilt
 * for the second.
 *
 * The screen's job is to make the three refusals visible while a run is going, not only afterwards.
 * A forty-minute run that is invisible until it finishes cannot be seen to have stalled — and a
 * stalled run reads as the coolest result of the day.
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "../store/sessionStore";
import { BigButton } from "../ui/bits";
import {
  BENCH_ORDER,
  batterySlope,
  benchStalled,
  benchVerdict,
  samplerLying,
  type BenchMode,
  type BenchRun,
  type BenchSample,
} from "../dev/deviceBench";
import { closeBenchLoop, onBenchSample, startBench, stopBench } from "../native/hsCamera";

/** Minutes, not seconds, because the person setting it is standing in a plant room. */
const CAP_MINUTES = 40;
const COOL_MINUTES = 10;

export function DeviceBenchCard() {
  const { showToast } = useApp();
  const [mode, setMode] = useState<BenchMode | null>(null);
  const [samples, setSamples] = useState<BenchSample[]>([]);
  const [run, setRun] = useState<BenchRun | null>(null);
  const [drift, setDrift] = useState<string | null>(null);
  /* ⚑ Recorded because thermal results are famously sensitive to all of them, and run A (RoomPlan)
     arrives days later on a different day. A set of runs whose conditions were not written down is a
     set of runs that cannot be compared. */
  const [ambient, setAmbient] = useState("");
  const [caseOn, setCaseOn] = useState(true);
  const off = useRef<(() => void) | null>(null);

  useEffect(() => () => off.current?.(), []);

  const begin = async (m: BenchMode) => {
    setSamples([]);
    setRun(null);
    setDrift(null);
    try {
      await startBench({
        mode: m,
        capSeconds: CAP_MINUTES * 60,
        coolSeconds: COOL_MINUTES * 60,
        sampleSeconds: 30,
        conditions: { ambientC: ambient, caseOn, note: `${m} run` },
      });
      off.current = onBenchSample((s) => setSamples((prev) => [...prev, s]));
      setMode(m);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bench refused to start");
    }
  };

  const end = async () => {
    try {
      const out = (await stopBench()) as BenchRun;
      off.current?.();
      off.current = null;
      setRun(out);
      setMode(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bench failed to stop");
    }
  };

  const latest = samples[samples.length - 1];
  const live = samples.length > 1 ? benchStalled(samples) : false;
  const lying = samples.length > 1 ? samplerLying(samples) : false;
  const slope = batterySlope(samples);
  const verdict = run ? benchVerdict(run) : null;

  return (
    <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-700">
      <h2 className="text-base font-semibold text-slate-100">Device bench</h2>
      <p className="mt-1 text-sm text-slate-400">
        One mode, held, sampled every 30 s. Runs to a thermal change or {CAP_MINUTES} minutes,
        whichever comes first, then keeps sampling for {COOL_MINUTES} while it cools.
      </p>

      {!mode && (
        <>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              ambient °C
              <input
                value={ambient}
                onChange={(e) => setAmbient(e.target.value)}
                inputMode="decimal"
                className="w-16 rounded bg-slate-800 px-2 py-1 text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={caseOn} onChange={(e) => setCaseOn(e.target.checked)} />
              case on
            </label>
          </div>
          <div className="mt-3 space-y-2">
            {BENCH_ORDER.map((m) => (
              <BigButton key={m.mode} variant="ghost" onClick={() => void begin(m.mode)}>
                {m.label}
                <span className="block text-xs font-normal text-slate-400">{m.why}</span>
              </BigButton>
            ))}
          </div>
          {/* ⚑ Named as missing rather than quietly absent: RoomPlan is not built, and a fourth
              button that ran something else would be worse than no fourth button. */}
          <p className="mt-2 text-xs text-slate-500">
            RoomPlan has no run here — it is not built yet. Re-run the control alongside it when it
            lands, to re-anchor the set across the gap.
          </p>
        </>
      )}

      {mode && latest && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-slate-300">
            <span className="font-mono text-slate-100">{mode}</span> ·{" "}
            {Math.round(latest.t / 60)} min · thermal{" "}
            <span className="font-mono text-slate-100">{latest.thermal}</span> · battery{" "}
            <span className="font-mono text-slate-100">{Math.round(latest.battery * 100)}%</span>
            {latest.cooling && <span className="text-brass-400"> · cooling</span>}
          </p>
          {/* ⚑ The proof of work, on screen while it matters rather than in the file afterwards. */}
          <p className="text-slate-400">
            frames <span className="font-mono text-slate-100">{latest.frames}</span> · mesh{" "}
            {latest.meshAnchors}/{latest.meshFaces}
            {latest.tracking && <> · {latest.tracking}</>}
          </p>
          {live && <p className="text-rose-400">STALLED — the session stopped producing frames.</p>}
          {lying && <p className="text-rose-400">SAMPLER LYING — drain reported while charging.</p>}
          <div className="mt-2 flex gap-2">
            <BigButton variant="ghost" onClick={() => void end()}>
              Stop the run
            </BigButton>
            {/* ⚑ Not thermal at all. Walk a loop, come back to the start, press this: the delta is
                the accumulated drift, and the whole architecture rests on positions being
                trustworthy over the length of a zone. */}
            {mode !== "control" && (
              <BigButton
                variant="ghost"
                onClick={() =>
                  void closeBenchLoop().then((r) =>
                    setDrift(r.closed ? `${r.driftMetres?.toFixed(3)} m` : (r.why ?? "not closed")),
                  )
                }
              >
                I am back at the start
              </BigButton>
            )}
          </div>
          {drift && <p className="text-slate-300">loop closure · {drift}</p>}
        </div>
      )}

      {run && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-slate-100">
            {run.mode} · <span className="font-mono">{verdict}</span>
          </p>
          {/* ⚑ The primary measure. `held` is a claim about a DURATION and is worthless without
              one, so the duration is printed beside it rather than implied. */}
          <p className="text-slate-300">
            {run.secondsToFirstTransition >= 0
              ? `first thermal change at ${Math.round(run.secondsToFirstTransition / 60)} min`
              : `no thermal change in ${Math.round(run.capSeconds / 60)} min`}{" "}
            · ended {run.endedBecause}
          </p>
          <p className="text-slate-400">
            battery{" "}
            {slope.percentPerHour === null
              ? "—"
              : `${slope.percentPerHour.toFixed(1)} %/hr over ${Math.round(slope.spanSeconds / 60)} min`}{" "}
            {/* The resolution the figure really has, travelling with the figure. */}
            · {slope.steps} step{slope.steps === 1 ? "" : "s"}
          </p>
          {run.loopClosure?.closed && (
            <p className="text-slate-300">drift · {run.loopClosure.driftMetres?.toFixed(3)} m</p>
          )}
          <BigButton
            variant="ghost"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(JSON.stringify(run))
                .then(() => showToast("Run copied — paste it into a file for the field session"))
                .catch(() => showToast("Could not copy"));
            }}
          >
            Copy the run
          </BigButton>
        </div>
      )}
    </section>
  );
}
