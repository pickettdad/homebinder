/**
 * Capture Mode spec §10 — the scans, as source-level invariants.
 *
 * These assert ABSENCE, which is the one property that cannot be checked by rendering the
 * screen and looking: a count that is merely off-screen today reappears the first time
 * someone adds a header. §2.1 says "not hidden behind a tab, not collapsed" — absent — so
 * the test is that capture mode cannot reach the machinery at all.
 *
 * Source-level on purpose. A behavioural test proves what one render did; this proves what
 * the module is CAPABLE of, and the walk's failure was a capability that got used.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SCREEN = "src/screens/v2/CaptureModeScreen.tsx";
const src = readFileSync(SCREEN, "utf8");

/** Import specifiers only — comments legitimately discuss what is excluded and why. */
const imports = [...src.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)";$/gm)].map((m) => m[0]);

describe("§10 — no checklist or open-count value is reachable from capture mode", () => {
  it("imports nothing that can produce a checklist item or an open count", () => {
    // The walk's named failure: every zone screen led with "35 core open" and the concierge
    // worked the debt instead of seeing the house. On a Discovery Visit nothing was supposed
    // to be resolved, so the number is not just discouraging — it is meaningless.
    const FORBIDDEN = [
      "ChecklistPanel",
      "auditSnapshot",
      "deriveZoneItems",
      "deriveComponentItems",
      "deriveSessionItems",
      "deriveZoneAudit",
      "buildAuditView",
      "offersVerdict",
    ];
    for (const name of FORBIDDEN) {
      expect(imports.join("\n"), `capture mode must not import ${name}`).not.toContain(name);
    }
  });

  it("computes no open count of its own", () => {
    // Deliberately stricter than the import check: a hand-rolled count would satisfy the
    // import rule and reintroduce the exact failure.
    //
    // Comments are stripped first, and that is a correction rather than a loosening. The
    // first version of this test failed on the file's own header, which quotes "35 core
    // open" to explain why the number is banned — it was asserting against the documentation
    // of the rule instead of against the rule. What must not exist is the CODE.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const phrase of ["coreUnresolved", "standardUnresolved", "core open", "openCount", "unresolved"]) {
      expect(code, `capture mode must not compute ${phrase}`).not.toContain(phrase);
    }
  });

  it("offers no route into the checklist, pins or the canvas", () => {
    // §2.1 lists pins and the canvas concept as absent too — they are classification, and
    // classification is what stopped the walk.
    for (const route of ['name: "pin"', 'name: "canvas"', 'name: "inbox"']) {
      expect(src, `capture mode must not navigate to ${route}`).not.toContain(route);
    }
  });
});

describe("§3 — a capture in capture mode has exactly one possible destination", () => {
  it("every capture target in the file is the current zone", () => {
    // "There are four places to put a photograph and the concierge stops to decide which.
    // The deciding is the cost, not the tapping." So: no pin evidence, no canvas, no inbox.
    const targets = [...src.matchAll(/\{\s*kind:\s*"(pin|zone|inbox)"/g)].map((m) => m[1]);
    expect(targets.length, "expected at least one capture target").toBeGreaterThan(0);
    expect(new Set(targets)).toEqual(new Set(["zone"]));
  });

  it("the post-capture step offers exactly the three spec'd choices", () => {
    // Use · Retake · Use and add note. The third fires on roughly one capture in ten, so it
    // is present and unobtrusive — and nothing else is added to the loop.
    expect(src).toContain("Retake");
    expect(src).toMatch(/Use and add note/);
    expect(src).toMatch(/Use \{isVideo \? "video" : "photo"\}/);
  });
});

describe("§1 — mode is derived at the routing seam, not settable", () => {
  const app = readFileSync("src/app/App.tsx", "utf8");

  it("App derives capture mode from the visit kind and nothing else", () => {
    expect(app).toContain("modeForVisit(");
    expect(app).toContain("visitKindOf(");
  });

  it("nothing anywhere lets a person switch mode directly", () => {
    // The named failure is a concierge on a busy morning in the wrong mode. There is no
    // setter, so there is no wrong morning.
    for (const f of ["src/app/App.tsx", SCREEN, "src/screens/v2/WalkScreen.tsx", "src/screens/v2/ZoneV2Screen.tsx"]) {
      const text = readFileSync(f, "utf8");
      expect(text, `${f} must not set a mode`).not.toMatch(/setMode|setCaptureMode|toggleMode/);
    }
  });
});

describe("§6 — an empty zone is asked why, and the candidate is offered not assumed", () => {
  const zoneScreen = readFileSync("src/screens/v2/ZoneV2Screen.tsx", "utf8");

  it("asks only when the zone has no media of any kind", () => {
    // Photos (video rides here), voice notes AND canvases — a zone captured by any route
    // needs no explanation, so all three count.
    expect(zoneScreen).toMatch(/zone\.photos\.length === 0/);
    expect(zoneScreen).toMatch(/zone\.voiceNotes\.length === 0/);
    expect(zoneScreen).toMatch(/zone\.canvases\.length === 0/);
  });

  it("never pre-fills the close note or reason from a resolution", () => {
    // The candidate is rendered as a button the concierge taps. Pre-filling would let an
    // existing resolution stand as the answer to a question nobody was asked.
    const code = zoneScreen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/useState\(emptyCandidate/);
    expect(code).not.toMatch(/setCloseNote\(emptyCandidate\.text\s*\?\?/);
    // Both halves land on the same tap, and only on a tap.
    expect(code).toMatch(/setCloseNote\(emptyCandidate\.text\)/);
    expect(code).toMatch(/setCloseReasonId\(emptyCandidate\.reasonId\)/);
  });

  it("an empty zone cannot be closed without a Table C reason", () => {
    // The ruling (2026-08-08): an uncaptured zone is a gap, so the close carries a REASON ID
    // beside the free text. Stated as "something routable was recorded" rather than as the
    // literal gate expression — the old version of this test asserted
    // `!closeNote.trim()` verbatim and would have failed on a strictly better gate.
    const code = zoneScreen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/disabled=\{noMedia && !closeReasonId\}/);
    expect(code).toMatch(/closeZoneV2\(zoneId, closeNote, closeReasonId/);
  });

  it("the reasons offered are Table C's, never a list written into the screen", () => {
    // A second vocabulary here would drift the moment Table C gains a row — the same defect
    // class as hardcoding `utility` in the UI instead of reading `defaultsTrueFor`.
    const code = zoneScreen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/v2Config\.naReasons\.map\(/);
    for (const id of ["none-present", "no-access", "not-applicable", "deferred"])
      expect(code, `${id} must not be written into the screen`).not.toContain(`"${id}"`);
  });
});

describe("F-20 — a capture-created zone can still have its attributes set", () => {
  it("ZoneAttributesSet has a dispatcher, not just a fold case", () => {
    // Capture mode does not ask the toggles, so without a post-creation path a
    // capture-created zone could never have them set at all.
    expect(readFileSync("src/store/sessionStore.ts", "utf8")).toContain('type: "ZoneAttributesSet"');
  });

  it("an unset attribute renders as unset, not as false", () => {
    // ABSENT is not FALSE (effectiveAttributes). The screen has to say so, or it recreates
    // the ambiguity the capture-mode decision exists to avoid.
    expect(readFileSync("src/screens/v2/ZoneV2Screen.tsx", "utf8")).toMatch(/not asked/);
  });
});

describe("Amendment 10 §D — a capture note rides ON the photograph", () => {
  it("captions the media rather than adding a zone note", () => {
    // The mechanical-room failure: a shot framed deliberately to show a chlorine injection
    // point, read downstream as a corner of a room. A zone-scoped note puts the intent in
    // the file but not on the frame — a dozen photos and a dozen notes, no correspondence.
    // `MediaCaptioned` rides through to manifest.media[].caption, which is what the
    // identification call is looking at.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("captionMedia(mediaId, note)");
    expect(code, "a capture note must not become a zone note").not.toMatch(/addNote\(/);
  });

  it("the caption is taken from the same tap that saves the photo", () => {
    // One act, not two. A separate captioning step is a second decision in the room, which
    // is what capture mode exists to remove.
    expect(src).toMatch(/capturePhotoV2\([\s\S]{0,120}\.then\(\(mediaId\)/);
  });
});
