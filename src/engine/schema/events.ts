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
}

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
