import { describe, expect, it } from "vitest";
import { parseRouteConfig } from "../../src/engine/schema/routeConfig";
import { baselineRoute } from "../../src/config/route.baseline";
import { fold } from "../../src/engine/fold";
import type { EventPayload, SessionEvent, Source } from "../../src/engine/schema/events";
import { EVENT_SCHEMA_VERSION } from "../../src/engine/schema/events";
import { buildManifest } from "../../src/engine/export/manifest";

const config = parseRouteConfig(baselineRoute);
const source: Source = { actor: "human", actorId: "test", device: "vitest", appVersion: "0.5.0" };

function log(payloads: EventPayload[]): SessionEvent[] {
  return payloads.map(
    (p, i) =>
      ({ ...p, eventId: `e${i}`, sessionId: "s1", seq: i + 1, at: "2026-07-21T10:00:00.000Z", schemaVersion: EVENT_SCHEMA_VERSION, source }) as SessionEvent,
  );
}

describe("export manifest", () => {
  it("is self-contained: config snapshot, events, media with paths+hashes, gap list", () => {
    const events = log([
      {
        type: "SessionInitialized", routeId: config.routeId, configVersion: config.configVersion,
        configHash: "hash1", flags: ["has-septic"], propertyLabel: "42 Concession Rd",
      },
      { type: "PhotoCaptured", slotInstanceId: "exterior/septic.lids", media: { mediaId: "m1", sha256: "abc", mime: "image/jpeg", bytes: 5000 } },
      { type: "VoiceNoteAttached", slotInstanceId: "exterior/septic.lids", media: { mediaId: "v1", sha256: "def", mime: "audio/mp4", bytes: 800 }, durationMs: 4000 },
      { type: "ExceptionRecorded", slotInstanceId: "attic/attic.hatch", reasonId: "defer-visit-two", note: "painted shut" },
    ]);
    const state = fold(config, events);
    const manifest = buildManifest({ state, config, events, exportedAt: "2026-07-21T13:00:00.000Z", appVersion: "0.5.0" });

    expect(manifest.config.hash).toBe("hash1");
    expect(manifest.config.snapshot.routeId).toBe(config.routeId);
    expect(manifest.events).toHaveLength(events.length);

    const photo = manifest.media.find((m) => m.mediaId === "m1")!;
    expect(photo.file).toBe("media/exterior/septic.lids/m1.jpg");
    expect(photo.sha256).toBe("abc");
    const voice = manifest.media.find((m) => m.mediaId === "v1")!;
    expect(voice.file).toBe("media/exterior/septic.lids/v1.m4a");

    expect(manifest.visitTwoGaps).toHaveLength(1);
    expect(manifest.visitTwoGaps[0]!.note).toBe("painted shut");

    const slotState = manifest.slotStates.find((s) => s.slotInstanceId === "exterior/septic.lids")!;
    expect(slotState.photoCount).toBe(1);
    expect(slotState.voiceCount).toBe(1);

    // The whole manifest must be JSON-serializable (it becomes manifest.json verbatim).
    expect(() => JSON.stringify(manifest)).not.toThrow();
  });
});
