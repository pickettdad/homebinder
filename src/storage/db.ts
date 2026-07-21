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

export interface SessionRow {
  id: string;
  status: "active" | "completed" | "exported" | "abandoned";
  routeId: string;
  configVersion: string;
  configHash: string;
  propertyLabel?: string;
  flags: string[];
  createdAt: string;
  updatedAt: string;
  lastEventSeq: number;
}

export interface EventRow {
  sessionId: string;
  seq: number;
  event: SessionEvent;
}

export interface MediaRow {
  id: string; // mediaId (UUIDv7)
  sessionId: string;
  slotInstanceId: string;
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
  routeId: string;
  version: string;
  config: RouteConfig;
  storedAt: string;
}

export interface OutboxRow {
  id?: number;
  sessionId: string;
  refType: "event" | "media";
  refId: string;
  status: "pending" | "synced" | "failed";
  attempts: number;
  createdAt: string;
}

export class FieldDb extends Dexie {
  sessions!: EntityTable<SessionRow, "id">;
  events!: Dexie.Table<EventRow, [string, number]>;
  media!: EntityTable<MediaRow, "id">;
  configSnapshots!: EntityTable<ConfigSnapshotRow, "hash">;
  outbox!: EntityTable<OutboxRow, "id">;

  constructor() {
    super("housesteady-field");
    this.version(1).stores({
      sessions: "id, status, createdAt",
      events: "[sessionId+seq], sessionId",
      media: "id, sessionId, slotInstanceId",
      configSnapshots: "hash",
      outbox: "++id, sessionId, status",
    });
  }
}

export const db = new FieldDb();
