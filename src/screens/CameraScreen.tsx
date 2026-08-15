/**
 * The capture camera (F-26) — one viewfinder, always open.
 *
 * The web layer is transparent while this screen is mounted and the native preview sits behind it,
 * so everything here is an overlay on a live camera. Not six doors launching six camera sessions,
 * which is what a file-input camera forces and what produced six interactions to photograph one
 * object.
 *
 * The rules that ride the design, and each is a decision rather than a style:
 * - ⚑ **The frame colour is painted from `setMode`'s return**, never from the button that was
 *   tapped. A frame painted from the press is a silent failure with false reassurance on top.
 * - **Icons, not words.** Muscle memory arrives in a shift; reading does not.
 * - ⚑ **Assume Use, never Retake. There is no confirm sheet** — the filmstrip is the confirmation.
 *   A concierge who wants another shot takes another shot.
 * - **Modes configure the sensor; actions are workflow prompts that use a mode.** They are drawn
 *   differently on purpose, because a control that looks like a mode will be used as one.
 *
 * This screen is where the owner judges focus, torch and exposure on a real plate. No amount of
 * Swift settles that, so the frames are openable at 1:1 and shareable off the device.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../store/sessionStore";
import { isNativePlatform } from "../app/platform";
import {
  adjustCamera,
  cameraAvailable,
  captureFrames,
  frameStateOf,
  frameUrl,
  onModeStatus,
  onTextBoxes,
  requestMode,
  startCamera,
  stopCamera,
  type CameraCapabilities,
  type CameraMode,
  type CaptureResult,
  type FrameState,
  type ModeStatusEvent,
  type TextBoxesEvent,
} from "../native/hsCamera";

const MODE_BUTTONS: { mode: CameraMode; glyph: string; hint: string }[] = [
  { mode: "object", glyph: "◉", hint: "Object" },
  { mode: "concern", glyph: "⚠", hint: "Concern" },
  { mode: "text", glyph: "🔍", hint: "Text" },
  { mode: "document", glyph: "▤", hint: "Document" },
];

/** Actions are drawn as a separate row: a mode stays until changed, an action starts a thing. */
const ACTIONS: { id: string; glyph: string; hint: string; mode: CameraMode }[] = [
  { id: "room-shot", glyph: "⬛", hint: "Room shot", mode: "object" },
  { id: "run-trace", glyph: "〰", hint: "Run trace", mode: "object" },
];

const FRAME_COLOUR: Record<FrameState, string> = {
  object: "ring-slate-300/70",
  concern: "ring-amber-400",
  text: "ring-emerald-400",
  document: "ring-sky-400",
  degraded: "ring-rose-500",
  off: "ring-slate-700",
};

function Overlay({ boxes }: { boxes: TextBoxesEvent["boxes"] }) {
  return (
    <>
      {boxes.map((box, index) => (
        <div
          key={`${box.text}-${index}`}
          className="pointer-events-none absolute rounded border-2 border-emerald-400/80"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
        />
      ))}
    </>
  );
}

/** The level bubble: one number, drawn, because a number read off a screen is not a bubble. */
function Level({ roll, square }: { roll: number; square: boolean }) {
  const clamped = Math.max(-20, Math.min(20, roll));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
      <div className="relative h-1 w-40 rounded-full bg-slate-100/30">
        <div
          className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${square ? "bg-emerald-400" : "bg-slate-100"}`}
          style={{ left: `calc(50% + ${clamped * 2}px - 6px)` }}
        />
      </div>
    </div>
  );
}

export function CameraScreen() {
  const { navigate, showToast } = useApp();
  const [status, setStatus] = useState<ModeStatusEvent | null>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [text, setText] = useState<TextBoxesEvent | null>(null);
  const [shots, setShots] = useState<CaptureResult[]>([]);
  const [viewing, setViewing] = useState<CaptureResult | null>(null);
  const [oneToOne, setOneToOne] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInstruments, setShowInstruments] = useState(false);
  /**
   * Auto-capture is the feature that turns roughly two hundred taps into thirty-four, so it is on
   * by default in the mode that has it. It is also switchable, because judging one deliberate
   * frame of one plate is a different act from walking a room — and a filmstrip filling up while
   * someone looks around is a filmstrip they cannot find the real shot in.
   */
  const [autoCapture, setAutoCapture] = useState(true);
  const autoRef = useRef(true);
  useEffect(() => {
    autoRef.current = autoCapture;
  }, [autoCapture]);

  const available = cameraAvailable();
  const lastAuto = useRef(0);
  const busyRef = useRef(false);

  const shoot = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await captureFrames();
      // Assume Use: it goes straight into the filmstrip. No confirm sheet — that was only ever an
      // artefact of the OS camera finishing its own job.
      setShots((prev) => [result, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // The web stack steps aside for the native preview, and steps back on unmount. Both halves
  // matter: leaving it transparent over a torn-down session is a black screen.
  useEffect(() => {
    if (!available) return;
    document.documentElement.classList.add("hs-camera-live");
    return () => document.documentElement.classList.remove("hs-camera-live");
  }, [available]);

  useEffect(() => {
    if (!available) return;
    const offText = onTextBoxes((event) => {
      setText(event);
      // Auto-capture when the read is stable. Driven from the native signal but fired here, so the
      // act of capturing stays in one place and can be reasoned about — and cooled down, because a
      // stable read stays stable for as long as the iPad is held still.
      // A stray word on a pipe label is a stable read too. Six characters is roughly the shortest
      // thing worth firing the shutter for on a plate, and it keeps the trigger off the noise.
      const worthShooting = event.characterCount >= 6;
      if (autoRef.current && event.stable && worthShooting && Date.now() - lastAuto.current > 4000) {
        lastAuto.current = Date.now();
        void shoot();
      }
    });
    const offStatus = onModeStatus(setStatus);
    startCamera("text")
      .then((result) => setCapabilities(result.capabilities))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      offText();
      offStatus();
      void stopCamera().catch(() => {});
    };
  }, [available, shoot]);

  const chooseMode = async (mode: CameraMode) => {
    try {
      // ⚑ The return is the only thing that paints. `status` updates from the modeStatus stream
      // that `apply` emits, so even this optimistic call cannot paint from the tap.
      const achieved = await requestMode(mode);
      if (achieved.unmet.length) showToast(`${mode}: could not reach ${achieved.unmet.join(", ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const frameState = frameStateOf(status);

  if (!available) {
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
          <h1 className="text-xl font-semibold text-slate-100">Camera</h1>
        </header>
        <div className="rounded-lg bg-slate-800/70 p-3 text-sm text-slate-300 ring-1 ring-slate-700">
          <p className="font-medium text-slate-100">No native camera here.</p>
          <p className="mt-1">
            {isNativePlatform()
              ? "Running in the native shell, but the HSCamera plugin did not register."
              : "This is the browser. Expected: the capture camera exists only in the iPad app."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col">
      {/* The viewfinder frame. Its colour is the achieved mode — the one thing on this screen that
          must never be derived from what was tapped. */}
      <div className={`pointer-events-none absolute inset-2 rounded-2xl ring-4 ${FRAME_COLOUR[frameState]}`} />

      <div className="relative flex-1">
        {text && status?.mode === "text" && <Overlay boxes={text.boxes} />}
        {status?.level && (status.mode === "text" || status.mode === "document") && (
          <Level roll={status.level.roll} square={status.level.square} />
        )}
      </div>

      <header className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-600"
        >
          ← Home
        </button>
        <div className="flex items-center gap-2">
          {status?.torchOn && <span className="rounded-full bg-amber-400/90 px-2 py-1 text-xs text-slate-900">torch</span>}
          {frameState === "degraded" && (
            <span className="rounded-full bg-rose-500 px-2 py-1 text-xs text-white">
              {status?.unmet.join(", ")}
            </span>
          )}
          {status?.mode === "text" && (
            <button
              type="button"
              aria-label="Auto-capture"
              onClick={() => setAutoCapture((v) => !v)}
              className={`rounded-lg px-3 py-2 text-xs ring-1 ${
                autoCapture ? "bg-emerald-500 text-slate-900 ring-emerald-400" : "bg-slate-900/70 text-slate-300 ring-slate-600"
              }`}
            >
              auto {autoCapture ? "on" : "off"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowInstruments((v) => !v)}
            className="rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-600"
          >
            {showInstruments ? "hide" : "instruments"}
          </button>
        </div>
      </header>

      {showInstruments && status && (
        <div className="absolute right-3 top-16 w-64 rounded-lg bg-slate-950/85 p-3 text-xs text-slate-300 ring-1 ring-slate-700">
          <p>thermal · <span className="font-mono text-slate-100">{status.thermalState}</span></p>
          <p>battery · <span className="font-mono text-slate-100">{Math.round(status.battery.level * 100)}%</span> {status.battery.state}</p>
          <p>
            light · <span className="font-mono text-slate-100">{status.lightScore.toFixed(2)}</span>
            <span className="text-slate-500"> (torch at ≥{status.underLitThreshold})</span>
          </p>
          {text && (
            <p>
              read · <span className="font-mono text-slate-100">{text.characterCount}</span> chars ·{" "}
              {text.meanConfidence.toFixed(2)}
              {text.marginal && <span className="text-amber-400"> marginal</span>}
            </p>
          )}
          {text && (
            <p>
              motion · <span className="font-mono text-slate-100">{text.motion.toFixed(4)}</span>
              <span className="text-slate-500"> (still under {text.stillThreshold})</span>
              {text.stable && <span className="text-emerald-400"> steady</span>}
            </p>
          )}
          <p>session · <span className="font-mono text-slate-100">{status.sessionRunning ? "running" : "stopped"}</span></p>
          {capabilities && <p className="mt-1 text-slate-500">brackets {capabilities.maxBracketedFrames} · torch {String(capabilities.torch)}</p>}
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-16 rounded-lg bg-rose-950/90 p-3 text-sm text-rose-100 ring-1 ring-rose-800">
          {error}
        </div>
      )}

      <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
        {shots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot) => (
              <button
                key={shot.at + shot.frames[0]!.path}
                type="button"
                onClick={() => setViewing(shot)}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-500"
              >
                <img src={frameUrl(shot.frames[0]!.path)} alt="" className="h-full w-full object-cover" />
                {shot.bracketed && (
                  <span className="absolute bottom-0 right-0 bg-slate-900/80 px-1 text-[10px] text-slate-200">
                    ×{shot.frames.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {MODE_BUTTONS.map((button) => (
              <button
                key={button.mode}
                type="button"
                aria-label={button.hint}
                onClick={() => void chooseMode(button.mode)}
                className={`h-14 w-14 rounded-xl text-xl ring-1 ${
                  status?.mode === button.mode
                    ? "bg-slate-100 text-slate-900 ring-slate-100"
                    : "bg-slate-900/70 text-slate-200 ring-slate-600"
                }`}
              >
                {button.glyph}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Capture"
            disabled={busy}
            onClick={() => void shoot()}
            className="h-20 w-20 rounded-full border-4 border-slate-100 bg-slate-100/20 active:bg-slate-100/60 disabled:opacity-40"
          />

          <div className="flex gap-1">
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                aria-label={action.hint}
                onClick={() => {
                  void chooseMode(action.mode);
                  showToast(`${action.hint} — framed wide, one per zone`);
                }}
                className="h-14 w-14 rounded-full bg-slate-900/70 text-lg text-slate-200 ring-1 ring-dashed ring-slate-500"
              >
                {action.glyph}
              </button>
            ))}
            <button
              type="button"
              aria-label="Torch"
              onClick={() => void adjustCamera({ torchOverride: !status?.torchOn })}
              className={`h-14 w-14 rounded-full text-lg ring-1 ${
                status?.torchOn ? "bg-amber-400 text-slate-900 ring-amber-300" : "bg-slate-900/70 text-slate-200 ring-slate-600"
              }`}
            >
              ⚡
            </button>
          </div>
        </div>
      </footer>

      {viewing && (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between gap-2 p-3">
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
            >
              ← Viewfinder
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOneToOne((v) => !v)}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
              >
                {oneToOne ? "Fit" : "1:1"}
              </button>
              <button
                type="button"
                onClick={() => void shareFrame(viewing)}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
              >
                Send
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <img
              src={frameUrl(viewing.frames[0]!.path)}
              alt=""
              className={oneToOne ? "max-w-none" : "h-full w-full object-contain"}
            />
          </div>
          <p className="p-3 text-xs text-slate-500">
            {viewing.mode} · {viewing.frames.length} frame{viewing.frames.length > 1 ? "s" : ""} ·{" "}
            {viewing.torchUsed ? "torch on" : "no torch"}
            {viewing.ocr && ` · read ${viewing.ocr.meanConfidence.toFixed(2)}`}
          </p>
        </div>
      )}
    </div>
  );
}

/** Off the device so a plate can be judged on a big screen, which is where legibility is settled. */
async function shareFrame(shot: CaptureResult): Promise<void> {
  const response = await fetch(frameUrl(shot.frames[0]!.path));
  const blob = await response.blob();
  const file = new File([blob], `hs-${shot.mode}-${shot.at.replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "HouseSteady capture" });
  }
}
