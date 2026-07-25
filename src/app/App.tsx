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
import { SetupV2Screen } from "../screens/v2/SetupV2Screen";
import { WalkScreen } from "../screens/v2/WalkScreen";
import { ZoneV2Screen } from "../screens/v2/ZoneV2Screen";
import { PinScreen } from "../screens/v2/PinScreen";
import { CanvasScreen } from "../screens/v2/CanvasScreen";
import { InboxScreen } from "../screens/v2/InboxScreen";
import { ExportV2Screen } from "../screens/v2/ExportV2Screen";
import { PhotoInput } from "../capture/PhotoInput";
import type { CaptureTarget } from "../engine/v2/events";

/**
 * Global camera (REDESIGN-v2 §3): a shutter on every in-session v2 screen. Captures
 * default to the screen's context — the open zone or pin — and to the inbox anywhere
 * else. Shoot first, file when hands are free.
 */
function GlobalCamera() {
  const { screen, v2Session, capturePhotoV2, showToast } = useApp();
  if (!v2Session || v2Session.completedAt) return null;
  if (!["walk", "zone2", "pin", "inbox"].includes(screen.name)) return null;

  let target: CaptureTarget = { kind: "inbox" };
  let where = "inbox";
  if (screen.name === "zone2") {
    target = { kind: "zone", id: screen.zoneId };
    where = "zone";
  } else if (screen.name === "pin") {
    target = { kind: "pin", id: screen.pinId };
    where = "pin";
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <PhotoInput
        onPhoto={(file) =>
          capturePhotoV2(target, file)
            .then(() => showToast(`Photo → ${where}`))
            .catch(() => showToast("Photo not saved — storage may be full"))
        }
        className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-3xl shadow-lg active:bg-teal-500"
      >
        📷
      </PhotoInput>
    </div>
  );
}

export function App() {
  const { ready, screen, sessionId, toast, init, drainNow, drainChatNow, refreshReviewStatus } = useApp();

  useEffect(() => { void init(); }, [init]);

  // Boot complete after the first commit: tell the index.html watchdog to stop being
  // destructive. Past this point a stray runtime error must never wipe the live app.
  useEffect(() => { window.__hsBooted = true; }, []);

  // Second-look drain triggers: connectivity regained, app foregrounded, and a slow
  // heartbeat while a session is active. The drain itself is single-flight and no-ops
  // offline or when unconfigured.
  useEffect(() => {
    if (!sessionId) return;
    const kick = () => { void drainNow(); void drainChatNow(); };
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
  }, [sessionId, drainNow, drainChatNow, refreshReviewStatus]);
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
      {screen.name === "setup2" && <SetupV2Screen />}
      {screen.name === "walk" && <WalkScreen />}
      {screen.name === "zone2" && <ZoneV2Screen zoneId={screen.zoneId} />}
      {screen.name === "pin" && <PinScreen key={screen.pinId} pinId={screen.pinId} />}
      {screen.name === "canvas" && (
        <CanvasScreen key={screen.canvasId} canvasId={screen.canvasId} zoneId={screen.zoneId} placePinId={screen.placePinId} />
      )}
      {screen.name === "inbox" && <InboxScreen />}
      {screen.name === "export2" && <ExportV2Screen />}
      <GlobalCamera />
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <p className="rounded-full bg-slate-700 px-5 py-3 text-slate-100 shadow-lg">{toast}</p>
        </div>
      )}
    </div>
  );
}
