/**
 * v2 storage path: createSessionV2 atomicity, in-transaction global pin numbering,
 * target-addressed media rows, and v1/v2 coexistence on the same Dexie v3 database.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { loadChecklists } from "../../src/config/loadChecklists";
import {
  appendEvents,
  createSessionV2,
  loadEvents,
  loadSessionChecklistConfig,
  loadSessionConfig,
} from "../../src/storage/sessionRepo";
import { db, type MediaRow } from "../../src/storage/db";
import { foldV2 } from "../../src/engine/v2/fold";
import type { V2SessionEvent } from "../../src/engine/v2/events";

const config = loadChecklists();

beforeEach(async () => {
  await Promise.all([
    db.sessions.clear(), db.configSnapshots.clear(), db.events.clear(),
    db.media.clear(), db.outbox.clear(), db.chatJobs.clear(),
  ]);
});

describe("createSessionV2 + appendEvents", () => {
  it("commits session row, checklist snapshot, and init event atomically; fold reconstructs", async () => {
    const sessionId = await createSessionV2({
      config,
      propertyFlags: ["gas", "well"],
      propertyLabel: "Test House",
    });

    const row = (await db.sessions.get(sessionId))!;
    expect(row.kind).toBe("v2");
    expect(row.lastPinNumber).toBe(0);
    expect(row.routeId).toBe(config.configId);

    const pinned = await loadSessionChecklistConfig(sessionId);
    expect(pinned.configVersion).toBe(config.configVersion);
    await expect(loadSessionConfig(sessionId)).rejects.toThrow(/v2/);

    const events = (await loadEvents(sessionId)) as V2SessionEvent[];
    const state = foldV2(events);
    expect(state.propertyFlags).toEqual(["gas", "well"]);
    expect(state.configHash).toBe(row.configHash);
  });

  it("stamps global permanent pin numbers inside the transaction, across zones and appends", async () => {
    const sessionId = await createSessionV2({ config, propertyFlags: [] });

    await appendEvents(sessionId, [
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {} },
      { type: "ZoneCreated", zoneId: "z2", zoneType: "kitchen", label: "Kitchen", attributes: {} },
      { type: "PinCreated", pinId: "p1", pinNumber: 0, zoneId: "z1" },
      { type: "PinCreated", pinId: "p2", pinNumber: 0, zoneId: "z2" },
    ]);
    const second = await appendEvents(sessionId, [
      { type: "PinCreated", pinId: "p3", pinNumber: 0, zoneId: "z1" },
    ]);

    const stamped = second[0]!;
    expect(stamped.type === "PinCreated" && stamped.pinNumber).toBe(3);

    const state = foldV2((await loadEvents(sessionId)) as V2SessionEvent[]);
    expect(state.pins.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(state.lastPinNumber).toBe(3);
    expect((await db.sessions.get(sessionId))!.lastPinNumber).toBe(3);
  });

  it("writes target-addressed media rows atomically with their events", async () => {
    const sessionId = await createSessionV2({ config, propertyFlags: [] });
    await appendEvents(sessionId, [
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: {} },
      { type: "PinCreated", pinId: "p1", pinNumber: 0, zoneId: "z1" },
    ]);

    const blob = new Blob(["fake-jpeg"], { type: "image/jpeg" });
    const mediaRow: MediaRow = {
      id: "m1", sessionId, targetKind: "pin", targetId: "p1", kind: "photo",
      mime: "image/jpeg", bytes: blob.size, sha256: "sha-m1",
      capturedAt: new Date().toISOString(), blob,
    };
    await appendEvents(sessionId, [
      {
        type: "PhotoAdded",
        media: { mediaId: "m1", sha256: "sha-m1", mime: "image/jpeg", bytes: blob.size },
        target: { kind: "pin", id: "p1" },
      },
    ], [mediaRow]);

    const stored = (await db.media.get("m1"))!;
    expect(stored.targetKind).toBe("pin");
    expect(stored.slotInstanceId).toBeUndefined();
    const state = foldV2((await loadEvents(sessionId)) as V2SessionEvent[]);
    expect(state.pins[0]!.photos.map((m) => m.mediaId)).toEqual(["m1"]);

    const outbox = await db.outbox.where("sessionId").equals(sessionId).toArray();
    expect(outbox.some((r) => r.refType === "media" && r.refId === "m1")).toBe(true);
  });

  it("v2 events carry schemaVersion 2 and system provenance on init", async () => {
    const sessionId = await createSessionV2({ config, propertyFlags: [] });
    const events = (await loadEvents(sessionId)) as V2SessionEvent[];
    expect(events[0]!.schemaVersion).toBe(2);
    expect(events[0]!.source.actor).toBe("system");
  });
});
