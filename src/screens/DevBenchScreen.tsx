/**
 * The write-rate measurement, as a screen the owner can run without a keyboard.
 *
 * It is a NAMED RISK on stage 4b turned into half an hour on the iPad. The whole reason it
 * has to run on the device is that IndexedDB throughput under WKWebView on iPadOS is the
 * unknown — a laptop answers a different question, and the cloud cannot answer it at all.
 *
 * Deliberately plain: three presets, one button, and a result that names which of the two
 * costs dominates. `writeBench.ts` explains why the split matters more than the total.
 */
import { useState } from "react";
import { useApp } from "../store/sessionStore";
import { BigButton, formatBytes } from "../ui/bits";
import {
  DEFAULT_FRAME_BYTES,
  dropBenchDb,
  runWriteBench,
  type BenchParams,
  type BenchResult,
} from "../dev/writeBench";

/**
 * Presets rather than number fields — a preset is a question ("does one room survive?"),
 * a number field is a decision the person running it should not have to make.
 *
 * "A room" is 40 fires because the worked mechanical room held 34 objects. At a three-frame
 * bracket that is 480 MB for ONE room, which is itself worth seeing before it is measured:
 * bracketing every plate roughly triples what a room costs to store.
 */
const PRESETS: { id: string; label: string; hint: string; params: BenchParams }[] = [
  {
    id: "quick",
    label: "Quick",
    hint: "10 fires — does it work at all",
    params: { fires: 10, framesPerFire: 3, bytesPerFrame: DEFAULT_FRAME_BYTES },
  },
  {
    id: "room",
    label: "A room",
    hint: "40 fires — a mechanical room with every plate bracketed",
    params: { fires: 40, framesPerFire: 3, bytesPerFrame: DEFAULT_FRAME_BYTES },
  },
  {
    id: "long",
    label: "Long",
    hint: "100 fires — does it slow down as it fills",
    params: { fires: 100, framesPerFire: 3, bytesPerFrame: DEFAULT_FRAME_BYTES },
  },
];

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right">
        <span className="font-mono text-slate-100">{value}</span>
        {note ? <span className="ml-2 text-xs text-slate-500">{note}</span> : null}
      </span>
    </div>
  );
}

export function DevBenchScreen() {
  const { navigate, showToast } = useApp();
  const [preset, setPreset] = useState(PRESETS[1]!);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<BenchResult | null>(null);

  const projected = preset.params.fires * preset.params.framesPerFire * preset.params.bytesPerFrame;

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress({ done: 0, total: preset.params.fires });
    try {
      const r = await runWriteBench(preset.params, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(r);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bench failed to start");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const s = result?.summary;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Write-rate check</h1>
          <p className="mt-1 text-sm text-slate-400">
            Can this iPad keep up with the new camera saving photographs automatically?
          </p>
        </div>
        <BigButton variant="ghost" onClick={() => navigate({ name: "home" })}>
          Back
        </BigButton>
      </header>

      <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-300">
        <p>
          The new capture screen saves every shot straight away, with no “keep this?” step — and for a
          nameplate it takes <strong>three</strong> at once. This writes exactly that pattern, as fast as
          it can, and reports what it cost.
        </p>
        <p className="mt-2 text-slate-400">
          It uses its own scratch database and deletes it afterwards. <strong>Your inspections are not
          touched.</strong>
        </p>
      </section>

      <div className="flex flex-col gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={running}
            onClick={() => setPreset(p)}
            className={`rounded-xl px-4 py-3 text-left ring-1 disabled:opacity-40 ${
              preset.id === p.id ? "bg-brass-600 text-white ring-brass-500" : "bg-slate-800 text-slate-300 ring-slate-600"
            }`}
          >
            <span className="font-medium">{p.label}</span>
            <span className="ml-2 text-sm opacity-80">{p.hint}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        This will write about <strong className="text-slate-200">{formatBytes(projected)}</strong> and then
        delete it.
      </p>

      <BigButton disabled={running} onClick={() => void run()}>
        {running
          ? progress
            ? `Running… ${progress.done}/${progress.total}`
            : "Running…"
          : "Run the check"}
      </BigButton>

      {result && (
        <section className="flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Result</h2>

          {result.error && (
            <div className="mb-3 rounded-lg border border-alert-500 bg-alert-950/50 p-3 text-sm text-alert-200">
              <p className="font-semibold">The device stopped it after {result.completedFires} shots.</p>
              <p className="mt-1 font-mono text-xs">{result.error}</p>
              <p className="mt-2 text-alert-300">
                That is a real answer, not a bug — it is the storage limit, and it is worth knowing.
              </p>
            </div>
          )}

          {s ? (
            <>
              <Row label="Shots completed" value={`${s.fires}`} note={`${s.frames} photographs`} />
              <Row label="Written" value={formatBytes(s.bytes)} />
              <Row
                label="Sustained rate"
                value={`${s.firesPerSecond.toFixed(1)} shots/sec`}
                note={s.firesPerSecond >= 1 ? "keeps up" : "too slow for auto-capture"}
              />
              <Row label="Fingerprinting each shot" value={`${s.hashMsP50.toFixed(0)} ms`} note={`worst ${s.hashMsP95.toFixed(0)} ms`} />
              <Row label="Saving each shot" value={`${s.txMsP50.toFixed(0)} ms`} note={`worst ${s.txMsP95.toFixed(0)} ms`} />
              <Row
                label="Slowdown as it filled"
                value={`${s.degradation.toFixed(2)}×`}
                note={s.degradation > 1.5 ? "gets worse — the important one" : "steady"}
              />
              <Row
                label="Where the time goes"
                value={
                  s.dominant === "hashing" ? "fingerprinting" : s.dominant === "commit" ? "saving" : "both, evenly"
                }
              />

              <p className="mt-3 text-sm text-slate-400">
                {s.dominant === "hashing"
                  ? "Fingerprinting dominates — the fix is to move it off the main thread, or have the camera hand us the fingerprint it can compute while writing the file."
                  : s.dominant === "commit"
                    ? "Saving dominates — the fix is storing photographs as files rather than inside the database."
                    : "Neither dominates, so neither fix alone is enough. Both need attention."}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Send this screen to the field session — the slowdown figure matters more than the averages,
                because a room that starts fast and stalls at object thirty is the failure a short test hides.
              </p>
            </>
          ) : (
            !result.error && <p className="text-sm text-slate-400">No samples recorded.</p>
          )}
        </section>
      )}

      <BigButton
        variant="ghost"
        disabled={running}
        onClick={() => void dropBenchDb().then(() => showToast("Scratch database removed"))}
      >
        Clean up the scratch database
      </BigButton>
    </div>
  );
}
