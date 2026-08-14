/**
 * The three declared capture kinds (Baseline Service Design v1.2 §4.1a/§4.1b, owner rulings
 * 2026-08-11): capture INTENT through the pipeline, and the capture-order run grouping the
 * capture-mode grid renders.
 *
 * These state invariants rather than inventory. `CaptureIntent` will gain values — the pan
 * may replace the room shot (#124), and a fourth kind is a design session away — so nothing
 * here asserts which values exist. What must hold at three kinds and at thirty is that an
 * intent set at capture arrives in the manifest unchanged, that an ordinary capture carries
 * none, and that re-filing a capture never rewrites what the act of capture was.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Source } from "../../src/engine/schema/events";
import type { CaptureIntent, V2EventPayload, V2SessionEvent } from "../../src/engine/v2/events";
import { foldV2 } from "../../src/engine/v2/fold";
import { buildManifestV3 } from "../../src/engine/export/manifestV3";
import { RUN_GAP_MS, groupIntoRuns } from "../../src/screens/v2/CaptureModeScreen";
import { globalCameraApplies } from "../../src/app/captureSurface";

const source: Source = { actor: "human", actorId: "inspector", device: "test", appVersion: "test" };

function mkEvents(payloads: V2EventPayload[]): V2SessionEvent[] {
  return payloads.map(
    (payload, i) =>
      ({
        ...payload,
        eventId: `evt-${i + 1}`,
        sessionId: "s1",
        seq: i + 1,
        at: `2026-08-11T00:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: 2,
        source,
      }) as V2SessionEvent,
  );
}

const media = (id: string, mime = "image/jpeg") => ({ mediaId: id, sha256: `sha-${id}`, mime, bytes: 10 });

/** One zone, one capture per declared kind plus two ordinary ones. */
function sessionWithIntents(intents: (CaptureIntent | undefined)[]) {
  const events = mkEvents([
    { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], visitKind: "discovery" },
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Mechanical", attributes: {}, level: "basement" },
    ...intents.map((intent, i) => ({
      type: "PhotoAdded" as const,
      media: media(`m${i}`, intent === "run-trace" ? "video/mp4" : "image/jpeg"),
      target: { kind: "zone" as const, id: "z1" },
      ...(intent ? { intent } : {}),
    })),
  ]);
  const state = foldV2(events);
  return buildManifestV3({ state, events, configSnapshot: {}, exportedAt: "2026-08-11T12:00:00.000Z", appVersion: "test" });
}

describe("capture intent — set at the door, unchanged downstream", () => {
  it("carries every set intent to the manifest and leaves ordinary captures with none", () => {
    // The invariant, not the list: whatever intents go in come out attached to the same
    // media, and absence stays absence. `undefined` is the ordinary capture — the majority —
    // and it must never acquire a value by travelling.
    const intents: (CaptureIntent | undefined)[] = [
      "room-shot",
      undefined,
      "pan",
      "run-trace",
      undefined,
      "document",
    ];
    const manifest = sessionWithIntents(intents);

    expect(manifest.media).toHaveLength(intents.length);
    for (const [i, expected] of intents.entries()) {
      const entry = manifest.media.find((m) => m.mediaId === `m${i}`);
      expect(entry, `m${i} must reach the manifest`).toBeDefined();
      expect(entry?.intent, `m${i} intent must survive the fold and the manifest`).toBe(expected);
    }
  });

  it("never invents an intent for a session that set none", () => {
    const manifest = sessionWithIntents([undefined, undefined]);
    expect(manifest.media.every((m) => m.intent === undefined)).toBe(true);
  });

  it("keeps the intent when a capture is re-filed to another target", () => {
    // Intent is a fact about the ACT of capture. Re-filing changes where a capture lives, not
    // what the concierge was doing when they took it — so a run trace dragged from the inbox
    // onto a pin is still a run trace. This is the property that made `intent` ride MediaRef
    // rather than the event lookup.
    const events = mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], visitKind: "discovery" },
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Mechanical", attributes: {}, level: "basement" },
      { type: "PhotoAdded", media: media("m0", "video/mp4"), target: { kind: "inbox" }, intent: "run-trace" },
      { type: "MediaReassigned", mediaId: "m0", target: { kind: "zone", id: "z1" } },
    ]);
    const manifest = buildManifestV3({
      state: foldV2(events),
      events,
      configSnapshot: {},
      exportedAt: "2026-08-11T12:00:00.000Z",
      appVersion: "test",
    });

    const entry = manifest.media.find((m) => m.mediaId === "m0");
    expect(entry?.owner).toEqual({ kind: "zone", zoneId: "z1" });
    expect(entry?.intent).toBe("run-trace");
  });
});

describe("capture mode owns the camera", () => {
  it("suppresses the floating camera on every screen a Discovery Visit can reach", () => {
    // The invariant is "one camera surface at a time", not a list of screens: whatever routes
    // capture mode grows, none of them may also carry the floating trio.
    for (const screen of ["walk", "zone2", "pin", "inbox", "export2"]) {
      expect(globalCameraApplies("discovery", screen), `discovery must own the camera on ${screen}`).toBe(false);
    }
  });

  it("keeps the floating camera for the visits that have no capture-mode screen", () => {
    // The trio is not being deleted — it is the only camera an Inspection or monthly visit
    // has, and those visits never render capture mode.
    expect(globalCameraApplies("inspection", "zone2")).toBe(true);
    expect(globalCameraApplies("monthly", "pin")).toBe(true);
    // A session predating visit kinds is not a Discovery visit (visitKindOf's distinction),
    // and must keep the camera it has always had.
    expect(globalCameraApplies(null, "walk")).toBe(true);
  });

  it("still withholds it from screens that have no unambiguous destination", () => {
    expect(globalCameraApplies("inspection", "export2")).toBe(false);
    expect(globalCameraApplies("inspection", "setup2")).toBe(false);
  });
});

describe("groupIntoRuns — the capture-order grid", () => {
  const at = (sec: number) => new Date(Date.UTC(2026, 7, 11, 12, 0, sec)).toISOString();
  const shot = (mediaId: string, sec: number) => ({ mediaId, at: at(sec) });

  it("loses and duplicates nothing", () => {
    // The property that matters most on a screen the concierge reviews in the room: every
    // capture is on it, exactly once. Holds at five captures and at fifty-eight.
    const input = [shot("a", 0), shot("b", 5), shot("c", 500), shot("d", 505), shot("e", 5000)];
    const flat = groupIntoRuns(input).flat();
    expect(flat.map((m) => m.mediaId).sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(flat).toHaveLength(input.length);
  });

  it("renders oldest first even when the stored order is not capture order", () => {
    // MediaReassigned re-appends a ref at the tail of its new list, so array order is NOT
    // capture order. Sorting is what keeps a re-filed capture where it was taken instead of
    // at the end of the room.
    const outOfOrder = [shot("late", 900), shot("first", 0), shot("mid", 5)];
    const flat = groupIntoRuns(outOfOrder).flat();
    expect(flat.map((m) => m.mediaId)).toEqual(["first", "mid", "late"]);
  });

  it("breaks a run only where the pause exceeds the threshold", () => {
    // The rule itself, stated at the boundary in both directions: exactly the threshold is
    // still one string; one second more is a new one. Anything else makes the constant a
    // guess about behaviour rather than about taste.
    const gapSec = RUN_GAP_MS / 1000;
    const exactly = groupIntoRuns([shot("a", 0), shot("b", gapSec)]);
    expect(exactly).toHaveLength(1);

    const beyond = groupIntoRuns([shot("a", 0), shot("b", gapSec + 1)]);
    expect(beyond).toHaveLength(2);
    expect(beyond[0]?.map((m) => m.mediaId)).toEqual(["a"]);
    expect(beyond[1]?.map((m) => m.mediaId)).toEqual(["b"]);
  });

  it("groups an object string into one run and the next object into another", () => {
    // What the grid is for: object, plate, plate arrives as a visual group with nobody having
    // named anything.
    const runs = groupIntoRuns([
      shot("object", 0),
      shot("plate-1", 8),
      shot("plate-2", 14),
      shot("next-object", 400),
      shot("next-plate", 407),
    ]);
    expect(runs.map((r) => r.map((m) => m.mediaId))).toEqual([
      ["object", "plate-1", "plate-2"],
      ["next-object", "next-plate"],
    ]);
  });

  it("returns no runs for no captures", () => {
    expect(groupIntoRuns([])).toEqual([]);
  });
});

describe("pin flag vocabulary — one declaration, and null is a state", () => {
  it("offers exactly the declared vocabulary in the UI, by construction", () => {
    // Not a list check — a check that the list is not restated. The screen imports PIN_FLAGS
    // rather than carrying its own array, so a fourth value cannot type-check everywhere and
    // silently fail to appear. Asserted at the source because the guarantee IS the import.
    const screen = readFileSync("src/screens/v2/PinScreen.tsx", "utf8");
    expect(screen).toContain("PIN_FLAGS");
    expect(screen, "the vocabulary must not be restated as a literal").not.toMatch(
      /\[\s*"fine"\s*,\s*"monitor"\s*,\s*"issue"\s*\]/,
    );
  });

  it("exports an unflagged pin as null rather than omitting the field", () => {
    // The Session Plan v0 Contract §9 lists three values and does not address null. Every pin
    // starts unflagged and tapping the active flag clears it back — so null is *deliberately
    // unflagged*, and a receiver reading it as missing data would lose a real state.
    const events = mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], visitKind: "discovery" },
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Mechanical", attributes: {}, level: "basement" },
      { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
      { type: "PinFlagged", pinId: "p1", flag: "issue" },
      { type: "PinFlagged", pinId: "p1", flag: null },
    ]);
    const manifest = buildManifestV3({
      state: foldV2(events), events, configSnapshot: {},
      exportedAt: "2026-08-13T12:00:00.000Z", appVersion: "test",
    });
    const pin = manifest.pins.find((p) => p.pinId === "p1");
    expect(pin).toBeDefined();
    expect("flag" in pin!, "flag must be present, not omitted").toBe(true);
    expect(pin!.flag).toBeNull();
  });
});
