/**
 * The capture camera bridge (F-26).
 *
 * Reached through `window.Capacitor.Plugins` rather than by importing `@capacitor/core`, the same
 * stance as `platform.ts`, `roomPlan.ts` and `hsShell.ts`: the web bundle stays free of the native
 * runtime and the browser simply reports the camera absent.
 *
 * ⚑ `addListener` returns its handle SYNCHRONOUSLY on this proxy — proven on device 2026-08-14,
 * and the reason `hsShell.ts` carries the same normalisation. Typed as a promise it type-checks
 * and throws at runtime.
 */

export const HS_CAMERA_JS_NAME = "HSCamera";

/** A mode declares a GOAL. The camera measures the scene and finds settings that reach it. */
export const CAMERA_MODES = ["object", "concern", "text", "document"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export interface CameraCapabilities {
  torch: boolean;
  nearFocus: boolean;
  spotMetering: boolean;
  maxBracketedFrames: number;
  level: boolean;
  textRecognition: boolean;
  unmetAtStart: string[];
}

/** What `setMode` actually achieved — never what was tapped. */
export interface ModeResult {
  mode: CameraMode;
  unmet: string[];
}

export interface TextBox {
  text: string;
  confidence: number;
  /** Normalised, top-left origin — already flipped out of Vision's bottom-left space. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextBoxesEvent {
  boxes: TextBox[];
  /** The camera is STILL and characters are present — the auto-capture trigger.
   *  Not "the same text twice": at the fast recognition level the live read jitters too hard
   *  for that ever to be true, proven on device 2026-08-14. */
  stable: boolean;
  /** ⚑ Characters WERE detected and read badly. Never "no text found". */
  marginal: boolean;
  meanConfidence: number;
  characterCount: number;
  /** Mean frame-to-frame shift as a fraction of frame width. Reported always, acted on rarely. */
  motion: number;
  stillThreshold: number;
}

export interface ModeStatusEvent {
  mode: CameraMode;
  unmet: string[];
  sessionRunning: boolean;
  torchOn: boolean;
  torchOverridden: boolean;
  /** 0 bright … 1 dark, from what the exposure system had to do. Reported always, acted on rarely. */
  lightScore: number;
  /** Torch arms at or above this. */
  underLitThreshold: number;
  /** …and releases only below this. ⚑ The gap is the fix: the torch is inside the loop that
   *  measures whether the torch is needed, so one threshold oscillates on a 5-second timer —
   *  which is what put a flash on one field capture and none on the next 34 seconds later. */
  torchReleaseThreshold: number;
  /** The clockwise rotation, in degrees, that brings the buffer upright. One number drives the
   *  preview, the still and Vision — two tables disagreeing is what shipped the landscape bug. */
  previewRotationAngle: number;
  captureRotationAngle: number;
  thermalState: "nominal" | "fair" | "serious" | "critical" | "unknown";
  battery: { level: number; state: string };
  level?: { pitch: number; roll: number; square: boolean };
  at: string;
}

export interface CaptureFrame {
  path: string;
  bytes: number;
  index: number;
  /** Read back off the written JPEG, never assumed. ⚑ 1 on a portrait shot means the rotation
   *  never reached the photo connection — the 2026-08-15 finding, now self-reporting. */
  exifOrientation: number;
}

export interface CaptureResult {
  frames: CaptureFrame[];
  mode: CameraMode;
  torchUsed: boolean;
  bracketed: boolean;
  /** Document mode only: a page was found and flattened. False means the frame is as shot. */
  deskewed: boolean;
  /** The angle asked of the photo connection, beside each frame's `exifOrientation`. Two numbers
   *  that must agree — printed so they can be seen not to. */
  rotationAngle: number;
  at: string;
  /** Present in text/document modes. ⚑ Nothing stores this — there is no manifest field (#163). */
  ocr?: {
    lines: { text: string; confidence: number }[];
    text: string;
    meanConfidence: number;
    engine: string;
    osVersion: string;
  };
  /** Absent until RoomPlan lands: the declared no-position state, never a fabricated one. */
  pose?: { x: number; y: number; z: number };
}

interface ListenerHandle {
  remove: () => unknown;
}

interface NativeCamera {
  start(options: { mode: CameraMode }): Promise<{ mode: CameraMode; capabilities: CameraCapabilities }>;
  setMode(options: { mode: CameraMode }): Promise<ModeResult>;
  adjust(options: {
    focusPoint?: { x: number; y: number };
    meteringPoint?: { x: number; y: number };
    torchOverride?: boolean;
  }): Promise<void>;
  capture(): Promise<CaptureResult>;
  stop(): Promise<void>;
  addListener(event: "textBoxes" | "modeStatus", handler: (data: never) => void): ListenerHandle | Promise<ListenerHandle>;
}

interface CapacitorGlobal {
  Plugins?: Record<string, unknown>;
  convertFileSrc?: (path: string) => string;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor;
}

function nativeCamera(): NativeCamera | null {
  return (capacitor()?.Plugins?.[HS_CAMERA_JS_NAME] as NativeCamera | undefined) ?? null;
}

/** True only inside the native shell with the camera plugin registered. */
export function cameraAvailable(): boolean {
  return nativeCamera() !== null;
}

/**
 * A native temp-file path made fetchable by the web layer. Frames cross the bridge as paths
 * rather than base64 — three 12 MP frames as a string is tens of megabytes, and the far end
 * wants a Blob regardless.
 */
export function frameUrl(path: string): string {
  const convert = capacitor()?.convertFileSrc;
  return convert ? convert(path) : path;
}

export async function frameBlob(frame: CaptureFrame): Promise<Blob> {
  const response = await fetch(frameUrl(frame.path));
  if (!response.ok) throw new Error(`Could not read the captured frame (${response.status})`);
  return response.blob();
}

const requireCamera = (): NativeCamera => {
  const plugin = nativeCamera();
  if (!plugin) throw new Error("The camera is only available in the native iPad app.");
  return plugin;
};

export const startCamera = (mode: CameraMode) => requireCamera().start({ mode });
export const stopCamera = () => requireCamera().stop();
export const captureFrames = () => requireCamera().capture();

/**
 * Ask for a mode; get back the mode ACHIEVED and what could not be reached.
 *
 * ⚑ Callers must paint from this return, never from the button they just handled. A frame painted
 * from the tap is a silent failure with false reassurance stacked on top, and the failure it
 * guards against is twenty plates shot in the wrong mode — every one of which looks fine.
 */
export const requestMode = (mode: CameraMode) => requireCamera().setMode({ mode });

export const adjustCamera = (options: {
  focusPoint?: { x: number; y: number };
  meteringPoint?: { x: number; y: number };
  torchOverride?: boolean;
}) => requireCamera().adjust(options);

function subscribe<T>(event: "textBoxes" | "modeStatus", handler: (data: T) => void): () => void {
  const plugin = nativeCamera();
  if (!plugin) return () => {};
  let removed = false;
  let pending: Promise<ListenerHandle | null>;
  try {
    pending = Promise.resolve(plugin.addListener(event, handler as (data: never) => void)).catch(() => null);
  } catch {
    return () => {};
  }
  return () => {
    if (removed) return;
    removed = true;
    void pending.then((handle) => handle?.remove()).catch(() => {});
  };
}

export const onTextBoxes = (handler: (event: TextBoxesEvent) => void) => subscribe("textBoxes", handler);
export const onModeStatus = (handler: (event: ModeStatusEvent) => void) => subscribe("modeStatus", handler);

/**
 * What the viewfinder frame colour means. Derived from the ACHIEVED mode and its unmet goals, in
 * one place, so the rule can be tested rather than living inside a component — the same reason
 * `offersVerdict` and `globalCameraApplies` are predicates rather than inline branches.
 *
 * `degraded` is the case the colour exists for: the mode is running but a goal it depends on could
 * not be reached, which is exactly when a photograph still looks fine and is not what was asked
 * for.
 */
export type FrameState = "object" | "concern" | "text" | "document" | "degraded" | "off";

export function frameStateOf(status: { mode: CameraMode; unmet: string[]; sessionRunning: boolean } | null): FrameState {
  if (!status || !status.sessionRunning) return "off";
  // Goals that change what the photograph IS. A missing level bubble is an inconvenience; missing
  // close focus or spot metering on a plate is a different photograph wearing the same label.
  const material = ["closeFocus", "spotMetering", "camera", "configuration"];
  if (status.unmet.some((goal) => material.includes(goal))) return "degraded";
  return status.mode;
}

/**
 * Should this capture prompt a retake?
 *
 * ⚑ Only when characters were detected AND read marginally. Most captures legitimately contain no
 * text — a pipe, a floor stain, a wide shot — so a trigger that fires on "nothing read" nags on
 * the majority case and is ignored by the time a plate needs it.
 */
export function shouldOfferRetake(event: Pick<TextBoxesEvent, "characterCount" | "marginal">): boolean {
  return event.characterCount > 0 && event.marginal;
}
