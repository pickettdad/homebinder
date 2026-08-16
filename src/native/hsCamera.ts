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
  /** ⚑ Rear lenses this device actually has, by Apple's type names. Reported, not used: a wider
   *  view in a tight space needs `builtInUltraWideCamera` — zoom only ever narrows — and whether
   *  this iPad has one is a fact about the model. Choosing a lens is a capture decision and needs
   *  a ruling before it needs code; this is here so the question is answered by a run rather than
   *  by a guess. */
  lenses: string[];
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
  /** ⚑ Whether live recognition ran for this frame at all. False in modes that do not read, where
   *  `characterCount: 0` would otherwise be indistinguishable from *looked and found nothing* —
   *  the ambiguity that let a frozen instrument panel read as a live one. */
  reading: boolean;
  meanConfidence: number;
  characterCount: number;
  /** The motion half of `stable`, on its own, so a shutter that will not fire can be attributed
   *  to stillness or to characters without guessing which. */
  still: boolean;
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
  /** ⚑ The torch is being held off because an unlit companion frame read the plate fine. Without
   *  this the panel shows a torch that is off while the light score says it should be on, and the
   *  two lines read as a contradiction rather than as a decision. */
  companionVetoActive: boolean;
  /** ⚑ Whether `motion` is being sampled at all. False during a traverse, where the frame callback
   *  belongs to the accumulator — and a stale number sitting there unlabelled is exactly what the
   *  2026-08-16 panels showed for nineteen minutes. */
  motionLive: boolean;
  /** The clockwise rotation, in degrees, that brings the buffer upright. One number drives the
   *  preview, the still and Vision — two tables disagreeing is what shipped the landscape bug. */
  previewRotationAngle: number;
  captureRotationAngle: number;
  thermalState: "nominal" | "fair" | "serious" | "critical" | "unknown";
  battery: { level: number; state: string };
  level?: { pitch: number; roll: number; square: boolean };
  at: string;
}

export interface FrameRead {
  lines: { text: string; confidence: number }[];
  text: string;
  meanConfidence: number;
  engine: string;
  osVersion: string;
}

export interface CaptureFrame {
  path: string;
  bytes: number;
  index: number;
  /** Read back off the written JPEG, never assumed. ⚑ 1 on a portrait shot means the rotation
   *  never reached the photo connection — the 2026-08-15 finding, now self-reporting. */
  exifOrientation: number;
  /** Whether the torch was lit for THIS frame. On a torch pair the two differ, which is the
   *  whole point of the pair. */
  torch: boolean;
  /** Per-frame accurate read, in text/document modes. On a pair these are two independent
   *  reads of one plate, and where they disagree is where the glare was. */
  ocr?: FrameRead;
}

/** One adjacent pair in a traverse. ⚑ `contiguity` has THREE values, and that is the design:
 *  `unverified` means the translation model does not describe this pair (the operator walked,
 *  so near content slid faster than far), never that something was missed. A false gap sends
 *  somebody back to a room they already covered, which is worse than saying nothing. */
export interface TraversePair {
  from: number;
  to: number;
  measured: boolean;
  dx?: number;
  dy?: number;
  overlap?: number;
  /** How differently the frame's left and right halves moved — the parallax measure. */
  disparity?: number;
  contiguity: "contiguous" | "gap" | "unverified";
}

export interface TraverseFrame {
  path: string;
  bytes: number;
  index: number;
  exifOrientation: number;
  at: string;
}

export interface TraverseStarted {
  startedAt: string;
  targetTravel: number;
  minimumOverlap: number;
  disparityTolerance: number;
  torchLatched: boolean;
  rotationAngle: number;
  unmet: string[];
}

export interface TraverseResult {
  frames: TraverseFrame[];
  pairs: TraversePair[];
  startedAt: string;
  endedAt: string;
  torchLatched: boolean;
  unmet: string[];
  gaps: number;
  unverified: number;
}

export interface TraverseProgressEvent {
  frames: number;
  pairs: TraversePair[];
  lastPair?: TraversePair | null;
}

export interface CaptureResult {
  frames: CaptureFrame[];
  mode: CameraMode;
  torchUsed: boolean;
  bracketed: boolean;
  /** Document mode only: a page was found and flattened. False means the frame is as shot. */
  deskewed: boolean;
  /** ⚑ The torch fired, so an unlit frame came with it. Fires on the minority of captures. */
  torchPaired: boolean;
  /** How much the lit and unlit reads of one plate agree, 0…1. Present only when a pair was
   *  taken AND both frames produced text — a number computed from one read would be an alarm
   *  on a case with nothing to say. */
  torchPairAgreement?: number;
  /** ⚑ Which two frame indices `torchPairAgreement` came from — the nominal-exposure lit frame and
   *  the unlit companion. Present because the first cut compared frames 0 and 1, which under a
   *  bracket are two LIT frames: they agree closely, so the glare alarm went quiet in the only
   *  mode that can raise it. A surprising number can now be checked against two photographs. */
  torchPairCompared?: [number, number];
  /** Whether the unlit companion read the plate on its own. ⚑ This is what decides the next
   *  arming: if the unlit frame got it, the torch added nothing and does not come back on. */
  companionReadSufficed?: boolean;
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
  startTraverse(): Promise<TraverseStarted>;
  stopTraverse(): Promise<TraverseResult>;
  stop(): Promise<void>;
  addListener(
    event: CameraEvent,
    handler: (data: never) => void,
  ): ListenerHandle | Promise<ListenerHandle>;
}

type CameraEvent = "textBoxes" | "modeStatus" | "traverse";

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

/**
 * The traverse (owner rulings 2026-08-16) — the mechanism, deliberately without a door.
 *
 * ⚑ **Renamed from *pan*, and the rename is a correction rather than a preference.** A pan is a
 * spin about the vertical axis; real rooms are L-shaped and getting round the corner means
 * walking, which gives parallax. A word that says *stand still and spin* produces concierges who
 * stand still and spin, in rooms that cannot be covered that way. The rule is **never break
 * contact** — rotate, walk, turn a corner — and the only question per adjacent pair is whether
 * the two frames share content.
 */
export const startTraverse = () => requireCamera().startTraverse();
export const stopTraverse = () => requireCamera().stopTraverse();

function subscribe<T>(event: CameraEvent, handler: (data: T) => void): () => void {
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
export const onTraverse = (handler: (event: TraverseProgressEvent) => void) => subscribe("traverse", handler);

/**
 * What a finished traverse amounts to.
 *
 * ⚑ **`unverified` never reads as `gaps`.** The binder's question is *is there a gap here*, and
 * the honest answers are yes, no, and *this mechanism cannot say* — the last being what a walked
 * corner produces. Collapsing the third into the first is the false alarm the owner ruled worse
 * than no flag at all, in the one place it costs a return visit.
 *
 * A predicate rather than a branch in the component, for the reason `frameStateOf` and
 * `globalCameraApplies` are: this is the rule, and a rule inside a component cannot be tested.
 */
export type TraverseVerdict = "empty" | "contiguous" | "gaps" | "unverified";

export function traverseVerdict(result: Pick<TraverseResult, "pairs">): TraverseVerdict {
  if (result.pairs.length === 0) return "empty";
  const gaps = result.pairs.filter((p) => p.contiguity === "gap").length;
  const unverified = result.pairs.filter((p) => p.contiguity === "unverified").length;
  /*
   ⚑ **A run whose pairs were mostly unverifiable does not get to headline `gaps`.**

   The first cut returned `gaps` on a single gap at any count. The 2026-08-16 L-walk is what it
   costs: **15 pairs — 1 gap, 13 unverified, 1 contiguous — reported as `gaps`.** One word, stated
   with confidence, on a run where the mechanism could not describe thirteen of the fifteen pairs
   it was asked about.

   That is this project's named diagnostic failure exactly — *a diagnostic decides whether there
   is anything to say before it says what* — and here it lands on the false alarm the owner ruled
   worse than no flag at all, because a concierge reading `gaps` walks the room again.

   So the verdict answers **can this mechanism describe the run** first. When most pairs came back
   unverified it cannot, and the run is `unverified`. ⚑ *The gap count is not hidden by this* — it
   is printed beside the verdict either way, so nothing is lost except a claim that was not
   earned.
  */
  if (unverified > gaps + result.pairs.filter((p) => p.contiguity === "contiguous").length) {
    return "unverified";
  }
  if (gaps > 0) return "gaps";
  if (unverified > 0) return "unverified";
  return "contiguous";
}

/**
 * What a frame IS, not where it sits in the array.
 *
 * "no torch" answers the question the reviewer is asking; "frame 2" answers a different one that
 * nobody has. On a torch pair the label is the whole reason the second frame exists.
 *
 * ⚑ **The two facts compose; they used to short-circuit.** `torchPaired` returned first, so when a
 * capture was BOTH bracketed and paired — which is text mode, the only mode that declares either —
 * three exposures a stop apart all came back labelled `torch`.
 *
 * It cost evidence on the run that found it. The owner sent four frames from one job on
 * 2026-08-16 and three arrived as `hs-text-…-torch.jpg`, `…torch 2`, `…torch 3`, kept apart only
 * by Google Drive's duplicate-name suffix. Measured afterwards they were a −1/0/+1 bracket, and
 * which was which is no longer recoverable from the files.
 *
 * *A label that says what a frame IS has to carry everything that distinguishes it from the frame
 * beside it, or it has not done the job the ordinal was rejected for.* Lives here rather than in
 * the reviewer for the same reason `traverseVerdict` does: a rule inside a component cannot be
 * tested, and this one is load-bearing for the filename a frame leaves the device under.
 */
export function frameLabel(
  shot: Pick<CaptureResult, "frames" | "torchPaired" | "bracketed">,
  index: number,
): string {
  const frame = shot.frames[index];
  if (!frame) return `frame ${index + 1}`;

  if (shot.torchPaired && !frame.torch) return "no torch";

  // Bracket biases are [−1, 0, +1] and the companion is appended after them, so the EV names line
  // up with the leading indices whether or not a pair followed.
  const ev = shot.bracketed ? ["−1 EV", "0 EV", "+1 EV"][index] : undefined;
  if (shot.torchPaired) return ev ? `torch · ${ev}` : "torch";
  return ev ?? `frame ${index + 1}`;
}

/** Below this the lit and unlit reads of one plate disagree enough to say so. A clean pair on a
 *  matte plate agrees almost exactly; glare is what pulls it down. */
export const GLARE_AGREEMENT_FLOOR = 0.9;

/**
 * Did the torch cost us characters?
 *
 * ⚑ Gated on a pair having been taken and both frames having produced text. Without that gate
 * this would answer on captures where nothing was compared — an alarm on the majority case,
 * which is the failure class this file already carries two other guards against.
 */
export function glareSuspected(
  result: Pick<CaptureResult, "torchPaired" | "torchPairAgreement">,
): boolean {
  return result.torchPaired && result.torchPairAgreement !== undefined
    && result.torchPairAgreement < GLARE_AGREEMENT_FLOOR;
}

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
