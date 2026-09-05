/**
 * What a file is called in the manifest, and what it must never be called.
 *
 * ⚑ The invariant under test is **not** the list of kinds — that list is open by design and will
 * grow. It is that **an unrecognised file may not be given a name the binder recognises**. The old
 * `kindOf` ended `: "voice"`, so everything it did not understand collapsed to a word the consumer
 * knows — and the binder's own guard for unrecognised kinds therefore fired on nothing. *The
 * producer defeated the consumer's check, and the check was built on the assumption the bug also
 * made.*
 */
import { describe, expect, it } from "vitest";
import { buildManifestV3 } from "../../src/engine/export/manifestV3";
import type { SessionStateV2 } from "../../src/engine/v2/fold";
import type { CaptureIntent } from "../../src/engine/v2/events";

const source = { actor: "human" as const, actorId: "c", device: "ipad", appVersion: "t" };

const mediaRef = (mediaId: string, mime: string, intent?: CaptureIntent) => ({
  mediaId,
  sha256: "0".repeat(64),
  mime,
  bytes: 1,
  at: "2026-08-28T00:00:00Z",
  intent,
  source,
});

/** A zone holding one media file of each shape under test. */
const stateWith = (media: ReturnType<typeof mediaRef>[]): SessionStateV2 =>
  ({
    sessionId: "s",
    flags: [],
    lifecycle: [],
    configId: "c",
    configVersion: "1.0.0",
    configHash: "h",
    zones: [
      {
        zoneId: "z",
        type: "mechanical",
        label: "Mechanical",
        attributes: {},
        photos: media,
        voiceNotes: [],
        canvases: [],
        noteIds: [],
        chatThreadIds: [],
      },
    ],
    pins: [],
    inbox: [],
    inboxNoteIds: [],
    notes: new Map(),
    chats: new Map(),
    resolutions: new Map(),
    refusals: [],
  }) as unknown as SessionStateV2;

const manifestOf = (media: ReturnType<typeof mediaRef>[]) =>
  buildManifestV3({
    state: stateWith(media),
    events: [],
    configSnapshot: {},
    exportedAt: "2026-08-28T00:00:00Z",
    appVersion: "test",
  });

const kindsIn = (media: ReturnType<typeof mediaRef>[]) =>
  Object.fromEntries(manifestOf(media).media.map((f) => [f.mediaId, f.kind]));

describe("kindOf — the fallthrough", () => {
  it("never gives an unrecognised file a name the binder recognises", () => {
    /* ⚑ THE invariant. Each of these is a mime the field has no rule for. None of them may come out
       as photo, video or voice — because each of those is a word the consumer trusts, and a wrong
       one passes every check at both ends. `unknown` is the only honest answer. */
    const strangers = [
      "application/octet-stream",
      "application/pdf",
      "text/plain",
      "model/usd",
      "",
      "application/json",
    ];
    const kinds = kindsIn(strangers.map((mime, i) => mediaRef(`m${i}`, mime)));
    for (const kind of Object.values(kinds)) {
      expect(["photo", "video", "voice"]).not.toContain(kind);
      expect(kind).toBe("unknown");
    }
  });

  it("still names what it genuinely knows", () => {
    const kinds = kindsIn([
      mediaRef("img", "image/jpeg"),
      mediaRef("vid", "video/quicktime"),
      mediaRef("aud", "audio/mp4"),
    ]);
    expect(kinds.img).toBe("photo");
    expect(kinds.vid).toBe("video");
    // ⛑ Voice is now reached by an audio mime rather than by exhaustion, which is the whole change.
    expect(kinds.aud).toBe("voice");
  });
});

describe("geometry", () => {
  it("is the declared act, not the container format", () => {
    /* ⚑ `application/json` is not inherently geometry — a floorplan is. The intent is a fact the
       concierge declared; the mime is an inference about a container. */
    const kinds = kindsIn([
      mediaRef("plan", "application/json", "floorplan"),
      mediaRef("mesh", "application/json", "mesh"),
      mediaRef("other", "application/json"),
    ]);
    expect(kinds.plan).toBe("geometry");
    expect(kinds.mesh).toBe("geometry");
    expect(kinds.other).toBe("unknown");
  });

  it("is never counted as a photograph, a video or a voice note", () => {
    /* ⛑ The fail-safe the contract note turns on: five gates in the binder are allowlists or
       equalities on 'photo', so a kind they have never met is refused by all five without any of
       them changing. This asserts the field half — that geometry does not creep into a count some
       gate later trusts. */
    const m = manifestOf([
      mediaRef("plan", "application/json", "floorplan"),
      mediaRef("mesh", "application/json", "mesh"),
      mediaRef("img", "image/jpeg"),
    ]);
    expect(m.totals.photos).toBe(1);
    expect(m.totals.videos).toBe(0);
    expect(m.totals.voiceNotes).toBe(0);
    expect(m.totals.geometry).toBe(2);
  });

  it("counts unknowns, because absent from every total is how a defect goes unread", () => {
    const m = manifestOf([mediaRef("x", "application/pdf")]);
    expect(m.totals.unknown).toBe(1);
    // And it is still a file, with its hash — trust root first, vocabulary second.
    expect(m.totals.mediaFiles).toBe(1);
  });
});

/**
 * ⛑ **A refusal is the app failing. A deletion is a person choosing.**
 *
 * They route to different places at the desk — *a refusal becomes a gap and goes to Escalate as a
 * targeted item for the next visit; a deletion goes to the Decision record.* ⚑ **If both arrived as
 * "this isn't here", the desk could not tell a hole from a judgement**, and the invariant under test
 * is exactly that separation: **the two never share an array.**
 */
describe("what the app refused, and what a person deleted", () => {
  const refused = (act: string, why: string, recoverable: boolean) => ({
    act, why, recoverable, at: "2026-09-04T00:00:00Z", zoneId: "z",
  });

  it("carries refusals in their own array, never mixed into the session's lifecycle", () => {
    const state = {
      ...(stateWith([]) as unknown as Record<string, unknown>),
      refusals: [refused("floorplan", "RoomPlan not supported on this device", false)],
    } as unknown as SessionStateV2;
    const m = buildManifestV3({
      state, events: [], configSnapshot: {}, exportedAt: "t", appVersion: "t",
    });
    expect(m.refusals).toHaveLength(1);
    // The session's own completed/reopened history must not have absorbed it.
    expect(m.session.lifecycle).toEqual([]);
  });

  it("keeps the reason verbatim and says whether the room can fix it", () => {
    // ⚑ `recoverable` is what makes a refusal actionable rather than merely recorded: "hold still"
    // is a different instruction from "this iPad has no RoomPlan".
    const state = {
      ...(stateWith([]) as unknown as Record<string, unknown>),
      refusals: [refused("mesh", "unmet sceneReconstruction", true), refused("floorplan", "no RoomPlan", false)],
    } as unknown as SessionStateV2;
    const m = buildManifestV3({ state, events: [], configSnapshot: {}, exportedAt: "t", appVersion: "t" });
    expect(m.refusals.map((r) => r.recoverable)).toEqual([true, false]);
    expect(m.refusals[0]!.why).toBe("unmet sceneReconstruction");
  });

  it("does not deduplicate — three refusals of one act is a different fact from one", () => {
    const state = {
      ...(stateWith([]) as unknown as Record<string, unknown>),
      refusals: [refused("position", "settling", true), refused("position", "settling", true)],
    } as unknown as SessionStateV2;
    const m = buildManifestV3({ state, events: [], configSnapshot: {}, exportedAt: "t", appVersion: "t" });
    expect(m.refusals).toHaveLength(2);
  });
});
