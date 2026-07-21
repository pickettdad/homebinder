import { useEffect } from "react";
import { useApp } from "../store/sessionStore";
import { useWakeLock } from "./useWakeLock";
import { UpdateBanner } from "./UpdateBanner";
import { HomeScreen } from "../screens/HomeScreen";
import { SetupScreen } from "../screens/SetupScreen";
import { RouteScreen } from "../screens/RouteScreen";
import { ZoneScreen } from "../screens/ZoneScreen";
import { CaptureScreen } from "../screens/CaptureScreen";
import { GateScreen } from "../screens/GateScreen";
import { ExportScreen } from "../screens/ExportScreen";

export function App() {
  const { ready, screen, sessionId, toast, init, drainNow, refreshReviewStatus } = useApp();

  useEffect(() => { void init(); }, [init]);

  // Second-look drain triggers: connectivity regained, app foregrounded, and a slow
  // heartbeat while a session is active. The drain itself is single-flight and no-ops
  // offline or when unconfigured.
  useEffect(() => {
    if (!sessionId) return;
    const kick = () => { void drainNow(); };
    const onVisible = () => { if (document.visibilityState === "visible") kick(); };
    window.addEventListener("online", kick);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => { void refreshReviewStatus().then(() => kick()); }, 60_000);
    kick();
    return () => {
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [sessionId, drainNow, refreshReviewStatus]);
  // Hold the screen awake for the whole visit; re-acquired after camera round-trips
  // and system releases. Status surfaces below so a failure is visible, not silent.
  const wakeLock = useWakeLock(sessionId !== null);

  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <UpdateBanner />
      {sessionId !== null && !wakeLock.held && (
        <div className="pointer-events-none fixed right-3 top-3 z-50 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-slate-950">
          {!wakeLock.supported
            ? "Screen sleep not preventable — raise Auto-Lock in Settings"
            : wakeLock.error
              ? `Screen may sleep — wake lock denied (${wakeLock.error})`
              : "Screen may sleep — wake lock not held"}
        </div>
      )}
      {screen.name === "home" && <HomeScreen />}
      {screen.name === "setup" && <SetupScreen />}
      {screen.name === "route" && <RouteScreen />}
      {screen.name === "zone" && <ZoneScreen zoneId={screen.zoneId} />}
      {screen.name === "capture" && (
        <CaptureScreen slotInstanceId={screen.slotInstanceId} findingId={screen.findingId} />
      )}
      {screen.name === "gate" && <GateScreen zoneId={screen.zoneId} />}
      {screen.name === "export" && <ExportScreen />}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <p className="rounded-full bg-slate-700 px-5 py-3 text-slate-100 shadow-lg">{toast}</p>
        </div>
      )}
    </div>
  );
}
