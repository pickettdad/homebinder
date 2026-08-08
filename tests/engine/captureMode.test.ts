/**
 * Capture Mode spec §9a steps 1 and 2 — visit kind, the mode it derives, and the
 * internal-by-default note guarantee.
 *
 * Invariants, not inventory: adding a fourth visit kind passes these; giving a note a
 * visibility field fails them.
 */
import { describe, expect, it } from "vitest";
import type { Source } from "../../src/engine/schema/events";
import type { V2EventPayload, V2SessionEvent, VisitKind } from "../../src/engine/v2/events";
import { foldV2 } from "../../src/engine/v2/fold";
import { VISIT_KINDS, modeForVisit, visitKindLabel, visitKindOf } from "../../src/engine/v2/checklist";
import { capturePromptFlags } from "../../src/screens/v2/CaptureModeScreen";
import { buildManifestV3 } from "../../src/engine/export/manifestV3";
import { loadChecklists } from "../../src/config/loadChecklists";

const config = loadChecklists();
const source: Source = { actor: "human", actorId: "inspector", device: "test", appVersion: "test" };

function mkEvents(payloads: V2EventPayload[]): V2SessionEvent[] {
  return payloads.map(
    (payload, i) =>
      ({
        ...payload,
        eventId: `evt-${i + 1}`,
        sessionId: "s1",
        seq: i + 1,
        at: `2026-08-06T00:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: 2,
        source,
      }) as V2SessionEvent,
  );
}

const init = (visitKind?: VisitKind): V2EventPayload => ({
  type: "SessionInitialized",
  configId: config.configId,
  configVersion: config.configVersion,
  configHash: "hash-test",
  propertyFlags: [],
  propertyLabel: "Test House",
  ...(visitKind ? { visitKind } : {}),
});

describe("§9a step 1 — visit kind is set once and never corrected", () => {
  it("every declared kind survives the fold", () => {
    for (const kind of VISIT_KINDS) {
      expect(visitKindOf(foldV2(mkEvents([init(kind)]))), kind).toBe(kind);
    }
  });

  it("an absent kind reads as null, NOT as discovery", () => {
    // Pre-2026-08 sessions carry no kind. Absent and discovery are different facts, and
    // collapsing them would silently relabel every historical session as a capture visit.
    expect(visitKindOf(foldV2(mkEvents([init()])))).toBeNull();
  });

  it("no event can change the kind after the session starts", () => {
    // The invariant behind "never a toggle": there is no correction event, so a long log
    // of everything else leaves the kind exactly as initialised.
    const state = foldV2(
      mkEvents([
        init("inspection"),
        { type: "PropertyFlagsCorrected", propertyFlags: ["gas"], note: "propane after all" },
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {} },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "ZoneClosed", zoneId: "z1", audit: { coreUnresolved: [], standardUnresolved: 0, naCount: 0 } },
      ]),
    );
    expect(visitKindOf(state)).toBe("inspection");
  });

  it("the manifest carries the kind so the binder never has to infer it", () => {
    const state = foldV2(mkEvents([init("monthly")]));
    const m = buildManifestV3({
      state,
      events: [],
      configSnapshot: config,
      exportedAt: "2026-08-06T00:00:00.000Z",
      appVersion: "test",
    });
    expect(m.session.visitKind).toBe("monthly");
  });
});

describe("§9a step 1 — mode is derived, never stored", () => {
  it("every kind resolves to a mode, and the picker offers every kind", () => {
    // Invariant: the picker list and the label/mode functions cannot drift from each other.
    // Holds at three kinds and at six.
    expect(new Set(VISIT_KINDS).size).toBe(VISIT_KINDS.length);
    for (const kind of VISIT_KINDS) {
      expect(["capture", "inspection"]).toContain(modeForVisit(kind));
      expect(visitKindLabel(kind).length, kind).toBeGreaterThan(0);
      expect(visitKindLabel(kind), kind).not.toBe(kind); // never a config id on screen (§0.2)
    }
  });

  it("discovery is the only kind that foregrounds capture", () => {
    expect(modeForVisit("discovery")).toBe("capture");
    for (const kind of VISIT_KINDS.filter((k) => k !== "discovery")) {
      expect(modeForVisit(kind), kind).toBe("inspection");
    }
  });

  it("an unrecorded kind renders as inspection, which is what those sessions were", () => {
    expect(modeForVisit(null)).toBe("inspection");
  });
});

describe("§9a step 2 — notes are internal, and there is nothing to make them otherwise", () => {
  const VISIBILITY_SHAPED = /visib|internal|client|share|publish|external|surface/i;

  it("a folded note carries no visibility field", () => {
    // The guarantee is the ABSENCE. Spec §5: no visibility toggle, no second button — the
    // desk decides what surfaces. A field saying "all notes are internal" would be an
    // invitation to add `internal: false`, so the assertion is that no such field exists.
    const state = foldV2(
      mkEvents([
        init("discovery"),
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {} },
        { type: "NoteAdded", noteId: "n1", target: { kind: "zone", id: "z1" }, text: "damp smell" },
      ]),
    );
    const note = state.notes.get("n1");
    expect(note).toBeDefined();
    for (const key of Object.keys(note!)) {
      expect(key, `NoteState.${key}`).not.toMatch(VISIBILITY_SHAPED);
    }
  });

  it("no note event payload can carry visibility", () => {
    // Same invariant one layer down: the write path has no field to set either.
    const noteEvents = mkEvents([
      { type: "NoteAdded", noteId: "n1", target: { kind: "inbox" }, text: "t" },
      { type: "NoteEdited", noteId: "n1", text: "t2" },
      { type: "NoteReassigned", noteId: "n1", target: { kind: "zone", id: "z1" } },
    ]);
    for (const e of noteEvents) {
      for (const key of Object.keys(e)) {
        expect(key, `${e.type}.${key}`).not.toMatch(VISIBILITY_SHAPED);
      }
    }
  });

  it("notes reach the manifest whole, so the desk has everything to triage", () => {
    const state = foldV2(
      mkEvents([
        init("discovery"),
        { type: "NoteAdded", noteId: "n1", target: { kind: "inbox" }, text: "wants the hallway painted" },
      ]),
    );
    const m = buildManifestV3({
      state,
      events: [],
      configSnapshot: config,
      exportedAt: "2026-08-06T00:00:00.000Z",
      appVersion: "test",
    });
    expect(m.notes).toHaveLength(1);
    expect(m.notes[0]!.text).toBe("wants the hallway painted");
  });
});

describe("capturePromptFlags — the list is config, never a list in the screen", () => {
  const cfg = (flags: { id: string; label: string; consumers?: ("field" | "binder")[] }[]) => ({
    propertyFlags: flags.map((f) => ({ intakeSource: "x", ...f })),
  });

  it("shows only the flags this session actually declared", () => {
    const c = cfg([
      { id: "pool", label: "Pool or hot tub" },
      { id: "ev", label: "EV charging" },
      { id: "septic", label: "Septic system" },
    ]);
    expect(capturePromptFlags(c, ["pool", "ev"]).map((f) => f.id)).toEqual(["pool", "ev"]);
  });

  it("with no consumer column declared, shows them all — an honest superset", () => {
    // A hardcoded capture-worthy subset here would be a second vocabulary beside the config,
    // which is the drift the naReasons picker is also tested against.
    const c = cfg([{ id: "pre_1990", label: "Built before ~1990" }, { id: "pool", label: "Pool" }]);
    expect(capturePromptFlags(c, ["pre_1990", "pool"]).map((f) => f.id)).toEqual(["pre_1990", "pool"]);
  });

  it("once ANY flag declares consumers, the column filters to `field`", () => {
    // "Once declared, it is closed" — the same shape as Table H's unit check. `pre_1990` is a
    // document fact: real, binder-consumed, and nothing to point a camera at.
    const c = cfg([
      { id: "pre_1990", label: "Built before ~1990", consumers: ["binder"] },
      { id: "pool", label: "Pool", consumers: ["field", "binder"] },
      { id: "ev", label: "EV charging", consumers: ["field"] },
    ]);
    expect(capturePromptFlags(c, ["pre_1990", "pool", "ev"]).map((f) => f.id)).toEqual(["pool", "ev"]);
  });

  it("an empty selection yields an empty prompt, not an empty box", () => {
    expect(capturePromptFlags(cfg([{ id: "pool", label: "Pool" }]), [])).toEqual([]);
  });
});
