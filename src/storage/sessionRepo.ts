/**
 * Session persistence operations. The single-writer append path lives here.
 */
import { db, type MediaRow, type SessionRow, type StoredEvent } from "./db";
import type { EventPayload, SessionEvent, Source } from "../engine/schema/events";
import { EVENT_SCHEMA_VERSION, type RoomInstance } from "../engine/schema/events";
import type { RouteConfig } from "../engine/schema/routeConfig";
import type { ChecklistConfig } from "../engine/schema/checklistConfig";
import { EVENT_SCHEMA_VERSION_V2, type V2EventPayload } from "../engine/v2/events";
import { uuidv7 } from "../engine/ids";
import { hashConfig } from "../engine/canonical";

/** Either model's payloads; a session only ever receives its own kind's. */
export type AnyEventPayload = EventPayload | V2EventPayload;

export const APP_VERSION = "0.5.0";

export function deviceSource(): Source {
  return {
    actor: "human",
    actorId: "inspector",
    device: typeof navigator !== "undefined" ? navigator.platform || "unknown" : "test",
    appVersion: APP_VERSION,
  };
}

const systemSource = (): Source => ({ ...deviceSource(), actor: "system", actorId: "app" });

/**
 * Append events (+ optional media blobs) atomically. Seq is assigned inside the
 * transaction from the session row — single-writer, no races (a Web Lock guards
 * multi-tab at the store layer).
 *
 * v2 addition: PinCreated payloads get their session-scoped pinNumber stamped here,
 * from the session row's lastPinNumber counter — the same in-transaction pattern as
 * seq. Callers pass pinNumber: 0 and read the stamped value off the returned event.
 */
export async function appendEvents(
  sessionId: string,
  payloads: AnyEventPayload[],
  media: MediaRow[] = [],
  source?: Source,
): Promise<StoredEvent[]> {
  const src = source ?? deviceSource();
  return db.transaction("rw", [db.sessions, db.events, db.media, db.outbox], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session ${sessionId}`);
    let seq = session.lastEventSeq;
    let pinNumber = session.lastPinNumber ?? 0;
    const schemaVersion = session.kind === "v2" ? EVENT_SCHEMA_VERSION_V2 : EVENT_SCHEMA_VERSION;
    const now = new Date().toISOString();
    const events: StoredEvent[] = payloads.map((payload) => {
      seq += 1;
      const stamped = payload.type === "PinCreated" ? { ...payload, pinNumber: ++pinNumber } : payload;
      return {
        ...stamped,
        eventId: uuidv7(),
        sessionId,
        seq,
        at: now,
        schemaVersion,
        source: payload.type === "SessionInitialized" ? systemSource() : src,
      } as StoredEvent;
    });

    await db.events.bulkAdd(events.map((event) => ({ sessionId, seq: event.seq, event })));
    if (media.length) await db.media.bulkAdd(media);
    await db.outbox.bulkAdd([
      ...events.map((e) => ({ sessionId, refType: "event" as const, refId: e.eventId, status: "pending" as const, attempts: 0, createdAt: now })),
      ...media.map((m) => ({ sessionId, refType: "media" as const, refId: m.id, status: "pending" as const, attempts: 0, createdAt: now })),
    ]);
    await db.sessions.update(sessionId, { lastEventSeq: seq, lastPinNumber: pinNumber, updatedAt: now });
    return events;
  });
}

export async function deleteMedia(mediaIds: string[]): Promise<void> {
  await db.media.bulkDelete(mediaIds);
}

export async function loadEvents(sessionId: string): Promise<StoredEvent[]> {
  const rows = await db.events.where("[sessionId+seq]").between([sessionId, 0], [sessionId, Infinity]).toArray();
  return rows.map((r) => r.event);
}

// ---- v1-typed views for the slot-model store/UI. A v1 session's log only ever
// ---- contains v1 events, so the narrowing is definitionally safe. These (and their
// ---- callers) are deleted with the v1 surface in Stage 1 step 7.

export async function loadEventsV1(sessionId: string): Promise<SessionEvent[]> {
  return (await loadEvents(sessionId)) as SessionEvent[];
}

export async function appendEventsV1(
  sessionId: string,
  payloads: EventPayload[],
  media: MediaRow[] = [],
  source?: Source,
): Promise<SessionEvent[]> {
  return (await appendEvents(sessionId, payloads, media, source)) as SessionEvent[];
}

/**
 * Create a session: snapshot the config (content-addressed — shared across sessions
 * with identical config), pin its hash, write SessionInitialized + initial rooms.
 */
export async function createSession(args: {
  config: RouteConfig;
  flags: string[];
  rooms: Omit<RoomInstance, "roomInstanceId">[];
  propertyLabel?: string;
}): Promise<string> {
  const { config, flags, rooms, propertyLabel } = args;
  const configHash = await hashConfig(config);
  const sessionId = uuidv7();
  const now = new Date().toISOString();

  // ONE atomic transaction for snapshot + session row + initial events. A failure at
  // any point (quota, crash) must never leave a session row without its
  // SessionInitialized event — such a half-session would make fold() throw on the
  // resume-on-launch path every launch thereafter. The appendEvents call opens a
  // nested Dexie transaction, which joins this parent transaction.
  await db.transaction("rw", [db.sessions, db.configSnapshots, db.events, db.media, db.outbox], async () => {
    const existing = await db.configSnapshots.get(configHash);
    if (!existing)
      await db.configSnapshots.add({
        hash: configHash, routeId: config.routeId, version: config.configVersion,
        config, storedAt: now,
      });
    const row: SessionRow = {
      id: sessionId, status: "active",
      routeId: config.routeId, configVersion: config.configVersion, configHash,
      propertyLabel, flags, createdAt: now, updatedAt: now, lastEventSeq: 0,
    };
    await db.sessions.add(row);

    await appendEvents(sessionId, [
      {
        type: "SessionInitialized",
        routeId: config.routeId,
        configVersion: config.configVersion,
        configHash,
        flags,
        propertyLabel,
      },
      ...rooms.map((room) => ({
        type: "RoomAdded" as const,
        room: { ...room, roomInstanceId: uuidv7() },
      })),
    ]);
  });

  return sessionId;
}

/** The pinned snapshot for a v1 session — the ONLY config the v1 fold may read. */
export async function loadSessionConfig(sessionId: string): Promise<RouteConfig> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error(`unknown session ${sessionId}`);
  if (session.kind === "v2") throw new Error(`session ${sessionId} is v2 — use loadSessionChecklistConfig`);
  const snapshot = await db.configSnapshots.get(session.configHash);
  if (!snapshot) throw new Error(`missing config snapshot ${session.configHash}`);
  return snapshot.config as RouteConfig;
}

/**
 * Create a v2 (pin model) session: snapshot the checklist config content-addressed,
 * pin its hash, write the v2 SessionInitialized. Same atomicity contract as v1
 * createSession — a half-session must be impossible.
 */
export async function createSessionV2(args: {
  config: ChecklistConfig;
  propertyFlags: string[];
  propertyLabel?: string;
}): Promise<string> {
  const { config, propertyFlags, propertyLabel } = args;
  const configHash = await hashConfig(config);
  const sessionId = uuidv7();
  const now = new Date().toISOString();

  await db.transaction("rw", [db.sessions, db.configSnapshots, db.events, db.media, db.outbox], async () => {
    const existing = await db.configSnapshots.get(configHash);
    if (!existing)
      await db.configSnapshots.add({
        hash: configHash, routeId: config.configId, version: config.configVersion,
        config, storedAt: now,
      });
    const row: SessionRow = {
      id: sessionId, status: "active", kind: "v2",
      routeId: config.configId, configVersion: config.configVersion, configHash,
      propertyLabel, flags: propertyFlags, createdAt: now, updatedAt: now,
      lastEventSeq: 0, lastPinNumber: 0,
    };
    await db.sessions.add(row);

    await appendEvents(sessionId, [
      {
        type: "SessionInitialized",
        configId: config.configId,
        configVersion: config.configVersion,
        configHash,
        propertyFlags,
        propertyLabel,
      },
    ]);
  });

  return sessionId;
}

/** The pinned checklist snapshot for a v2 session — the ONLY config v2 code may read. */
export async function loadSessionChecklistConfig(sessionId: string): Promise<ChecklistConfig> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error(`unknown session ${sessionId}`);
  if (session.kind !== "v2") throw new Error(`session ${sessionId} is not v2`);
  const snapshot = await db.configSnapshots.get(session.configHash);
  if (!snapshot) throw new Error(`missing config snapshot ${session.configHash}`);
  return snapshot.config as ChecklistConfig;
}

export async function listSessions(): Promise<SessionRow[]> {
  return db.sessions.orderBy("createdAt").reverse().toArray();
}

export async function setSessionStatus(sessionId: string, status: SessionRow["status"]): Promise<void> {
  await db.sessions.update(sessionId, { status, updatedAt: new Date().toISOString() });
}

export async function sessionMediaBytes(sessionId: string): Promise<number> {
  let total = 0;
  await db.media.where("sessionId").equals(sessionId).each((m) => { total += m.bytes; });
  return total;
}

/** Storage self-check surfaced in the UI; persistence request is best-effort. */
export async function requestPersistence(): Promise<{ persisted: boolean; usage?: number; quota?: number }> {
  let persisted = false;
  if (navigator.storage?.persist) persisted = await navigator.storage.persist();
  let usage: number | undefined, quota: number | undefined;
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    usage = est.usage; quota = est.quota;
  }
  return { persisted, usage, quota };
}
