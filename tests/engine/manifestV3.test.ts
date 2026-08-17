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

/**
 * Video capture (2026-07-25). Video rides in the visual (`photos`) collections beside stills,
 * so every place that used to assume "photos array ⇒ kind photo" is a corruption risk: the
 * manifest is the provenance record the binder builder trusts.
 */
describe("manifest v3 — video classification", () => {
  const vidZone = { mediaId: "vz", sha256: "shavz", mime: "video/mp4", bytes: 900 };
  const vidPin = { mediaId: "vp", sha256: "shavp", mime: "video/quicktime", bytes: 800 };
  const vidInbox = { mediaId: "vi", sha256: "shavi", mime: "video/mp4", bytes: 700 };
  const audio = { mediaId: "au", sha256: "shaau", mime: "audio/mp4", bytes: 600 };

  function videoSession() {
    const events = mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], propertyLabel: "Vid House" },
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {}, level: "basement" },
      { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
      { type: "PhotoAdded", media: vidZone, target: { kind: "zone", id: "z1" } },
      { type: "PhotoAdded", media: vidPin, target: { kind: "pin", id: "p1" } },
      { type: "PhotoAdded", media: vidInbox, target: { kind: "inbox" } },
      { type: "VoiceNoteAdded", media: audio, target: { kind: "zone", id: "z1" }, durationMs: 4000 },
    ]);
    const state = foldV2(events);
    return buildManifestV3({
      state, events, configSnapshot: { layers: [] },
      exportedAt: "2026-07-25T01:00:00.000Z", appVersion: "0.5.0",
    });
  }

  const byId = (m: ReturnType<typeof videoSession>, id: string) =>
    m.media.find((f: MediaFileEntryV3) => f.mediaId === id)!;

  it("labels video as video wherever it is owned — zone, pin and inbox alike", () => {
    const m = videoSession();
    expect(byId(m, "vz").kind).toBe("video");
    expect(byId(m, "vp").kind).toBe("video");
    expect(byId(m, "vi").kind).toBe("video");
  });

  it("still labels audio as voice — the video guard must not swallow voice notes", () => {
    expect(byId(videoSession(), "au").kind).toBe("voice");
  });

  it("gives video a video extension — 'video/mp4' must never be filed as .m4a", () => {
    const m = videoSession();
    expect(byId(m, "vz").file.endsWith(".mp4")).toBe(true);
    expect(byId(m, "vp").file.endsWith(".mov")).toBe(true);
    expect(byId(m, "au").file.endsWith(".m4a")).toBe(true);
  });

  it("keeps video out of the orphan pile and counts its bytes", () => {
    const m = videoSession();
    expect(m.orphanEvents).toHaveLength(0);
    expect(m.totals.mediaBytes).toBe(900 + 800 + 700 + 600);
  });

  it("totals every media file into exactly one bucket — no video falls through", () => {
    const t = videoSession().totals;
    expect(t.videos).toBe(3);
    expect(t.voiceNotes).toBe(1);
    expect(t.photos).toBe(0);
    expect(t.photos + t.videos + t.voiceNotes).toBe(t.mediaFiles);
  });
});

describe("zone close reason — the gap survives the export (ruling 2026-08-08)", () => {
  const closeWith = (reasonId?: string, note?: string) =>
    (() => {
      const events = mkEvents([
        { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], propertyLabel: "H" },
        { type: "ZoneCreated", zoneId: "z1", zoneType: "attic", label: "Attic", attributes: {} },
        { type: "ZoneClosed", zoneId: "z1", note, reasonId, audit: { coreUnresolved: [], standardUnresolved: 0, naCount: 0 } },
      ]);
      return buildManifestV3({
        state: foldV2(events), events, configSnapshot: { layers: [] },
        exportedAt: "2026-08-08T00:00:00.000Z", appVersion: "0.5.0",
      });
    })();

  it("emits the reason id alongside the note", () => {
    // The binder cannot re-derive "why was nothing captured" from an empty zone — it can only
    // read what the field recorded. If the id stops at the fold, the gap is invisible.
    const z = closeWith("no-access", "hatch painted shut").zones[0]!;
    expect(z.closeReasonId).toBe("no-access");
    expect(z.closeNote).toBe("hatch painted shut");
  });

  it("emits the ID, never a pre-resolved gap flag", () => {
    // PLAN-STAGE-1 §7a-iii: the emitter cannot know the receiving config, so it must not bake
    // this config's `feedsGapList` opinion into the record. The id plus the travelling config
    // snapshot is the whole contract; a boolean here would be a claim we are not positioned
    // to make.
    const z = closeWith("no-access") as unknown as Record<string, unknown>;
    for (const baked of ["feedsGapList", "isGap", "recordsFinding"])
      expect(Object.keys(z)).not.toContain(baked);
  });

  it("a zone closed without a reason carries none — absent, not defaulted", () => {
    expect(closeWith(undefined, "done").zones[0]!.closeReasonId).toBeUndefined();
  });
});

describe("the other frames of one capture", () => {
  /*
   ⚑ The shape exists to satisfy two demands that pull opposite ways.

   The record must hold every frame: the unlit companion answers *did the torch erase characters*,
   it measured as the cleanest plate of two nights, and it was being written to a temp directory
   and discarded. So the manifest — the trust root — has to name it.

   And no count may move. Every count in the app reads `photos.length`, so a bracketed plate filed
   as four photographs would turn "6 photographs here" into 24 overnight. **A sibling is part of one
   capture, not a photograph in its own right** — the concierge pressed once.
  */
  const primary = { mediaId: "f0", sha256: "sha0", mime: "image/jpeg", bytes: 10 };
  const evidence = { mediaId: "f1", sha256: "sha1", mime: "image/jpeg", bytes: 11 };
  const insurance = { mediaId: "f2", sha256: "sha2", mime: "image/jpeg", bytes: 12 };

  const withSiblings = () => {
    const events = mkEvents([
      { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [] },
      { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {} },
      {
        type: "PhotoAdded",
        media: { ...primary, frame: { captureId: "cap1", role: "primary" } },
        target: { kind: "zone", id: "z1" },
        siblings: [
          { ...evidence, frame: { captureId: "cap1", role: "evidence", torch: false } },
          { ...insurance, frame: { captureId: "cap1", role: "insurance", ev: -1 } },
        ],
      },
    ]);
    const state = foldV2(events);
    return {
      state,
      manifest: buildManifestV3({
        state, events, configSnapshot: { layers: [] },
        exportedAt: "2026-08-17T00:00:00.000Z", appVersion: "0.5.0",
      }),
    };
  };

  it("⚑ lists every frame in the manifest, because the record must hold what was captured", () => {
    const { manifest } = withSiblings();
    const ids = manifest.media.map((m) => m.mediaId);
    for (const id of ["f0", "f1", "f2"]) expect(ids).toContain(id);
    // And each carries what it is, since the role cannot be recovered from the pixels later.
    expect(manifest.media.find((m) => m.mediaId === "f1")?.frame?.role).toBe("evidence");
    expect(manifest.media.find((m) => m.mediaId === "f2")?.frame?.role).toBe("insurance");
  });

  it("⚑ moves no count, however many frames one capture produced", () => {
    const { state, manifest } = withSiblings();
    // The invariant, stated over the counts rather than over these three ids: one press, one
    // photograph, whatever the camera had to do to get it.
    expect(state.zones[0]!.photos).toHaveLength(1);
    expect(manifest.totals.photos).toBe(1);
  });

  it("keeps siblings with their primary's owner, so nothing is filed somewhere else", () => {
    const { manifest } = withSiblings();
    const owners = manifest.media
      .filter((m) => ["f0", "f1", "f2"].includes(m.mediaId))
      .map((m) => JSON.stringify(m.owner));
    expect(new Set(owners).size).toBe(1);
  });
});
