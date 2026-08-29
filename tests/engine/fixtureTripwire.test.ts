/**
 * ⚑ **The tripwire.** *Without it a fixture is a photograph of one day rather than a contract.*
 *
 * `docs/fixtures/manifest-position-example.json` is what the binder side builds its receiver
 * against while it waits for a real walk. Twice it has been wrong in a way **neither side could
 * see**: it called the media array `files[]` (the emitter has always written `media[]`), and it
 * gave `owner` the shape `{kind, id}` (the emitter writes `{kind:"pin", pinId, pinNumber}`). A
 * receiver built on either finds nothing, throws nothing and reports nothing — *the silent
 * failure, twice, in one hand-written file.*
 *
 * ## What this asserts, and what it deliberately does not
 *
 * ⛑ **Containment, never equality.** Every path the fixture documents must still exist, at the
 * same JSON type, in a manifest built by the real emitter. An **addition** to the manifest passes
 * — additions are the emitting side's call alone under the version policy ratified 2026-08-15.
 * A **removal or a rename** fails, which is the only thing that can break a receiver.
 *
 * *A test that enumerated the manifest's fields would fire on every legitimate addition and be
 * disabled within a month. This one states what must hold.*
 *
 * ⚑ And it runs in the direction that catches the real bug: it reads the **fixture's** paths and
 * looks for them in the **emitter's** output. The reverse — emitter paths present in the fixture —
 * would fail on every field the example simply chose not to illustrate.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildManifestV3 } from "../../src/engine/export/manifestV3";
import type { SessionStateV2 } from "../../src/engine/v2/fold";
import type { CaptureIntent } from "../../src/engine/v2/events";

const fixture = JSON.parse(
  readFileSync(new URL("../../docs/fixtures/manifest-position-example.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const source = { actor: "human" as const, actorId: "c", device: "ipad", appVersion: "t" };

type Extra = { intent?: CaptureIntent; position?: unknown; frame?: unknown; siblings?: unknown[] };
const media = (mediaId: string, mime: string, extra: Extra = {}) => ({
  mediaId,
  sha256: "0".repeat(64),
  mime,
  bytes: 2048,
  at: "2026-08-23T17:41:02Z",
  source,
  ...extra,
});

/**
 * A session exercising every shape the fixture illustrates — a positioned frame, an inheriting one,
 * a refusal, a floorplan and a mesh.
 *
 * ⚑ It must exercise them, not merely declare them: a path the emitter never emits because this
 * state never reaches it would be reported as a missing field, and the tripwire would cry wolf on
 * its own fixture. That is the failure mode of a contract test, and it is why this state is built
 * to be walked rather than to be short.
 */
const state = {
  sessionId: "01a02616-843f-79df-8ecc-95f3c23a3e5f",
  flags: [],
  lifecycle: [],
  configId: "c",
  configVersion: "1.0.0",
  configHash: "h",
  visitKind: "discovery",
  zones: [
    {
      zoneId: "zone-mechanical",
      type: "mechanical",
      label: "Mechanical",
      attributes: {},
      photos: [
        media("media-refused-3", "image/jpeg", {
          position: { positioned: false, why: "paused" },
        }),
        media("media-plan-4", "application/json", { intent: "floorplan" }),
        media("media-mesh-5", "application/json", { intent: "mesh" }),
        /* ⚑ The room shot — a WIDE primary whose pose is honest and whose matrix does not describe
           it, with the 1× sibling it points at. The case the 2026-08-28 ruling exists for, and the
           reason the fixture illustrating it must be exercised rather than merely declared. */
        media("media-roomshot-6", "image/jpeg", {
          intent: "room-shot",
          frame: { captureId: "2026-08-23T17:38:10Z", role: "primary", lens: "wide" },
          position: {
            positioned: true,
            zoneId: "zone-mechanical",
            tracking: "normal",
            at: "2026-08-23T17:38:10Z",
            x: 0.412,
            y: -0.503,
            z: 1.884,
            transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.412, -0.503, 1.884, 1],
            projection: {
              projectable: false,
              why: "taken through the wide lens; transform describes ARKit's normal camera, which is the only one world tracking is offered",
              projectableFrame: { captureId: "2026-08-23T17:38:10Z", lens: "normal" },
            },
          },
          siblings: [
            {
              mediaId: "media-roomshot-6-sib",
              sha256: "0".repeat(64),
              mime: "image/jpeg",
              bytes: 2048,
              frame: { captureId: "2026-08-23T17:38:10Z", role: "evidence", lens: "normal" },
            },
          ],
        }),
      ],
      voiceNotes: [],
      canvases: [],
      noteIds: [],
      chatThreadIds: [],
    },
  ],
  pins: [
    {
      pinId: "pin-water-heater",
      number: 1,
      zoneId: "zone-mechanical",
      anchors: [],
      noteIds: [],
      chatThreadIds: [],
      photos: [
        media("media-anchor-1", "image/jpeg", {
          frame: { captureId: "2026-08-23T17:41:02Z", role: "primary", lens: "normal" },
          position: {
            positioned: true,
            zoneId: "zone-mechanical",
            tracking: "normal",
            at: "2026-08-23T17:41:02Z",
            x: 1.243,
            y: -0.518,
            z: 3.407,
            transform: [0.998, 0, -0.062, 0, 0.004, 0.998, 0.062, 0, 0.062, -0.062, 0.996, 0, 1.243, -0.518, 3.407, 1],
            surface: { x: 1.61, y: -0.44, z: 3.92, distance: 0.72 },
            projection: { projectable: true },
          },
        }),
        media("media-detail-2", "image/jpeg"),
      ],
      voiceNotes: [],
    },
  ],
  inbox: [],
  inboxNoteIds: [],
  notes: new Map(),
  chats: new Map(),
  resolutions: new Map(),
} as unknown as SessionStateV2;

const built = JSON.parse(
  JSON.stringify(
    buildManifestV3({
      state,
      events: [],
      configSnapshot: {},
      exportedAt: "2026-08-23T18:00:00Z",
      appVersion: "field-6a",
    }),
  ),
) as Record<string, unknown>;

const typeOf = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v;

/**
 * Every leaf and container path in an object, as `a.b.c`.
 *
 * ⛑ Keys beginning `_` are the fixture's own prose — `_note`, `_payloads` — and are not manifest
 * fields. Array elements collapse to `[]` so five example media entries state one contract about
 * what a media entry may contain, rather than five about positions in a list.
 */
function paths(value: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (Array.isArray(value)) {
    for (const item of value) for (const [k, t] of paths(item, `${prefix}[]`)) out.set(k, t);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("_")) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      out.set(path, typeOf(v));
      for (const [k, t] of paths(v, path)) out.set(k, t);
    }
  }
  return out;
}

describe("the manifest fixture is a contract, not a photograph of one day", () => {
  const documented = paths(fixture);
  const emitted = paths(built);

  it("documents something worth checking", () => {
    // A tripwire over an empty set passes forever. This is the guard on the guard.
    expect(documented.size).toBeGreaterThan(30);
    expect([...documented.keys()]).toContain("media[].position.transform");
  });

  it("names every field the way the emitter names it", () => {
    const missing = [...documented.keys()].filter((p) => !emitted.has(p));
    // ⚑ `files[]` and `owner.id` would BOTH have appeared here, on the day they were written.
    expect(missing).toEqual([]);
  });

  it("gives every field the type the emitter gives it", () => {
    const wrong = [...documented].filter(([p, t]) => emitted.has(p) && emitted.get(p) !== t)
      .map(([p, t]) => `${p}: fixture says ${t}, emitter writes ${emitted.get(p)}`);
    expect(wrong).toEqual([]);
  });

  it("illustrates a pose whose matrix does not describe its own image, and names the frame it does", () => {
    /* ⛑ The case a desk gets wrong silently: projecting a 120° image through a 1× matrix looks
       like bad measurement, not a wrong assumption. The fixture must carry it or the binder is
       built against a world where it never happens. */
    const rows = (fixture.media as Record<string, unknown>[]) ?? [];
    const wide = rows.find(
      (m) => (m.position as { projection?: { projectable?: boolean } })?.projection?.projectable === false,
    );
    expect(wide, "no not-projectable example in the fixture").toBeDefined();
    const projection = (wide!.position as { projection: { projectableFrame?: unknown; why?: string } }).projection;
    // It must POINT somewhere, or say null. A missing key would be the ambiguity all over again.
    expect(Object.prototype.hasOwnProperty.call(projection, "projectableFrame")).toBe(true);
    expect(projection.why ?? "").not.toBe("");
    // And every positioned frame answers the question at all — that is what "required" buys.
    const positioned = rows.filter((m) => (m.position as { positioned?: boolean })?.positioned === true);
    expect(positioned.length).toBeGreaterThan(0);
    for (const m of positioned) {
      expect((m.position as { projection?: unknown }).projection, `${m.mediaId} does not answer`).toBeDefined();
    }
  });

  it("illustrates a geometry capture, a refusal and an inheriting frame — the three the desk reads", () => {
    // Containment on the ROWS, because the fixture's whole value is showing these three states.
    // Not equality: a sixth example is a welcome addition, never a break.
    const rows = (fixture.media as Record<string, unknown>[]) ?? [];
    expect(rows.some((m) => m.kind === "geometry")).toBe(true);
    expect(rows.some((m) => (m.position as { positioned?: boolean })?.positioned === false)).toBe(true);
    expect(rows.some((m) => m.position === undefined && (m.owner as { kind?: string })?.kind === "pin")).toBe(true);
  });
});
