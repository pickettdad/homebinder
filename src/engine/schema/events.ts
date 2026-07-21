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

export interface CaptureMediaMeta {
  mediaId: string;
  sha256: string;
  mime: string;
  bytes: number;
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
    });

export type SessionEventType = SessionEvent["type"];

/** Payload = an event minus everything the appender stamps. */
export type EventPayload = SessionEvent extends infer E
  ? E extends EventBase
    ? Omit<E, keyof EventBase>
    : never
  : never;
