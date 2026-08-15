/**
 * Field 4's acceptance test, as a screen — because the proof has to be *read on the iPad*, twice,
 * by someone holding it, and a value that only exists in a Xcode console proves nothing about
 * the TestFlight build.
 *
 * It states a verdict before it states detail. A wall of fields with no verdict leaves the
 * reading to whoever is holding the device, and the one comparison that matters — Debug here,
 * Release there, everything else identical — is easy to get wrong by eye at the end of a day.
 *
 * It renders in the browser too, and says so plainly. The browser path is the control (CLAUDE.md):
 * "does the web version do the same?" is the question that halves a native problem fastest, and a
 * screen that refuses to render there cannot answer it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../store/sessionStore";
import { BigButton } from "../ui/bits";
import { isNativePlatform } from "../app/platform";
import {
  echoIsWellFormed,
  hsShellAvailable,
  onHeartbeat,
  probeBridge,
  type BridgeProbe,
  type HSShellHeartbeat,
} from "../native/hsShell";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-right font-mono ${strong ? "text-lg text-slate-50" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

export function NativeCheckScreen() {
  const { navigate } = useApp();
  const [running, setRunning] = useState(false);
  const [probe, setProbe] = useState<BridgeProbe | null>(null);
  const [beats, setBeats] = useState<HSShellHeartbeat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  const available = hsShellAvailable();

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setBeats([]);
    setProbe(null);
    try {
      const result = await probeBridge();
      setProbe(result);
      // Logged as well as rendered: the same value then reaches Safari's Web Inspector and the
      // device console, which is how it can be captured off a build nobody is standing in front
      // of. `webContentsDebuggingEnabled` in capacitor.config.ts is what makes that work on the
      // Release/TestFlight build too.
      console.log("[HSShell] bridge probe", JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.log("[HSShell] bridge probe failed", err);
    } finally {
      setRunning(false);
    }
  }, []);

  // Subscribed on mount, before anything is sent: a listener registered after the native side
  // has already fired would miss beats and report a broken event path that works.
  //
  // And the probe runs on open rather than waiting for a tap. The screen's whole job is to answer
  // one question; making someone find the button first adds a step where a wrong answer looks
  // like an untaken action. The button re-runs it, which is what it is actually for.
  useEffect(() => {
    unsubscribe.current = onHeartbeat((beat) => {
      setBeats((prev) => [...prev, beat]);
      // Logged as well as counted, so "did events flow native → web" is answerable from a console
      // capture rather than from someone reading a row off a screen. The method returning and the
      // events arriving are two capabilities, and only one of them shows up in the echo.
      console.log(`[HSShell] heartbeat ${beat.beat}/${beat.of} at ${beat.at}`);
    });
    if (available) void run();
    return () => unsubscribe.current?.();
  }, [available, run]);

  const wellFormed = probe ? echoIsWellFormed(probe) : false;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="rounded-lg px-3 py-2 text-sm text-slate-400 ring-1 ring-slate-700 active:bg-slate-800"
        >
          ← Home
        </button>
        <h1 className="text-xl font-semibold text-slate-100">Native bridge check</h1>
      </header>

      <p className="text-sm text-slate-400">
        Proves one value crosses from the native shell into the app, and that the native side can
        speak on its own afterwards. Run it once here over the cable, and once on the TestFlight
        build: the build type must differ and everything else must match.
      </p>

      {!available && (
        <div className="rounded-lg bg-slate-800/70 p-3 text-sm text-slate-300 ring-1 ring-slate-700">
          <p className="font-medium text-slate-100">No native bridge here.</p>
          <p className="mt-1">
            {isNativePlatform()
              ? "Running in the native shell, but the HSShell plugin did not register — that is the failure this screen exists to catch."
              : "This is the browser. Expected: the plugin only exists inside the iPad app."}
          </p>
        </div>
      )}

      <BigButton onClick={run} disabled={running || !available}>
        {running ? "Running…" : probe || error ? "Run it again" : "Run the check"}
      </BigButton>

      {error && (
        <div className="rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200 ring-1 ring-rose-900">{error}</div>
      )}

      {probe && (
        <>
          <div
            className={`rounded-lg p-3 ring-1 ${
              wellFormed
                ? "bg-emerald-950/50 text-emerald-100 ring-emerald-900"
                : "bg-rose-950/60 text-rose-100 ring-rose-900"
            }`}
          >
            <p className="text-lg font-semibold">
              {wellFormed ? "Bridge crossed." : "Answer came back malformed."}
            </p>
            <p className="mt-1 text-sm">
              {wellFormed
                ? `${probe.echo.plugin.buildConfiguration} build, ${probe.echo.device.hardware} on iOS ${probe.echo.device.systemVersion}.`
                : "Something answered, but not with the values the plugin is supposed to return. Send this screen to the owner rather than re-running it."}
            </p>
          </div>

          <section className="rounded-lg bg-slate-900 p-3 ring-1 ring-slate-800">
            <Row label="Build type" value={probe.echo.plugin.buildConfiguration} strong />
            <Row label="Plugin version" value={probe.echo.plugin.version} />
            <Row label="Device" value={probe.echo.device.hardware} />
            <Row label="Model" value={probe.echo.device.model} />
            <Row label="iOS" value={probe.echo.device.systemVersion} />
            <Row label="Round trip" value={`${probe.roundTripMs} ms`} />
            <Row label="Argument returned" value={probe.echo.sentAt === probe.sentAt ? "unchanged" : "ALTERED"} />
            <Row label="Native clock" value={probe.echo.receivedAt} />
            <Row
              label="Heartbeats"
              value={beats.length ? `${beats[beats.length - 1]!.beat} of ${beats[beats.length - 1]!.of}` : "waiting…"}
            />
          </section>
        </>
      )}
    </div>
  );
}
