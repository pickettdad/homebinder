/**
 * The v2 walk, driven through the real store against fake-indexeddb: start session →
 * create zones → pins (typed, flagged) → canvas + anchors → global-camera inbox capture
 * → retag → notes → advisory close. This is the step-3 acceptance path in test form.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { useApp } from "../../src/store/sessionStore";
import { loadChecklists } from "../../src/config/loadChecklists";
import { db } from "../../src/storage/db";

const jpeg = (content: string) => new Blob([content], { type: "image/jpeg" });

beforeEach(async () => {
  await Promise.all([
    db.sessions.clear(), db.configSnapshots.clear(), db.events.clear(),
    db.media.clear(), db.outbox.clear(), db.chatJobs.clear(),
  ]);
  useApp.setState({
    sessionId: null, v2Config: null, v2Session: null, v2Events: [],
    checklists: loadChecklists(), checklistErrors: [], sessionRows: [],
    screen: { name: "home" },
  });
});

describe("v2 walk flow through the store", () => {
  it("start → zones → pins → canvas/anchor → inbox capture → retag → advisory close", async () => {
    const s = () => useApp.getState();

    await s().startSessionV2({ propertyFlags: ["gas"], propertyLabel: "41 Birch Lane" });
    expect(s().v2Session?.propertyLabel).toBe("41 Birch Lane");
    expect(s().screen).toEqual({ name: "walk" });

    const utl = await s().createZone("utility", "Utility room", {});
    const bed = await s().createZone("living-space", "Guest room", { sleeping: true });
    expect(s().v2Session?.zones).toHaveLength(2);

    // Pins get real permanent numbers from the storage transaction.
    const p1 = await s().createPin(utl);
    const p2 = await s().createPin(bed);
    expect(s().v2Session?.pins.map((p) => p.number)).toEqual([1, 2]);
    await s().setPinType(p1, { kind: "component", componentType: "water-heater" });
    await s().setPinFlag(p1, "monitor");
    await s().setPinType(p2, { kind: "freeform", label: "odd bracket" });

    // Canvas + tap-to-anchor.
    const canvasId = await s().addCanvas(utl, jpeg("wide-wall-shot"));
    await s().placeAnchor(p1, canvasId, 0.42, 0.61);
    const pin1 = s().v2Session!.pins.find((p) => p.pinId === p1)!;
    expect(pin1.anchors).toMatchObject([{ canvasId, x: 0.42, y: 0.61 }]);

    // Global camera → inbox, then filed onto the pin. The media row follows the retag.
    const mediaId = await s().capturePhotoV2({ kind: "inbox" }, jpeg("nameplate"));
    expect(s().v2Session?.inbox).toHaveLength(1);
    await s().reassignMedia(mediaId, { kind: "pin", id: p1 });
    expect(s().v2Session?.inbox).toHaveLength(0);
    expect(s().v2Session?.pins.find((p) => p.pinId === p1)?.photos.map((m) => m.mediaId)).toEqual([mediaId]);
    expect((await db.media.get(mediaId))?.targetKind).toBe("pin");
    expect((await db.media.get(mediaId))?.targetId).toBe(p1);

    // Text note on the pin (dictation-first input path).
    const noteId = await s().addNote({ kind: "pin", id: p1 }, "TPR discharge looks new");
    expect(s().v2Session?.notes.get(noteId)?.text).toContain("TPR");

    // Advisory close: nothing blocks; the audit snapshot is recorded with the event.
    await s().closeZoneV2(utl, "ran out of light");
    const zone = s().v2Session!.zones.find((z) => z.zoneId === utl)!;
    expect(zone.closedAt).toBeDefined();
    expect(zone.closeNote).toBe("ran out of light");
    expect(zone.audit!.coreUnresolved.length).toBeGreaterThan(0); // plenty unresolved — still closed
    // The typed water-heater pin proposes its evidence item; that never counts as resolved.
    expect(zone.audit!.coreUnresolved).toContain("utl.water-heater");

    // Resume from storage cold: same state (crash-resume contract).
    const sessionId = s().sessionId!;
    useApp.setState({ v2Session: null, v2Events: [], v2Config: null, sessionId: null });
    await s().resumeSession(sessionId);
    expect(s().v2Session?.pins).toHaveLength(2);
    expect(s().v2Session?.zones.find((z) => z.zoneId === utl)?.closedAt).toBeDefined();
    expect(s().screen).toEqual({ name: "zone2", zoneId: bed }); // last active zone
  });

  it("field-test fixes: stamped pins, anchor removal, inbox captions, storey levels, complete visit", async () => {
    const s = () => useApp.getState();
    await s().startSessionV2({ propertyFlags: [], propertyLabel: "41 Birch Lane" });

    // Storey level rides along at creation and groups the walk screen.
    const utl = await s().createZone("utility", "Utility", {}, "basement");
    expect(s().v2Session?.zones[0]?.level).toBe("basement");

    const canvasId = await s().addCanvas(utl, jpeg("panel-wall"));

    // Stamp mode: one tap = one typed, anchored pin with its OWN permanent number,
    // so a single receptacle can be flagged without painting the rest.
    const r1 = await s().createPinAt(utl, canvasId, 0.2, 0.5, { kind: "component", componentType: "receptacle" });
    const r2 = await s().createPinAt(utl, canvasId, 0.8, 0.5, { kind: "component", componentType: "receptacle" });
    const pins = () => s().v2Session!.pins;
    expect(pins().map((p) => p.number)).toEqual([1, 2]);
    expect(pins().every((p) => p.pinType?.kind === "component" && p.anchors.length === 1)).toBe(true);
    await s().setPinFlag(r2, "monitor");
    expect(pins().find((p) => p.pinId === r1)?.flag).toBeNull();

    // A misplaced marker comes off alone — the pin and its number survive.
    await s().placeAnchor(r1, canvasId, 0.55, 0.55);
    const stray = pins().find((p) => p.pinId === r1)!.anchors[1]!;
    await s().removeAnchor(stray.anchorId);
    expect(pins().find((p) => p.pinId === r1)!.anchors).toHaveLength(1);
    expect(pins().find((p) => p.pinId === r1)!.retired).toBeUndefined();

    // Inbox capture gets a caption; the caption travels when filed.
    const mediaId = await s().capturePhotoV2({ kind: "inbox" }, jpeg("mystery"));
    await s().captionMedia(mediaId, "hallway thermostat, cracked cover");
    await s().reassignMedia(mediaId, { kind: "pin", id: r1 });
    expect(pins().find((p) => p.pinId === r1)?.photos[0]?.caption).toBe("hallway thermostat, cracked cover");

    // Inbox delete path: discard removes the ref and the stored row.
    const gone = await s().capturePhotoV2({ kind: "inbox" }, jpeg("blurry"));
    await s().discardMediaV2(gone);
    expect(s().v2Session?.inbox).toHaveLength(0);
    expect(await db.media.get(gone)).toBeUndefined();

    // Completing the visit stamps the session; nothing blocks.
    await s().completeSessionV2();
    expect(s().v2Session?.completedAt).toBeDefined();
  });

  it("egress lands in the sleeping guest room but not the utility room", async () => {
    const s = () => useApp.getState();
    await s().startSessionV2({ propertyFlags: [] });
    const utl = await s().createZone("utility", "Utility", {});
    const bed = await s().createZone("living-space", "Guest room", { sleeping: true });
    const { deriveZoneItems } = await import("../../src/engine/v2/checklist");
    const cfg = s().v2Config!;
    const state = s().v2Session!;
    expect(deriveZoneItems(cfg, state, bed).map((d) => d.item.id)).toContain("liv.egress");
    expect(deriveZoneItems(cfg, state, utl).map((d) => d.item.id)).not.toContain("liv.egress");
  });
});
