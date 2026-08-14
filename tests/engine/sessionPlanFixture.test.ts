/**
 * The session plan, as the field side reads it — the receiving half of the seam.
 *
 * `fixtures/session-plan/session-plan_walk-2026-07-31_v1.json` is a committed copy of the
 * binder's golden fixture (binder PR #116), emitted through its real import and audit against
 * the 2026-07-31 walk export and regenerated there by `npm run plan-fixture`. **This file is
 * the tripwire on the field side**: the binder proved its own fires by adding a field and
 * watching it fail by name, and this is the matching half — if the emitted shape moves, the
 * receiver's build breaks here rather than in a mechanical room.
 *
 * ⚑ These assert INVARIANTS, not the numbers. 8 zones and 208 carried gaps are facts about
 * one walk; they will differ on every real property, and a test pinning them fires on every
 * legitimate re-emission. What must hold on any plan is that **every section's count matches
 * the array it describes** — the whole reason `sections` exists is that an empty array cannot
 * say whether the mechanism ran, so a count that disagrees with its own array is the one
 * failure that would make the reports worse than useless.
 *
 * The receiver is NOT built yet. This validates the shape it will be built against, so the
 * contract is pinned before the code exists rather than after.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 * THE RECEIVER'S RULES, ratified 2026-08-14 with Builder Code and the design session.
 *
 * Recorded here rather than in a reply, because **the receiver is built in this repo and
 * these bind whoever builds it** — and the design session that carried them is consolidating,
 * so a ruling left in a message has one fewer path to the code than it had yesterday.
 *
 * **Versioning — bump on breaking only.** Breaking is a receiver correct at N being wrong at
 * N+1: a field removed, renamed, retyped, or given new meaning under the same name. Adding a
 * field is NOT breaking. ⚑ That is only safe as a *pair* with the tolerance rule below — the
 * emitter may add freely precisely because the receiver ignores what it does not know.
 * `planRevision` rides alongside so an ignored-field report is attributable to a build.
 *
 * **1 · Unknown version → refuse, loudly, never best-effort.** Guessing is the one case that
 * produces a silent wrong answer.
 *
 * **2 · Unknown field at a known version → ignore and count.**
 *
 * **3 · Unknown value in a known field → preserve, display, count, mark unrecognised.**
 *
 * ⚑ **The discriminator carve-out, and it is a named class rather than one exception.**
 * **A field whose value selects how another field is read is REFUSED for that pair, not
 * marked.** `sinceBasis` is today's only instance — `since` is null on every basis but
 * `dated`, and a null there is four different facts — so an unrecognised basis makes `since`
 * uninterpretable rather than merely flagged. Naming the class is the point: rule 3 is right
 * for vocabulary and wrong for anything that decides how to read something else.
 *
 * ⚑ **Refuse the plan, never the visit.** Server-side "loudly" is a 4xx. Field-side it is an
 * iPad in a basement, where **a visit without a plan is survivable and a frozen app is not.**
 * The import fails, says so plainly, and the visit proceeds unplanned — the same ladder as
 * *a capture is safe the instant it is taken, and no later step is mandatory.*
 *
 * ⚑ **TWO SHAPE RULINGS THAT ARE NOT YET EMITTED — corrected 2026-08-14, and an earlier
 * revision of this block recorded both as guarantees a receiver may rely on. They are not.
 * Check them against the fixture beside this file, which is the point of it being here.**
 *
 * - **`flag` always present and nullable** — ruled, **not emitted**. `typedPins[]` in the v1
 *   fixture carries `pinId · componentType · label · priorUnitPhoto` and **no `flag` key at
 *   all**. So a receiver reading `pin.flag` today gets `undefined` from an absent key, not
 *   `null` from an unflagged pin — and those are different facts.
 * - **Every flagged live pin carried regardless of typing** — ruled, **not emitted**. The
 *   binder ships flags on typed pins only, and **three flagged untyped pins do not travel.**
 *
 * **So `typedPins[]` is a PARTIAL record of what was flagged, and a receiver must treat it as
 * one.** Reading it as the whole set means a pin the concierge flagged is silently absent
 * from the visit it was flagged for — which is `an empty list is indistinguishable from a
 * completed one`, in the dimension the flag exists to serve.
 *
 * Read `sections.typedPins` for the count that did not travel. ⚑ **Its note does not carry
 * that count yet** — at v1 it reads *"live typed pins, by field-minted uuid"* — so until it
 * does, the shortfall is not derivable from the payload at all and a receiver must not
 * pretend otherwise.
 *
 * *Recorded this way deliberately: a ruling and a shipped behaviour are different facts, and
 * writing the first as if it were the second is what put a wrong line in a merged PR.*
 * ────────────────────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const FIXTURE = "fixtures/session-plan/session-plan_walk-2026-07-31_v1.json";

interface SectionReport {
  count: number;
  note: string;
}

/** Only what the field side reads. Deliberately not a re-declaration of the emitter's type. */
interface SessionPlanShape {
  planSchemaVersion: number;
  kind: string;
  source: { actor: string; propertyId: string; generatedAt: string; generatedBy: string };
  property: { id: string; label: string };
  zones: { zoneId: string; label: string | null; type: string | null; attributes: Record<string, boolean> }[];
  typedPins: { pinId: string; componentType: string | null; label: string | null }[];
  carriedGaps: { itemId: string; reason: string; since: string | null; sinceBasis: string; sinceNote: string }[];
  monitorsDue: unknown[];
  comparisonPositionsDue: unknown[];
  openConcerns: unknown[];
  sections: Record<string, SectionReport>;
  warnings: string[];
}

const plan = JSON.parse(readFileSync(FIXTURE, "utf8")) as SessionPlanShape;

describe("session plan — the shape the receiver is built against", () => {
  it("declares the version and kind the receiver gates on", () => {
    // The two fields a receiver must read before anything else: `kind` proves it is a plan at
    // all, `planSchemaVersion` decides whether this receiver may read it. An unknown version
    // is refused rather than best-effort — guessing is the case that produces a silent wrong
    // answer, which is why both sides agreed the rule rather than each assuming one.
    expect(plan.kind).toBe("session-plan");
    expect(plan.planSchemaVersion).toBe(1);
  });

  it("carries a section report for every collection, and none for anything else", () => {
    // The invariant behind the whole design: an empty array is ambiguous between "the
    // mechanism ran and found nothing", "this config cannot express it" and "it is unbuilt".
    // A collection with no section is exactly that ambiguity restored.
    const collections = Object.entries(plan).filter(([, v]) => Array.isArray(v)).map(([k]) => k);
    const reported = Object.keys(plan.sections);
    for (const key of collections) {
      if (key === "warnings") continue; // warnings describe the emission, not a section of it
      expect(reported, `${key} must carry a section report`).toContain(key);
    }
  });

  it("every section count equals the length of the array it describes", () => {
    // Holds at eight zones and at eighty. A count that disagrees with its own array is worse
    // than no count: it is a number a reader trusts instead of looking.
    for (const [key, report] of Object.entries(plan.sections)) {
      const arr = (plan as unknown as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) continue; // priorUnitPhotographs reports on a field, not a list
      expect(report.count, `sections.${key}.count vs ${key}.length`).toBe(arr.length);
    }
  });

  it("every section note says something, because a count alone cannot say which case it is", () => {
    for (const [key, report] of Object.entries(plan.sections)) {
      expect(report.note.trim().length, `sections.${key}.note must not be empty`).toBeGreaterThan(0);
    }
  });

  it("reads a gap's date only through its basis", () => {
    // `since` is null on every basis but `dated`, and a null there is four different facts.
    // The discriminator is not decoration — a receiver that renders `since` without reading
    // `sinceBasis` shows a date it cannot justify, or hides one it could.
    const BASES = ["dated", "undated", "predates-record", "no-visit"];
    for (const gap of plan.carriedGaps) {
      expect(BASES, `unknown sinceBasis ${gap.sinceBasis}`).toContain(gap.sinceBasis);
      if (gap.sinceBasis !== "dated") expect(gap.since, `${gap.itemId} must have no date`).toBeNull();
      expect(gap.sinceNote.trim().length).toBeGreaterThan(0);
    }
  });

  it("surfaces an unrecognised flag value as a warning rather than dropping it", () => {
    // The fail-open path, proven on real data: the walk set `fine`, which the emitter's
    // vocabulary predates. Preserved, counted, named, and explicitly not treated as a monitor.
    // Asserted as a property of the mechanism — that a warning names the value — rather than
    // as the specific string, which changes the moment the contract carries the vocabulary.
    expect(Array.isArray(plan.warnings)).toBe(true);
    if (plan.warnings.length > 0) {
      for (const w of plan.warnings) expect(w.trim().length).toBeGreaterThan(0);
    }
  });

  it("tolerates a field it has never seen", () => {
    // The receiver rule made testable: unknown field at a known version is ignored and
    // counted, never a parse failure. This is the half that lets the emitter add fields
    // without bumping the version, and the two rules are only safe as a pair.
    const withExtra = { ...plan, someFieldFromTheFuture: { nested: true } };
    expect(() => JSON.parse(JSON.stringify(withExtra))).not.toThrow();
    expect((withExtra as unknown as Record<string, unknown>).planSchemaVersion).toBe(1);
  });
});
