/**
 * Session persistence operations. The single-writer append path lives here.
 */
import { db, type MediaRow, type SessionRow } from "./db";
import type { EventPayload, SessionEvent, Source } from "../engine/schema/events";
import { EVENT_SCHEMA_VERSION, type RoomInstance } from "../engine/schema/events";
import type { RouteConfig } from "../engine/schema/routeConfig";
import { uuidv7 } from "../engine/ids";
import { hashConfig } from "../engine/canonical";

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
 */
export async function appendEvents(
  sessionId: string,
  payloads: EventPayload[],
  media: MediaRow[] = [],
  source?: Source,
): Promise<SessionEvent[]> {
  const src = source ?? deviceSource();
  return db.transaction("rw", [db.sessions, db.events, db.media, db.outbox], async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error(`unknown session ${sessionId}`);
    let seq = session.lastEventSeq;
    const now = new Date().toISOString();
    const events: SessionEvent[] = payloads.map((payload) => {
      seq += 1;
      return {
        ...payload,
        eventId: uuidv7(),
        sessionId,
        seq,
        at: now,
        schemaVersion: EVENT_SCHEMA_VERSION,
        source: payload.type === "SessionInitialized" ? systemSource() : src,
      } as SessionEvent;
    });

    await db.events.bulkAdd(events.map((event) => ({ sessionId, seq: event.seq, event })));
    if (media.length) await db.media.bulkAdd(media);
    await db.outbox.bulkAdd([
      ...events.map((e) => ({ sessionId, refType: "event" as const, refId: e.eventId, status: "pending" as const, attempts: 0, createdAt: now })),
      ...media.map((m) => ({ sessionId, refType: "media" as const, refId: m.id, status: "pending" as const, attempts: 0, createdAt: now })),
    ]);
    await db.sessions.update(sessionId, { lastEventSeq: seq, updatedAt: now });
    return events;
  });
}

export async function deleteMedia(mediaIds: string[]): Promise<void> {
  await db.media.bulkDelete(mediaIds);
}

export async function loadEvents(sessionId: string): Promise<SessionEvent[]> {
  const rows = await db.events.where("[sessionId+seq]").between([sessionId, 0], [sessionId, Infinity]).toArray();
  return rows.map((r) => r.event);
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

  await db.transaction("rw", [db.sessions, db.configSnapshots], async () => {
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
  });

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

  return sessionId;
}

/** The pinned snapshot for a session — the ONLY config the fold may read. */
export async function loadSessionConfig(sessionId: string): Promise<RouteConfig> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error(`unknown session ${sessionId}`);
  const snapshot = await db.configSnapshots.get(session.configHash);
  if (!snapshot) throw new Error(`missing config snapshot ${session.configHash}`);
  return snapshot.config;
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
