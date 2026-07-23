/**
 * Storage-layer test against a real (in-memory) IndexedDB: proves the atomic
 * createSession transaction — session row + config snapshot + initial events + outbox
 * in one commit — actually functions through Dexie's nested-transaction path.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { parseRouteConfig } from "../../src/engine/schema/routeConfig";
import { baselineRoute } from "../../src/config/route.baseline";
import { createSession, loadEvents, loadSessionConfig } from "../../src/storage/sessionRepo";
import { db } from "../../src/storage/db";
import { fold } from "../../src/engine/fold";
import type { SessionEvent } from "../../src/engine/schema/events";

describe("createSession", () => {
  beforeEach(async () => {
    await Promise.all([
      db.sessions.clear(), db.configSnapshots.clear(), db.events.clear(),
      db.media.clear(), db.outbox.clear(),
    ]);
  });

  it("commits session row, snapshot, events, and outbox atomically and folds cleanly", async () => {
    const config = parseRouteConfig(baselineRoute);
    const sessionId = await createSession({
      config,
      flags: ["has-well"],
      rooms: [
        { zoneId: "main-floor", kind: "kitchen", label: "Kitchen" },
        { zoneId: "upper-floor", kind: "bedroom", label: "Bedroom 1" },
      ],
      propertyLabel: "Test House",
    });

    const session = await db.sessions.get(sessionId);
    expect(session?.status).toBe("active");
    expect(session?.lastEventSeq).toBe(3); // SessionInitialized + 2 RoomAdded

    const events = (await loadEvents(sessionId)) as SessionEvent[];
    expect(events.map((e) => e.type)).toEqual(["SessionInitialized", "RoomAdded", "RoomAdded"]);

    const outboxRows = await db.outbox.where("sessionId").equals(sessionId).toArray();
    expect(outboxRows).toHaveLength(3);
    expect(outboxRows.every((r) => r.status === "pending")).toBe(true);

    // The pinned snapshot resolves and the fold reconstructs a working state.
    const pinned = await loadSessionConfig(sessionId);
    const state = fold(pinned, events);
    expect(state.rooms).toHaveLength(2);
    expect(state.zones.some((z) => z.slots.some((s) => s.defId === "well.pressure-system"))).toBe(true);
  });
});
