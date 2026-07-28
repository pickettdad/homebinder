/**
 * v2 fold + checklist derivation — the pin-model engine core.
 *
 * Derivation tests run against the REAL generated config (loadChecklists) so they also
 * pin the master's composition semantics: inheritance, triggers, per-pin component
 * attachment, session items, and the attest proposal rule.
 */
import { describe, expect, it } from "vitest";
import type { Source } from "../../src/engine/schema/events";
import type { V2EventPayload, V2SessionEvent } from "../../src/engine/v2/events";
import { exportIsCurrent, foldV2, resolutionKey } from "../../src/engine/v2/fold";
import {
  activeRefs,
  auditSnapshot,
  buildAuditView,
  deriveComponentItems,
  deriveSessionItems,
  deriveZoneAudit,
  deriveZoneItems,
} from "../../src/engine/v2/checklist";
import { loadChecklists } from "../../src/config/loadChecklists";

const config = loadChecklists();

const source: Source = { actor: "human", actorId: "inspector", device: "test", appVersion: "test" };

/** Stamp EventBase the way appendEvents does, with deterministic seq. */
function mkEvents(payloads: V2EventPayload[]): V2SessionEvent[] {
  return payloads.map(
    (payload, i) =>
      ({
        ...payload,
        eventId: `evt-${i + 1}`,
        sessionId: "s1",
        seq: i + 1,
        at: `2026-07-23T00:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: 2,
        source,
      }) as V2SessionEvent,
  );
}

const init: V2EventPayload = {
  type: "SessionInitialized",
  configId: config.configId,
  configVersion: config.configVersion,
  configHash: "hash-test",
  propertyFlags: ["gas", "septic"],
  propertyLabel: "Test House",
};

const media = (n: number) => ({ mediaId: `m${n}`, sha256: `sha${n}`, mime: "image/jpeg", bytes: 100 });

describe("foldV2 core", () => {
  it("throws without SessionInitialized", () => {
    expect(() => foldV2(mkEvents([{ type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } }]))).toThrow(
      /SessionInitialized/,
    );
  });

  it("builds zones, pins, anchors, and canvases; tracks counters", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: { has_mechanicals: true } },
        { type: "CanvasAdded", canvasId: "c1", zoneId: "z1", kind: "photo", media: media(1) },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "water-heater" } },
        { type: "PinFlagged", pinId: "p1", flag: "monitor" },
        { type: "AnchorPlaced", anchorId: "a1", pinId: "p1", canvasId: "c1", x: 0.25, y: 0.75 },
        { type: "PinCreated", pinId: "p2", pinNumber: 2 }, // misc bucket
      ]),
    );
    expect(state.zones).toHaveLength(1);
    expect(state.pins.map((p) => p.number)).toEqual([1, 2]);
    expect(state.pins[0]!.pinType).toEqual({ kind: "component", componentType: "water-heater" });
    expect(state.pins[0]!.flag).toBe("monitor");
    expect(state.pins[0]!.anchors).toEqual([{ anchorId: "a1", canvasId: "c1", x: 0.25, y: 0.75 }]);
    expect(state.pins[1]!.zoneId).toBeUndefined();
    expect(state.lastPinNumber).toBe(2);
    expect(state.lastEventSeq).toBe(8);
    expect(state.orphanEvents).toHaveLength(0);
  });

  it("retires pins without reusing numbers and supports freeform typing", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PinRetired", pinId: "p1", note: "mistake" },
        { type: "PinCreated", pinId: "p2", pinNumber: 2, zoneId: "z1" },
        { type: "PinTyped", pinId: "p2", pinType: { kind: "freeform", label: "mystery box" } },
      ]),
    );
    expect(state.pins).toHaveLength(2); // retired pin stays — numbers permanent
    expect(state.pins[0]!.retired?.note).toBe("mistake");
    expect(state.pins[1]!.number).toBe(2);
    expect(state.pins[1]!.pinType).toEqual({ kind: "freeform", label: "mystery box" });
  });

  it("routes media by target, reassigns from inbox, and discards", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "kitchen", label: "K", attributes: {} },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PhotoAdded", media: media(1), target: { kind: "inbox" } },
        { type: "PhotoAdded", media: media(2), target: { kind: "zone", id: "z1" } },
        { type: "VoiceNoteAdded", media: media(3), target: { kind: "pin", id: "p1" }, durationMs: 900 },
        { type: "MediaReassigned", mediaId: "m1", target: { kind: "pin", id: "p1" } },
        { type: "PhotoAdded", media: media(4), target: { kind: "inbox" } },
        { type: "MediaDiscarded", mediaId: "m4" },
      ]),
    );
    expect(state.inbox).toHaveLength(0);
    expect(state.zones[0]!.photos.map((m) => m.mediaId)).toEqual(["m2"]);
    expect(state.pins[0]!.photos.map((m) => m.mediaId)).toEqual(["m1"]);
    expect(state.pins[0]!.voiceNotes.map((m) => m.mediaId)).toEqual(["m3"]);
  });

  it("advisory close records the audit and reopen clears it", () => {
    const audit = { coreUnresolved: ["int.canvas"], standardUnresolved: 3, naCount: 1 };
    const closed = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "bathroom", label: "Bath", attributes: {} },
        { type: "ZoneClosed", zoneId: "z1", note: "ran out of light", audit },
      ]),
    );
    expect(closed.zones[0]!.closedAt).toBeDefined();
    expect(closed.zones[0]!.closeNote).toBe("ran out of light");
    expect(closed.zones[0]!.audit).toEqual(audit);

    const reopened = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "bathroom", label: "Bath", attributes: {} },
        { type: "ZoneClosed", zoneId: "z1", audit },
        { type: "ZoneReopened", zoneId: "z1" },
      ]),
    );
    expect(reopened.zones[0]!.closedAt).toBeUndefined();
    expect(reopened.zones[0]!.audit).toBeUndefined();
  });

  it("zone levels: set at creation, corrected later; ghost zone orphans", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true }, level: "basement" },
        { type: "ZoneCreated", zoneId: "z2", zoneType: "living-space", label: "Guest", attributes: {} },
        { type: "ZoneLevelSet", zoneId: "z2", level: "second" },
        { type: "ZoneLevelSet", zoneId: "ghost", level: "attic" },
      ]),
    );
    expect(state.zones[0]!.level).toBe("basement");
    expect(state.zones[1]!.level).toBe("second");
    expect(state.orphanEvents).toHaveLength(1);
  });

  it("captions travel with the capture through a retag; unknown media orphans", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "kitchen", label: "K", attributes: {} },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PhotoAdded", media: media(1), target: { kind: "inbox" } },
        { type: "MediaCaptioned", mediaId: "m1", text: "panel, dead-front off" },
        { type: "MediaReassigned", mediaId: "m1", target: { kind: "pin", id: "p1" } },
        { type: "MediaCaptioned", mediaId: "ghost", text: "x" },
      ]),
    );
    expect(state.pins[0]!.photos[0]!.caption).toBe("panel, dead-front off");
    expect(state.orphanEvents).toHaveLength(1);
  });

  it("removing one anchor leaves the pin, its number, and its other anchors (field test 3)", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "CanvasAdded", canvasId: "c1", zoneId: "z1", kind: "photo", media: media(1) },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "AnchorPlaced", anchorId: "a1", pinId: "p1", canvasId: "c1", x: 0.1, y: 0.1 },
        { type: "AnchorPlaced", anchorId: "a2", pinId: "p1", canvasId: "c1", x: 0.9, y: 0.9 },
        { type: "AnchorRemoved", anchorId: "a1" },
      ]),
    );
    expect(state.pins[0]!.anchors.map((a) => a.anchorId)).toEqual(["a2"]);
    expect(state.pins[0]!.number).toBe(1);
    expect(state.pins[0]!.retired).toBeUndefined();
  });

  it("SessionCompleted stamps completedAt", () => {
    const state = foldV2(mkEvents([init, { type: "SessionCompleted" }]));
    expect(state.completedAt).toBeDefined();
  });

  it("reopen un-completes and logs the reason; re-complete re-stamps — full lifecycle in order", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "SessionCompleted" },
        { type: "SessionReopened", reason: "forgot the bathroom GFCI" },
        { type: "SessionCompleted" },
      ]),
    );
    expect(state.completedAt).toBeDefined(); // re-completed → set again
    expect(state.lifecycle.map((l) => l.type)).toEqual(["completed", "reopened", "completed"]);
    expect(state.lifecycle[1]!.reason).toBe("forgot the bathroom GFCI");

    // While reopened (before the second completion) the visit is live again.
    const reopened = foldV2(
      mkEvents([init, { type: "SessionCompleted" }, { type: "SessionReopened", reason: "x" }]),
    );
    expect(reopened.completedAt).toBeUndefined();
  });

  it("PinLabeled sets a nickname additively; empty clears; ghost pin orphans", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "water-treatment" } },
        { type: "PinLabeled", pinId: "p1", label: "chlorine tank" },
        { type: "PinLabeled", pinId: "ghost", label: "x" },
      ]),
    );
    expect(state.pins[0]!.label).toBe("chlorine tank");
    // Type is untouched by the nickname.
    expect(state.pins[0]!.pinType).toEqual({ kind: "component", componentType: "water-treatment" });
    expect(state.orphanEvents).toHaveLength(1);

    const cleared = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "PinLabeled", pinId: "p1", label: "temp" },
        { type: "PinLabeled", pinId: "p1", label: "" },
      ]),
    );
    expect(cleared.pins[0]!.label).toBeUndefined();
  });

  it("orphans events with unknown references instead of dropping or throwing", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneRenamed", zoneId: "ghost", label: "x" },
        { type: "PinFlagged", pinId: "ghost", flag: "issue" },
        { type: "PhotoAdded", media: media(1), target: { kind: "pin", id: "ghost" } },
        { type: "ItemReopened", scope: { kind: "session" }, itemId: "never-resolved" },
      ]),
    );
    expect(state.orphanEvents).toHaveLength(4);
  });

  it("ignores unknown event types (forward compat)", () => {
    const events = mkEvents([init]);
    events.push({ ...events[0]!, seq: 2, type: "FutureThing" } as unknown as V2SessionEvent);
    expect(() => foldV2(events)).not.toThrow();
  });

  it("records resolutions per scope and reopens them; PropertyFlagsCorrected replaces flags", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        {
          type: "ItemResolved",
          scope: { kind: "zone", zoneId: "z1" },
          itemId: "utl.pressure",
          resolution: { kind: "satisfied", via: "measure", result: "pass", evidence: { value: 58, unit: "psi" } },
        },
        {
          type: "ItemResolved",
          scope: { kind: "pin", pinId: "p1" },
          itemId: "wh.tpr",
          resolution: { kind: "satisfied", via: "check", result: "fail", note: "discharge not piped" },
        },
        {
          type: "ItemResolved",
          scope: { kind: "zone", zoneId: "z1" },
          itemId: "utl.backwater",
          resolution: { kind: "na", reasonId: "none-present" },
        },
        { type: "ItemReopened", scope: { kind: "zone", zoneId: "z1" }, itemId: "utl.pressure" },
        { type: "PropertyFlagsCorrected", propertyFlags: ["gas", "septic", "well"], note: "well found on site" },
      ]),
    );
    expect(state.resolutions.has(resolutionKey({ kind: "zone", zoneId: "z1" }, "utl.pressure"))).toBe(false);
    const tpr = state.resolutions.get(resolutionKey({ kind: "pin", pinId: "p1" }, "wh.tpr"));
    expect(tpr?.resolution).toMatchObject({ kind: "satisfied", result: "fail" });
    expect(state.propertyFlags).toContain("well");
  });

  it("records chat threads on pins with provenance-carrying messages", () => {
    const state = foldV2(
      mkEvents([
        init,
        { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "U", attributes: { has_mechanicals: true } },
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
        { type: "ChatMessageSent", threadId: "t1", target: { kind: "pin", id: "p1" }, text: "what is this?", mediaIds: ["m1"] },
        { type: "ChatReplyRecorded", threadId: "t1", model: "claude-sonnet-5", text: "A pressure tank.", usage: { inputTokens: 10, outputTokens: 5 } },
      ]),
    );
    const thread = state.chats.get("t1")!;
    expect(thread.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(thread.messages[1]!.model).toBe("claude-sonnet-5");
    expect(state.pins[0]!.chatThreadIds).toEqual(["t1"]);
  });
});

describe("checklist derivation (real config)", () => {
  const baseEvents: V2EventPayload[] = [
    init,
    { type: "ZoneCreated", zoneId: "bath", zoneType: "bathroom", label: "Main Bath", attributes: {} },
    { type: "ZoneCreated", zoneId: "utl", zoneType: "utility", label: "Utility", attributes: { has_mechanicals: true } },
    { type: "ZoneCreated", zoneId: "bed", zoneType: "living-space", label: "Guest Room", attributes: { sleeping: true } },
  ];

  it("composes a bathroom from interior-base + wet-base + its own list", () => {
    const state = foldV2(mkEvents(baseEvents));
    const items = deriveZoneItems(config, state, "bath");
    const ids = items.map((d) => d.item.id);
    expect(ids).toContain("int.surfaces"); // interior-base
    expect(ids).toContain("wet.under-sink"); // wet-base
    expect(ids).toContain("bth.toilet"); // own list (was bth.toilet-secure before v1.4 renamed it)
    expect(ids).not.toContain("rgh.structure"); // rough-base not inherited
    const groups = new Set(items.map((d) => d.group));
    expect(groups.has("interior-base")).toBe(true);
    expect(groups.has("wet-base")).toBe(true);
  });

  it("applies property triggers: gas surfaces the sniffer, oil/propane tank item stays hidden", () => {
    const state = foldV2(mkEvents(baseEvents));
    const ids = deriveZoneItems(config, state, "utl").map((d) => d.item.id);
    expect(ids).toContain("utl.gas-shutoff"); // property.gas set
    expect(ids).toContain("utl.sniffer"); // anyOf(gas, propane) — gas satisfies it
    expect(ids).not.toContain("utl.fuel-tank"); // anyOf(oil, propane) — neither set
  });

  it("zone attribute triggers: egress only in sleeping zones (v1.2 interior-base move)", () => {
    const state = foldV2(mkEvents(baseEvents));
    expect(deriveZoneItems(config, state, "bed").map((d) => d.item.id)).toContain("liv.egress");
    expect(deriveZoneItems(config, state, "bath").map((d) => d.item.id)).not.toContain("liv.egress");
  });

  it("attaches component items per pin — two water heaters mean two nameplate items", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "utl" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "water-heater" } },
        { type: "PinCreated", pinId: "p2", pinNumber: 2, zoneId: "utl" },
        { type: "PinTyped", pinId: "p2", pinType: { kind: "component", componentType: "water-heater" } },
        { type: "PinCreated", pinId: "p3", pinNumber: 3, zoneId: "utl" },
        { type: "PinTyped", pinId: "p3", pinType: { kind: "freeform", label: "unknown device" } },
      ]),
    );
    const items = deriveComponentItems(config, state, "utl");
    const nameplates = items.filter((d) => d.item.id === "wh.nameplate");
    expect(nameplates).toHaveLength(2);
    expect(new Set(nameplates.map((d) => (d.scope.kind === "pin" ? d.scope.pinId : "")))).toEqual(new Set(["p1", "p2"]));
    // Freeform pins attach nothing (REDESIGN §3 / utl.unidentified pathway).
    expect(items.some((d) => d.scope.kind === "pin" && d.scope.pinId === "p3")).toBe(false);
  });

  it("audit view: documentation and tests never mix, grouped, nothing dropped (step 4 UI contract)", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "utl" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "water-heater" } },
      ]),
    );
    const items = deriveZoneAudit(config, state, "utl");
    const view = buildAuditView(items);
    for (const g of view.documentation) for (const d of g.items) expect(d.item.attest).toBe("evidence");
    for (const g of view.tests) for (const d of g.items) expect(d.item.attest).toBe("action");
    const total = [...view.documentation, ...view.tests].reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(items.length); // partition — every derived item appears exactly once
    expect(view.tests.length).toBeGreaterThan(0); // utility has real tests (TPR, sniffer…)
    // Groups keyed and non-empty, first-appearance order preserved within a section.
    for (const g of [...view.documentation, ...view.tests]) {
      expect(g.key).toBeTruthy();
      expect(g.items.length).toBeGreaterThan(0);
    }
  });

  it("pin nicknames disambiguate same-typed component groups in the audit", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "utl" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "water-heater" } },
        { type: "PinLabeled", pinId: "p1", label: "main tank" },
        { type: "PinCreated", pinId: "p2", pinNumber: 2, zoneId: "utl" },
        { type: "PinTyped", pinId: "p2", pinType: { kind: "component", componentType: "water-heater" } },
      ]),
    );
    const groups = new Set(deriveComponentItems(config, state, "utl").map((d) => d.group));
    // Nicknamed pin carries its label; the un-nicknamed one still reads by number+type.
    expect(groups).toContain("#1 water-heater — main tank");
    expect(groups).toContain("#2 water-heater");
  });

  it("proposes evidence pin items from a matching typed pin, NEVER action items", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "utl" },
        { type: "PinTyped", pinId: "p1", pinType: { kind: "component", componentType: "sump-pump" } },
      ]),
    );
    const items = deriveZoneAudit(config, state, "utl");
    // utl.sump (evidence, pin sump-pump) → proposed by the pin's existence.
    const sump = items.find((d) => d.item.id === "utl.sump")!;
    expect(sump.status).toEqual({ kind: "proposed", pinIds: ["p1"] });
    // sp.bucket (action) on the same pin → stays unresolved. The bucket test cannot
    // be proposed by anything — this is the owner's two-list rule, mechanically.
    const bucket = items.find((d) => d.item.id === "sp.bucket")!;
    expect(bucket.item.attest).toBe("action");
    expect(bucket.status).toEqual({ kind: "unresolved" });
    // rgh.foundation is satisfy:pin but attest:action → also never proposed.
    const foundation = items.find((d) => d.item.id === "rgh.foundation")!;
    expect(foundation.status).toEqual({ kind: "unresolved" });
  });

  it("component evidence-pin items propose from pins in OTHER zones (fp.chimney × elevation chimney)", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "ZoneCreated", zoneId: "elv", zoneType: "elevation", label: "North side", attributes: {} },
        { type: "PinCreated", pinId: "fp", pinNumber: 1, zoneId: "bed" },
        { type: "PinTyped", pinId: "fp", pinType: { kind: "component", componentType: "fireplace" } },
        { type: "PinCreated", pinId: "ch", pinNumber: 2, zoneId: "elv" },
        { type: "PinTyped", pinId: "ch", pinType: { kind: "component", componentType: "chimney" } },
      ]),
    );
    const items = deriveComponentItems(config, state, "bed");
    const link = items.find((d) => d.item.id === "fp.chimney")!;
    expect(link.item.attest).toBe("evidence");
    expect(link.status).toEqual({ kind: "proposed", pinIds: ["ch"] });
    // The WETT flag on the same fireplace is action — never proposed by anything.
    expect(items.find((d) => d.item.id === "fp.wett")!.status).toEqual({ kind: "unresolved" });
  });

  it("v1.2.1: finished-behind fires in any finished rough zone via zone.finished", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        { type: "ZoneCreated", zoneId: "gar", zoneType: "garage", label: "Garage", attributes: { finished: true } },
        { type: "ZoneCreated", zoneId: "crawl", zoneType: "crawlspace", label: "Crawl", attributes: {} },
      ]),
    );
    expect(deriveZoneItems(config, state, "gar").map((d) => d.item.id)).toContain("bsm.finished-behind");
    expect(deriveZoneItems(config, state, "crawl").map((d) => d.item.id)).not.toContain("bsm.finished-behind");
  });

  it("session items surface with pin.* refs house-wide (wood-heat catch hidden without flag)", () => {
    const state = foldV2(mkEvents(baseEvents));
    const ids = deriveSessionItems(config, state).map((d) => d.item.id);
    expect(ids).toContain("ses.alarm-coverage");
    expect(ids).toContain("ses.below-recheck");
    expect(ids).not.toContain("ses.wood-heat-pinned"); // property.wood_heat not set
    expect(activeRefs(state, undefined).has("property.gas")).toBe(true);
  });

  it("audit snapshot counts core/standard/na for the advisory close", () => {
    const state = foldV2(
      mkEvents([
        ...baseEvents,
        {
          type: "ItemResolved",
          scope: { kind: "zone", zoneId: "bath" },
          itemId: "bth.toilet-secure",
          resolution: { kind: "satisfied", via: "check", result: "pass" },
        },
        {
          type: "ItemResolved",
          scope: { kind: "zone", zoneId: "bath" },
          itemId: "wet.fan",
          resolution: { kind: "na", reasonId: "not-applicable", note: "window bath, no fan" },
        },
      ]),
    );
    const items = deriveZoneAudit(config, state, "bath");
    const snap = auditSnapshot(items);
    expect(snap.naCount).toBe(1);
    expect(snap.coreUnresolved).not.toContain("bth.toilet-secure");
    expect(snap.coreUnresolved).not.toContain("wet.fan");
    expect(snap.coreUnresolved).toContain("int.canvas");
    expect(snap.standardUnresolved).toBeGreaterThan(0);
  });
});

describe("pin move across zones drops anchors (owner ruling 2026-07-25)", () => {
  const base: V2EventPayload[] = [
    init,
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: { has_mechanicals: true } },
    { type: "ZoneCreated", zoneId: "z2", zoneType: "utility", label: "Garage", attributes: { has_mechanicals: true } },
    { type: "CanvasAdded", canvasId: "c1", zoneId: "z1", kind: "photo", media: media(1) },
    { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
    { type: "AnchorPlaced", anchorId: "a1", pinId: "p1", canvasId: "c1", x: 0.2, y: 0.3 },
  ];

  it("clears anchors when the pin moves to a different zone", () => {
    const state = foldV2(mkEvents([...base, { type: "PinAssigned", pinId: "p1", zoneId: "z2" }]));
    const pin = state.pins.find((p) => p.pinId === "p1")!;
    expect(pin.zoneId).toBe("z2");
    expect(pin.anchors).toEqual([]);
  });

  it("keeps anchors when re-assigned to the SAME zone", () => {
    const state = foldV2(mkEvents([...base, { type: "PinAssigned", pinId: "p1", zoneId: "z1" }]));
    expect(state.pins.find((p) => p.pinId === "p1")!.anchors).toHaveLength(1);
  });

  it("clears anchors when the pin moves to the misc bucket (no zone)", () => {
    const state = foldV2(mkEvents([...base, { type: "PinAssigned", pinId: "p1", zoneId: undefined }]));
    const pin = state.pins.find((p) => p.pinId === "p1")!;
    expect(pin.zoneId).toBeUndefined();
    expect(pin.anchors).toEqual([]);
  });
});

describe("export tracking / exportIsCurrent", () => {
  const base: V2EventPayload[] = [
    init,
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: { has_mechanicals: true } },
  ];

  it("is false before any export", () => {
    expect(exportIsCurrent(foldV2(mkEvents(base)))).toBe(false);
  });

  it("is true immediately after an export is recorded", () => {
    const state = foldV2(
      mkEvents([...base, { type: "ExportProduced", manifestSha256: "abc", files: [{ name: "m.json", bytes: 10 }] }]),
    );
    expect(state.exports).toHaveLength(1);
    expect(state.exports[0]!.manifestSha256).toBe("abc");
    expect(exportIsCurrent(state)).toBe(true);
  });

  it("goes stale as soon as anything else is recorded", () => {
    const state = foldV2(
      mkEvents([
        ...base,
        { type: "ExportProduced", manifestSha256: "abc", files: [] },
        { type: "PinCreated", pinId: "p9", pinNumber: 9, zoneId: "z1" },
      ]),
    );
    expect(exportIsCurrent(state)).toBe(false);
  });
});

/**
 * Re-filing video (2026-07-25). MediaReassigned has to decide which collection a capture
 * lands in. The old rule was "has a duration ⇒ voice note", which is true for audio and
 * wrong for video: a clip re-filed onto a pin would quietly become a voice note and
 * disappear from every photo grid.
 */
describe("fold v2 — video survives re-filing as visual evidence", () => {
  const base: V2EventPayload[] = [
    { type: "SessionInitialized", configId: "cfg", configVersion: "1.0", configHash: "h", propertyFlags: [], propertyLabel: "H" },
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: { has_mechanicals: true }, level: "basement" },
    { type: "PinCreated", pinId: "p1", pinNumber: 1, zoneId: "z1" },
  ];

  it("keeps a video in photos when re-filed inbox → pin", () => {
    const state = foldV2(
      mkEvents([
        ...base,
        { type: "PhotoAdded", media: { mediaId: "v1", sha256: "s", mime: "video/mp4", bytes: 10 }, target: { kind: "inbox" }, durationMs: 47000 },
        { type: "MediaReassigned", mediaId: "v1", target: { kind: "pin", id: "p1" } },
      ]),
    );
    const pin = state.pins.find((p) => p.pinId === "p1")!;
    expect(pin.photos.map((m) => m.mediaId)).toEqual(["v1"]);
    expect(pin.photos[0]!.durationMs).toBe(47000); // clip length survives the move
    expect(pin.voiceNotes).toHaveLength(0);
  });

  it("keeps a video in photos when re-filed zone → pin (the walkabout path)", () => {
    const state = foldV2(
      mkEvents([
        ...base,
        { type: "PhotoAdded", media: { mediaId: "v2", sha256: "s", mime: "video/quicktime", bytes: 10 }, target: { kind: "zone", id: "z1" }, durationMs: 8000 },
        { type: "MediaReassigned", mediaId: "v2", target: { kind: "pin", id: "p1" } },
      ]),
    );
    const pin = state.pins.find((p) => p.pinId === "p1")!;
    expect(pin.photos.map((m) => m.mediaId)).toEqual(["v2"]);
    expect(pin.voiceNotes).toHaveLength(0);
  });

  it("still routes an audio voice note to voiceNotes when re-filed", () => {
    const state = foldV2(
      mkEvents([
        ...base,
        { type: "VoiceNoteAdded", media: { mediaId: "a1", sha256: "s", mime: "audio/mp4", bytes: 10 }, target: { kind: "inbox" }, durationMs: 3000 },
        { type: "MediaReassigned", mediaId: "a1", target: { kind: "pin", id: "p1" } },
      ]),
    );
    const pin = state.pins.find((p) => p.pinId === "p1")!;
    expect(pin.voiceNotes.map((m) => m.mediaId)).toEqual(["a1"]);
    expect(pin.photos).toHaveLength(0);
  });
});
