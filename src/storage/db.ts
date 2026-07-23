/**
 * IndexedDB layout (Dexie). Design rules:
 *  - events are tiny JSON, keyed [sessionId+seq] for free ordered replay
 *  - media blobs live in their own table so replay never touches megabytes
 *  - every capture is ONE transaction: event + blob + outbox rows + session bump —
 *    a killed tab can never leave an event without its photo or vice versa
 *  - outbox exists from day one; nothing drains it in v0.5 (v1 sync = add a drain loop)
 */
import Dexie, { type EntityTable } from "dexie";
import type { SessionEvent } from "../engine/schema/events";
import type { RouteConfig } from "../engine/schema/routeConfig";
import type { ChecklistConfig } from "../engine/schema/checklistConfig";
import type { V2SessionEvent } from "../engine/v2/events";

/** Any event either model writes; a session's log is homogeneous (kind-routed). */
export type StoredEvent = SessionEvent | V2SessionEvent;

export interface SessionRow {
  id: string;
  status: "active" | "completed" | "exported" | "abandoned";
  /** v1 slot model (absent = v1, pre-v2 rows) or v2 pin model. */
  kind?: "v1" | "v2";
  /** v1: routeId. v2: the checklist configId. Renamed when the v1 surface is deleted. */
  routeId: string;
  configVersion: string;
  configHash: string;
  propertyLabel?: string;
  flags: string[];
  createdAt: string;
  updatedAt: string;
  lastEventSeq: number;
  /** v2 only: the global permanent pin counter (lastEventSeq pattern). */
  lastPinNumber?: number;
}

export interface EventRow {
  sessionId: string;
  seq: number;
  event: StoredEvent;
}

export interface MediaRow {
  id: string; // mediaId (UUIDv7)
  sessionId: string;
  /** v1 slot addressing. Absent on v2 rows. */
  slotInstanceId?: string;
  /** v2 target addressing (PLAN-STAGE-1 §4). Absent on v1 rows. */
  targetKind?: "pin" | "zone" | "inbox";
  targetId?: string;
  kind: "photo" | "voice";
  mime: string;
  bytes: number;
  sha256: string;
  capturedAt: string;
  durationMs?: number;
  blob: Blob;
}

export interface ConfigSnapshotRow {
  hash: string;
  /** v1: routeId. v2: configId. Informational; the hash is the identity. */
  routeId: string;
  version: string;
  config: RouteConfig | ChecklistConfig;
  storedAt: string;
}

export interface OutboxRow {
  id?: number;
  sessionId: string;
  refType: "event" | "media" | "review" | "chat";
  refId: string;
  status: "pending" | "synced" | "failed";
  attempts: number;
  createdAt: string;
}

/**
 * A queued on-demand chat request (one turn). Mirrors ReviewJobRow's mechanics —
 * jobId doubles as the Idempotency-Key; the drain loop is the only consumer.
 */
export interface ChatJobRow {
  jobId: string;
  sessionId: string;
  threadId: string;
  status: "pending" | "inflight" | "done" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastErrorCode?: string;
  createdAt: string;
}

/**
 * A "Second look" review job: one queued network request covering a chunk of a zone's
 * captures. Jobs are created atomically with the ZoneClosed + ReviewRequested events;
 * the drain loop is their only consumer. Failed jobs re-arm on connectivity, and only
 * abandoning the session drops them.
 */
export interface ReviewJobRow {
  jobId: string; // UUIDv7; doubles as the Idempotency-Key
  sessionId: string;
  zoneId: string;
  kind: "zone-summary";
  chunkIndex: number;
  chunkOf: number;
  slotInstanceIds: string[];
  mediaIds: string[];
  status: "pending" | "inflight" | "done" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastErrorCode?: string;
  createdAt: string;
}

export class FieldDb extends Dexie {
  sessions!: EntityTable<SessionRow, "id">;
  events!: Dexie.Table<EventRow, [string, number]>;
  media!: EntityTable<MediaRow, "id">;
  configSnapshots!: EntityTable<ConfigSnapshotRow, "hash">;
  outbox!: EntityTable<OutboxRow, "id">;
  reviewJobs!: EntityTable<ReviewJobRow, "jobId">;
  chatJobs!: EntityTable<ChatJobRow, "jobId">;

  constructor() {
    super("housesteady-field");
    this.version(1).stores({
      sessions: "id, status, createdAt",
      events: "[sessionId+seq], sessionId",
      media: "id, sessionId, slotInstanceId",
      configSnapshots: "hash",
      outbox: "++id, sessionId, status",
    });
    this.version(2).stores({
      reviewJobs: "jobId, sessionId, status",
    });
    // v2 pin model: target-addressed media (slotInstanceId index kept — v1 rows remain
    // readable until legacy sessions are deleted), chat job queue. Nullable-field
    // additions (kind, lastPinNumber, targetKind/targetId) need no upgrade function.
    this.version(3).stores({
      media: "id, sessionId, slotInstanceId, targetId",
      chatJobs: "jobId, sessionId, status",
    });
  }
}

export const db = new FieldDb();
