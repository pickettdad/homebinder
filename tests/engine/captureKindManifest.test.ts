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

/**
 * ⚑ **Which room the concierge came from — the one adjacency fact geometry cannot recover.**
 *
 * Every zone mints its own ARKit origin, so *two plans are never in a common frame* and which rooms
 * touch cannot be derived from position. ⛑ The invariant under test is **not** the list of answers —
 * it is that **an absent answer, an uncaptured space and outside are three different facts**, and
 * that the declaration survives to the export intact.
 */
describe("where the concierge walked in from", () => {
  const zoneWith = (enteredFrom?: unknown) =>
    ({
      ...(stateWith([]) as unknown as Record<string, unknown>),
      zones: [
        {
          zoneId: "z", type: "mechanical", label: "Mechanical", attributes: {}, enteredFrom,
          lifecycle: [], photos: [], voiceNotes: [], canvases: [], noteIds: [], chatThreadIds: [],
        },
      ],
    }) as unknown as SessionStateV2;
  const zoneOf = (enteredFrom?: unknown) =>
    buildManifestV3({ state: zoneWith(enteredFrom), events: [], configSnapshot: {}, exportedAt: "t", appVersion: "t" })
      .zones[0]!;

  it("carries a declared adjacency through to the export", () => {
    expect(zoneOf({ kind: "zone", zoneId: "hall" }).enteredFrom).toEqual({ kind: "zone", zoneId: "hall" });
  });

  it("keeps 'not declared' distinct from 'outside'", () => {
    // ⛑ Absent means nobody said. `outside` means somebody said outside. A desk that treated them
    // as one would invent an exterior door on every room where the question was skipped.
    expect(zoneOf(undefined).enteredFrom).toBeUndefined();
    expect(zoneOf({ kind: "outside" }).enteredFrom).toEqual({ kind: "outside" });
  });

  it("carries an edge that points at a room nobody captured", () => {
    // ⚑ A finding, not a fallback: a hall walked through and never scanned is an escalation item,
    // and an edge pointing at nothing is more useful than no edge.
    expect(zoneOf({ kind: "uncaptured" }).enteredFrom).toEqual({ kind: "uncaptured" });
  });
});

/**
 * ⛑ **A leg is an ordered thing that happened over time, and the export said neither.**
 *
 * ⚑ *Step 3 of the posed traverse.* Two facts a walk carries and the record threw away:
 *
 * 1. **The device's own frame number.** It counts every frame *captured*, filed or discarded — so
 *    `0, 1, 3, 4` means frame 2 was taken and dropped below the texture floor. `roleFor` built the
 *    record from **array position**, which cannot say that, and array position was the only order a
 *    leg carried into the export.
 * 2. **When each frame was taken.** One press files a leg, so every frame shares one `capturedAt` —
 *    correct, and useless for a walk. *Twenty-two frames spread over half a minute arrive stamped
 *    with the moment the leg ended.*
 *
 * The invariants below are about **preservation and distinctness**, not about today's field names or
 * today's frame count: nothing renumbers, and the two clocks answer two different questions.
 */
describe("a traverse leg is ordered and timed", () => {
  const legFrame = (ordinal: number, takenAt: string) => ({
    captureId: "2026-09-07T12:00:00.000Z",
    role: ordinal === 0 ? ("primary" as const) : ("evidence" as const),
    ordinal,
    takenAt,
  });

  it("never renumbers, so a hole stays a hole", () => {
    /* ⚑ The fixture deliberately skips 2. **Without a gap, a renumbering bug and a correct emitter
       produce identical output** — the test would pass on the defect it exists to catch. */
    const frames = [0, 1, 3, 4].map((n) => legFrame(n, `2026-09-07T12:00:0${n}.500Z`));
    const media = frames.map((f, i) =>
      ({ ...mediaRef(`m${i}`, "image/jpeg", "pan"), frame: f }) as never,
    );
    const out = manifestOf(media as never);
    const ordinals = out.media.map((m) => (m.frame as { ordinal?: number } | undefined)?.ordinal);
    expect(ordinals).toEqual([0, 1, 3, 4]);
    // Stated as properties rather than as that list: strictly increasing, and NOT a dense range.
    expect(ordinals.every((n, i) => i === 0 || (n ?? 0) > (ordinals[i - 1] ?? 0))).toBe(true);
    expect(ordinals).not.toEqual(ordinals.map((_, i) => i));
  });

  it("keeps the two clocks apart — one commit, many exposures", () => {
    /* ⛑ Both failures in one assertion pair. A shared per-frame time cannot locate a pause; a
       per-frame commit time cannot say these frames were one press. */
    const frames = [0, 1, 2].map((n) => legFrame(n, `2026-09-07T12:00:0${n}.250Z`));
    const media = frames.map((f, i) =>
      ({ ...mediaRef(`t${i}`, "image/jpeg", "pan"), frame: f }) as never,
    );
    const out = manifestOf(media as never);
    expect(new Set(out.media.map((m) => m.capturedAt)).size).toBe(1);
    const taken = out.media.map((m) => (m.frame as { takenAt?: string } | undefined)?.takenAt);
    expect(new Set(taken).size).toBe(out.media.length);
  });
});

/**
 * ⛑ **A bracket may inherit a pose. A leg may not.**
 *
 * The declared rule — *an absent `position` on a non-primary frame means the pose is on the primary
 * of this `captureId`* — is right for a bracket and a **silent fabrication** for a traverse. Three
 * exposures of one thing from one place share a pose; ⚑ **twenty-two frames taken from twenty-two
 * places do not.**
 *
 * A desk following the contract would stamp a failed frame with the leg's first pose and draw *a
 * polyline that starts correctly and then piles vertices on the origin* — with no error anywhere and
 * perfectly plausible geometry. **A gap is visible; a wrong point is not.**
 *
 * The invariant is about **which absences may be inherited**, not about today's intent vocabulary.
 */
describe("who may inherit a pose", () => {
  const sibling = (intent?: CaptureIntent) => ({
    ...mediaRef("cap", "image/jpeg", intent),
    siblings: [{ ...mediaRef("sib", "image/jpeg", intent) }],
  });

  it("files a refusal on an unposed traverse frame instead of letting it inherit", () => {
    const out = manifestOf([sibling("pan")] as never);
    const sib = out.media.find((m) => m.mediaId === "sib");
    expect(sib?.position?.positioned).toBe(false);
    // ⚑ And it says why — a refusal a reader cannot act on is a refusal that gets ignored.
    expect((sib?.position as { why?: string } | undefined)?.why).toBeTruthy();
  });

  it("leaves a bracket's sibling absent, because inheritance is correct there", () => {
    /* ⛑ The other half, and it is what stops this becoming a rule that fires everywhere. A capture
       that legitimately shares one pose must keep sharing it — filing refusals on brackets would
       turn every ordinary sibling into a gap the desk has to explain. */
    for (const intent of [undefined, "room-shot"] as const) {
      const out = manifestOf([sibling(intent as CaptureIntent)] as never);
      expect(out.media.find((m) => m.mediaId === "sib")?.position).toBeUndefined();
    }
  });
});
