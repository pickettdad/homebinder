/**
 * The capture camera bridge (F-26).
 *
 * Reached through `window.Capacitor.Plugins` rather than by importing `@capacitor/core`, the same
 * stance as `platform.ts` and `hsShell.ts`: the web bundle stays free of the native
 * runtime and the browser simply reports the camera absent.
 *
 * ⚑ `addListener` returns its handle SYNCHRONOUSLY on this proxy — proven on device 2026-08-14,
 * and the reason `hsShell.ts` carries the same normalisation. Typed as a promise it type-checks
 * and throws at runtime.
 */

import type { BenchSample } from "../dev/deviceBench";
import type { ZoneMode, ZoneOpened, ZonePlan, ZonePosition } from "./zone";

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

/**
 * Which piece of glass, named for what the concierge sees.
 *
 * ⚑ Deliberately NOT Apple's vocabulary: Apple's `builtInWideAngleCamera` is the *normal* lens, and
 * the owner uses "wide" to mean *wider than normal*. Carrying both meanings of one word across a
 * bridge is a collision waiting to ship.
 */
export const CAMERA_LENSES = ["normal", "wide"] as const;
export type CameraLens = (typeof CAMERA_LENSES)[number];

/** What `setLens` achieved — never what was asked. Text refuses wide, not every iPad has an
 *  ultra-wide, and a traverse will not swap mid-run. */
export interface LensResult {
  mode: CameraMode;
  lens: CameraLens;
  unmet: string[];
}

/**
 * The default lens for a mode, and whether the concierge may change it (owner ruling 2026-08-16).
 *
 * ⚑ **The concierge chooses; the mode sets the default.** The design session argued the app should
 * decide, because a mode declares a goal and a lens is a setting. The owner overturned it, and the
 * reason is the one that governs everything a concierge is asked to judge: *the lens is a
 * substitute for stepping backwards, and in a tight mechanical room you often cannot step
 * backwards.* "Does the whole thing fit in the picture" needs no knowledge of what the thing is.
 *
 * Text is the single refusal — edge distortion on characters buys nothing and costs reads.
 *
 * A predicate rather than a branch in the component, for the same reason `traverseVerdict` and
 * `frameLabel` are: this is the rule, and a rule inside a component cannot be tested.
 */
export function lensPolicyFor(
  mode: CameraMode,
  intent?: LensIntent,
): { default: CameraLens; locked: boolean } {
  // The refusal wins over any intent: a plate is a plate whatever door was used to reach it.
  if (mode === "text" || mode === "document") return { default: "normal", locked: true };
  // ⚑ Room shot and traverse default wide — both are "get the whole of it in", which is the exact
  // job the lens does. Run trace is NOT in the ruling and so is not assumed into it; it follows a
  // pipe rather than framing a room, and the concierge can still choose.
  if (intent === "room-shot" || intent === "traverse") return { default: "wide", locked: false };
  return { default: "normal", locked: false };
}

/** The capture doors whose framing job differs enough to change the lens default. */
export type LensIntent = "room-shot" | "run-trace" | "traverse";

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
  /** ⚑ What `lightScore` is made of. `isoLoad` measures ISO against *this format's ceiling*, so a
   *  sensor with a very high maximum reads a genuinely dim room as only mildly dark — which is the
   *  candidate explanation for a torch that will not arm in a mechanical room. Reported so the
   *  threshold can be judged against numbers rather than argued about. */
  iso: number;
  isoMax: number;
  isoMin: number;
  exposureMs: number;
  /** The glass actually in the session. */
  lens: CameraLens;
  /** ⚑ This mode refuses the choice — Text does, because a 120° lens bends straight lines near the
   *  frame edge and a plate shot there reads worse, not wider. Distinct from "wide is off": the UI
   *  has to say *not allowed here* rather than offer a control that silently does nothing. */
  lensLocked: boolean;
  /** Whether this iPad has an ultra-wide at all. */
  lensAvailable: boolean;
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
  /** ⚑ WHICH kind of "cannot say" — one word used to cover all of these, and the counts could not
   *  tell them apart. `implausibleShift`: the whole-frame registration returned a displacement the
   *  trigger says is impossible. `crossCheck`: the accumulator's path and the pair's displacement
   *  disagree. `impossiblyStill`: travelled a full target and the pair claims nothing moved.
   *  `unregistered`: Vision could not align the pair at all. `disparity` is retired — the
   *  half-split no longer decides anything (see `measureOverlap`). */
  reason?:
    | "unregistered"
    | "impossiblyStill"
    | "disparity"
    | "implausibleShift"
    | "crossCheck"
    | "flowStill"
    | "tooLittleTexture";
  /** ⚑ Steps that failed to register behind this pair. Invisible to the accumulator's travel sum,
   *  so a run can under-count by exactly the amount it could not see. The other half of the corner
   *  discriminator — `maxStep` only sees the steps that succeeded. */
  droppedSteps?: number;
  /** ⚑ How much there is to see in each frame of the pair, measured on ONE frame at a time.
   *  Every measure that has failed here was a correlation between two frames, and correlation with
   *  nothing to correlate returns confident nonsense — four times, in three mechanisms. Texture has
   *  no partner to be fooled about. Blank-first calibration: covered lens 1.8, blurred carry 4.1,
   *  real frames 10.6-21.0. */
  textureFrom?: number;
  textureTo?: number;
  /** Median flow magnitude as a fraction of frame width, and its 90th percentile. */
  flowMedian?: number;
  flowP90?: number;
  /** ⚑ How consistently the flow field points one way, 0..1. Proposed as the partner to texture,
   *  tested blank-first, and NOT adopted: a covered lens reads 0.995 — as coherent as a clean
   *  sweep — because coherence is derived from the flow field, which is derived from correlating
   *  two frames, so it inherits the failure it was proposed to escape. Recorded, never gated. */
  flowConsistency?: number;
  /** ⚑ How different the two frames' CONTENT is, by a learned descriptor rather than a pixel
   *  correlation — the first measure here that asks whether this is the same place. Same wall
   *  0.31-0.57, different walls 0.86-1.28. Recorded and NOT gated: a dim pair that genuinely shares
   *  content reads 0.873, above two genuinely different frames at 0.726, so the sample overlaps.
   *  And two covered-lens frames read 0.202 — "the same place" — so it can never gate alone. */
  placeDistance?: number;
  /** ⚑ Whether the translation-era plausibility bound would have rejected this pair. It no longer
   *  decides: it rejects using the measurement flow replaced, before flow is consulted, and on
   *  2026-08-19 it was the main source of "cannot say" on good walks — 8 of 16 and 11 of 19. */
  implausibleShift?: boolean;
  /** ⚑ The share of the frame that landed inside its neighbour, measured by optical flow — the
   *  verdict since `flow-v1`. Every earlier mechanism fitted a global 2D transform to the pair and
   *  the frames refute that premise: a 120° lens, a room with depth and a walk partly toward it
   *  produce pairs no similarity or homography describes. Flow assumes nothing global and answers
   *  the question actually being asked, which is how much of this was already seen. */
  covered?: number;
  /** ⚑ Vision's homography scale between the pair, RECORDED AND NOT ACTED ON. The powder room
   *  settled that motion toward a subject is the traverse's problem rather than the corner's, so a
   *  registration carrying scale is the known fix — this is the evidence needed to build it without
   *  guessing, because it cannot be validated from screenshots. `homographyScaleX` and `…Y` are
   *  kept apart because a similarity has ONE scale and a homography that has drifted into
   *  perspective does not: the gap between them says whether the fit is trustworthy. */
  homographyScale?: number;
  homographyScaleX?: number;
  homographyScaleY?: number;
  homographyTx?: number;
  homographyTy?: number;
  /** ⚑ Largest single accumulator step behind this pair. The corner discriminator: small steps
   *  mean the accumulator was tracking and the pair mis-registered; large steps mean it was losing
   *  ground and the pair's big displacement is real — which would make some of these honest gaps
   *  rather than "cannot say". Recorded, not acted on. */
  maxStep?: number;
  /** ⚑ The trust check that now decides: how far the accumulator's path length sits from the
   *  pair's own displacement. Two independent measurements of one travel, both whole-frame. */
  crossCheck?: number;
  /** ⚑ The two components apart, because they are not the same quantity: `x` is a fraction of
   *  frame WIDTH, `y` a fraction of frame HEIGHT. If the failure is nearly all `y`, the tolerance
   *  is being spent on vertical registration noise between two half-frames. */
  disparityX?: number;
  disparityY?: number;
  /** The raw half-shifts. The *shape* of the disagreement is the discriminator: a systematic
   *  optical effect scales the halves, parallax offsets them. */
  leftDx?: number;
  leftDy?: number;
  rightDx?: number;
  rightDy?: number;
  expectedTravel?: number;
  displacement?: number;
  /** ⚑ How far the worse half's translation sits from the whole frame's. Parallax nudges a half
   *  away from the whole; it cannot send it a third of a frame away at any depth a room contains,
   *  so a large value here is a failed registration reporting itself as a measurement. */
  halfVsWhole?: number;
}

/**
 * What a traverse's own numbers say about why it could not describe itself.
 *
 * ⚑ **`dominant` is null whenever the data does not indicate a cause**, and that is the whole
 * design. Two runs on 2026-08-16 came back 87% and 86% unverified at two different frame spacings,
 * which refutes the reason the spacing was changed and leaves several candidates the counts cannot
 * separate. An attribution printed on ambiguous data would be this project's named alarm failure —
 * *a diagnostic decides whether there is anything to say before it says what* — landing on the one
 * question where a confident wrong answer costs another wasted round.
 *
 * So the numbers are always computed and the attribution is gated behind a real separation.
 */
export interface TraverseDiagnosis {
  pairs: number;
  measured: number;
  /** ⚑ The check that decides. Listed first because the panel must lead with what the verdict
   *  turned on — leading with `disparity`, which no longer gates, made a clean run read as broken. */
  /** ⚑ Median content distance between adjacent frames. Same place, 61 pairs across three
   *  lighting conditions: 0.27-0.70. Different place, 5 hand-measured pairs: 0.73-1.28. The margin
   *  at the boundary is 0.027, so it is shown and not acted on. */
  medianPlaceDistance: number | null;
  medianCrossCheck: number | null;
  medianDisparity: number | null;
  medianDisparityX: number | null;
  medianDisparityY: number | null;
  reasons: {
    unregistered: number;
    impossiblyStill: number;
    disparity: number;
    implausibleShift: number;
    crossCheck: number;
    flowStill: number;
    tooLittleTexture: number;
  };
  /** Which axis is spending the tolerance — `null` when neither dominates. */
  dominant: "vertical" | "horizontal" | null;
}

/** How much one axis must exceed the other before the difference is called a finding rather than
 *  noise. Two-to-one: below that, both axes are contributing and naming one would be a guess. */
export const DISPARITY_DOMINANCE_RATIO = 2;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * Frames taken with the iPad turned away from the angle their file claims.
 *
 * ⚑ **The record and the device disagreed for a fortnight and nothing said so.** A traverse fixes
 * the capture connection's rotation at `startTraverse` — correctly, because re-rotating mid-leg
 * would make the pairs either side of a turn incomparable — and every frame is then stamped with
 * that one angle. On the 2026-08-19 clean-gap walk all seventy frames read `exifOrientation: 6`,
 * including the fifty taken with the iPad carried at the owner's side.
 *
 * The fix is not to reconcile them. It is to stop the record asserting a frozen value as though it
 * were observed, and to name the frames where the two part company — the same move as
 * {@link framesNeedingEyes}: a person settles in seconds what the arithmetic should not guess at.
 *
 * Compared against the leg's OPENING angle rather than a stored constant, because that is the angle
 * the connection was actually frozen to. A quarter turn is the threshold because that is the point
 * at which a stamped orientation puts a different edge of the picture at the top; smaller wobbles
 * are the concierge's hands and mean nothing.
 *
 * Legs recorded before `deviceRotationAngle` shipped carry no angles and report nothing, which is
 * correct: absent is not the same as agreeing.
 */
export function framesTurnedFromStamp(result: Pick<TraverseResult, "frames">): number[] {
  const opening = result.frames.find((f) => typeof f.deviceRotationAngle === "number");
  if (!opening) return [];
  const base = opening.deviceRotationAngle as number;
  return result.frames
    .filter((f) => {
      if (typeof f.deviceRotationAngle !== "number") return false;
      // Shortest way round the circle: 350° and 10° are twenty degrees apart, not three hundred.
      const raw = Math.abs(f.deviceRotationAngle - base) % 360;
      return Math.min(raw, 360 - raw) >= 90;
    })
    .map((f) => f.index);
}

/**
 * The frames a person should look at, because arithmetic cannot settle what they answer.
 *
 * ⚑ **A rejected pair raises two different questions and this mechanism can only answer one.**
 * `implausibleShift` says *this measurement is wrong* — and the 2026-08-17 walks back that up, with
 * `maxStep` on rejected pairs at 0.010–0.026 against 0.013–0.034 on pairs that passed, so the
 * accumulator was tracking while the pair claimed to have moved a whole frame width.
 *
 * It does **not** say whether anything in the room was missed. Those pairs report overlaps of
 * 0.083–0.115, and if the reading is wrong then the true overlap is simply unknown — which is
 * exactly the question a concierge answers in five seconds by looking at two photographs.
 *
 * So the frames are named. The alternative is arguing from numbers about something the owner can
 * see, in the one corner of the room where he is closest to an object and most likely to have
 * broken contact.
 */
export function framesNeedingEyes(result: Pick<TraverseResult, "pairs">): number[] {
  const indices = new Set<number>();
  for (const pair of result.pairs) {
    // Only the pairs whose *measurement* is in doubt. A crossCheck disagreement is a smaller
    // claim and a genuine gap is already reported as one — neither needs a person.
    if (pair.reason !== "implausibleShift") continue;
    indices.add(pair.from);
    indices.add(pair.to);
  }
  return [...indices].sort((a, b) => a - b);
}

export function traverseDiagnosis(result: Pick<TraverseResult, "pairs">): TraverseDiagnosis {
  const pairs = result.pairs;
  const measured = pairs.filter((p) => p.measured);
  const pick = (key: "disparity" | "disparityX" | "disparityY") =>
    median(measured.map((p) => p[key]).filter((v): v is number => typeof v === "number"));

  const medianDisparityX = pick("disparityX");
  const medianDisparityY = pick("disparityY");

  let dominant: TraverseDiagnosis["dominant"] = null;
  if (medianDisparityX !== null && medianDisparityY !== null) {
    if (medianDisparityY > medianDisparityX * DISPARITY_DOMINANCE_RATIO) dominant = "vertical";
    else if (medianDisparityX > medianDisparityY * DISPARITY_DOMINANCE_RATIO) dominant = "horizontal";
  }

  return {
    pairs: pairs.length,
    measured: measured.length,
    medianPlaceDistance: median(
      measured.map((p) => p.placeDistance).filter((v): v is number => typeof v === "number"),
    ),
    medianCrossCheck: median(
      measured.map((p) => p.crossCheck).filter((v): v is number => typeof v === "number"),
    ),
    medianDisparity: pick("disparity"),
    medianDisparityX,
    medianDisparityY,
    reasons: {
      unregistered: pairs.filter((p) => p.reason === "unregistered").length,
      impossiblyStill: pairs.filter((p) => p.reason === "impossiblyStill").length,
      disparity: pairs.filter((p) => p.reason === "disparity").length,
      implausibleShift: pairs.filter((p) => p.reason === "implausibleShift").length,
      crossCheck: pairs.filter((p) => p.reason === "crossCheck").length,
      flowStill: pairs.filter((p) => p.reason === "flowStill").length,
      tooLittleTexture: pairs.filter((p) => p.reason === "tooLittleTexture").length,
    },
    dominant,
  };
}

export interface TraverseFrame {
  path: string;
  bytes: number;
  index: number;
  /** What the FILE claims, stamped once from the connection's rotation at `startTraverse`. */
  exifOrientation: number;
  /** ⚑ Variance of the Laplacian on this frame — the one instrument in the traverse that is a
   *  property of a SINGLE frame and so cannot be fooled by having nothing to compare against.
   *  Recorded per frame so the keep threshold can be chosen from a distribution across walks
   *  rather than fitted to one. Absent on legs recorded before this shipped. */
  texture?: number;
  /** ⚑ How the iPad was actually held when this frame was requested, which is not the same thing.
   *  On the 2026-08-19 clean-gap walk all 70 frames read `exifOrientation: 6` while fifty of them
   *  were taken with the iPad carried at the owner's side. The frozen value stays — re-rotating
   *  mid-leg would make the pairs either side of a turn incomparable — but the record no longer
   *  asserts it as an observation. Absent on legs recorded before this shipped. */
  deviceRotationAngle?: number;
  at: string;
}

/** ⚑ What the room afforded and what was taken, metered once per leg.
 *
 *  Recorded because the one number the shutter costing could not settle from banked frames is
 *  where noise becomes unacceptable — and a value that is computed but unreachable cannot settle
 *  it. `underExposed` is the room refusing the floor: the frame is darker than metered, which is
 *  the trade the 1/30 floor makes deliberately, because a dark frame is recoverable and a smeared
 *  one is not. Absent on legs recorded before this shipped. */
export interface TraverseExposure {
  /** Reciprocal seconds — 15 means 1/15 s. What the auto-exposure had settled on. */
  meteredShutter: number;
  meteredISO: number;
  /** Reciprocal seconds. What the leg was actually locked to. */
  shutter: number;
  iso: number;
  isoCeiling: number;
  formatMaxISO: number;
  underExposed: boolean;
}

export interface TraverseStarted {
  startedAt: string;
  /** ⚑ Which registration model produced every number in this run. `overlap`, `displacement`,
   *  `crossCheck` and the plausibility gate are all defined against the translation-only model —
   *  a reader with no way to tell which model produced a number cannot compare two runs. Same
   *  reasoning as `engine` on an OCR read. */
  registration: string;
  /** The leg this run declares itself a continuation of. ⚑ A statement about the concierge's
   *  hands, never about coverage — *I chose to stop here*, not *nothing was missed*. */
  continuesFrom?: string | null;
  targetTravel: number;
  minimumOverlap: number;
  disparityTolerance: number;
  torchLatched: boolean;
  rotationAngle: number;
  unmet: string[];
}

export interface TraverseResult {
  registration: string;
  continuesFrom?: string | null;
  frames: TraverseFrame[];
  pairs: TraversePair[];
  startedAt: string;
  endedAt: string;
  torchLatched: boolean;
  unmet: string[];
  gaps: number;
  unverified: number;
  exposure?: TraverseExposure;
  /** ⚑ Frames captured and deliberately not filed, because the concierge was walking rather than
   *  sweeping and the frames were noise in the binder's input. Counted rather than silent: a leg
   *  that drops half of what it took must say so, or `frames.length` reads as everything it saw.
   *  A hole in `frames[].index` is where one was. */
  discarded?: number;
  discardedTexture?: number[];
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
  /** ⚑ Which glass took this capture (owner ruling 2026-08-16). *A missing object means something
   *  different at 65° than at 120°* — a desk asking "why is the water heater in none of these"
   *  needs to know whether the wide view was in use and it still did not fit, or the concierge was
   *  on normal and could not step back far enough. Without this the two are indistinguishable. */
  lens: CameraLens;
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
  /** ⚑ **The declared no-position state, never a fabricated one — and now it can be filled.**
   *
   *  A capture taken inside an open, running zone session carries the measured pose of the frame
   *  it was taken with. A capture taken while the session is paused, or before a zone was entered,
   *  or while tracking had not settled, carries the REFUSAL instead — `{positioned: false, why}` —
   *  rather than nothing at all.
   *
   *  ⛑ The difference matters more than it looks: an absent field says *this build could not do
   *  positions*, and a refusal says *this one could and did not, here is why*. A container the desk
   *  cannot place is otherwise indistinguishable from one nobody meant to place. */
  position?: ZonePosition;
}

interface ListenerHandle {
  remove: () => unknown;
}

interface NativeCamera {
  start(options: { mode: CameraMode }): Promise<{ mode: CameraMode; capabilities: CameraCapabilities }>;
  setMode(options: { mode: CameraMode }): Promise<ModeResult>;
  setLens(options: { lens: CameraLens }): Promise<LensResult>;
  startAudioProbe(): Promise<AudioProbeStarted>;
  stopAudioProbe(): Promise<AudioProbeResult>;
  adjust(options: {
    focusPoint?: { x: number; y: number };
    meteringPoint?: { x: number; y: number };
    torchOverride?: boolean;
  }): Promise<void>;
  capture(): Promise<CaptureResult>;
  startTraverse(options: { continuesFrom?: string }): Promise<TraverseStarted>;
  stopTraverse(): Promise<TraverseResult>;
  /** The device bench — see `src/dev/deviceBench.ts`. Dev-bench only; it takes the camera to
   *  itself for the length of a run and refuses while a capture session is live. */
  startBench(options: {
    mode: string;
    capSeconds?: number;
    sampleSeconds?: number;
    coolSeconds?: number;
    conditions?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  stopBench(): Promise<unknown>;
  closeBenchLoop(): Promise<{ closed: boolean; driftMetres?: number; why?: string }>;
  /** The zone session — see `src/native/zone.ts`. Three bounded modes, one coordinate space. */
  openZone(options: { zoneId?: string }): Promise<ZoneOpened>;
  closeZone(): Promise<unknown>;
  setZoneMode(options: { mode: ZoneMode }): Promise<{ mode: ZoneMode; unmet: string[] }>;
  pauseZone(): Promise<{ paused: boolean }>;
  resumeZone(): Promise<{ paused: boolean }>;
  takePosition(): Promise<ZonePosition>;
  startRoomPlan(): Promise<{ started: boolean; why?: string }>;
  stopRoomPlan(): Promise<ZonePlan>;
  zoneLog(): Promise<{ entries: Record<string, unknown>[]; count: number; wrapped: boolean }>;
  stop(): Promise<void>;
  addListener(
    event: CameraEvent,
    handler: (data: never) => void,
  ): ListenerHandle | Promise<ListenerHandle>;
}

type CameraEvent = "textBoxes" | "modeStatus" | "traverse" | "benchSample" | "zone";

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

/** Ask for a lens; get back the one ACHIEVED. Same contract as `requestMode`, and the caller must
 *  paint from this return — a control painted from the tap claims a field of view the photograph
 *  does not have. */
export const requestLens = (lens: CameraLens) => requireCamera().setLens({ lens });

/**
 * The shutter-sound probe — a measurement, not a feature.
 *
 * ⚑ Whether the camera's shutter click lands inside a live recording decides the shape of the run
 * trace, and it is a **device fact**: it varies by region, by iOS version and by whether an audio
 * session is active, so it cannot be settled by reading documentation. Record, take a capture,
 * stop, then listen. Nothing in the concierge's path calls this.
 */
export interface AudioProbeStarted {
  path: string;
  startedAt: string;
  category: string;
  /** ⚑ If another app owns the audio session, "no click" proves nothing about the click. */
  otherAudioPlaying: boolean;
}

export interface AudioProbeResult {
  path: string;
  bytes: number;
  endedAt: string;
}

export const startAudioProbe = () => requireCamera().startAudioProbe();
export const stopAudioProbe = () => requireCamera().stopAudioProbe();

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
/**
 * Start a traverse, optionally declaring it the continuation of a leg just ended.
 *
 * ⚑ **A declared break is a recorded act, and that is why it does not weaken *never break
 * contact*.** The rule's failure mode was an invisible one — a concierge who stopped and started
 * again left nothing behind saying so, and the desk read two runs it could not relate. Declaring
 * the break makes the discontinuity **observable**, which is strictly more honest than a rule
 * quietly violated.
 *
 * ⚑ And explicitly NOT the corner fix. The corner is motion toward a subject and it occurs in any
 * tight space — the powder-room walk scores the same as the corner with no corner in it. If pause
 * became the answer to that, a concierge would pause constantly and the one continuous act would
 * dissolve into a series of stills. This is for the breaks that are genuinely necessary: a doorway,
 * an obstacle, a person in the way.
 */
export const startTraverse = (continuesFrom?: string) =>
  requireCamera().startTraverse(continuesFrom ? { continuesFrom } : {});
export const stopTraverse = () => requireCamera().stopTraverse();

/** The device bench. See `src/dev/deviceBench.ts` for what the numbers are allowed to claim. */
export const startBench = (options: {
  mode: string;
  capSeconds?: number;
  sampleSeconds?: number;
  coolSeconds?: number;
  conditions?: Record<string, unknown>;
}) => requireCamera().startBench(options);
export const stopBench = () => requireCamera().stopBench();
export const closeBenchLoop = () => requireCamera().closeBenchLoop();

/** The zone session. `takePosition` REFUSES rather than guessing — see `src/native/zone.ts`. */
export const openZone = (zoneId?: string) => requireCamera().openZone(zoneId ? { zoneId } : {});
export const closeZone = () => requireCamera().closeZone();
export const setZoneMode = (mode: ZoneMode) => requireCamera().setZoneMode({ mode });
export const pauseZone = () => requireCamera().pauseZone();
export const resumeZone = () => requireCamera().resumeZone();
export const takePosition = () => requireCamera().takePosition();
export const startRoomPlan = () => requireCamera().startRoomPlan();
export const stopRoomPlan = () => requireCamera().stopRoomPlan();
/** ⚑ The zone session's own record of what it did. Survives an untethered walk, which the console
 *  did not — twice, the second time costing a walk. */
export const zoneLog = () => requireCamera().zoneLog();

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
/** ⚑ Streamed rather than only returned at the end: a forty-minute run that is invisible until it
 *  finishes cannot be seen to have stalled, and a stalled run is the failure the bench exists to
 *  make impossible to mistake for a cool one. */
export const onBenchSample = (handler: (event: BenchSample) => void) => subscribe("benchSample", handler);
/** Tracking-state changes, map saves and session errors, as they happen. ⚑ Tracking is streamed
 *  rather than polled because *can I anchor this container* has to be answerable BEFORE the
 *  shutter — afterwards it is a fact about a photograph nobody can retake. */
export const onZone = (handler: (event: Record<string, unknown>) => void) => subscribe("zone", handler);

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

/**
 * What a FILED frame is, read off the record rather than off this session.
 *
 * ⚑ The sibling of `frameLabel`, which names frames still in hand. This one names frames that have
 * been stored, and it exists because the stored viewer could not tell one from another — it showed
 * the first and asserted the rest were not kept, which stopped being true the moment siblings
 * shipped.
 *
 * Names what the role means to a person, not the role word: *no torch* and *−1 EV* answer the
 * question a reviewer is asking, and "evidence" answers a question about our own bookkeeping.
 */
export function storedFrameLabel(
  frame: { frame?: { role: "primary" | "evidence" | "insurance"; torch?: boolean; ev?: number } },
  index?: number,
): string {
  const meta = frame.frame;
  if (typeof meta?.ev === "number") {
    const ev = meta.ev > 0 ? `+${meta.ev} EV` : meta.ev < 0 ? `−${Math.abs(meta.ev)} EV` : "0 EV";
    return meta.torch === false ? `no torch · ${ev}` : ev;
  }
  if (meta?.torch === false) return "no torch";
  /*
   ⚑ **The ordinal, and only here.** `frameLabel` rejects it — "frame 2" answers a question nobody
   has about a bracket, where what distinguishes the frames is exposure and torch.

   A traverse is the opposite case: its frames differ by **position along the walk**, which the
   ordinal is exactly. And the panel names pairs by index — *look at frames 3, 4* — so without it
   nineteen buttons all read "frame" and the instruction cannot be followed. That is what the owner
   saw. The ordinal is not a fallback here; it is the answer.
  */
  if (typeof index === "number") return `${index + 1}`;
  return meta?.role === "primary" ? "kept" : "frame";
}
