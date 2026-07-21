/**
 * Fold/replay semantics: crash-recovery is "replay the log", so these tests are the
 * crash-safety contract.
 */
import { describe, expect, it } from "vitest";
import { parseRouteConfig, type RouteConfig } from "../../src/engine/schema/routeConfig";
import { baselineRoute } from "../../src/config/route.baseline";
import { fold } from "../../src/engine/fold";
import type { EventPayload, SessionEvent, Source } from "../../src/engine/schema/events";
import { EVENT_SCHEMA_VERSION } from "../../src/engine/schema/events";
import { slotProgress, visitTwoGaps, nextIncompleteSlot, isSlotUnlocked } from "../../src/engine/selectors";
import { gateOutstanding, canCloseZone } from "../../src/engine/gate";

const config: RouteConfig = parseRouteConfig(baselineRoute);
const source: Source = { actor: "human", actorId: "test", device: "vitest", appVersion: "0.5.0" };

function log(payloads: EventPayload[]): SessionEvent[] {
  return payloads.map(
    (p, i) =>
      ({
        ...p,
        eventId: `e${i + 1}`,
        sessionId: "s1",
        seq: i + 1,
        at: `2026-07-21T10:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: EVENT_SCHEMA_VERSION,
        source,
      }) as SessionEvent,
  );
}

const init: EventPayload = {
  type: "SessionInitialized",
  routeId: config.routeId,
  configVersion: config.configVersion,
  configHash: "hash1",
  flags: ["has-well"],
};

const media = (id: string) => ({ mediaId: id, sha256: "x", mime: "image/jpeg", bytes: 1000 });

describe("fold", () => {
  it("expands the plan from flags + rooms and applies captures", () => {
    const events = log([
      init,
      { type: "RoomAdded", room: { roomInstanceId: "rA", zoneId: "upper-floor", kind: "bedroom", label: "Bedroom 1" } },
      { type: "PhotoCaptured", slotInstanceId: "basement/bsmt.furnace-nameplate", media: media("m1") },
    ]);
    const state = fold(config, events);

    // Conditional well slots exist because has-well is set.
    const basement = state.zones.find((z) => z.zoneId === "basement")!;
    expect(basement.slots.some((s) => s.defId === "well.pressure-system")).toBe(true);

    // Room routine instantiated for the added bedroom, with egress (bedroom template extends room-routine).
    const upper = state.zones.find((z) => z.zoneId === "upper-floor")!;
    const bedroomSlots = upper.slots.filter((s) => s.roomInstanceId === "rA");
    expect(bedroomSlots.some((s) => s.defId === "bedroom.egress")).toBe(true);
    expect(bedroomSlots.some((s) => s.defId === "room-routine.entry-wide")).toBe(true);
    expect(bedroomSlots[0]!.label).toContain("Bedroom 1");

    const furnace = basement.slots.find((s) => s.defId === "bsmt.furnace-nameplate")!;
    expect(furnace.photos).toHaveLength(1);
    expect(state.lastActiveZoneId).toBe("basement");
  });

  it("omits conditional blocks when flags are off", () => {
    const state = fold(config, log([{ ...init, flags: [] }]));
    const basement = state.zones.find((z) => z.zoneId === "basement")!;
    expect(basement.slots.some((s) => s.defId === "well.pressure-system")).toBe(false);
  });

  it("photo discard removes the capture; the event log keeps the fact", () => {
    const events = log([
      init,
      { type: "PhotoCaptured", slotInstanceId: "garage/gar.slab", media: media("m1") },
      { type: "PhotoDiscarded", slotInstanceId: "garage/gar.slab", mediaId: "m1" },
    ]);
    const state = fold(config, events);
    const slot = state.zones.find((z) => z.zoneId === "garage")!.slots.find((s) => s.defId === "gar.slab")!;
    expect(slot.photos).toHaveLength(0);
    expect(slotProgress(slot).kind).toBe("pending");
  });

  it("exceptions resolve slots, feed the gap list per config, and can be cleared", () => {
    const events = log([
      init,
      { type: "ExceptionRecorded", slotInstanceId: "attic/attic.hatch", reasonId: "defer-visit-two", note: "hatch painted shut" },
      { type: "ExceptionRecorded", slotInstanceId: "garage/gar.slab", reasonId: "not-applicable" },
      { type: "ExceptionRecorded", slotInstanceId: "garage/gar.opener", reasonId: "not-accessible", note: "car parked against wall" },
      { type: "ExceptionCleared", slotInstanceId: "garage/gar.slab" },
    ]);
    const state = fold(config, events);
    const gaps = visitTwoGaps(state, config);
    // defer-visit-two AND not-accessible feed the gap list; not-applicable doesn't (and was cleared anyway).
    expect(gaps.map((g) => g.slot.instanceId).sort()).toEqual(["attic/attic.hatch", "garage/gar.opener"]);
    const slab = state.zones.find((z) => z.zoneId === "garage")!.slots.find((s) => s.defId === "gar.slab")!;
    expect(slab.exception).toBeUndefined();
  });

  it("zone close/reopen round-trips", () => {
    const events = log([
      init,
      { type: "ZoneClosed", zoneId: "arrival", summary: { captured: 0, excepted: 3, deferred: 0 } },
      { type: "ZoneReopened", zoneId: "arrival" },
    ]);
    const state = fold(config, events);
    expect(state.zones.find((z) => z.zoneId === "arrival")!.gate).toBe("open");
  });

  it("keeps events for unknown slots as orphans instead of dropping them", () => {
    const events = log([
      init,
      { type: "PhotoCaptured", slotInstanceId: "nowhere/nothing", media: media("m1") },
    ]);
    const state = fold(config, events);
    expect(state.orphanEvents).toHaveLength(1);
  });

  it("is deterministic: same log, same state", () => {
    const events = log([
      init,
      { type: "RoomAdded", room: { roomInstanceId: "rA", zoneId: "main-floor", kind: "kitchen", label: "Kitchen" } },
      { type: "PhotoCaptured", slotInstanceId: "exterior/ext.elevations", media: media("m1") },
    ]);
    expect(fold(config, events)).toEqual(fold(config, events));
  });
});

describe("gate", () => {
  it("blocks a zone with unresolved required slots and unblocks when all are resolved or excepted", () => {
    const arrivalSlots = config.zones.find((z) => z.id === "arrival")!.slots;
    const capture = (slotId: string, n: number): EventPayload[] =>
      Array.from({ length: n }, (_, i) => ({
        type: "PhotoCaptured" as const,
        slotInstanceId: `arrival/${slotId}`,
        media: media(`${slotId}-${i}`),
      }));

    // Voice-required slot (show-me tour) stays outstanding on photos alone.
    const partial = fold(config, log([init, ...capture("arr.documents", 1), ...capture("arr.show-me-tour", 1), ...capture("arr.air-monitor", 1)]));
    const zonePartial = partial.zones.find((z) => z.zoneId === "arrival")!;
    expect(canCloseZone(zonePartial)).toBe(false);
    expect(gateOutstanding(zonePartial).map((g) => g.kind)).toContain("voice-required");

    const done = fold(
      config,
      log([
        init,
        ...capture("arr.documents", 1),
        ...capture("arr.show-me-tour", 1),
        { type: "VoiceNoteAttached", slotInstanceId: "arrival/arr.show-me-tour", media: { ...media("v1"), mime: "audio/mp4" } },
        ...capture("arr.air-monitor", 1),
      ]),
    );
    const zoneDone = done.zones.find((z) => z.zoneId === "arrival")!;
    expect(gateOutstanding(zoneDone)).toHaveLength(0);
    expect(arrivalSlots.filter((s) => s.required)).toHaveLength(3);
  });

  it("counts below-minCaptures as outstanding", () => {
    const state = fold(config, log([
      init,
      { type: "PhotoCaptured", slotInstanceId: "exterior/ext.elevations", media: media("m1") },
    ]));
    const exterior = state.zones.find((z) => z.zoneId === "exterior")!;
    const gap = gateOutstanding(exterior).find((g) => g.slot.defId === "ext.elevations");
    expect(gap?.kind).toBe("below-min");
    expect(gap?.detail).toContain("1 of 4");
  });
});

describe("water-run constraint", () => {
  it("locks the ceiling re-check until every water-run slot is resolved, then unlocks", () => {
    const rooms: EventPayload[] = [
      { type: "RoomAdded", room: { roomInstanceId: "rK", zoneId: "main-floor", kind: "kitchen", label: "Kitchen" } },
    ];
    const base = fold(config, log([{ ...init, flags: [] }, ...rooms]));
    const recheck = base.zones.find((z) => z.zoneId === "final-checks")!.slots[0]!;
    expect(isSlotUnlocked(base, recheck)).toBe(false);

    // Resolve every slot tagged water-run (kitchen has two: under-sink + drains).
    const waterRunSlots = base.zones.flatMap((z) => z.slots).filter((s) => s.tags.includes("water-run"));
    expect(waterRunSlots.length).toBeGreaterThan(0);
    const resolveAll: EventPayload[] = waterRunSlots.map((s, i) => ({
      type: "PhotoCaptured" as const,
      slotInstanceId: s.instanceId,
      media: media(`wr${i}`),
    }));
    const done = fold(config, log([{ ...init, flags: [] }, ...rooms, ...resolveAll]));
    const recheckDone = done.zones.find((z) => z.zoneId === "final-checks")!.slots[0]!;
    expect(isSlotUnlocked(done, recheckDone)).toBe(true);
  });

  it("nextIncompleteSlot skips locked slots", () => {
    // With a kitchen present, its water-run slots are pending -> the re-check is locked
    // and final-checks has no reachable next slot.
    const state = fold(config, log([
      { ...init, flags: [] },
      { type: "RoomAdded", room: { roomInstanceId: "rK", zoneId: "main-floor", kind: "kitchen", label: "Kitchen" } },
    ]));
    expect(nextIncompleteSlot(state, "final-checks")).toBeUndefined();
  });

  it("treats the constraint as satisfied when nothing carries the tag (no wet rooms)", () => {
    // Vacuous case: zero water-run slots in the plan -> nothing to wait for.
    const state = fold(config, log([{ ...init, flags: [] }]));
    const recheck = state.zones.find((z) => z.zoneId === "final-checks")!.slots[0]!;
    expect(isSlotUnlocked(state, recheck)).toBe(true);
  });
});
