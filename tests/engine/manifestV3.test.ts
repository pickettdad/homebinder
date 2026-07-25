/**
 * Manifest v3 (pin model) + pre-export integrity sweep — PLAN-STAGE-1 §7.
 * Builds a small pin session through the REAL fold, then asserts the manifest shape, the
 * media-path scheme, the vocabulary telemetry, and that the integrity sweep catches missing /
 * wrong-size / tampered media.
 */
import { describe, expect, it } from "vitest";
import type { Source } from "../../src/engine/schema/events";
import type { V2EventPayload, V2SessionEvent } from "../../src/engine/v2/events";
import { foldV2 } from "../../src/engine/v2/fold";
import {
  buildManifestV3,
  sweepMediaIntegrity,
  type MediaFileEntryV3,
} from "../../src/engine/export/manifestV3";

const source: Source = { actor: "human", actorId: "inspector", device: "test", appVersion: "test" };

function mkEvents(payloads: V2EventPayload[]): V2SessionEvent[] {
  return payloads.map(
    (payload, i) =>
      ({
        ...payload,
        eventId: `evt-${i + 1}`,
        sessionId: "s1",
        seq: i + 1,
        at: `2026-07-25T00:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: 2,
        source,
      }) as V2SessionEvent,
  );
}

const mc = { mediaId: "mc", sha256: "shac", mime: "image/jpeg", bytes: 11 };
const mp = { mediaId: "mp", sha256: "shap", mime: "image/jpeg", bytes: 22 };
const mz = { mediaId: "mz", sha256: "shaz", mime: "image/jpeg", bytes: 33 };
const mi = { mediaId: "mi", sha256: "shai", mime: "image/jpeg", bytes: 44 };

function sampleSession() {
  const events = mkEvents([
    { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: ["gas"], propertyLabel: "Test House" },
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {}, level: "basement" },
    { type: "CanvasAdded", canvasId: "c1", zoneId: "z1", kind: "photo", media: mc },
    { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
    { type: "PinTyped", pinId: "p1", pinType: { kind: "freeform", label: "mystery box" } },
    { type: "PinLabeled", pinId: "p1", label: "the weird one" },
    { type: "PinFlagged", pinId: "p1", flag: "issue" },
    { type: "PhotoAdded", media: mp, target: { kind: "pin", id: "p1" } },
    { type: "AnchorPlaced", anchorId: "a1", pinId: "p1", canvasId: "c1", x: 0.5, y: 0.4 },
    { type: "PhotoAdded", media: mz, target: { kind: "zone", id: "z1" } },
    { type: "PhotoAdded", media: mi, target: { kind: "inbox" } },
    { type: "NoteAdded", noteId: "n1", target: { kind: "pin", id: "p1" }, text: "corroded" },
    { type: "ChatMessageSent", threadId: "t1", target: { kind: "pin", id: "p1" }, text: "what is this?", mediaIds: ["mp"] },
    { type: "ChatReplyRecorded", threadId: "t1", model: "claude-sonnet-5", text: "A junction box." },
    { type: "ZoneClosed", zoneId: "z1", audit: { coreUnresolved: [], standardUnresolved: 0, naCount: 0 } },
    { type: "SessionCompleted" },
  ]);
  const state = foldV2(events);
  const manifest = buildManifestV3({ state, events, configSnapshot: { layers: [] }, exportedAt: "2026-07-25T01:00:00.000Z", appVersion: "0.5.0" });
  return { events, state, manifest };
}

describe("buildManifestV3", () => {
  it("stamps schema v3, session identity, lifecycle, and the config snapshot", () => {
    const { manifest, events } = sampleSession();
    expect(manifest.manifestSchemaVersion).toBe(3);
    expect(manifest.session.propertyLabel).toBe("Test House");
    expect(manifest.session.flags).toEqual(["gas"]);
    expect(manifest.session.completedAt).toBeDefined();
    expect(manifest.session.lifecycle.some((l) => l.type === "completed")).toBe(true);
    expect(manifest.config).toMatchObject({ configId: "cfg", version: "1.0", hash: "h", snapshot: { layers: [] } });
    expect(manifest.events).toHaveLength(events.length);
    expect(Array.isArray(manifest.orphanEvents)).toBe(true);
  });

  it("preserves freeform pin type verbatim and keeps the nickname a separate field (§7 telemetry)", () => {
    const { manifest } = sampleSession();
    const pin = manifest.pins.find((p) => p.pinId === "p1")!;
    expect(pin.type).toEqual({ kind: "freeform", label: "mystery box" });
    expect(pin.label).toBe("the weird one");
    expect(pin.flag).toBe("issue");
    expect(pin.number).toBe(1);
    expect(pin.anchors).toHaveLength(1);
    expect(pin.mediaIds).toContain("mp");
    expect(pin.chatThreadIds).toContain("t1");
  });

  it("files every media under the §7 path scheme with the right owner and group", () => {
    const { manifest } = sampleSession();
    const at = (id: string) => manifest.media.find((x) => x.mediaId === id)!;
    expect(at("mp").file).toBe("media/z1/pin-1/mp.jpg");
    expect(at("mp").owner).toEqual({ kind: "pin", pinId: "p1", pinNumber: 1 });
    expect(at("mz").file).toBe("media/z1/_zone/mz.jpg");
    expect(at("mz").owner).toEqual({ kind: "zone", zoneId: "z1" });
    expect(at("mc").file).toBe("media/z1/_canvas/mc.jpg");
    expect(at("mi").file).toBe("media/_misc/_inbox/mi.jpg");
    expect(at("mi").group).toBe("_misc");
    // The canvas photo is also listed on its zone's canvases[] with the same path.
    expect(manifest.zones[0]!.canvases[0]).toMatchObject({ canvasId: "c1", mediaId: "mc", file: "media/z1/_canvas/mc.jpg" });
  });

  it("lists the inbox, notes, chats (with per-message source), and totals", () => {
    const { manifest } = sampleSession();
    expect(manifest.inbox.mediaIds).toEqual(["mi"]);
    expect(manifest.notes).toHaveLength(1);
    expect(manifest.chats).toHaveLength(1);
    const chat = manifest.chats[0]!;
    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[1]).toMatchObject({ role: "assistant", model: "claude-sonnet-5" });
    expect(chat.messages.every((m) => m.source)).toBe(true);
    expect(manifest.totals).toMatchObject({ zones: 1, pins: 1, canvases: 1, photos: 4, mediaFiles: 4, inboxItems: 1 });
    expect(manifest.totals.mediaBytes).toBe(11 + 22 + 33 + 44);
  });
});

describe("sweepMediaIntegrity", () => {
  it("passes when every media resolves to a blob of the expected size", async () => {
    const { manifest } = sampleSession();
    const load = async (id: string) => {
      const m = manifest.media.find((x) => x.mediaId === id)!;
      return new Blob([new Uint8Array(m.bytes)]);
    };
    const report = await sweepMediaIntegrity(manifest.media, load);
    expect(report.ok).toBe(true);
    expect(report.checked).toBe(4);
    expect(report.problems).toHaveLength(0);
  });

  it("flags a missing blob and a byte-count mismatch", async () => {
    const { manifest } = sampleSession();
    const load = async (id: string) => {
      if (id === "mp") return undefined; // lost
      if (id === "mz") return new Blob([new Uint8Array(999)]); // wrong size
      const m = manifest.media.find((x) => x.mediaId === id)!;
      return new Blob([new Uint8Array(m.bytes)]);
    };
    const report = await sweepMediaIntegrity(manifest.media, load);
    expect(report.ok).toBe(false);
    expect(report.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mediaId: "mp", kind: "missing-blob" }),
        expect.objectContaining({ mediaId: "mz", kind: "byte-mismatch" }),
      ]),
    );
  });

  it("verifies the sha256 when asked, and catches tampering", async () => {
    const bytes = new TextEncoder().encode("hello world");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const entry = (sha: string): MediaFileEntryV3 => ({
      mediaId: "x", kind: "photo", owner: { kind: "inbox" }, group: "_misc",
      file: "media/_misc/_inbox/x.jpg", mime: "image/jpeg", bytes: bytes.byteLength, sha256: sha,
      capturedAt: "2026-07-25T00:00:00.000Z", source,
    });
    const load = async () => new Blob([bytes]);

    const good = await sweepMediaIntegrity([entry(hex)], load, { verifyHash: true });
    expect(good.ok).toBe(true);

    const bad = await sweepMediaIntegrity([entry("deadbeef")], load, { verifyHash: true });
    expect(bad.ok).toBe(false);
    expect(bad.problems[0]!.kind).toBe("hash-mismatch");
  });
});
