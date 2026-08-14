/**
 * Issue #71 — the black screen on an EXISTING inspection database.
 *
 * A v2 session pins its checklist config by content hash and stores a SNAPSHOT of it
 * (`configSnapshots`). That snapshot is written once, by whichever app version created the
 * session, and is then read back by every later version — `loadSessionChecklistConfig` is
 * the ONLY config v2 code may read for that session, which is the correct design: an
 * inspection must not change shape underneath the inspector mid-visit.
 *
 * The consequence is the thing these tests exist for: **a snapshot is data written by a past
 * version of this app, and the engine reading it is the current one.** Every field the schema
 * gains after a session is created is absent from that session's snapshot. `defaultsTrueFor`
 * (master v1.6.1) is the one that shipped the bug — `effectiveAttributes` iterated
 * `config.zoneAttributes` and called `attr.defaultsTrueFor.includes(...)` on rows written
 * before the field existed. The throw lands during RENDER, and with no error boundary React
 * unmounts the whole root: a black rectangle, post-boot, with the watchdog correctly silent.
 *
 * So the invariant is stated over ADDED FIELDS IN GENERAL, not over `defaultsTrueFor`:
 * deriving against a snapshot that is missing schema-added fields must not throw. That holds
 * for the next field the master gains as well as for this one, which an assertion naming
 * `defaultsTrueFor` would not.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Source } from "../../src/engine/schema/events";
import type { V2EventPayload, V2SessionEvent } from "../../src/engine/v2/events";
import { foldV2 } from "../../src/engine/v2/fold";
import { deriveSessionItems, deriveZoneItems, effectiveAttributes } from "../../src/engine/v2/checklist";
import { loadChecklists } from "../../src/config/loadChecklists";
import { validateChecklistConfig, type ChecklistConfig } from "../../src/engine/schema/checklistConfig";

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
        at: `2026-07-23T00:00:${String(i).padStart(2, "0")}.000Z`,
        schemaVersion: 2,
        source,
      }) as V2SessionEvent,
  );
}

/**
 * A session as it exists on the test iPad: created by an older build, resumed by this one.
 * A zone whose attributes are PARTIALLY set is the case that matters — `effectiveAttributes`
 * short-circuits on attributes the zone already carries, so a zone with every attribute set
 * would step over the bug.
 */
const staleSession = foldV2(
  mkEvents([
    {
      type: "SessionInitialized",
      configId: config.configId,
      configVersion: config.configVersion,
      configHash: "hash-stale",
      propertyFlags: ["gas"],
      propertyLabel: "Existing inspection",
    },
    { type: "ZoneCreated", zoneId: "z1", zoneType: "utility", label: "Utility", attributes: {} },
  ]),
);

const staleZone = staleSession.zones[0]!;

/**
 * Strip a field the schema gained AFTER the snapshot was written. `delete` on a structured
 * clone, rather than a hand-built fixture, because the point is that this is the real config
 * minus one field — the same object the old app serialized into IndexedDB.
 */
function snapshotWithout(field: string): ChecklistConfig {
  const stale = structuredClone(config) as ChecklistConfig;
  for (const attr of stale.zoneAttributes) delete (attr as Record<string, unknown>)[field];
  return stale;
}

/**
 * The other half of #71, and the half that matters more: the cause above was one field, but
 * the SYMPTOM — a black rectangle with no text — was the absence of an error boundary. Any
 * future render throw lands the same way without one, so this asserts the boundary exists
 * rather than asserting anything about `defaultsTrueFor`.
 *
 * Source-level, in this repo's existing idiom (see captureModeScreen.test.ts): the property
 * wanted is that the module CANNOT let a render throw reach the root, which a single render
 * of a working screen would not demonstrate.
 */
describe("#71 — a render throw must not be able to unmount the root", () => {
  const app = readFileSync("src/app/App.tsx", "utf8");
  const main = readFileSync("src/main.tsx", "utf8");

  it("seats a boundary around the screen switch, and another around App itself", () => {
    expect(app).toContain("<ErrorBoundary");
    expect(main).toContain("<ErrorBoundary");
  });

  it("keeps the boundary ABOVE the screens, not merely somewhere in the file", () => {
    // The failing screens are the v2 ones a resume lands on; a boundary opened after them
    // would compile, pass the check above, and catch nothing.
    const open = app.indexOf("<ErrorBoundary");
    const close = app.indexOf("</ErrorBoundary>");
    for (const screen of ["<HomeScreen", "<ZoneV2Screen", "<WalkScreen", "<PinScreen"]) {
      const at = app.indexOf(screen);
      expect(at, `${screen} is not inside the boundary`).toBeGreaterThan(open);
      expect(at, `${screen} is not inside the boundary`).toBeLessThan(close);
    }
  });

  it("renders the failure instead of swallowing it — the field needs text to screenshot", () => {
    const boundary = readFileSync("src/app/ErrorBoundary.tsx", "utf8");
    expect(boundary).toContain("getDerivedStateFromError");
    // The watchdog's post-boot silence is correct and stays; this is what replaces it as the
    // thing that actually speaks. A boundary that rendered null would reproduce #71 exactly.
    expect(boundary).toMatch(/error\.message/);
    expect(boundary).toMatch(/componentStack/);
  });
});

describe("#71 — deriving against a stored snapshot written by an older app version", () => {
  it("does not throw when a schema-added zone-attribute field is absent", () => {
    const stale = snapshotWithout("defaultsTrueFor");
    expect(() => effectiveAttributes(stale, staleZone)).not.toThrow();
    expect(() => deriveZoneItems(stale, staleSession, "z1")).not.toThrow();
    expect(() => deriveSessionItems(stale, staleSession)).not.toThrow();
  });

  it("treats an absent default the way an empty one behaves — no attribute is invented", () => {
    const stale = snapshotWithout("defaultsTrueFor");
    // A snapshot predating the field cannot express "defaults true for utility", so the
    // honest reading is that it defaults true for nothing. Inventing an attribute the
    // inspector never set would change what a past visit is recorded as having asked.
    expect(effectiveAttributes(stale, staleZone)).toEqual({});
  });

  it("re-parses a stale snapshot back into schema shape, so added fields arrive filled", () => {
    // The class fix, stated over the mechanism rather than the field: `loadSessionChecklistConfig`
    // runs the stored row through the schema, and the schema gives every added field a default.
    // Asserting the PARSE is what makes this hold for the next field the master gains; asserting
    // "defaultsTrueFor is []" would only ever restate the fix that already shipped.
    const parsed = validateChecklistConfig(snapshotWithout("defaultsTrueFor"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (const attr of parsed.config.zoneAttributes) expect(Array.isArray(attr.defaultsTrueFor)).toBe(true);
  });

  it("still applies the default when the snapshot does carry the field", () => {
    // The guard must not disable the feature for current sessions — Table B's whole point
    // is that picking `utility` pre-ticks has_mechanicals.
    const fresh = effectiveAttributes(config, staleZone);
    const declared = config.zoneAttributes.filter((a) => a.defaultsTrueFor.includes("utility"));
    for (const attr of declared) expect(fresh[attr.id]).toBe(true);
  });
});
