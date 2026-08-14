import { useEffect, useState } from "react";
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
import { CaptureModeScreen } from "../screens/v2/CaptureModeScreen";
import { modeForVisit, visitKindOf } from "../engine/v2/checklist";
import { globalCameraApplies } from "./captureSurface";
import { ErrorBoundary } from "./ErrorBoundary";
import { isNativePlatform } from "./platform";
import { APP_VERSION } from "../storage/sessionRepo";
import { loadChecklists } from "../config/loadChecklists";
import { WalkScreen } from "../screens/v2/WalkScreen";
import { ZoneV2Screen } from "../screens/v2/ZoneV2Screen";
import { PinScreen } from "../screens/v2/PinScreen";
import { CanvasScreen } from "../screens/v2/CanvasScreen";
import { InboxScreen } from "../screens/v2/InboxScreen";
import { ExportV2Screen } from "../screens/v2/ExportV2Screen";
import { DevBenchScreen } from "../screens/DevBenchScreen";
import { PhotoInput, VideoInput } from "../capture/PhotoInput";
import { SweepCamera } from "../capture/SweepCamera";
import type { CaptureTarget } from "../engine/v2/events";

/**
 * Global capture (REDESIGN-v2 §3): a shutter on every in-session v2 screen. Captures
 * default to the screen's context — the open zone or pin — and to the inbox anywhere
 * else. Shoot first, file when hands are free.
 *
 * Three doors, because the work has three shapes (field report 2026-07-25):
 *   Photo — native camera, full 12MP, for the nameplate that must stay legible.
 *   Sweep — stay-open viewfinder, for walking a room shooting continuously.
 *   Video — native recorder, for runs of pipe, operating equipment, water flow.
 * The destination is named on every one of them, so a capture never disappears.
 */
function GlobalCamera() {
  const { screen, v2Session, capturePhotoV2, showToast } = useApp();
  const [sweeping, setSweeping] = useState(false);
  if (!v2Session || v2Session.completedAt) return null;
  // Capture mode owns the camera; the floating trio stays everywhere else (owner ruling
  // 2026-08-11). The rule lives in `globalCameraApplies` so it can be tested.
  if (!globalCameraApplies(visitKindOf(v2Session), screen.name)) return null;

  let target: CaptureTarget = { kind: "inbox" };
  let where = "Inbox";
  if (screen.name === "zone2") {
    target = { kind: "zone", id: screen.zoneId };
    where = v2Session.zones.find((z) => z.zoneId === screen.zoneId)?.label ?? "zone";
  } else if (screen.name === "pin") {
    target = { kind: "pin", id: screen.pinId };
    const pin = v2Session.pins.find((p) => p.pinId === screen.pinId);
    where = pin ? `pin #${pin.number}` : "pin";
  }

  const saved = (what: string) => () => showToast(`${what} → ${where}`);
  const failed = () => showToast("Not saved — storage may be full");

  return (
    <>
      {sweeping && (
        <SweepCamera
          destination={where}
          onShot={(blob) => capturePhotoV2(target, blob, "image/jpeg")}
          onClose={() => setSweeping(false)}
        />
      )}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <VideoInput
          onVideo={(file, ms) => capturePhotoV2(target, file, undefined, ms).then(saved("Video")).catch(failed)}
          className="flex items-center gap-2 rounded-full bg-slate-800/95 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-slate-600 active:bg-slate-700"
        >
          🎥 Video
        </VideoInput>
        <button
          type="button"
          onClick={() => setSweeping(true)}
          className="flex items-center gap-2 rounded-full bg-slate-800/95 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg ring-1 ring-slate-600 active:bg-slate-700"
        >
          ⚡ Sweep
        </button>
        <PhotoInput
          onPhoto={(file) => capturePhotoV2(target, file).then(saved("Photo")).catch(failed)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brass-600 text-3xl shadow-lg active:bg-brass-500"
        >
          📷
        </PhotoInput>
      </div>
    </>
  );
}

export function App() {
  const { ready, screen, sessionId, toast, init, drainNow, drainChatNow, refreshReviewStatus, v2Session, v2Config, leaveSession } =
    useApp();
  /**
   * Capture Mode spec §1: mode follows the visit kind and is never independently settable.
   * Derived here, at the one place that decides what a route renders — so capture mode is a
   * different SCREEN rather than the zone screen with things hidden, which is what §2.1's
   * "absent, not collapsed" requires.
   */
  const captureMode = modeForVisit(v2Session ? visitKindOf(v2Session) : null) === "capture";

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
      {/*
        Issue #71: a render throw anywhere below here used to unmount the ENTIRE root, and the
        watchdog is deliberately silent post-boot — so the failure reached the field as a black
        rectangle with no text. The boundary is seated around the screen switch rather than at
        the root so that recovery is "go back to the home screen", which keeps the visit; the
        events are already on disk, so nothing is repaired, only re-navigated.
      */}
      <ErrorBoundary
        resetKey={JSON.stringify(screen)}
        onRecover={leaveSession}
        context={() => ({
          screen,
          sessionId,
          appVersion: APP_VERSION,
          // The snapshot version is the one that matters: #71 was a session pinned to a config
          // written by an older build, so this is the first thing to compare against today's.
          sessionConfigVersion: v2Config?.configVersion,
          currentConfigVersion: loadChecklists().configVersion,
          native: isNativePlatform(),
        })}
      >
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
      {screen.name === "walk" && (captureMode ? <CaptureModeScreen /> : <WalkScreen />)}
      {screen.name === "zone2" &&
        (captureMode ? <CaptureModeScreen zoneId={screen.zoneId} /> : <ZoneV2Screen zoneId={screen.zoneId} />)}
      {screen.name === "pin" && <PinScreen key={screen.pinId} pinId={screen.pinId} />}
      {screen.name === "canvas" && (
        <CanvasScreen key={screen.canvasId} canvasId={screen.canvasId} zoneId={screen.zoneId} placePinId={screen.placePinId} />
      )}
      {screen.name === "inbox" && <InboxScreen />}
      {screen.name === "export2" && <ExportV2Screen />}
      {screen.name === "devbench" && <DevBenchScreen />}
      <GlobalCamera />
      </ErrorBoundary>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <p className="rounded-full bg-slate-700 px-5 py-3 text-slate-100 shadow-lg">{toast}</p>
        </div>
      )}
    </div>
  );
}
