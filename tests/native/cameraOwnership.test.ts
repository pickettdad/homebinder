/**
 * ⛑ **Nothing starts the capture session without first asking who owns the lens.**
 *
 * ARKit and `AVCaptureSession` cannot share the rear camera. `reclaimCamera` has refused while a
 * zone holds it since 2026-09-05 — and **`start()` did not go through `reclaimCamera`**, so opening
 * the capture screen during a zone configured and started the capture session anyway. The field log
 * records the consequence four times in ninety seconds: `cameraToZone` → `presetReasserted` →
 * `sessionFailed: Required sensor failed` → a forced re-init **with a new world origin**.
 *
 * ⚑ The invariant asserted here is **not the list of call sites** — that list will grow. It is that
 * **every one of them consults `zoneOwnsCamera`**, which holds at two call sites and at twenty.
 *
 * *Why a source assertion rather than a behavioural one:* this rule lives entirely in Swift, and the
 * failure mode is a **new** call site added without the guard. A test over the source is the only
 * instrument that sees that; a test over behaviour would need the device that already found the bug.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PLUGIN = resolve(__dirname, "../../native/hs-native/ios/Sources/HsNative/HSCameraPlugin.swift");
const src = readFileSync(PLUGIN, "utf8");
const lines = src.split("\n");

/** The enclosing `func` for a line, found by walking back to the nearest declaration. */
const enclosingFunc = (index: number) => {
  for (let i = index; i >= 0; i--) {
    const m = /^\s*(?:@objc\s+)?(?:private\s+|public\s+|internal\s+)?func\s+(\w+)/.exec(lines[i]!);
    if (m) return { name: m[1]!, at: i };
  }
  return null;
};

describe("who is allowed to start the capture session", () => {
  it("has call sites at all — a test that finds nothing passes for the wrong reason", () => {
    // ⚑ The guard against the assertion below going vacuous if the call is ever renamed.
    const calls = lines.filter((l) => /session\.startRunning\(\)/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    expect(calls.length).toBeGreaterThan(0);
  });

  it("consults zone ownership before every one of them", () => {
    const unguarded: string[] = [];
    lines.forEach((line, i) => {
      if (!/session\.startRunning\(\)/.test(line)) return;
      if (/^\s*(\/\/|\*)/.test(line)) return; // prose about the call, not the call
      const fn = enclosingFunc(i);
      if (!fn) {
        unguarded.push(`line ${i + 1}: no enclosing func`);
        return;
      }
      const body = lines.slice(fn.at, i).join("\n");
      if (!body.includes("zoneOwnsCamera")) unguarded.push(`${fn.name}() at line ${i + 1}`);
    });
    // Named, not counted: a count tells a maintainer there is a problem and not where.
    expect(unguarded).toEqual([]);
  });
});

/**
 * ⚑ **The overlay follows the mode, never the presence of anchors.**
 *
 * Positioning runs `sceneReconstruction = .mesh` continuously — mesh helps tracking — so **mesh
 * anchors exist in every mode.** An overlay drawn whenever anchors are present is therefore drawn
 * always, which the field read exactly as it looks: *"went back to photograph this room and it was
 * still showing the mesh overlay."*
 */
describe("the mesh overlay", () => {
  const zone = readFileSync(
    resolve(__dirname, "../../native/hs-native/ios/Sources/HsNative/HSZoneSession.swift"),
    "utf8",
  );

  it("is gated on the mode at the one place that knows the mode", () => {
    // The anchors handed to the preview are chosen by mode, so the renderer cannot get it wrong.
    expect(zone).toMatch(/mode == \.mesh \?[\s\S]{0,120}ARMeshAnchor[\s\S]{0,40}: \[\]/);
  });

  it("hands the preview pixels rather than an ARFrame", () => {
    /* ⛑ Holding an ARFrame past the delegate callback starves ARKit's frame pool and the viewfinder
       freezes while the rest of the app runs on — the 2026-09-05 field signature exactly. */
    expect(zone).toMatch(/onPreviewFrame: \(\(CVPixelBuffer, \[ARMeshAnchor\], ARCamera\) -> Void\)\?/);
  });
});
