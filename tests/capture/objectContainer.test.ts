/**
 * The object container's rules (Baseline Service Design v1.8 §4.1a-ii).
 *
 * Every test below states an invariant, never an inventory: nothing counts the containers a zone
 * happens to hold, and nothing names a colour or a control. The rules that carry real weight —
 * *ungrouped stays free*, *a trace is not a member*, *a container never spans two zones* — are
 * each one branch whose absence would be silent in the field and loud only at the desk, months
 * later, in the form of twenty photographs filed against the wrong object.
 */
import { describe, expect, it } from "vitest";
import {
  captureTargetFor,
  containerAfterZoneChange,
  containersInZone,
  isEstablishingShot,
  isObjectContainer,
  stripModel,
  tapContainer,
  type OpenContainer,
} from "../../src/capture/objectContainer";
import type { MediaRef, PinStateV2 } from "../../src/engine/v2/fold";

const media = (mediaId: string): MediaRef => ({
  mediaId,
  sha256: mediaId,
  mime: "image/jpeg",
  bytes: 1,
  at: "2026-08-15T00:00:00.000Z",
  source: { actor: "human", actorId: "test", device: "test", appVersion: "test" },
});

const pin = (over: Partial<PinStateV2> & { pinId: string; number: number }): PinStateV2 => ({
  zoneId: "z1",
  flag: null,
  anchors: [],
  photos: [],
  voiceNotes: [],
  noteIds: [],
  chatThreadIds: [],
  ...over,
});

describe("what counts as a container", () => {
  it("is an untyped, unanchored pin in this zone — the shape v1.8 §4.2 says already exists", () => {
    expect(isObjectContainer(pin({ pinId: "a", number: 1 }), "z1")).toBe(true);
  });

  it("stops being one once the desk has typed it — the scaffolding has done its job", () => {
    const typed = pin({ pinId: "a", number: 1, pinType: { kind: "freeform", label: "furnace" } });
    expect(isObjectContainer(typed, "z1")).toBe(false);
  });

  it("stops being one once it is anchored to a canvas", () => {
    const anchored = pin({
      pinId: "a",
      number: 1,
      anchors: [{ anchorId: "an1", canvasId: "c1", x: 0.5, y: 0.5 }],
    });
    expect(isObjectContainer(anchored, "z1")).toBe(false);
  });

  it("is never offered back after it was retired — that capture would file into a thrown-away thing", () => {
    const retired = pin({ pinId: "a", number: 1, retired: { at: "2026-08-15T00:00:00.000Z" } });
    expect(isObjectContainer(retired, "z1")).toBe(false);
  });

  it("belongs to exactly one zone", () => {
    expect(isObjectContainer(pin({ pinId: "a", number: 1, zoneId: "z1" }), "z2")).toBe(false);
  });
});

describe("the strip", () => {
  it("wears each object's FIRST photograph, so the icon stays recognisable as shots accumulate", () => {
    const furnace = pin({ pinId: "a", number: 1, photos: [media("establishing"), media("plate")] });
    expect(containersInZone([furnace], "z1")[0]?.iconMediaId).toBe("establishing");
  });

  it("orders objects by when they were made, not by where they sit in the folded array", () => {
    const later = pin({ pinId: "b", number: 9 });
    const earlier = pin({ pinId: "a", number: 2 });
    expect(containersInZone([later, earlier], "z1").map((c) => c.pinId)).toEqual(["a", "b"]);
  });

  it("shows the zone's objects when you are out of a container, and that container's captures when you are in", () => {
    const furnace = pin({ pinId: "a", number: 1, photos: [media("m1"), media("m2")] });
    const tank = pin({ pinId: "b", number: 2 });

    const outside = stripModel([furnace, tank], "z1", null);
    expect(outside.objects.map((o) => o.pinId)).toEqual(["a", "b"]);
    expect(outside.captures).toEqual([]);

    const inside = stripModel([furnace, tank], "z1", { pinId: "a", zoneId: "z1" });
    expect(inside.captures.map((m) => m.mediaId)).toEqual(["m1", "m2"]);
    expect(inside.objects).toEqual([]);
  });

  it("still draws the open container itself while you are inside it — the exit needs something to land on", () => {
    const furnace = pin({ pinId: "a", number: 1, photos: [media("m1")] });
    expect(stripModel([furnace], "z1", { pinId: "a", zoneId: "z1" }).current?.pinId).toBe("a");
  });
});

describe("entering and leaving", () => {
  const open: OpenContainer = { pinId: "a", zoneId: "z1" };

  it("enters an object when you tap it", () => {
    expect(tapContainer(null, "a", "z1")).toEqual(open);
  });

  it("⛑ leaves when you tap the one you are already in — the same gesture, no new control", () => {
    expect(tapContainer(open, "a", "z1")).toBeNull();
  });

  it("switches straight to another object without passing through ungrouped", () => {
    expect(tapContainer(open, "b", "z1")).toEqual({ pinId: "b", zoneId: "z1" });
  });

  it("closes automatically on leaving the zone — a container spanning two zones is always wrong", () => {
    expect(containerAfterZoneChange(open, "z2")).toBeNull();
    expect(containerAfterZoneChange(open, null)).toBeNull();
    expect(containerAfterZoneChange(open, "z1")).toEqual(open);
  });
});

describe("where a capture files", () => {
  const open: OpenContainer = { pinId: "a", zoneId: "z1" };

  it("goes to the open container", () => {
    expect(captureTargetFor(open, "z1")).toEqual({ kind: "pin", id: "a" });
  });

  it("⚑ keeps ungrouped capture free — walk in, shoot, and the visit is still complete and valid", () => {
    expect(captureTargetFor(null, "z1")).toEqual({ kind: "zone", id: "z1" });
    expect(captureTargetFor(null, "z1", "room-shot")).toEqual({ kind: "zone", id: "z1" });
  });

  it("⚑ never files a run trace inside the container it started in — that asserts the pipe is the furnace's", () => {
    expect(captureTargetFor(open, "z1", "run-trace")).toEqual({ kind: "zone", id: "z1" });
  });

  it("files every other declared kind into the container, since they are all shots OF the object", () => {
    for (const intent of ["room-shot", "pan", "document"] as const) {
      expect(captureTargetFor(open, "z1", intent)).toEqual({ kind: "pin", id: "a" });
    }
  });
});

describe("the establishing shot", () => {
  it("is the first capture into a container and nothing else — there is no separate act", () => {
    expect(isEstablishingShot(pin({ pinId: "a", number: 1 }))).toBe(true);
    expect(isEstablishingShot(pin({ pinId: "a", number: 1, photos: [media("m1")] }))).toBe(false);
  });

  it("is not claimed when there is no container open", () => {
    expect(isEstablishingShot(undefined)).toBe(false);
  });
});
