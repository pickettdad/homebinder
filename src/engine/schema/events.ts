/**
 * Session events — the append-only source of truth for a visit.
 *
 * Every field-visible action is one immutable event. Current state is a pure fold over
 * the log (see fold.ts). Nothing is ever mutated or deleted; corrections are new events.
 *
 * Provenance doctrine: every event carries `source`. v0.5 only ever writes
 * actor 'human' | 'system'; 'ai' is reserved so v1 review results land as new events
 * (referencing old ones) with zero migration.
 */

export const EVENT_SCHEMA_VERSION = 1;

export interface Source {
  actor: "human" | "ai" | "system";
  /** inspector id, model id, or 'app' */
  actorId: string;
  device: string;
  appVersion: string;
}

export interface EventBase {
  eventId: string; // UUIDv7
  sessionId: string;
  /** Per-session monotonic sequence assigned at append time — the authoritative order. */
  seq: number;
  /** Device wall clock, ISO-8601 — advisory only. */
  at: string;
  schemaVersion: number;
  source: Source;
}

export interface RoomInstance {
  roomInstanceId: string;
  zoneId: string;
  kind: string;
  label: string; // "Bedroom 2"
}

/**
 * A device read of one frame.
 *
 * ⚑ **On the frame, never on the object.** Five photographs of one water heater produce five reads
 * at five confidences, and collapsing them onto the pin would force a choice about which one is
 * *the* read — a choice nothing in the field is qualified to make.
 *
 * `engine` is a reader IDENTITY rather than a vendor name: a read is only comparable against
 * another read from the same recogniser on the same OS, so the revision and the build travel with
 * it (Register #135). Without that, two reads that disagree cannot be told from two readers that
 * disagree.
 */
export interface FrameReadMeta {
  text: string;
  engine: string;
  confidence: number;
  osVersion?: string;
}

/**
 * What this frame is within its capture, when a capture produced more than one.
 *
 * ⚑ **The two kinds are different in kind and marked as such** (design session, 2026-08-17).
 * `evidence` is the unlit companion: it answers *did the torch erase characters*, and that question
 * survives for years — it measured as the cleanest plate of two nights, 0.000% clipped against
 * 7.31%. `insurance` is the rest of a bracket: three exposures so that one reads, and once the desk
 * has resolved the plate the other two have done their job.
 *
 * Marked at write time because a retention policy that drops insurance and keeps evidence is then a
 * filter rather than a schema change — and the distinction cannot be recovered afterwards from the
 * pixels.
 */
export interface FrameRoleMeta {
  /** Groups the frames of one capture. The concierge pressed once. */
  captureId: string;
  role: "primary" | "evidence" | "insurance";
  /** Whether the torch was lit for THIS frame. On a pair the two differ, which is the whole point. */
  torch?: boolean;
  /** Exposure bias in stops, on a bracketed frame. */
  ev?: number;
  lens?: string;
  /** ⚑ Which registration model produced this run's measurements. Stamped while there is only one,
   *  because two kinds of record that look identical cannot be compared — the same reasoning
   *  `FrameReadMeta.engine` carries for a reader. */
  registration?: string;
  /** The leg this one declares itself a continuation of. ⚑ A statement about the concierge's own
   *  hands — *I chose to stop here* — and never a claim that nothing was missed across the break.
   *  That claim is the desk's, and this field deliberately does not make it. */
  continuesFrom?: string;
}

export interface CaptureMediaMeta {
  mediaId: string;
  sha256: string;
  mime: string;
  bytes: number;
  /** ⚑ Additive, and additions are the emitting side's call alone under the version policy
   *  ratified 2026-08-15 — the receiver ignores what it does not consume. Absent on every capture
   *  written before this shipped, which is exactly what "non-breaking" has to mean. */
  read?: FrameReadMeta;
  frame?: FrameRoleMeta;
  /**
   * Where this frame was taken, when a zone session was running and able to say.
   *
   * ⚑ **At least one frame per container carries a measured position; everything else inherits it.**
   * So this is expected to be present on ONE frame of a container and absent on the rest, and that
   * is completeness rather than a gap — the desk reads the container, not the frame.
   *
   * ⛑ **A refusal is recorded as a refusal, not as an absence.** `positioned: false` with a reason
   * says *the app could take a position here and did not, because the session was paused* — which a
   * missing field cannot say, and which is the difference between a container the desk cannot place
   * and a container nobody meant to place. Additive; absent on every capture written before this.
   */
  position?: CapturePositionMeta;
}

/**
 * ⚑ **Whether `transform` describes the camera that took THIS image** (owner ruling 2026-08-28).
 *
 * A pose and a camera model are two different facts and they arrive in one object, which is exactly
 * how they get confused. `x/y/z` is **where the concierge stood** and is true whatever glass was
 * fitted. `transform` additionally describes **ARKit's own 1× wide-angle camera** — the ultra-wide
 * is not offered to world tracking on this device (`HSLensProbe`, 2026-08-24) — so a 120° image
 * cannot be projected through it.
 *
 * ⛑ **This is a field rather than a paragraph in a document, and the reason is the whole day's
 * lesson.** *A rule that lives only in a document is a rule the reader has to already know.* Left
 * implicit, some future desk pass projects a 120° image through a 1× matrix and **the error looks
 * like bad measurement rather than a wrong assumption** — which is the same shape as the `voice`
 * fallthrough and the `files[]` drift.
 *
 * ⚑ **Required, not optional**, so the compiler makes the emitter decide at every site. An optional
 * field can be forgotten by a producer *and* skipped by a consumer; a required one is answered
 * every time it is stamped.
 */
export type PositionProjection =
  | { projectable: true }
  | {
      projectable: false;
      /** Why this image cannot be projected through `transform` — the fact, not the symptom. */
      why: string;
      /**
       * The frame in the SAME capture whose geometry `transform` does describe, named by the two
       * fields every entry already carries. ⛑ **`null` means no such frame was taken** — a wide
       * room shot whose sibling was refused has a real pose and nothing to project at all, and that
       * is a different sentence from *look next door*.
       *
       * *Named by `captureId` + `lens` rather than by mediaId on purpose: a sibling's mediaId is
       * minted after the pose is stamped, so carrying it here would couple the position to the
       * order media rows are written in — a coupling that breaks silently when either moves.*
       */
      projectableFrame: { captureId: string; lens: string } | null;
    };

export type CapturePositionMeta =
  | {
      positioned: true;
      zoneId: string;
      /** ⚑ ARKit's own word for how sure it was. It says when it does not know, and dropping that
       *  would repeat the mistake every traverse measure made and had corrected a round later. */
      tracking: string;
      at: string;
      x: number;
      y: number;
      z: number;
      /** Column-major 4×4, so the desk can ray-cast for itself years later. */
      transform: number[];
      /** ⚑ The pose is where the concierge STOOD. This is the surface in front of the lens, when
       *  geometry existed to hit it. Absent reads *unknown*, never *nothing there*. */
      surface?: { x: number; y: number; z: number; distance: number };
      /**
       * ⚑ **How much of the room ARKit believes it knows** — `notAvailable` | `limited` |
       * `extending` | `mapped`, straight from `ARFrame.worldMappingStatus`.
       *
       * ⛑ **Read this, not `tracking`.** `tracking` can only ever say `normal` on a positioned
       * pose, because the native side refuses anything else — 109 of 109 across the 2026-08-30
       * export. *A field with one possible value carries no information*, and this is the one that
       * does: `limited` forty minutes into a zone is a pose worth less than an early one.
       */
      mapping?: string;
      /**
       * ⚑ **How many times tracking has been re-established since this zone opened.**
       *
       * The mechanical room's poses walked **3 m below its own floor** over 42 minutes, in discrete
       * 0.4–0.7 m steps. Across that walk ARKit reported `initializing` 109 times and
       * `relocalizing` **zero** — so each wake re-derives the device pose rather than matching the
       * map it already had, and the error between one pose and the next has no correspondence.
       * *This count is what lets a desk say a late pose and an early one are not the same
       * measurement.*
       */
      reinits?: number;
      /** Seconds since that re-establishment — the other half of *how old is this pose's frame*. */
      sinceInitSec?: number;
      /** ⚑ Reported, not acted on. A pose taken against very few tracked points is a pose taken in
       *  a room with nothing to hold on to — which is the mechanical room's own description. */
      featurePoints?: number;
      /** ⚑ Whether `transform` describes the camera that took this image. See `PositionProjection`
       *  — required, so it is answered rather than assumed. */
      projection: PositionProjection;
    }
  | { positioned: false; why: string; tracking?: string };

export type SessionEvent =
  | (EventBase & {
      type: "SessionInitialized";
      routeId: string;
      configVersion: string;
      configHash: string;
      flags: string[];
      propertyLabel?: string;
    })
  | (EventBase & { type: "RoomAdded"; room: RoomInstance })
  | (EventBase & { type: "RoomRemoved"; roomInstanceId: string })
  | (EventBase & { type: "PhotoCaptured"; slotInstanceId: string; media: CaptureMediaMeta })
  | (EventBase & { type: "PhotoDiscarded"; slotInstanceId: string; mediaId: string })
  | (EventBase & {
      type: "VoiceNoteAttached";
      slotInstanceId: string;
      media: CaptureMediaMeta;
      durationMs?: number;
    })
  | (EventBase & { type: "VoiceNoteDiscarded"; slotInstanceId: string; mediaId: string })
  | (EventBase & {
      type: "ExceptionRecorded";
      slotInstanceId: string;
      reasonId: string;
      note?: string;
    })
  | (EventBase & { type: "ExceptionCleared"; slotInstanceId: string })
  | (EventBase & {
      type: "ZoneClosed";
      zoneId: string;
      summary: { captured: number; excepted: number; deferred: number };
    })
  | (EventBase & { type: "ZoneReopened"; zoneId: string; note?: string })
  | (EventBase & { type: "SessionCompleted" })
  | (EventBase & {
      type: "ExportProduced";
      manifestSha256: string;
      files: { name: string; bytes: number; sha256?: string }[];
    })
  // ---- v1 "Second look" review events. AI results land as ordinary appended events
  // ---- (actor 'ai', actorId = model id); human dispositions are later events on top.
  | (EventBase & {
      type: "ReviewRequested";
      reviewJobId: string;
      zoneId: string;
      kind: "zone-summary";
      slotInstanceIds: string[];
      mediaIds: string[];
    })
  | (EventBase & {
      type: "ReviewRecorded";
      reviewJobId: string;
      zoneId: string;
      model: string;
      findings: ReviewFindingPayload[];
      usage?: { inputTokens: number; outputTokens: number };
    })
  | (EventBase & { type: "ReviewFailed"; reviewJobId: string; zoneId: string; code: string })
  | (EventBase & {
      type: "ReviewFindingResolved";
      findingId: string;
      zoneId: string;
      resolution: "cleared" | "deferred" | "reshot";
      note?: string;
    });

export interface ReviewFindingPayload {
  findingId: string;
  slotInstanceId: string;
  mediaIds: string[];
  severity: "info" | "reshoot" | "anomaly";
  message: string;
  confidence: number;
}

export type SessionEventType = SessionEvent["type"];

/** Payload = an event minus everything the appender stamps. */
export type EventPayload = SessionEvent extends infer E
  ? E extends EventBase
    ? Omit<E, keyof EventBase>
    : never
  : never;
