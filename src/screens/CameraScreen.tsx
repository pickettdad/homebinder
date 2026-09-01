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
import { MediaThumb } from "./v2/shared";
import type { MediaRef } from "../engine/v2/fold";
import { db } from "../storage/db";
import type { FrameReadMeta, FrameRoleMeta, CapturePositionMeta } from "../engine/schema/events";
import type { CaptureIntent } from "../engine/v2/events";
import {
  captureTargetFor,
  containerAfterZoneChange,
  stripModel,
  tapContainer,
  type OpenContainer,
} from "../capture/objectContainer";
import { useVoiceRecorder } from "../capture/useVoiceRecorder";
import { ZoneStrip } from "./ZoneStrip";
import { FloorPlanView } from "./FloorPlanView";
import { zoneMeasures } from "../native/zone";
import { bothUnits } from "../native/planGeometry";
import type { ZoneMode, ZonePlan, ZonePosition } from "../native/zone";
import {
  adjustCamera,
  cameraAvailable,
  captureFrames,
  captureWantsRetake,
  positionForSibling,
  projectionFor,
  frameBlob,
  frameLabel,
  frameStateOf,
  frameUrl,
  glareSuspected,
  lensPolicyFor,
  requestLens,
  startAudioProbe,
  stopAudioProbe,
  framesNeedingEyes,
  framesTurnedFromStamp,
  takePosition,
  openZone,
  closeZone,
  onZone,
  pauseZone,
  resumeZone,
  startRoomPlan,
  stopRoomPlan,
  zoneLog,
  setZoneMode as setZoneModeNative,
  storedFrameLabel,
  traverseDiagnosis,
  traverseVerdict,
  type AudioProbeResult,
  type AudioProbeStarted,
  type CameraLens,
  type LensIntent,
  onModeStatus,
  onTextBoxes,
  onTraverse,
  requestMode,
  startCamera,
  startTraverse,
  stopCamera,
  stopTraverse,
  type CameraCapabilities,
  type CameraMode,
  type CaptureResult,
  type FrameState,
  type ModeStatusEvent,
  type TextBoxesEvent,
  type TraverseProgressEvent,
  type TraverseResult,
} from "../native/hsCamera";

const MODE_BUTTONS: { mode: CameraMode; glyph: string; hint: string }[] = [
  { mode: "object", glyph: "◉", hint: "Object" },
  { mode: "concern", glyph: "⚠", hint: "Concern" },
  { mode: "text", glyph: "🔍", hint: "Text" },
  { mode: "document", glyph: "▤", hint: "Document" },
];

/** Actions are drawn as a separate row: a mode stays until changed, an action starts a thing. */
/*
 ⚑ **Run trace is gone from here, by owner ruling (2026-08-17), and removal is the fix rather than
 a rename.**

 *A run trace is continuous by definition, and a single photograph of a pipe is an object shot
 wearing a misleading label.* This button took one still and called it a trace — so the record
 would have carried a declared capture kind whose defining property the artifact did not have,
 which is worse than not declaring it at all: the desk would trust the label.

 The video control on the zone screen stands, marked superseded-in-principle rather than retired.
 It exists because nothing could read a sequence of photographs; the traverse can now read frames
 in order with overlap recorded, which is what the video stood in for. But **the traverse cannot
 yet trace a run end to end**, so the thing that can do the job today keeps doing it. It goes when
 the traverse can — after scale-aware registration, not before.
*/
/**
 * ⛑ **Empty on purpose, and the room shot is why** (owner ruling 2026-08-21).
 *
 * A room shot happens **once, at the start of a zone**. This screen is the one doing the repetitive
 * work — object after object, plate after plate — and a door that fires once per room sitting in the
 * row you hit forty times is clutter in the place clutter costs most.
 *
 * ⚑ It moved to the zone screen, and it arrives here anyway: that screen opens the viewfinder with
 * `startAction: "room-shot"`, because the room shot is a sibling pair whose 1× frame carries a
 * measured position — so it has to fire where the camera and the session already are. **The door
 * moved; the act did not.**
 *
 * Kept as a list rather than deleted: the next action that belongs on this row has somewhere to go.
 */
const ACTIONS: { id: string; glyph: string; hint: string; mode: CameraMode }[] = [];

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

/**
 * ⚑ **Container state, marked where the concierge is already looking.**
 *
 * Being inside a container without realising it is silent: twenty shots filed into the wrong
 * object look exactly like twenty filed correctly, and nothing downstream can tell. This is the
 * mode-colour failure wearing different clothes and it takes the same answer — mark it in the
 * frame. A strip you have to look away from to read is the small icon that rule already rejects.
 *
 * ⚑ **It does not touch the mode ring, and that is the point.** The mode ring already carries
 * *which mode was achieved* and *degraded*; a ring that also meant *in a container* would mean
 * none of the three. So this is a second mark with different geometry (inset), different stroke
 * (dashed) and a colour outside the mode palette entirely — three ways of not being the ring.
 */
function ContainerFrame({ icon, mime, count }: { icon?: string; mime?: string; count: number }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-5 rounded-xl border-2 border-dashed border-brass-400" />
      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
        <span className="flex items-center gap-2 rounded-full bg-brass-500 py-1 pl-1 pr-3 text-sm font-semibold text-slate-950">
          {icon && mime ? (
            <MediaThumb mediaId={icon} mime={mime} className="h-7 w-7 shrink-0 rounded-full" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950/20">⬤</span>
          )}
          {/* Not a name. A container declares "this is a thing", never what the thing is. */}
          in this object · {count} shot{count === 1 ? "" : "s"}
        </span>
      </div>
    </>
  );
}

/**
 * The strip down one side of the viewfinder (v1.8 §4.1a-ii) — **places, and only places.**
 *
 * The zone's objects, stacked, **each wearing its own first photograph as its icon — the furnace
 * one, without anybody typing "furnace"**. The one you are inside is ringed rather than lifted out
 * of the list: ⛑ tapping it leaves it, which is the same gesture as entering and therefore not a
 * new control.
 *
 * ⚑ **Captures used to be drawn here too, and that was the clutter** (owner, 2026-08-16). Inside a
 * container this strip showed that container's photographs *and hid its neighbours*, while the
 * bottom strip went on showing everything — so the side answered a question the bottom already
 * answered, and stopped answering the one only it could. The contents belong to the filmstrip; the
 * way between objects belongs here.
 */
function ObjectStrip({
  model,
  onNew,
  onTap,
}: {
  model: ReturnType<typeof stripModel>;
  onNew: () => void;
  onTap: (pinId: string) => void;
}) {
  return (
    <div className="absolute bottom-32 left-2 top-14 flex w-16 flex-col gap-2 overflow-y-auto">
      <button
        type="button"
        aria-label="New object"
        onClick={onNew}
        className="h-14 w-14 shrink-0 rounded-xl bg-slate-900/70 text-2xl text-brass-400 ring-1 ring-slate-500"
      >
        +
      </button>
      {model.objects.map((object) => {
        const inside = model.current?.pinId === object.pinId;
        return (
          <button
            key={object.pinId}
            type="button"
            // The label carries the state, because the ring is the only other thing that does and
            // a ring is not readable by anything that is not an eye.
            aria-label={inside ? `Leave object ${object.number}` : `Object ${object.number}`}
            onClick={() => onTap(object.pinId)}
            className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900/70 ${
              inside ? "ring-2 ring-brass-400" : "ring-1 ring-slate-500"
            }`}
          >
            {object.iconMediaId && object.iconMime ? (
              <MediaThumb mediaId={object.iconMediaId} mime={object.iconMime} className="h-full w-full object-cover" />
            ) : (
              <span className={`flex h-full w-full items-center justify-center ${inside ? "text-brass-400" : "text-slate-400"}`}>
                ⬤
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The strip along the bottom — **the contents of wherever you are standing.**
 *
 * Inside an object, that object's captures. Out in the zone, the zone's own: its concerns, its
 * room shots, and the run traces that file here rather than into the container they started in.
 *
 * ⚑ **It says which**, and that is not a caption for tidiness. This strip changes meaning as the
 * concierge steps in and out of a container, and *twenty shots filed into the wrong object look
 * exactly like twenty filed correctly* — the failure the container ring already guards, arriving
 * through the strip instead. A strip that silently changes what it is showing is the same defect
 * with a different door.
 */
function ContextFilmstrip({
  model,
  label,
  onOpen,
}: {
  model: ReturnType<typeof stripModel>;
  label: string;
  onOpen: (capture: MediaRef) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 text-xs text-slate-400">
        {model.filmstrip === "object" ? (
          <>
            in this object · {model.captures.length} shot{model.captures.length === 1 ? "" : "s"}
          </>
        ) : (
          <>
            {label} · {model.captures.length} not in an object
          </>
        )}
      </p>
      {model.captures.length > 0 && (
        /* ⚑ Tappable, reversing the previous "this is the record, not a picker". The field
           answered it (owner, 2026-08-16 evening): a thumbnail you cannot open is a thumbnail you
           cannot check, and checking is the entire reason the strip shows what was filed. Opening
           one is looking, not picking — nothing here changes where a capture went. */
        <div className="flex gap-2 overflow-x-auto pb-1">
          {model.captures.map((capture) => (
            <button
              key={capture.mediaId}
              type="button"
              aria-label="Open capture"
              onClick={() => onOpen(capture)}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-600"
            >
              <MediaThumb mediaId={capture.mediaId} mime={capture.mime} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
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

export function CameraScreen({
  zoneId,
  startAction,
}: {
  zoneId?: string;
  startAction?: "floorplan" | "mesh" | "room-shot" | "traverse" | "document";
}) {
  const { navigate, showToast, v2Session, createPin, capturePhotoV2 } = useApp();
  const [status, setStatus] = useState<ModeStatusEvent | null>(null);
  /** The latest status, readable from callbacks that must not re-subscribe when it changes —
   *  `beginTraverse` needs the lens state and is deliberately stable. */
  const statusRef = useRef<ModeStatusEvent | null>(null);
  statusRef.current = status;
  const [openCapture, setOpenCapture] = useState<MediaRef | null>(null);
  /** Which frame of a filed capture is being looked at. Reset by opening a different one. */
  const [storedIndex, setStoredIndex] = useState(0);
  const [storedActual, setStoredActual] = useState(false);
  /**
   * ⚑ The declared kind the NEXT capture will carry, and it must be visible.
   *
   * An action that silently changes what the next shot means is the container failure again —
   * twenty shots filed as something the concierge did not intend look exactly like twenty filed
   * correctly. So it is drawn, and it clears itself on the capture it was for.
   */
  const [pendingIntent, setPendingIntent] = useState<CaptureIntent | null>(null);
  /** How many legs of one walk have been recorded. Resets when a traverse starts unrelated. */
  const [legNumber, setLegNumber] = useState(1);
  /* ⚑ The narration a trace is FOR. A concierge walking a pipe describing what it does will not
     leave the viewfinder to say it, so the recorder lives here rather than on the zone screen. */
  const recorder = useVoiceRecorder();
  /** Where the current leg began. Taken before the exposure lock, held until the leg is filed. */
  const startPosition = useRef<ZonePosition>({ positioned: false, why: "leg not started" });
  /** The anchor the last leg ended on — handed to the next leg when they are chained. */
  const lastEnd = useRef<ZonePosition | null>(null);
  /* ⛑ **A note binds to its LEG, and the owner's reason is better than the one it replaces.**

     I had it bind to the run, arguing that a narration spanning three legs describes all three.
     True, and the wrong optimisation: *"if I narrated something specific to leg 6, the desk would
     need to fish through all audio through all legs."* **A mechanical room is seven or eight legs**
     — a run-long file makes every question a search, and a per-leg file makes it a lookup.

     ⚑ So the note is *cycled* at each boundary instead: leg 6's narration is leg 6's file. The run
     stays reachable by walking `frame.continuesFrom`, which costs the desk one hop and costs the
     concierge nothing. See `cycleVoice`. */
  /** The `captureId` of the leg currently being walked, or null. Set by `beginTraverse`. */
  const legRef = useRef<string | null>(null);
  /* ⚑ **The preview is genuinely black while ARKit holds the lens**, and it was unexplained.
     `cameraYielded` stops the capture session, so there is nothing to draw for the 1–5 s ARKit
     takes to relocalise. The field read that as a crash — *"screen goes black and stayed black"* —
     which is what an unexplained black screen means to anyone. It is now labelled. */
  const [measuring, setMeasuring] = useState(false);
  /** The last leg-boundary audio gap, in ms. Shown so the requirement is answered by a number. */
  const [voiceGapMs, setVoiceGapMs] = useState<number | null>(null);
  const pendingIntentRef = useRef<CaptureIntent | null>(null);
  pendingIntentRef.current = pendingIntent;
  /** mediaId → the capture it came from, for this session only. See `shoot`. */
  const sessionFrames = useRef<Map<string, CaptureResult>>(new Map());
  /** When characters worth shooting first appeared — the start of the wait the concierge feels,
   *  which begins well before the camera calls the iPad still. */
  const readableSince = useRef<number | null>(null);
  const [timing, setTiming] = useState<{ waitedMs: number; captureMs: number } | null>(null);
  /** What the torch was last asked to be, until the camera confirms it. See `toggleTorch`. */
  const [torchAsked, setTorchAsked] = useState<boolean | null>(null);
  const torchPending = torchAsked !== null && torchAsked !== (status?.torchOn ?? false);
  const [audioProbe, setAudioProbe] = useState<AudioProbeStarted | null>(null);
  const [audioClip, setAudioClip] = useState<AudioProbeResult | null>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [text, setText] = useState<TextBoxesEvent | null>(null);
  const [shots, setShots] = useState<CaptureResult[]>([]);
  const [viewing, setViewing] = useState<CaptureResult | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [oneToOne, setOneToOne] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInstruments, setShowInstruments] = useState(false);
  const [traversing, setTraversing] = useState(false);
  const [traverseProgress, setTraverseProgress] = useState<TraverseProgressEvent | null>(null);
  const [traverseResult, setTraverseResult] = useState<TraverseResult | null>(null);
  /* ⚑ Held so the plan is visibly a deliverable rather than a side effect. A floorplan that
     produced nothing and a floorplan nobody ran look identical without this. */
  const [plan, setPlan] = useState<ZonePlan | null>(null);
  /* ⚑ The positioning session opens with the viewfinder and closes with it. There is no entry
     gesture: the zone was entered on the zone screen, and asking again put a second meaning on a
     word this product had already spent. */
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("positioning");
  const [zonePaused, setZonePaused] = useState(false);
  const [zoneTracking, setZoneTracking] = useState<string | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [meshing, setMeshing] = useState(false);
  const [zoneNote, setZoneNote] = useState<string | null>(null);
  const [zoneFailure, setZoneFailure] = useState<string | null>(null);
  const [roomProgress, setRoomProgress] = useState<{
    walls: number; doors: number; windows: number; openings: number;
  } | null>(null);

  /**
   * ⚑ The session's whole lifecycle, and it has no buttons in it.
   *
   * Opens when the viewfinder opens inside a zone; closes when it leaves. `startAction` carries the
   * door the concierge tapped on the zone screen — floorplan or mesh — so the act begins where the
   * camera is without a second gesture asking them to declare a room they are standing in.
   *
   * ⛑ **Tracking is streamed rather than polled**, because *can I anchor this container* has to be
   * answerable BEFORE the shutter. Afterwards it is a fact about a photograph nobody can retake.
   */
  useEffect(() => {
    if (!zoneId || !cameraAvailable()) return;
    let live = true;
    const off = onZone((e) => {
      if (typeof e.tracking === "string") setZoneTracking(e.tracking);
      if (typeof e.zoneError === "string") setZoneNote(String(e.zoneError));
      /* ⛑ **A scan looked like an ordinary viewfinder and reported nothing** (field 2026-08-21).
         RoomPlan tells you what it has found and what to do about it; both were being dropped. */
      if (typeof e.roomInstruction === "string") setZoneNote(String(e.roomInstruction));
      if (e.roomProgress && typeof e.roomProgress === "object") {
        const p = e.roomProgress as Record<string, number>;
        setRoomProgress({
          walls: p.walls ?? 0,
          doors: p.doors ?? 0,
          windows: p.windows ?? 0,
          openings: p.openings ?? 0,
        });
        setZoneNote(`${p.doors ?? 0} doors · ${p.windows ?? 0} windows · ${p.openings ?? 0} openings`);
      }
      /* ⚑ The plan as it is being drawn. A gap in an outline is a missed wall; a count cannot show
         one, and this is the only moment it can still be walked. */
      if (e.roomShape && typeof e.roomShape === "object") setPlan(e.roomShape as ZonePlan);
      // ⚑ Held, not toasted. A message that disappears is a message that cannot be acted on later,
      // and the whole failure of 2026-08-21 was a state nobody could see they were in.
      if (typeof e.zoneFailed === "string") {
        setZoneFailure(String(e.zoneFailed));
        setScanning(false);
        setMeshing(false);
      }
    });
    void (async () => {
      try {
        const out = await openZone(zoneId);
        if (!live) return;
        setZoneOpen(true);
        setZoneMode(out.mode);
        /* ⛑ **Armed, not running** (field report 2026-08-21). This said `false` and the strip read
           it as *a session is running, offer Pause* — while natively positioning was asleep, which
           is its normal state. ⚑ Two different facts had one flag: **is the session awake** (almost
           never, by design) and **may positions be taken** (usually yes). The strip needs the
           second, so that is what this now carries. */
        setZonePaused(false);
        if (!out.roomPlanSupported && startAction === "floorplan") {
          setZoneNote("No floorplan on this device");
          return;
        }
      } catch (e) {
        if (live) setZoneFailure(e instanceof Error ? e.message : "Zone session unavailable");
      }
    })();
    return () => {
      live = false;
      off();
      /* ⛑ **Await the open before closing** (field report 2026-08-21: positioning gone after backing
         out and returning). React runs the new effect's body before the old one's cleanup finishes,
         so a bare `closeZone()` here could land AFTER the next `openZone` and null the session that
         had just been created. ⚑ The symptom is the worst kind: it works, then it silently does
         not, and only a relaunch clears it — the same shape as the guard bug, one layer up. */
      /* ⛑ **The zone session outlives this screen, and closing it here was the bug** (zone log,
         2026-08-21: eight `openZone` calls, zero reused).

         Removing `startAction` from the deps was not enough, because tapping Floorplan or Mesh on
         the zone screen NAVIGATES — this component unmounts and a new one mounts. So the cleanup
         ran, closed the zone, and the next mount built a fresh session with `reset: true`.

         ⚑ **A zone's coordinate space belongs to the zone, not to whichever screen happens to be
         showing.** The plugin already holds it across screens; `openZone` on a different zone
         replaces it, and `stop` tidies up. So the cleanup unsubscribes and nothing else.

         And this is what makes the ray-cast work: planes need a few seconds to accumulate, and a
         session rebuilt on every entry never had them — which is why every position in the log came
         back `surface: false` even after plane detection was turned back on. */
      setZoneOpen(false);
      setScanning(false);
      setMeshing(false);
    };
    /* ⛑ **`startAction` is deliberately NOT a dependency** (zone log, 2026-08-21). It was, and the
       result was six `openZone` calls for one kitchen — one per action tapped — each rebuilding the
       session with `reset: true`. ⚑ **The zone's coordinate space was destroyed and remade every
       time the concierge tapped Floorplan or Mesh**, so a position taken afterwards was measured
       against a different origin from the plan, and nothing anywhere said so. The session belongs to
       the zone; the action is something done inside it. */
  }, [zoneId]);

  /**
   * The action the concierge tapped on the zone screen, performed in the session that is already
   * open. ⚑ Separate from the lifecycle above so that choosing an action never restarts a zone.
   */
  useEffect(() => {
    if (!zoneOpen || !startAction) return;
    let live = true;
    void (async () => {
      try {
        if (startAction === "room-shot") {
          await applyIntentLens("room-shot");
          setPendingIntent("room-shot");
        } else if (startAction === "traverse") {
          /* ⛑ **Armed, not started.** The lens goes wide because that is what a traverse wants —
             `lensPolicyFor` already rules it, and it MUST be applied before `startTraverse`, which
             locks exposure, focus and white balance and refuses a swap mid-run. But the run itself
             waits for the concierge to press: *a traverse that began the instant the screen opened
             would record the walk to the pipe rather than the pipe.* */
          await applyIntentLens("traverse");
        } else if (startAction === "document") {
          /* ⚑ The door that READS. Document mode finds the page, flattens it and runs accurate
             recognition on the result — which is the whole reason this door now leads here instead
             of to a flat photograph of a curled invoice. */
          const achieved = await requestMode("document");
          if (live && achieved.unmet.length) setZoneNote(`document: could not reach ${achieved.unmet.join(", ")}`);
        } else if (startAction === "floorplan") {
          const started = await startRoomPlan();
          if (live && started.started) {
            setScanning(true);
            setZoneMode("roomplan");
          } else if (live) setZoneNote(started.why ?? "floorplan refused");
        } else if (startAction === "mesh") {
          const r = await setZoneModeNative("mesh");
          if (live) {
            setMeshing(true);
            setZoneMode("mesh");
            if (r.unmet.length) setZoneNote(`unmet ${r.unmet.join(", ")}`);
          }
        }
      } catch (e) {
        if (live) setZoneFailure(e instanceof Error ? e.message : "action failed");
      }
    })();
    return () => {
      live = false;
    };
  }, [zoneOpen, startAction]);

  const finishScan = useCallback(async () => {
    setScanning(false);
    setRoomProgress(null);
    const plan = await stopRoomPlan().catch(() => ({ captured: false, why: "failed" }) as ZonePlan);
    setPlan(plan);
    setZoneMode("positioning");
    /* ⚑ The plan reported as the numbers somebody can price from, not as a count of surfaces.
       One walk producing a quoting table is the point of the whole capture. */
    /*
      ⚑ **The raw plan is filed; the table is only a readout** (owner ruling 2026-08-21).

      The field app's job is images and accurate raw data — the desk decides what to do with it. So
      every wall, door, window and opening goes into the record verbatim, with its dimensions, its
      transform and RoomPlan's own confidence, and `zoneMeasures` stays a pure function over that.
      **Anything derived can be re-derived; a surface nobody stored cannot be.**

      ⛑ Filed as a capture rather than held in React state, which is where it was: the first cut
      scanned a room, printed a line, and threw the geometry away.
    */
    if (plan.captured && zoneId) {
      const blob = new Blob([JSON.stringify(plan)], { type: "application/json" });
      /* ⚑ Declared, not left to be guessed from a mime type. Without an intent a room's geometry
         arrives at the desk as an unlabelled JSON blob among the photographs. */
      await capturePhotoV2({ kind: "zone", id: zoneId }, blob, "application/json", undefined, "floorplan")
        .catch(() => {});
    }
    if (plan.captured) {
      const m = zoneMeasures(plan);
      /* ⚑ Feet first, because that is what a quote is written in here, with metres alongside
         because that is what the sensor measured. */
      setZoneNote(
        `${m.perimeter ? bothUnits(m.perimeter) : "—"} round · ` +
          `${m.baseboard ? bothUnits(m.baseboard) : "—"} baseboard · ` +
          `${m.ceilingHeight ? bothUnits(m.ceilingHeight) : "—"} high · ` +
          `${m.windows.count} windows · ${m.doors.count} doors`,
      );
    } else setZoneNote(plan.why ?? "no plan");
  }, []);

  const finishMesh = useCallback(async () => {
    setMeshing(false);
    const out = await setZoneModeNative("positioning").catch(() => null);
    setZoneMode("positioning");
    /* ⚑ The geometry is the deliverable, so it is filed raw exactly as the floorplan is — the desk
       decides what to do with it. A count on screen is a receipt, not the record. */
    const mesh = (out as { mesh?: { anchors: number; faces: number; why?: string } } | null)?.mesh;
    if (!mesh) return;
    if (zoneId && mesh.faces > 0) {
      const blob = new Blob([JSON.stringify(mesh)], { type: "application/json" });
      await capturePhotoV2({ kind: "zone", id: zoneId }, blob, "application/json", undefined, "mesh")
        .catch(() => {});
    }
    setZoneNote(
      mesh.faces > 0
        ? `mesh · ${mesh.anchors} pieces · ${mesh.faces.toLocaleString()} faces filed`
        : (mesh.why ?? "nothing was meshed"),
    );
  }, [zoneId, capturePhotoV2]);

  /**
   * ⚑ Rebuild rather than resume. A failed `ARSession` cannot be revived by `run(config)` — that is
   * what made every mode after a failure inherit the corpse — so this closes the zone and opens it
   * again, which is the one thing that was previously only achievable by relaunching the app.
   */
  const retryZone = useCallback(async () => {
    if (!zoneId) return;
    setZoneFailure(null);
    setZoneNote("restarting positioning…");
    await closeZone().catch(() => {});
    try {
      const out = await openZone(zoneId);
      setZoneOpen(true);
      setZoneMode(out.mode);
      setZonePaused(true);
      setZoneNote(null);
    } catch (e) {
      // ⚑ Clear the "restarting…" line on the way out. It stayed on screen forever when the retry
      // failed, which reads as *still trying* — the one thing it was not doing.
      setZoneNote(null);
      setZoneFailure(e instanceof Error ? e.message : "positioning unavailable");
    }
  }, [zoneId]);

  const togglePause = useCallback(async () => {
    const out = zonePaused ? await resumeZone() : await pauseZone();
    setZonePaused(out.paused);
  }, [zonePaused]);
  /**
   * Auto-capture is the feature that turns roughly two hundred taps into thirty-four, so it is on
   * by default in the mode that has it. It is also switchable, because judging one deliberate
   * frame of one plate is a different act from walking a room — and a filmstrip filling up while
   * someone looks around is a filmstrip they cannot find the real shot in.
   */
  const [autoCapture, setAutoCapture] = useState(true);
  /** ⚑ Read inside the frame callback, which closes over its first render — a state value would be
   *  stale there and auto-capture would keep firing exactly as it did before the fix. */
  const reviewingRef = useRef(false);
  /** ⚑ Containers that already carry at least one measured position. A SAMPLING record, not a
   *  choice: the desk still ranks every position it receives, and a Text frame is always sampled
   *  whatever this holds. Session-scoped and never persisted — a container positioned on a previous
   *  visit is a different visit's fact. */
  const positionedContainers = useRef<Set<string>>(new Set());
  const autoRef = useRef(true);
  useEffect(() => {
    autoRef.current = autoCapture;
  }, [autoCapture]);

  /* Anything covering the live preview is a not-a-capture posture: the reviewer, the stored viewer.
     Kept in a ref because the frame callback closes over its first render. */
  useEffect(() => {
    /* ⛑ **`viewing` was the one that mattered and the first fix missed it.** Tapping a frame shot
       THIS session opens the full reviewer (`viewing`); only a frame filed earlier opens
       `openCapture`. So the guard covered the case the owner was not hitting and missed the case he
       was — auto-capture went on firing behind the reviewer exactly as before.

       ⚑ Both are listed rather than the one that was reported, because the rule is *anything
       covering the live preview is not a capture posture* and a rule stated as a list of the
       symptoms seen so far is a rule that breaks on the next surface added. */
    reviewingRef.current = openCapture !== null || viewing !== null;
  }, [openCapture, viewing]);

  const available = cameraAvailable();
  const lastAuto = useRef(0);
  const busyRef = useRef(false);

  /**
   * The object container (v1.8 §4.1a-ii). Its rules live in `capture/objectContainer` — what is
   * here is the gesture and the paint.
   */
  const [open, setOpen] = useState<OpenContainer | null>(null);
  const zone = zoneId ? v2Session?.zones.find((z) => z.zoneId === zoneId) : undefined;
  const strip = stripModel(v2Session?.pins ?? [], zoneId ?? "", open, zone?.photos ?? []);

  /**
   * ⚑ Everything `shoot` reads travels by ref, and `shoot` keeps an EMPTY dependency list.
   *
   * It is a dependency of the effect that calls `startCamera`, so an identity that changed when
   * the open container changed would tear down and restart the capture session on every tap of
   * the strip — a black viewfinder for a beat, a lost torch state, and a restart in the middle
   * of the auto-capture the concierge was lining up.
   */
  const openRef = useRef<OpenContainer | null>(null);
  const zoneRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    zoneRef.current = zoneId;
    // Leaving the zone closes the open container. Not a prompt: a container spanning two zones
    // is always wrong, so there is no decision to put to anybody.
    setOpen((current) => containerAfterZoneChange(current, zoneId ?? null));
  }, [zoneId]);

  const shoot = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      /* ⚑ **The sibling pair, asked for by the door** (running list item 7).

         A room shot is the one act whose job is *what is in this room* rather than *what is this
         object*, and it is taken once per zone — so it is where a 120° frame is worth two input
         swaps, and where paying for them forty times a room would not be. **The 1× frame carries
         the measured position and the 120° one inherits from its own sibling**, because world
         tracking is not offered the ultra-wide on this iPad (`HSLensProbe`, 2026-08-24) and a
         positioned 0.5× frame is unavailable at any price.

         A request, not an instruction: Text refuses it by policy and a device without the glass
         refuses it by hardware. `result.wideRefused` says which. */
      /*
        ⛑ **The container is decided HERE, at the shutter, and it used to be decided at the write.**

        Field 2026-08-30: *"I took a nameplate shot of one of the water treatment systems, then
        immediately hit new object container, and since it took a while for the nameplate capture to
        register, it ended up landing as the first object container picture instead of in the
        previous object container as its nameplate."*

        ⚑ `captureTargetFor(openRef.current, …)` ran **after** the frames came back — a window of
        one to three seconds on a bracket — so a container opened during that window took ownership
        of a photograph of the previous object. **A nameplate filed against the wrong equipment is
        worse than a missing one**: it is a wrong answer that looks like a right one, and nothing
        downstream can tell.

        *The container that was open when the concierge pressed is the container that owns the
        frame.* Same class as every other value read at the wrong moment in this file — and the
        first one where the wrong value silently corrupts the record rather than the experience.
      */
      const targetAtShutter = openRef.current;
      const result = await captureFrames({ wideSibling: pendingIntentRef.current === "room-shot" });
      /*
        ⚑ **The position is taken at the shutter, and a refusal is recorded as a refusal.**

        Asked here rather than afterwards because a pose is a fact about *when the frame was taken*
        — a second later the concierge has moved. And `takePosition` REFUSES rather than handing
        back the last pose it happened to hold, so what lands on the capture is either a measured
        position or the reason there is not one.

        ⛑ The refusal is the half that matters. An absent field says *this build had no positions*;
        `{positioned:false, why:"paused"}` says *this one could and did not, here is why* — and a
        container the desk cannot place is otherwise indistinguishable from one nobody meant to.
      */
      /*
        ⚑ **Sampled, not chosen — and the distinction is the whole of this** (owner ruling
        2026-08-23, restored 2026-08-28).

        The field still does not pick which frame represents an object. That judgement stays at the
        desk, which ranks by `surface.distance` — closest wins — over whatever it is sent. What
        changes here is only **how often a position is sampled**, and that is a walkability decision
        rather than a semantic one.

        ⛑ **Positioning every frame cost 2–3 seconds per photograph**, because a position wakes ARKit
        and it re-establishes tracking after the capture session takes the lens back. A real
        multi-room walk under that is miserable, and this walk has to actually happen.

        **First frame in a container, plus every Text frame.** ⚑ *The nameplate shot is therefore
        always among the candidates* — which is the frame the desk most wants, because the concierge
        stands 0.3–1 m from a plate and six feet back from a fridge. The owner's own objection to
        "first wins" is answered by including Text rather than by the field choosing between them.

        Captures outside a container still take one each: a zone concern has nothing to inherit from.

        ⚑ **This is a sampling rate and it goes away entirely under decision one.** If ARKit holds the
        lens for a zone there is no wake, no pause, and every frame can carry a position — which is
        what the ruling asked for and what the handover currently prices out.
      */
      /* ⛑ **Through the refs, because `shoot` closes over its first render** — its deps are
         `[capturePhotoV2]`, and the file already reads `openRef.current` two dozen lines below for
         exactly this reason. Written as `open?.pinId` this would have been permanently null, so
         every frame would have sampled a position and the change would have done nothing at all
         while reading as though it had. ⚑ *A stale closure is the same shape as a stale ARFrame:
         a value that is confidently the wrong one.* */
      const containerId = openRef.current?.pinId ?? null;
      const isPlate = statusRef.current?.mode === "text";
      const needsPosition =
        containerId === null || isPlate || !positionedContainers.current.has(containerId);
      const position = needsPosition
        ? await takePosition().catch(
            () => ({ positioned: false, why: "no zone open" }) as ZonePosition,
          )
        : undefined;
      if (containerId && position?.positioned) positionedContainers.current.add(containerId);
      // Assume Use: it goes straight into the filmstrip. No confirm sheet — that was only ever an
      // artefact of the OS camera finishing its own job.
      setShots((prev) => [result, ...prev]);
      // Filed to the container if one is open, to the zone otherwise. Reached from Home there is
      // no zone at all and this screen stays what Field 4b built: the harness where a plate is
      // judged at 1:1. Nothing to file into is a state, not a failure.
      const currentZone = zoneRef.current;
      const frame = result.frames[0];
      if (currentZone && frame) {
        const blob = await frameBlob(frame);
        /*
          ⚑ **Every frame of the capture is filed, and each says what it is.**

          `frames[0]` is the primary — the one that counts, and the only one any count sees. The
          unlit companion is `evidence`: it answers *did the torch erase characters*, a question
          that survives for years, and on 2026-08-16 it produced the cleanest plate of two nights.
          The remaining bracket exposures are `insurance`: three shots so that one reads, spent once
          the desk has resolved the plate.

          The distinction is marked here, at write time, because it cannot be recovered from the
          pixels later — and a retention policy that keeps evidence and drops insurance is then a
          filter over a field rather than a schema change nobody can make retroactively.
        */
        const captureId = result.at;
        const roleOf = (index: number): FrameRoleMeta => ({
          captureId,
          /* ⛑ The 120° sibling is `evidence`, and that is the retention rule rather than a
             label: *evidence survives, insurance is spendable once the desk has resolved the
             plate.* A room's wide frame answers "what was around this" — a question that is still
             being asked in five years. Which frame is the wide one is read off `lens`, not here. */
          role:
            index === 0
              ? "primary"
              : result.frames[index]?.lens === "wide" && result.wideSibling
                ? "evidence"
                : result.frames[index]?.torch === false && result.torchPaired
                  ? "evidence"
                  : "insurance",
          torch: result.frames[index]?.torch,
          ev: result.bracketed && index < 3 ? [-1, 0, 1][index] : undefined,
          /* ⚑ Per FRAME. `result.lens` describes the capture and was right for every capture
             built before the sibling pair; on a pair it is right about three frames out of four,
             which is the worst kind of right. */
          lens: result.frames[index]?.lens ?? result.lens,
        });
        const readOf = (index: number): FrameReadMeta | undefined => {
          const ocr = result.frames[index]?.ocr;
          return ocr
            ? { text: ocr.text, engine: ocr.engine, confidence: ocr.meanConfidence, osVersion: ocr.osVersion }
            : undefined;
        };
        const siblings = await Promise.all(
          result.frames.slice(1).map(async (f, i) => ({
            blob: await frameBlob(f),
            mime: "image/jpeg",
            read: readOf(i + 1),
            frame: roleOf(i + 1),
            /* ⚑ The doctrine lives in `positionForSibling`, not here — a rule inside a
               component cannot be scanned or tested, which is the same reason `globalCameraApplies`
               is a predicate. Read it there; it is the reason the wide frame refuses. */
            position: positionForSibling(f, result.wideSibling === true),
          })),
        );
        /*
          ⚑ **The intent was hard-coded `undefined`, so a declared capture kind never reached the
          record — and one documented rule could not execute at all.**

          `captureTargetFor` carries a run-trace branch with a paragraph explaining why it is a
          function rather than a ternary: *a trace starts inside a container and ends outside it, so
          filing it inside asserts the pipe belongs to the furnace.* That branch is tested, the test
          passes, and **the app never passed an intent** — so in the field every trace filed to
          whatever container happened to be open, and every room shot filed as an ordinary capture.

          The test passes because it calls the function directly. Nothing called it that way. This
          is the same defect as the panel pointing at frames nothing kept, one layer down: *a rule
          being correct is not the same as a rule being reached.*
        */
        const declared = pendingIntentRef.current ?? undefined;
        const mediaId = await capturePhotoV2(
          captureTargetFor(targetAtShutter, currentZone, declared), blob, "image/jpeg",
          undefined, declared,
          /* ⚑ On the PRIMARY only. Siblings inherit — the container's anchor is one frame, and a
             pose stamped on all three of a bracket would read as three positions of one object. */
          {
            read: readOf(0),
            frame: roleOf(0),
            /* ⚑ **The pose is the native side's; what it DESCRIBES is this side's.**
               `takePosition` knows where the iPad was and nothing about which glass took the
               photograph — that fact lives here, with the frames. See `projectionFor`: the room
               shot's primary is the 120° frame the concierge framed (owner ruling 2026-08-16,
               re-confirmed in the field), so its pose is honest and its matrix does not describe
               it, and the record must say so rather than leave the desk to know it. */
            position: position?.positioned ? { ...position, projection: projectionFor(result) } : position,
            siblings,
          },
        );
        /* ⛑ **A room shot stays armed; every other declared intent fires once.**

           *"You take one shot and it exits the room-shot container, so you can't take follow-up
           shots"* — field 2026-08-30, having taken **three** room shots to get three angles of a
           mechanical room, one of which landed as an ordinary zone capture because the door had
           already disarmed. The 2026-08-21 ruling that a room shot *"happens once, at the start of
           a zone"* was written before anyone had photographed a room with equipment on four walls.

           ⚑ A traverse or a document is one act by construction; **a room shot is one act per
           angle**, and the concierge decides how many angles a room has. It disarms on leaving the
           viewfinder, which is the act that ends it. */
        if (pendingIntentRef.current !== "room-shot") {
          pendingIntentRef.current = null;
          setPendingIntent(null);
        }
        /*
          ⚑ **The link back from the filed capture to the frames it came from**, and it exists to
          undo a regression this session caused.

          Field 4g moved the bottom strip to the filed record and argued the 1:1 reviewer could
          stay in the harness, "which is where a plate gets judged and always has been". **The
          field refuted that within a day**: the owner shoots plates inside a real zone, and there
          he was left with one thumbnail he could not open past, no exposure stack and no 1:1.

          *The camera's whole acceptance test is a person judging a plate at 100%* — so removing
          that from the one place a bad capture can still be retaken for free took the test out of
          the room it exists for.

          One map, this session only. Nothing is persisted, because the other frames are not
          persisted either (see the viewer): this restores review of what is still in hand, and
          claims nothing about captures from an earlier visit.
        */
        sessionFrames.current.set(mediaId, result);

        /*
          ⚑ **The retake rule finally has a reader** (running list item 5).

          `shouldOfferRetake` has existed, correct and tested, since the day the trigger was ruled
          on — and **nothing in the app called it**, so in the field it fired on nobody. That is
          rule 43 again: *a value being computed is not the same as a reader being able to reach
          it*, and this is the seventh instance.

          ⛑ **A toast, not a sheet.** This screen's contract is *Assume Use, never Retake* — the
          filmstrip is the confirmation. So this is an offer that costs nothing to ignore: shoot
          again or move on, and the capture is already filed either way. A gate here would trade
          the whole no-confirm-sheet design for one marginal plate.

          And it says something only when there is something to say: `characterCount > 0 AND
          marginal`. Most captures legitimately hold no text at all, and a prompt that fired on
          those would be background noise by the time a plate needed it.
        */
        if (captureWantsRetake(result)) {
          showToast("That plate read poorly — worth another, closer or with the light moved");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [capturePhotoV2, showToast]);

  /**
   * The `+` at the top of the strip. Tapping it while inside a container closes that one and
   * opens a new one — one gesture, and the previous object needs no closing act of its own.
   *
   * ⛑ **It also returns the camera to `object` mode**, because the field found the alternative:
   * *"I think I took the main object shot of the GSW hot water tank using the nameplate mode,
   * because it was the last mode I was in when I switched object container."* ⚑ *A container opens
   * on the whole thing* — that is what the first frame of a container is for — and inheriting the
   * close-focus, spot-metered, lens-locked Text mode from the previous object's plate is a setting
   * chosen for a different job, silently applied to the shot that identifies the equipment.
   *
   * ⚑ The container is created with no type and no label, and nothing here asks for one. It
   * declares *this is a thing and I am now photographing it*, never what the thing is.
   */
  /**
   * The traverse, driven from the instruments panel.
   *
   * ⚑ The *mechanism* only. No capture kind, no in-frame guidance, and nothing filed — the
   * frames land in the app's temporary directory and the record comes back as numbers. The owner
   * held the surface back because the traverse and the run trace may be one primitive, and a
   * door built tonight would harden around the narrower of the two.
   */
  const beginTraverse = useCallback(async (continuesFrom?: string, carriedStart?: ZonePosition) => {
    setTraverseResult(null);
    setTraverseProgress(null);
    try {
      /*
        ⚑ **Where this leg BEGINS, in the world** (design ruling 2026-08-29).

        A traverse registers frame to frame by image overlap — translation-only, image space — so
        it recovers *order* and *shape* and knows nothing about where in the house it happened.
        ⛑ **The order is the thing the desk cannot get any other way.** The owner's own mechanical
        room has a water line that crosses the room, skips a unit and doubles back to it: a desk
        reasoning from what sits near what does not merely fail, it *confidently produces the wrong
        sequence.*

        **Per-frame position is not available and this is not a tuning problem.** A traverse runs on
        the `AVCaptureSession` with exposure, focus and white balance locked; ARKit cannot hold the
        lens at the same time, and one position costs a full camera handover — **1.70 s, measured
        on device 2026-08-28** (yield → `limited(initializing)` → `normal` → read → reclaim). A
        handover mid-run would also break the exposure lock the whole registration model depends on,
        which is why `swapLens` already refuses while traversing. Per-frame world position **is**
        decision one, not an addition to this.

        **So: an anchor at each end of each leg**, taken where the concierge has already stopped.
        The chain between them carries the order; these two carry the room. ⚑ *And a run that
        doubles back is walked as separate legs* — `continuesFrom` already exists for exactly that —
        so the leg endpoints form a polyline of the route rather than a straight line through it.
      */
      /*
        ⛑ **A chained leg inherits the anchor the previous leg just measured.**

        `next leg` used to end leg N — a position — and immediately start leg N+1 — another
        position. **Two five-second handovers back to back, measuring the same spot twice**, with
        the preview black for eleven seconds in between. The field: *"once the handover finally
        happens.. takes a while."*

        ⚑ The end of leg N and the start of leg N+1 **are the same place at the same moment** by
        construction — that is what chaining means. Measuring it twice was not redundancy, it was
        the same one-ended-operation error inverted: paying twice for one fact.
      */
      if (carriedStart) {
        startPosition.current = carriedStart;
      } else {
        setMeasuring(true);
        startPosition.current = await takePosition()
          .catch(() => ({ positioned: false, why: "no zone open" }) as ZonePosition)
          .finally(() => setMeasuring(false));
      }
      /* Painted before the await that follows, not after it. `startTraverse` locks exposure and
         focus and can take a moment; leaving the bar reading "start trace" while frames are
         already firing is the state the field called confusing, and it was. */
      setTraversing(true);
      // ⚑ Lens SECOND, and it MUST be before `startTraverse`. A traverse locks exposure, white
      // balance and focus on its first frame and refuses a lens swap mid-run — so a wide default
      // applied afterwards would be silently declined, and the run would be shot on normal while
      // the control said wide.
      if (statusRef.current?.lensAvailable) {
        const policy = lensPolicyFor(statusRef.current.mode, "traverse");
        if (!policy.locked && statusRef.current.lens !== policy.default) {
          await requestLens(policy.default);
        }
      }
      const started = await startTraverse(continuesFrom);
      /* ⚑ Held so a voice note taken DURING this leg can name it. See `toggleVoice`. */
      legRef.current = started.startedAt;
      setLegNumber((n) => (continuesFrom ? n + 1 : 1));
    } catch (err) {
      setTraversing(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /** ⚑ Returns the finished leg, so the next one can declare itself its continuation. Without a
   *  return there is no way to chain legs from the viewfinder, and legs are the whole route. */
  /**
   * Start or finish a spoken note without leaving the viewfinder.
   *
   * ⛑ **Files to the ZONE, never the open container** — the same rule the trace itself follows. A
   * narration recorded while walking a run describes the run, and filing it inside whichever object
   * happened to be open would assert the pipe belongs to that object.
   */
  const toggleVoice = useCallback(async () => {
    const zone = zoneRef.current;
    if (recorder.state === "recording") {
      const rec = await recorder.stop();
      if (rec && zone) {
        /*
          ⚑ **A note spoken during a leg names that leg** (owner question 2026-08-30: *"are the
          voice notes carried to the manifest so they bind with the traverse leg?"*).

          ⛑ **They were not.** The note filed to the zone with a timestamp and nothing else, so the
          desk could only correlate it by clock — and *"whatever notes are in it are judged first
          against that leg and its images"* was not something the record supported.

          ⚑ **Bound through `frame.captureId`, which is the key that already means "these belong to
          one act."** A leg's frames all carry it; the note now carries the same value, so the note
          and the leg's images are one group by the mechanism that already exists rather than a new
          one. *`role: "evidence"` because a narration survives — it is never a spare exposure.*

          ⛑ **This is a proposal, not a ruling.** Baseline Service Design §8 item 2 gives the design
          session note-binding, and `CaptureTarget` still has no media variant — so this binds a note
          to a *capture group*, which is the thing a leg actually is, and stops short of inventing
          note-to-media targeting. Outside a traverse nothing is stamped, because there is no act to
          name and a captureId pointing at nothing is worse than none.
        */
        /* ⚑ The RUN's id, not the current leg's. A note opened in leg 1 and closed in leg 3
           describes all three, and `runRootRef` is the only value that stays true for all of it —
           `legRef` would name whichever leg happened to be running when the concierge stopped
           talking, which is the least meaningful of the three. */
        const leg = traversing ? legRef.current : null;
        await capturePhotoV2(
          { kind: "zone", id: zone },
          rec.blob,
          rec.mime,
          rec.durationMs,
          undefined,
          leg ? { frame: { captureId: leg, role: "evidence" } } : undefined,
        );
      }
      return;
    }
    if (recorder.state === "unsupported") {
      showToast("This device will not record audio here");
      return;
    }
    await recorder.start();
  }, [recorder, capturePhotoV2, showToast, traversing]);

  /**
   * @param finishing `false` when this end is the first half of a `next leg`.
   *
   * ⛑ **The distinction is the whole of the owner's ruling** and the first cut lost it: stopping
   * the trace stops the narration, **but a leg change is not stopping the trace.** *That is one
   * continuous run and the narration belongs to all of it* — it was cut at every boundary because
   * `next leg` reaches this function too, and nothing here knew which of the two acts it was
   * serving. A parameter, because a function that cannot tell its callers apart will keep guessing.
   */
  /**
   * Close the note on this leg and open one on the next, without letting go of the microphone.
   *
   * ⚑ **Only when a note is actually running** (owner clarification 2026-08-30). If the concierge
   * stopped talking during leg 6, leg 7 must not start recording on its own — *"concierge already
   * stopped the audio in that string."* The trigger is the live state, never the act of changing legs.
   *
   * ⛑ **Restart first, file afterwards.** The gap the concierge hears is `stop` → `start` and
   * nothing else; writing a blob to storage takes as long as it takes and happens behind them. And
   * the microphone stays open across the cycle — `getUserMedia` was the expensive half and it used
   * to run every time.
   *
   * The gap is **measured and logged**, not hoped for: the requirement was *a fraction of a second
   * would be fine*, and a requirement stated as a number deserves an answer as one.
   */
  const cycleVoice = useCallback(async () => {
    if (recorder.state !== "recording") return;
    const zone = zoneRef.current;
    const closingLeg = legRef.current;
    const began = performance.now();
    const rec = await recorder.stop({ keepStream: true });
    await recorder.start();
    const gapMs = performance.now() - began;
    setVoiceGapMs(Math.round(gapMs));
    if (rec && zone) {
      // Filed behind the restart, deliberately — see above.
      void capturePhotoV2(
        { kind: "zone", id: zone },
        rec.blob,
        rec.mime,
        rec.durationMs,
        undefined,
        closingLeg ? { frame: { captureId: closingLeg, role: "evidence" } } : undefined,
      );
    }
  }, [recorder, capturePhotoV2]);

  const endTraverse = useCallback(async (finishing = true): Promise<TraverseResult | null> => {
    try {
      // The concierge who pressed *stop trace* has every reason to believe the recording stopped.
      // ⚑ A LEG change is not that act — it cycles instead, so each leg gets its own file.
      if (finishing && recorder.state === "recording") await toggleVoice();
      else if (!finishing) await cycleVoice();
      const result = await stopTraverse();
      setTraverseResult(result);
      /* The far end of the leg. Taken after the run has stopped, so no handover ever lands inside
         a traverse — the two anchors bracket it rather than interrupt it. */
      setMeasuring(true);
      const endPosition = await takePosition()
        .catch(() => ({ positioned: false, why: "no zone open" }) as ZonePosition)
        .finally(() => setMeasuring(false));
      lastEnd.current = endPosition;

      /*
        ⚑ **A traverse filed nothing at all, and nobody noticed because the numbers arrived.**

        Every run wrote its frames to the native temp directory, returned their paths, computed
        overlap across them — and then the screen kept the verdict and dropped the photographs. Six
        walks of a mechanical room produced no coverage of it whatsoever.

        It also made last round's instrument useless: the panel names *look at frames 3, 4* and
        there were no frames to look at. **An instrument that points at something unreachable is
        not an instrument** — and that is the same defect as the message on the stored viewer, and
        as the panel headlining a retired metric, three times in three rounds.

        Filed as ONE capture with `intent: "pan"`, because that is what it is: §4.1a's pan, one
        continuous act the concierge started once. Frame 0 is the primary and the rest are its
        siblings, so a thirty-frame walk adds **one** to the count of photographs in this room —
        the same rule a bracket already follows, for the same reason.

        Every frame is `evidence` rather than `insurance`: each covers a different part of the
        wall, none is a spare exposure of the same thing, and none becomes spendable once
        something has been read.
      */
      const currentZone = zoneRef.current;
      const [first, ...rest] = result.frames;
      if (currentZone && first) {
        /*
          ⚑ The join and the registration model ride the FILED capture, not just the panel — which
          is rule 43 applied to this change while writing it. A leg that declares itself a
          continuation, and a number that is only meaningful against the model that produced it,
          are both facts the desk needs and neither survives in the traverse result alone: that
          object lives until the next run and then goes.
        */
        const roleFor = (index: number): FrameRoleMeta => ({
          captureId: result.startedAt,
          role: index === 0 ? "primary" : "evidence",
          lens: statusRef.current?.lens,
          registration: result.registration,
          continuesFrom: result.continuesFrom ?? undefined,
        });
        const blobFor = async (path: string) => (await fetch(frameUrl(path))).blob();
        /*
          ⚑ **The two anchors ride the first and last frames**, which is where they were taken and
          the only honest place to put them. Every frame between carries none — its role is not
          `primary`, so the manifest's own rule already says the pose is on the primary of this
          `captureId`, and the desk reads the leg rather than the frame.

          ⛑ *A traverse is shot WIDE* (`lensPolicyFor`, and the run locks the lens for its whole
          length), so both anchors are honest poses whose matrix does not describe their image —
          and there is **no 1× frame anywhere in a traverse**, so `projectableFrame` is `null`.
          *That is the case the field exists for: a real pose and nothing to project at all.*
        */
        const traverseProjection = { frames: [{ lens: statusRef.current?.lens }], at: result.startedAt };
        const withProjection = (p: ZonePosition): CapturePositionMeta =>
          p.positioned ? { ...p, projection: projectionFor(traverseProjection) } : p;
        const lastIndex = rest.length - 1;
        const siblings = await Promise.all(
          rest.map(async (f, i) => ({
            blob: await blobFor(f.path),
            mime: "image/jpeg",
            frame: roleFor(i + 1),
            position: i === lastIndex ? withProjection(endPosition) : undefined,
          })),
        );
        await capturePhotoV2(
          // ⚑ To the zone, never the open container — the same rule a run trace follows. A pan
          // covers a room; filing it inside the furnace would assert the room belongs to it.
          { kind: "zone", id: currentZone },
          await blobFor(first.path),
          "image/jpeg",
          undefined,
          "pan",
          { frame: roleFor(0), position: withProjection(startPosition.current), siblings },
        );
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setTraversing(false);
    }
  }, [capturePhotoV2, recorder.state, toggleVoice, cycleVoice]);

  const newContainer = useCallback(async () => {
    const currentZone = zoneRef.current;
    if (!currentZone) return;
    try {
      const pinId = await createPin(currentZone);
      setOpen({ pinId, zoneId: currentZone });
      /* ⚑ Back to `object`. See this function's header: a container opens on the whole thing, and
         Text mode inherited from the previous object's plate is close-focused, spot-metered and
         lens-locked — settings chosen for a job this frame is not doing. Painted from the return,
         as everything on this screen must be. */
      if (statusRef.current && statusRef.current.mode !== "object") {
        const achieved = await requestMode("object").catch(() => null);
        if (achieved && achieved.mode !== "object") showToast(`mode stayed ${achieved.mode}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not start an object here");
    }
  }, [createPin, showToast]);

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

      /*
        ⚑ **Two different waits, timed apart** (owner report, 2026-08-16 evening: *auto-capture
        takes a while to fire*, alongside *0.008 is still too tight*). Those are not one complaint,
        and changing the threshold on the strength of the combined feeling would be tuning the
        wrong half:

        - **`waitedMs`** — steady-and-readable until the shutter fires. This is what the threshold
          governs, plus the six-frame motion window (1.2 s at the 5 Hz analysis cadence) and the
          four-second cooldown. If this is the big one, the threshold is the lever.
        - **`captureMs`** — shutter to result in hand. This roughly doubled when the pair was
          reordered to put the flash last, so a slower-feeling camera is expected here and says
          nothing about steadiness at all.

        Measured before anything is changed, because the owner's two sentences have two different
        fixes and the numbers say which he is feeling.
      */
      /*
        ⚑ **The first cut timed the wrong interval, which is why it read `waited 0.0s`.**

        It started the clock when `stable` arrived — but `stable` is *already* steady-and-readable,
        so the shutter fires in the same event and the answer is always zero. The wait the
        concierge actually feels begins when they have the plate framed and readable and are
        holding still **waiting for the gate to open**, which is entirely before `stable`.

        So the clock starts at "characters are present and worth shooting", whether or not the
        camera has decided the iPad is still. That interval contains the thing under suspicion —
        the 0.008 threshold and the six-frame window it is measured over — and the old one
        contained none of it.
      */
      const worthHolding = worthShooting;
      if (worthHolding && readableSince.current === null) readableSince.current = Date.now();
      if (!worthHolding) readableSince.current = null;

      /* ⛑ **Not while a photograph is open** (field report 2026-08-21). The reviewer sits over the
         live preview, so the camera goes on seeing a still scene and auto-capture goes on firing —
         the concierge is looking at one frame while the app quietly takes several more of the back
         of their hand. ⚑ The frames all look fine, which is the tell: this is the silent-failure
         shape again, and the fix is that inspecting is not a capture posture. */
      if (reviewingRef.current) return;
      /* ⛑ **A dwell before it fires** (field 2026-08-23: "fired pretty quick, before I even got into
         position, and the second one was the better one" — both times).

         `stable` means the camera stopped moving, which is true the instant a hand pauses on the way
         somewhere. ⚑ **The concierge settling on a plate and the concierge passing one look identical
         for the first fraction of a second**, and the difference is only that one of them stays. So
         the trigger waits for the read to have been worth shooting continuously — `readableSince` was
         already being measured and only reported, never used to decide.

         Two-thirds of a second: short enough that a deliberate hold still feels immediate, long
         enough that a hand travelling past a label does not trip it. The owner's own observation is
         the calibration — the *second* shot was the good one, which is the first one firing early. */
      const dwell = readableSince.current === null ? 0 : Date.now() - readableSince.current;
      if (autoRef.current && event.stable && worthShooting && dwell >= 700
          && Date.now() - lastAuto.current > 4000) {
        const waited = readableSince.current === null ? 0 : Date.now() - readableSince.current;
        lastAuto.current = Date.now();
        readableSince.current = null;
        const began = Date.now();
        void shoot().then(() => setTiming({ waitedMs: waited, captureMs: Date.now() - began }));
      }
    });
    const offStatus = onModeStatus(setStatus);
    const offTraverse = onTraverse(setTraverseProgress);
    /* ⛑ **Object, not text** (field report 2026-08-21). Opening on Text meant the viewfinder began
       in the one mode that fires the shutter by itself, so walking into a room started taking
       photographs of whatever happened to hold still. ⚑ Auto-capture is right for a plate the
       concierge is deliberately holding on; it is wrong as the state a screen opens in, because the
       concierge has not chosen anything yet. Object is the mode that waits to be told. */
    startCamera("object")
      .then((result) => setCapabilities(result.capabilities))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      offText();
      offStatus();
      offTraverse();
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

  /**
   * ⚑ Same contract as `chooseMode`: ask, then let the status stream paint. Nothing here reads the
   * button that was tapped, because Text refuses wide and a traverse refuses a swap mid-run — so a
   * control painted from the press would claim a field of view the photograph does not have.
   */
  /** Every pair's raw numbers, off the device as a file. The panel shows the summary; this is what
   *  actually settles the question, and it is small enough to send from a mechanical room. */
  const shareTraverseData = async () => {
    if (!traverseResult) return;
    /*
      ⚑ **Spread, never re-enumerated — and that is a structural fix, not a tidy-up.**

      This object used to list its fields by hand, and it silently dropped `registration` the round
      it was added: the stamp was computed in Swift, carried in the result, and thrown away by the
      one thing that carries results off the device. **Sixth instance of rule 43, in the field added
      specifically to make records comparable across mechanisms.**

      An enumerated copy is the mechanism by which that keeps happening here — every future field
      has to be remembered in a second place, and nothing fails when it is not. Spreading cannot
      forget.
    */
    const payload = {
      ...traverseResult,
      frameCount: traverseResult.frames.length,
      lens: statusRef.current?.lens ?? null,
      diagnosis: traverseDiagnosis(traverseResult),
    };
    const file = new File([JSON.stringify(payload, null, 2)], `hs-traverse-${traverseResult.startedAt.replace(/[:.]/g, "-")}.json`, {
      type: "application/json",
    });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "HouseSteady traverse numbers" });
    }
  };

  /**
   * Ask the torch to change, and show that it was asked.
   *
   * ⚑ The request is cleared by the *confirmation*, not by a timer — `status.torchOn` reaching the
   * asked-for value is what ends the pending state. A timer would clear it whether or not anything
   * happened, which is the false-reassurance failure this button already avoids on the other side.
   */
  const toggleTorch = async () => {
    const wanted = !status?.torchOn;
    setTorchAsked(wanted);
    try {
      await adjustCamera({ torchOverride: wanted });
    } catch (err) {
      setTorchAsked(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleAudioProbe = async () => {
    try {
      if (audioProbe) {
        const done = await stopAudioProbe();
        setAudioProbe(null);
        setAudioClip(done);
      } else {
        setAudioClip(null);
        setAudioProbe(await startAudioProbe());
      }
    } catch (err) {
      setAudioProbe(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Every frame of one capture, in a single share.
   *
   * ⚑ Built because the owner asked and the reason is not convenience: sending twenty frames one
   * at a time is *send, save, choose location*, twenty times, and a tedious path is one that gets
   * skipped or abandoned half way. **The frames are the only thing that has ever settled a
   * traverse question** — the homography, the scale search and flow-v1's inversion were all
   * decided on real files and none of them could have been decided on the panel numbers. A
   * capture's frames are one artifact and they travel as one.
   */
  /**
   * The zone session's own record, off the device as a file.
   *
   * ⚑ Built after the tether failed twice — the second time silently, after reporting the app
   * launched, costing the owner a walked kitchen with nothing to show for it. **An instrument that
   * only works while somebody is watching is not an instrument**, and this is the shape that has
   * never failed here: the device records, the concierge taps share.
   */
  const shareZoneLog = async () => {
    try {
      const log = await zoneLog();
      const file = new File([JSON.stringify(log, null, 1)], `hs-zone-log-${Date.now()}.json`, {
        type: "application/json",
      });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "HouseSteady — zone log" });
      } else {
        showToast("This device will not share that file");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No zone log");
    }
  };

  const shareAllFrames = async (capture: MediaRef) => {
    const refs = [capture, ...(capture.siblings ?? [])];
    const files: File[] = [];
    for (const [index, ref] of refs.entries()) {
      const row = await db.media.get(ref.mediaId);
      if (!row) continue;
      // Numbered so the sequence survives the transfer — a traverse's frames differ by position,
      // and a folder sorted by name has to preserve that.
      const n = String(index).padStart(3, "0");
      files.push(new File([row.blob], `hs-${n}-${ref.mediaId}.jpg`, { type: ref.mime }));
    }
    if (!files.length) return;
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      await navigator.share({ files, title: `HouseSteady — ${files.length} frames` });
    } else {
      showToast("This device will not share that many files at once");
    }
  };

  /** A filed frame off the device as its own file. Sending a screenshot of it loses the pixels
   *  that any measurement has to be made on. */
  const shareStoredFrame = async (frame: MediaRef) => {
    const row = await db.media.get(frame.mediaId);
    if (!row) return;
    const file = new File([row.blob], `hs-frame-${frame.mediaId}.jpg`, { type: frame.mime });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "HouseSteady frame" });
    }
  };

  /** Off the device, because the whole question is whether a human can hear the click. */
  const shareAudioClip = async () => {
    if (!audioClip) return;
    const response = await fetch(frameUrl(audioClip.path));
    const blob = await response.blob();
    const file = new File([blob], `hs-shutter-probe-${audioClip.endedAt.replace(/[:.]/g, "-")}.m4a`, {
      type: "audio/mp4",
    });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "HouseSteady shutter probe" });
    }
  };

  /** ⚑ Returns the lens ACHIEVED, so a caller can paint from the return rather than the ask. It
   *  used to return nothing, which left every caller with only the request to go on. */
  const chooseLens = async (lens: CameraLens): Promise<CameraLens | null> => {
    try {
      const achieved = await requestLens(lens);
      if (achieved.lens !== lens) showToast(`lens stayed ${achieved.lens}`);
      return achieved.lens;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  /** The mode's default lens for a door, applied when that door is opened. The concierge can still
   *  change it afterwards — this is a default, never a lock. */
  /**
   * ⚑ **Waits for the status, and says so when it never comes.**
   *
   * The room-shot effect fires the moment the zone opens. `modeStatus` is an event from the native
   * side and has usually **not arrived yet** — so the previous version read `status` (the state,
   * out of its own render's closure), found `null`, and **returned silently**. The room shot then
   * opened on NORMAL while the ruling of 2026-08-16 says wide, and the field found it before any
   * test did: *"in a tight room, without viewing through wide angle, it's hard to know if I am
   * getting the shot I need."*
   *
   * ⛑ Two defects, one line. It read the **state** where the traverse path twenty lines above
   * correctly reads `statusRef.current` — the third instance of that class in this file today. And
   * it treated *not ready yet* as *nothing to do*, which is the silent-no-op shape this repo keeps
   * paying for. It now waits, and if the status never comes it **reports** rather than shrugging.
   */
  const applyIntentLens = async (intent: LensIntent) => {
    const deadline = Date.now() + 2500;
    while (!statusRef.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const live = statusRef.current;
    if (!live) {
      setZoneNote("camera never reported its state — lens left as found");
      return;
    }
    if (!live.lensAvailable) return;
    const policy = lensPolicyFor(live.mode, intent);
    if (policy.locked || live.lens === policy.default) return;
    const achieved = await chooseLens(policy.default);
    /* Painted from the return, never from the ask. A control that claims a field of view the
       photograph does not have is the failure this whole contract exists to prevent. */
    if (achieved && achieved !== policy.default) {
      setZoneNote(`lens stayed ${achieved} — wanted ${policy.default}`);
    }
  };

  const diagnosis = traverseResult ? traverseDiagnosis(traverseResult) : null;
  const eyes = traverseResult ? framesNeedingEyes(traverseResult) : [];
  /* ⚑ Reached, not merely computed. The whole point of recording the device's live angle is that
     someone can see where it parted from the stamp — a number that never reaches a reader is rule
     43 again, and this file has paid for that six times. */
  const turned = traverseResult ? framesTurnedFromStamp(traverseResult) : [];
  const frameState = frameStateOf(status);
  // Clamped rather than trusted: a stack of three followed by a stack of one would otherwise
  // leave the index pointing past the end and render nothing at all.
  const shown = viewing?.frames[Math.min(frameIndex, viewing.frames.length - 1)];

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
      {open && (
        <ContainerFrame
          icon={strip.current?.iconMediaId}
          mime={strip.current?.iconMime}
          count={strip.current?.captureCount ?? 0}
        />
      )}

      <div className="relative flex-1">
        {text && status?.mode === "text" && <Overlay boxes={text.boxes} />}
        {status?.level && (status.mode === "text" || status.mode === "document") && (
          <Level roll={status.level.roll} square={status.level.square} />
        )}
      </div>

      {zoneId && (
        <ObjectStrip
          model={strip}
          onNew={() => void newContainer()}
          onTap={(pinId) => setOpen((current) => tapContainer(current, pinId, zoneId))}
        />
      )}

      {/*
        ⛑ **Moved out of the bottom row, where it sat underneath the mode buttons and could not be
        tapped.** It belongs at the top with the zone name, because it is about *where you are* —
        which is what the header already says — and the bottom of a viewfinder is the shutter's.
      */}
      {/*
        ⛑ **The deliverable, on screen, where it can be disagreed with.** A scan that reports *five
        walls* is unfalsifiable — nobody in the room can tell a correct five from a wrong five. Drawn
        to scale with the lengths on it, the concierge checks it against the room they are standing
        in, which is the only moment a wrong answer is cheap to fix.
      */}
      {/* ⛑ **The black screen, named.** While ARKit holds the lens the capture session is stopped
          and there is nothing to draw — 1 s on a fresh session, up to 5 s relocalising. Unlabelled,
          that is indistinguishable from a crash, and the field read it as one twice. */}
      {measuring && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70">
          <p className="rounded-lg bg-slate-900/90 px-4 py-3 text-sm text-slate-200 ring-1 ring-slate-600">
            measuring position — the preview is off while the sensor has the lens
          </p>
        </div>
      )}
      {zoneId && plan && (scanning || !traversing) && (
        <div className="pointer-events-none absolute right-3 top-14 w-40">
          <div className="pointer-events-auto rounded-lg bg-slate-950/85 p-1 ring-1 ring-slate-700">
            <FloorPlanView plan={plan} height={140} labels={!scanning} />
          </div>
        </div>
      )}
      {zoneId && (
        <ZoneStrip
          open={zoneOpen}
          mode={zoneMode}
          paused={zonePaused}
          tracking={zoneTracking}
          scanning={scanning}
          meshing={meshing}
          note={zoneNote}
          failure={zoneFailure}
          progress={roomProgress}
          onRetry={() => void retryZone()}
          onFinishScan={() => void finishScan()}
          onFinishMesh={() => void finishMesh()}
          onTogglePause={() => void togglePause()}
        />
      )}

      <header className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        {/*
          ⛑ **Back, not Home** (owner ruling 2026-08-21). Leaving the viewfinder dropped the
          concierge at the app root, and getting back to the room they were standing in meant
          resuming the visit and finding the zone again — three taps to undo one.

          ⚑ The viewfinder was reached FROM a zone, so leaving it goes back to that zone. Home stays
          reachable from there, which is where a step out of the visit belongs. When there is no
          zone — the camera opened from Home as the plate harness — Home is still the only way back
          and the label says so rather than promising a screen that does not exist.
        */}
        <button
          type="button"
          onClick={() => navigate(zoneId ? { name: "zone2", zoneId } : { name: "home" })}
          className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-600"
        >
          {zoneId ? "← Back" : "← Home"}
        </button>
        {/* Where shots are landing, always on screen — the 2026-07-26 field report's core
            complaint was not knowing where a capture went. Absent when there is no zone, which
            says the same thing honestly: this is the harness and nothing is being filed. */}
        {zone && (
          <span className="rounded-full bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100">→ {zone.label}</span>
        )}
        {/* ⚑ And when there is NO zone, say what this screen is. The absence used to be the whole
            signal, on the theory that nothing on screen means nothing is being filed — but the
            owner reached it from Home on 2026-08-16, found no container control, and concluded the
            feature was missing. It was not; it is hidden because there is no zone to file into.
            An absence cannot distinguish "nothing is being filed" from "this is broken", so the
            screen names itself instead. */}
        {/* ⚑ Drawn, because an action that silently changes what the next shot MEANS is the
            container failure again: a run trace filed as an ordinary object shot looks exactly
            like one filed correctly, and nothing downstream can tell. */}
        {pendingIntent && (
          <span className="rounded-full bg-brass-500 px-3 py-1.5 text-sm font-semibold text-slate-950">
            next shot · {pendingIntent === "run-trace" ? "run trace" : "room shot"}
          </span>
        )}
        {!zone && (
          <span className="rounded-full bg-slate-900/70 px-3 py-1.5 text-sm text-slate-400">
            camera harness · nothing is filed · enter from a zone to test objects
          </span>
        )}
        <div className="flex items-center gap-2">
          {/*
            ⚑ **The torch word is gone, and removal is the answer rather than a third fix.**

            It said the same thing as the torch button and said it a beat later, because it was
            painted from `torchOn` alone while the button now carries asked / on / off. The owner
            offered both options — teach it the same three states, or drop it — and two indicators
            for one fact is the worse of the two whichever is faster: the moment they disagree, and
            they did, the concierge has to work out which one to believe.

            What survives is the one you can act on. The button is where the tap lands, so the
            button is where the state belongs.
          */}
          {frameState === "degraded" && (
            <span className="rounded-full bg-rose-500 px-2 py-1 text-xs text-white">
              {status?.unmet.join(", ")}
            </span>
          )}
          {/* ⚑ The lens is the concierge's (owner ruling 2026-08-16). Painted from `status.lens`,
              which is what the session actually holds — never from the tap, for the same reason the
              frame colour is painted from `setMode`'s return. Hidden when this iPad has no
              ultra-wide; disabled, not hidden, when the MODE refuses it, because "not available
              here" and "not available at all" are different sentences and a missing control says
              neither. */}
          {status?.lensAvailable && (
            <button
              type="button"
              aria-label="Lens"
              disabled={status.lensLocked}
              onClick={() => void chooseLens(status.lens === "wide" ? "normal" : "wide")}
              className={`rounded-lg px-3 py-2 text-xs ring-1 ${
                status.lensLocked
                  ? "bg-slate-900/40 text-slate-600 ring-slate-700"
                  : status.lens === "wide"
                    ? "bg-sky-500 text-slate-900 ring-sky-400"
                    : "bg-slate-900/70 text-slate-300 ring-slate-600"
              }`}
            >
              {status.lensLocked ? "wide n/a here" : status.lens === "wide" ? "wide" : "normal"}
            </button>
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
            <span className="text-slate-500">
              {" "}
              (on ≥{status.underLitThreshold}, off &lt;{status.torchReleaseThreshold})
            </span>
            {/* Otherwise a torch that is correctly off while the score says "arm" reads as a
                contradiction rather than as a decision taken on better evidence. */}
            {status.companionVetoActive && (
              <span className="text-emerald-400"> · unlit frame read fine, torch held off</span>
            )}
          </p>
          {/* Where that score came from. A room too dark to read a plate in should show ISO near
              the ceiling; if it does not, the ceiling is what makes the score look mild and the
              arm threshold is being asked the wrong question. */}
          <p className="text-slate-500">
            iso <span className="font-mono text-slate-300">{Math.round(status.iso)}</span>/
            <span className="font-mono text-slate-300">{Math.round(status.isoMax)}</span> ·{" "}
            <span className="font-mono text-slate-300">{status.exposureMs.toFixed(1)}</span>ms
          </p>
          {/* Both angles, because the field bug was two rotation tables disagreeing. If these
              two and a frame's exifOrientation ever tell different stories, that IS the finding. */}
          <p>
            rotation · <span className="font-mono text-slate-100">{status.previewRotationAngle}°</span> preview ·{" "}
            <span className="font-mono text-slate-100">{status.captureRotationAngle}°</span> capture
          </p>
          {/* ⚑ Both lines below say when they are NOT measuring, rather than leaving the last
              value on screen. Two panels nineteen minutes apart on 2026-08-16 both read
              `motion · 0.0883` and `read · 0 chars` because this whole block was published only
              from the recognition callback, which object mode and every traverse skip. A number
              that has stopped moving is read as a number that is not moving. */}
          {text && (
            <p>
              read ·{" "}
              {text.reading ? (
                <>
                  <span className="font-mono text-slate-100">{text.characterCount}</span> chars ·{" "}
                  {text.meanConfidence.toFixed(2)}
                  {text.marginal && <span className="text-amber-400"> marginal</span>}
                </>
              ) : (
                <span className="text-slate-500">not read in this mode</span>
              )}
            </p>
          )}
          {text && (
            <p>
              motion ·{" "}
              {status.motionLive ? (
                <>
                  <span className="font-mono text-slate-100">{text.motion.toFixed(4)}</span>
                  {/* Fixed to four places: the gate is computed now, not a constant, and printing
                      a raw float spilled 0.01353200318753853 across two lines in the field. */}
                  <span className="text-slate-500"> (still under {text.stillThreshold.toFixed(4)})</span>
                  {text.still && <span className="text-emerald-400"> steady</span>}
                </>
              ) : (
                <span className="text-slate-500">not sampled during a traverse</span>
              )}
            </p>
          )}
          <p>session · <span className="font-mono text-slate-100">{status.sessionRunning ? "running" : "stopped"}</span></p>
          {/* The two halves of "it takes a while", apart. `waited` runs from characters-on-screen
              to shutter — the threshold's to answer; `capture` is the reordered pair's and says
              nothing about steadiness. */}
          {timing && (
            <p>
              last auto · held <span className="font-mono text-slate-100">{(timing.waitedMs / 1000).toFixed(1)}s</span>
              {" · capture "}
              <span className="font-mono text-slate-100">{(timing.captureMs / 1000).toFixed(1)}s</span>
            </p>
          )}
          {/*
            ⚑ **The shutter-sound probe — a measurement, not a feature** (owner approval
            2026-08-16). Whether the camera's click lands inside a live recording decides the shape
            of the run trace, and it is a device fact: it varies by region, by iOS version and by
            whether an audio session is active, so it cannot be settled by reading documentation.

            Record → take a capture → stop → listen. It sits inside the instruments panel because
            that is a harness, and nothing in the concierge's path reaches it.
          */}
          <div className="mt-2 border-t border-slate-700 pt-2">
            <button
              type="button"
              onClick={() => void toggleAudioProbe()}
              className={`w-full rounded-lg px-2 py-1.5 text-xs ring-1 ${
                audioProbe
                  ? "bg-rose-500 text-white ring-rose-400"
                  : "bg-slate-900/70 text-slate-300 ring-slate-600"
              }`}
            >
              {audioProbe ? "recording — capture, then stop" : "shutter-sound probe"}
            </button>
            {audioProbe?.otherAudioPlaying && (
              // Without this a silent recording proves nothing: another app owns the session.
              <p className="mt-1 text-amber-400">another app owns the audio session</p>
            )}
            {audioClip && (
              <p className="mt-1">
                <button type="button" onClick={() => void shareAudioClip()} className="underline">
                  send clip ({Math.round(audioClip.bytes / 1024)} kB)
                </button>
              </p>
            )}
          </div>
          {capabilities && (
            <p className="mt-1 text-slate-500">
              {/* ⚑ "has torch", not "torch on", and the rename is a correction. This line reports
                  `device.hasTorch` — a permanent hardware fact — and reading it as the torch's
                  live state on 2026-08-16 produced a whole false finding: 98 minutes of thermal
                  walk reported as "the torch was lit throughout", which it was not. The live state
                  has its own indicator, the amber pill in the header, and only that one moves. */}
              brackets {capabilities.maxBracketedFrames} · has torch {String(capabilities.torch)}
              {status.lensAvailable && <> · lens {status.lens}{status.lensLocked ? " (locked)" : ""}</>}
              {/* Reported so the ultra-wide question is settled by a run rather than by a guess
                  about which iPad this is. Nothing switches lens yet — that needs a ruling. */}
              {capabilities.lenses?.length > 0 && (
                <> · lenses {capabilities.lenses.map((l) => l.replace(/^AVCaptureDeviceTypeBuiltIn/, "")).join(", ")}</>
              )}
            </p>
          )}

          {/*
            ⚑ The traverse, as an INSTRUMENT and deliberately not a door. It lives inside the
            instruments panel — beside the thermal and light readouts, behind a toggle, in
            monospace — because the owner held the capture kind back: a surface built now would
            harden around a kind whose job may be about to double if the run trace turns out to
            be the same primitive. This is the thing that lets tomorrow's L-walk be measured, and
            nothing a concierge would ever find.
          */}
          <div className="mt-2 border-t border-slate-700 pt-2">
            <button
              type="button"
              onClick={() => void (traversing ? endTraverse() : beginTraverse())}
              className={`w-full rounded-lg px-3 py-2 text-xs ring-1 ${
                traversing ? "bg-brass-500 text-slate-950 ring-brass-400" : "bg-slate-900 text-slate-300 ring-slate-600"
              }`}
            >
              {traversing ? "stop traverse" : "start traverse"}
            </button>
            {traversing && traverseProgress && (
              <p className="mt-1">
                frames · <span className="font-mono text-slate-100">{traverseProgress.frames}</span>
                {traverseProgress.lastPair?.measured && (
                  <>
                    {" · overlap "}
                    <span className="font-mono text-slate-100">
                      {(traverseProgress.lastPair.overlap ?? 0).toFixed(2)}
                    </span>
                    {" · disparity "}
                    <span className="font-mono text-slate-100">
                      {(traverseProgress.lastPair.disparity ?? 0).toFixed(3)}
                    </span>
                  </>
                )}
                {/* ⚑ The live per-pair verdict was green/amber/rose here, which is a colour
                    asserting coverage frame by frame while the concierge is still walking. It read
                    emerald straight through both carries on 2026-08-19. Pinned: the word stays,
                    uncoloured and grey, because it is still worth watching and no longer worth
                    believing. */}
                {traverseProgress.lastPair && (
                  <span className="text-slate-500">
                    {" "}
                    {traverseProgress.lastPair.contiguity}
                  </span>
                )}
              </p>
            )}
            {traverseResult && !traversing && (
              <p className="mt-1">
                {/*
                  ⚑ **The traverse is pinned, and the verdict stops headlining at the same moment it
                  stops being trusted** (owner ruling 2026-08-19). The gap detector is abandoned
                  after eight measures failed in one family; the traverse still fires, still files
                  frames and still records overlap, because the desk needs frames rather than a
                  verdict — a gap is only actionable in the room, while it can still be re-walked.

                  Leaving a demoted verdict in the lead is the retired-metric defect for the THIRD
                  time: `disparity` printed as though it still gated, the torch word meant two
                  things, and now this. So the frames lead — they are what the leg actually produced
                  — and the verdict drops to the grey line beside `disparity`, labelled the same way.
                */}
                {legNumber > 1 && <span className="text-brass-400">leg {legNumber} · </span>}
                <span className="font-mono text-slate-100">{traverseResult.frames.length}</span>{" "}
                frames · {traverseResult.unverified} unverified
                {/* ⚑ Said out loud, never inferred from a smaller count. A leg that drops frames
                    while walking is doing what it was told; a leg that drops them silently is a
                    leg whose frame count means something different from the one beside it. */}
                {(traverseResult.discarded ?? 0) > 0 && (
                  <span className="text-slate-400"> · {traverseResult.discarded} dropped walking</span>
                )}
                {traverseResult.exposure && (
                  <>
                    {" · "}
                    <span className="font-mono text-slate-100">
                      1/{Math.round(traverseResult.exposure.shutter)}
                    </span>
                    {" @ ISO "}
                    <span className="font-mono text-slate-100">
                      {Math.round(traverseResult.exposure.iso)}
                    </span>
                    {/* ⚑ Gated on the verdict, not printed always: the room refusing the 1/30 floor
                        is a real thing to say, and saying "exposure fine" on every other leg is the
                        alarm-on-the-majority-case failure. */}
                    {traverseResult.exposure.underExposed && (
                      <span className="text-amber-400"> · dark, floor held</span>
                    )}
                  </>
                )}
                {traverseResult.unmet.length > 0 && (
                  <span className="text-amber-400"> · unmet {traverseResult.unmet.join(", ")}</span>
                )}
              </p>
            )}
            {/*
              ⚑ **Why it could not say, not just how often.** Two runs on 2026-08-16 came back 87%
              and 86% unverified at two different frame spacings — which refutes the reason the
              spacing was halved and leaves several causes the counts cannot separate. These are
              the numbers the verdict was computed from.

              The attribution line is gated: it appears only when one axis genuinely dominates.
              Printing a cause on ambiguous data is the alarm-on-the-majority-case failure landing
              on the one question where a confident wrong answer costs another wasted round.
            */}
            {/*
              ⚑ **The panel led with a retired metric, which is the torch word's defect one screen
              over.** `disparity` stopped gating anything when the trust check moved to the whole
              frame — so on a run that scored 21 of 28 with no gaps it correctly read 0.4668, and
              the owner read that as something being wrong. It also printed *the y axis is spending
              the tolerance* against a tolerance nothing is spent on any more.

              So the order follows the decision: what the verdict turned on first, then why the
              rest could not be judged, then the retired number labelled as retired. The attribution
              line is gone rather than repointed — an attribution for a check that no longer gates
              is exactly the sentence that misled.
            */}
            {traverseResult && !traversing && diagnosis && (
              <p className="mt-1 text-slate-400">
                {/* ⚑ Shown so the field builds the distribution the decision needs. Same-place
                    sits at 0.27-0.70 across three lighting conditions; different-place at
                    0.73-1.28 on five pairs. A margin of 0.027 is not a threshold. */}
                {traverseResult.exposure && (
                  <>
                    {/* ⚑ Metered against taken. The pair is the whole point: it says what the room
                        offered and what the leg took, so the noise question the shutter costing
                        could not settle from banked frames is answered by walks rather than by
                        argument. */}
                    metered 1/{Math.round(traverseResult.exposure.meteredShutter)} @ ISO{" "}
                    {Math.round(traverseResult.exposure.meteredISO)} · ceiling{" "}
                    {Math.round(traverseResult.exposure.isoCeiling)}
                    <br />
                  </>
                )}
                place ·{" "}
                <span className="font-mono text-slate-100">
                  {diagnosis.medianPlaceDistance?.toFixed(3) ?? "—"}
                </span>
                {" "}· cross-check med ·{" "}
                <span className="font-mono text-slate-100">{diagnosis.medianCrossCheck?.toFixed(4) ?? "—"}</span>
                {" "}· {diagnosis.measured} judged
                <br />
                cannot-say · {diagnosis.reasons.tooLittleTexture} nothing to see ·{" "}
                {diagnosis.reasons.flowStill} image still · {diagnosis.reasons.crossCheck} cross-check ·{" "}
                {diagnosis.reasons.implausibleShift} implausible · {diagnosis.reasons.unregistered} unregistered
                {turned.length > 0 && (
                  <>
                    <br />
                    {/* ⚑ Not an alarm and not a fault: the leg was walked with the iPad turned, the
                        files claim the angle it started at, and the desk should know which frames
                        those are rather than discover it by looking at a sideways photograph. */}
                    <span className="text-slate-400">
                      turned from stamp · frames {turned.join(", ")}
                    </span>
                  </>
                )}
                {eyes.length > 0 && (
                  <>
                    <br />
                    {/* ⚑ Not an alarm: the measurement is in doubt, not the coverage. The frames
                        are named because a person settles in seconds what arithmetic cannot. */}
                    <span className="text-amber-400">look at frames {eyes.join(", ")}</span>
                  </>
                )}
                <br />
                <span className="text-slate-600">
                  coverage {traverseVerdict(traverseResult)} · {traverseResult.gaps} gap
                  {traverseResult.gaps === 1 ? "" : "s"} · disparity{" "}
                  {diagnosis.medianDisparity?.toFixed(4) ?? "—"} — recorded, not deciding
                </span>
              </p>
            )}
            {/*
              ⛑ **Always offered, not gated on a zone being open.** The run worth sending is usually
              the one that just went wrong, and by then the session has closed — a share button that
              needs a healthy session shares nothing on the day it is needed.
            */}
            <p className="mt-1">
              <button type="button" onClick={() => void shareZoneLog()} className="underline">
                send zone log
              </button>
            </p>
            {traverseResult && !traversing && traverseResult.pairs.length > 0 && (
              <p className="mt-1">
                <button type="button" onClick={() => void shareTraverseData()} className="underline">
                  send traverse numbers
                </button>
              </p>
            )}
            {/*
              ⚑ **Resume declares a break; it does not claim coverage across one.**

              *I chose to stop here* is a fact the concierge is qualified to state. *Nothing was
              missed between the legs* belongs to the desk, and this button records no opinion on
              it — which is why the join is `declared` and never `contiguous`.

              Offered beside "start traverse" rather than instead of it, because the two mean
              different things and the record distinguishes them: a declared continuation, or two
              unrelated pans.
            */}
            {traverseResult && !traversing && (
              <p className="mt-1">
                <button
                  type="button"
                  onClick={() => void beginTraverse(traverseResult.startedAt)}
                  className="rounded-lg bg-slate-900/70 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-600"
                >
                  {/* ⚑ The leg number is on the button, because the owner pressed it and the frame
                      count restarted at 1 with nothing saying why. Restarting is correct — each leg
                      is its own capture and its frames differ by position WITHIN that leg — but a
                      counter that resets with no explanation reads as work lost. Naming the leg
                      makes the restart the expected thing rather than a surprise. */}
                  resume — start leg {legNumber + 1}, declaring a break
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-16 rounded-lg bg-rose-950/90 p-3 text-sm text-rose-100 ring-1 ring-rose-800">
          {error}
        </div>
      )}

      {/*
        A filed capture, full size.

        ⚑ **One frame, and the panel says so rather than letting the absence pass as completeness.**
        Only `frames[0]` is ever stored — the other exposures of a bracket, and the unlit half of a
        torch pair, live in the native temp directory and are never written to the record. So this
        can show what was filed and nothing else, and stepping through a stack here is not
        bookkeeping that was skipped, it is **frames that do not exist to step through**. Storing
        them is a manifest question and a cross-repo contract, not this session's to settle (#163's
        neighbour).
      */}
      {/*
        ⚑ **Every frame of a filed capture, from the record.**

        This viewer used to show one image and say *the bracket's other exposures are not stored* —
        which was true when it was written and became false the moment siblings shipped, so the
        screen went on asserting an absence the record had already filled. **A message that was
        accurate once is not a message that stays accurate**, and nothing made it re-check.

        Reading from the stored siblings rather than from this session's in-memory map is also what
        makes it work at all on a capture from an earlier visit — which is most of them, and was the
        case the owner hit.
      */}
      {openCapture && (() => {
        const frames = [openCapture, ...(openCapture.siblings ?? [])];
        const shownFrame = frames[Math.min(storedIndex, frames.length - 1)] ?? openCapture;
        return (
          <div className="absolute inset-0 z-40 flex flex-col bg-slate-950/95">
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="text-xs text-slate-400">
                {storedFrameLabel(shownFrame, storedIndex)} · {storedIndex + 1} of {frames.length}
              </span>
              <div className="flex shrink-0 gap-2">
                {/* ⚑ Screenshots are not the frames. A harness built on re-rendered, re-cropped
                    screenshots disagreed with the device on a pair whose value was known, so the
                    scale question cannot be settled from them — it needs the file. */}
                <button
                  type="button"
                  onClick={() => void shareStoredFrame(shownFrame)}
                  className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
                >
                  send
                </button>
                {frames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void shareAllFrames(openCapture)}
                    className="rounded-lg bg-slate-900/70 px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
                  >
                    send all {frames.length}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStoredActual((v) => !v)}
                  className={`rounded-lg px-3 py-2 text-sm ring-1 ${
                    storedActual
                      ? "bg-slate-100 text-slate-900 ring-slate-100"
                      : "bg-slate-900/70 text-slate-300 ring-slate-600"
                  }`}
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => setOpenCapture(null)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200"
                >
                  close
                </button>
              </div>
            </div>
            {/* ⚑ 1:1 is here because judging a plate at 100% is the camera's acceptance test, and
                a viewer that only ever fits-to-screen cannot perform it — the owner asked for it by
                noticing it was missing. Fit is the default because most frames are being
                identified rather than read. */}
            <div className={`flex min-h-0 flex-1 p-2 ${storedActual ? "overflow-auto" : "items-center justify-center"}`}>
              <MediaThumb
                mediaId={shownFrame.mediaId}
                mime={shownFrame.mime}
                className={storedActual ? "max-w-none" : "max-h-full max-w-full object-contain"}
              />
            </div>
            {frames.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {frames.map((f, index) => (
                  <button
                    key={f.mediaId}
                    type="button"
                    onClick={() => setStoredIndex(index)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs ring-1 ${
                      index === storedIndex
                        ? "bg-slate-100 text-slate-900 ring-slate-100"
                        : "bg-slate-900/70 text-slate-300 ring-slate-600"
                    }`}
                  >
                    {storedFrameLabel(f, index)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/*
        ⛑ **A scan is not a photograph-taking mode** (owner ruling 2026-08-21). While the floorplan
        or the mesh is running the shutter, the modes, the filmstrip and the torch are all doors to
        an act that cannot happen — ARKit holds the lens — and offering them makes the screen look
        broken rather than busy. The scan gets its finish action and nothing else.
      */}
      {!scanning && !meshing && (
      <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
        {/*
          ⚑ Two different strips, and which one appears is decided by whether anything is being
          filed at all. In a zone the bottom strip is **the record of where you are standing**
          (owner, 2026-08-16). In the harness there is no zone, nothing files, and the strip stays
          what Field 4b built: this session's captures, tappable into the 1:1 reviewer — which is
          where a plate gets judged and always has been.
        */}
        {zoneId && (
          <ContextFilmstrip
            model={strip}
            label={zone?.label ?? "zone"}
            /* Shot this visit → the full reviewer, with its exposure stack and 1:1. Filed earlier →
               the flat viewer, which is all the record can offer. The strip does not need to know
               the difference; the tap resolves it. */
            onOpen={(capture) => {
              const shot = sessionFrames.current.get(capture.mediaId);
              if (shot) {
                setFrameIndex(0);
                setViewing(shot);
              } else {
                setStoredIndex(0);
                setStoredActual(false);
                setOpenCapture(capture);
              }
            }}
          />
        )}
        {!zoneId && shots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot) => (
              <button
                key={shot.at + shot.frames[0]!.path}
                type="button"
                onClick={() => {
                  setFrameIndex(0);
                  setViewing(shot);
                }}
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

        {/*
          ⚑ **The traverse, promoted from instrument to control** (owner ruling 2026-08-29).

          It has lived inside the collapsed instruments panel, in monospace, *"nothing a concierge
          would ever find"* — deliberately, because the capture kind was held back while the run
          trace's costing was open: **a surface built then would have hardened around a kind whose
          job might double.** ⛑ *That costing closed today.* The run-trace video is retired and the
          traverse takes its job, so the reason to hide it is gone and the field found the hole the
          same hour: **"there's nothing there that is for the traverse."**

          ⚑ **`Next leg` is the load-bearing button, not `Stop`.** A run that doubles back must be
          walked as separate legs or the desk gets a straight line through a route that is not
          straight — and that is exactly the wrong answer the traverse exists to prevent. Burying
          the chaining behind *stop, leave, re-enter, start* would leave it unused, which is how
          this control got hidden in the first place.

          The voice button is here because **a trace is where narration is actually spoken** — the
          concierge is walking a pipe describing what it does — and sending them back to the zone
          screen to say it means it does not get said.
        */}
        {(startAction === "traverse" || traversing || traverseResult) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-950/85 p-2 ring-1 ring-slate-700">
            {/*
              ⛑ **Keeping N of M, where the concierge is looking** (2026-08-30).

              Four legs were walked across two nights that kept **nothing** — `kept: 0` every time —
              and the app said so only in a log file pulled off the device over a cable afterwards.
              *The count existed the whole time*: `onTraverse` has always carried `frames` and
              `discarded`, and the screen showed `frames` alone, inside the collapsed instruments
              panel. **A leg that is throwing everything away is visible in two seconds or it is
              visible in a post-mortem**, and this project has now done the post-mortem four times.

              ⚑ Amber only when frames are being taken and none are being kept — *a verdict before
              the prose*. Nothing to say on a leg that is going fine.
            */}
            <span
              className={`shrink-0 px-1 text-xs ${
                traversing && traverseProgress && traverseProgress.frames === 0 && (traverseProgress.discarded ?? 0) > 0
                  ? "text-amber-400"
                  : "text-slate-400"
              }`}
            >
              {measuring
                ? "measuring…"
                : traversing && traverseProgress
                  ? `leg ${legNumber} · keeping ${traverseProgress.frames}/${traverseProgress.frames + (traverseProgress.discarded ?? 0)}`
                  : traversing
                    ? `leg ${legNumber}`
                    : legNumber > 0
                      ? `${legNumber} done`
                      : "trace"}
            </span>
            <button
              type="button"
              onClick={() => void (traversing ? endTraverse() : beginTraverse())}
              className={`h-12 flex-1 rounded-lg text-sm font-medium ring-1 ${
                traversing
                  ? "bg-brass-500 text-slate-950 ring-brass-400"
                  : "bg-slate-900 text-slate-200 ring-slate-600"
              }`}
            >
              {traversing ? "stop trace" : "start trace"}
            </button>
            {traversing && (
              <button
                type="button"
                onClick={() =>
                  void endTraverse(false).then((r) =>
                    r ? beginTraverse(r.startedAt, lastEnd.current ?? undefined) : undefined,
                  )
                }
                className="h-12 flex-1 rounded-lg bg-slate-900 text-sm font-medium text-slate-200 ring-1 ring-slate-600"
              >
                next leg ↩
              </button>
            )}
            <button
              type="button"
              aria-label={recorder.state === "recording" ? "Stop the voice note" : "Voice note"}
              onClick={() => void toggleVoice()}
              className={`h-12 w-16 rounded-lg text-lg ring-1 ${
                recorder.state === "recording"
                  ? "bg-red-500 text-white ring-red-400"
                  : "bg-slate-900 text-slate-200 ring-slate-600"
              }`}
            >
              {recorder.state === "recording"
                ? `${Math.round(recorder.elapsedMs / 1000)}s${voiceGapMs !== null ? ` ·${voiceGapMs}ms` : ""}`
                : "🎙"}
            </button>
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
                  void (async () => {
                    await chooseMode(action.mode);
                    // ⚑ The door sets the lens default. A room shot is "get the whole of it in",
                    // which is the exact job the wide lens does — so opening that door should not
                    // also require remembering to change lens. Still a default: the control stays
                    // live and the concierge can go back to normal.
                    await applyIntentLens("room-shot");
                    // The door declares what the next capture IS. Without this the kind never
                    // reached the record and `captureTargetFor`'s run-trace rule never fired.
                    setPendingIntent("room-shot");
                  })();
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
              onClick={() => void toggleTorch()}
              /*
                ⚑ **Three states, not two** (owner report 2026-08-17: the torch lights immediately
                but the button takes about a second to look pressed).

                The lag is real and the rule that causes it is the right rule — the button is
                painted from the confirmed state, never from the tap, because a control painted
                from the tap is a silent failure with false reassurance on top. The `modeStatus`
                stream is what confirms, and it runs on a five-second timer, so a tap can wait
                nearly that long to be acknowledged.

                The fix is therefore not to paint from the tap. It is to admit that *asked* is a
                real state distinct from *on* and from *off*, and to show it: dimmed-amber while
                the request is outstanding, solid once the camera confirms, and back to off with a
                complaint if the confirmation never arrives. **Nothing here claims the torch is on
                until the camera says so** — it only stops pretending nothing happened.
              */
              /* ⚑ Pending is tested FIRST, and that ordering is the whole fix. Testing `torchOn`
                 first made the dim state reachable only on the way *on*: switching off left the
                 button solid amber until confirmation arrived, which is the same lag the owner
                 reported, surviving in one direction (2026-08-17). A pending state that only shows
                 for one of the two transitions is not a third state, it is a decoration. */
              className={`h-14 w-14 rounded-full text-lg ring-1 transition-colors ${
                torchPending
                  ? "bg-amber-400/40 text-amber-100 ring-amber-400/60"
                  : status?.torchOn
                    ? "bg-amber-400 text-slate-900 ring-amber-300"
                    : "bg-slate-900/70 text-slate-200 ring-slate-600"
              }`}
            >
              ⚡
            </button>
          </div>
        </div>
      </footer>
      )}

      {viewing && shown && (
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
                onClick={() => void shareFrame(viewing, frameIndex)}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-600"
              >
                Send
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <img
              src={frameUrl(shown.path)}
              alt=""
              className={oneToOne ? "max-w-none" : "h-full w-full object-contain"}
            />
          </div>

          {/*
            ⚑ Every frame in the stack is reachable (owner ruling 2026-08-16). The reviewer used
            to show frame 0 and nothing else — so a bracket of three, or the unlit half of a torch
            pair, existed on disk and could not be looked at. **The frame being judged may not be
            the best one in the stack**, and judging legibility off the wrong frame is worse than
            not judging it: it produces a confident verdict about a photograph nobody saw.

            Each frame is labelled with what it IS, not its ordinal. "no torch" is the answer to
            the question being asked; "frame 2" is not.
          */}
          {viewing.frames.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-3 pb-1">
              {viewing.frames.map((frame, index) => (
                <button
                  key={frame.path}
                  type="button"
                  onClick={() => setFrameIndex(index)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs ring-1 ${
                    index === frameIndex
                      ? "bg-slate-100 text-slate-900 ring-slate-100"
                      : "bg-slate-900 text-slate-300 ring-slate-600"
                  }`}
                >
                  {frameLabel(viewing, index)}
                  {frame.ocr && (
                    <span className="ml-1 font-mono opacity-70">{frame.ocr.meanConfidence.toFixed(2)}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="p-3 text-xs text-slate-500">
            {viewing.mode} · {viewing.frames.length} frame{viewing.frames.length > 1 ? "s" : ""} ·{" "}
            {frameLabel(viewing, frameIndex)}
            {" · "}
            {/* ⚑ Printed because two JPEGs could not settle it by argument. On a portrait shot,
                orientation 1 with a 90° request means the rotation never reached the connection. */}
            {viewing.rotationAngle}° asked · exif {shown.exifOrientation}
            {shown.ocr && ` · read ${shown.ocr.meanConfidence.toFixed(2)}`}
            {/* Gated on a pair AND two reads — see `glareSuspected`. Silence is the ordinary case. */}
            {glareSuspected(viewing) && (
              <span className="text-amber-400">
                {" · "}the two reads disagree ({Math.round((viewing.torchPairAgreement ?? 0) * 100)}%) — the
                torch probably erased characters
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** Off the device so a plate can be judged on a big screen, which is where legibility is settled.
 *  Sends the frame being LOOKED AT — sending frame 0 while the reviewer is on the unlit one would
 *  be the same confident-verdict-about-an-unseen-photograph failure, one step further along. */
async function shareFrame(shot: CaptureResult, index: number): Promise<void> {
  const frame = shot.frames[index] ?? shot.frames[0];
  if (!frame) return;
  const response = await fetch(frameUrl(frame.path));
  const blob = await response.blob();
  const suffix = shot.frames.length > 1 ? `-${frameLabel(shot, index).replace(/\s+/g, "")}` : "";
  const file = new File([blob], `hs-${shot.mode}-${shot.at.replace(/[:.]/g, "-")}${suffix}.jpg`, {
    type: "image/jpeg",
  });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "HouseSteady capture" });
  }
}
