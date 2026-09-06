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

const ZONE_SRC = readFileSync(
  resolve(__dirname, "../../native/hs-native/ios/Sources/HsNative/HSZoneSession.swift"),
  "utf8",
);

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
  const zone = ZONE_SRC;

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

/**
 * ⛑ **Leaving a scan mode restores the viewfinder, and the session does it — not the caller.**
 *
 * Field 2026-09-05: *"screen goes black after finish roomplan."* The log is unambiguous —
 * `roomDelivered` → `arPreviewDetached` → forty-five seconds of `tracking` events with nothing ever
 * re-attached. RoomPlan hands the live `ARSession` back, so the session went on tracking perfectly
 * behind a black rectangle, and only backing out of the zone cleared it.
 *
 * ⚑ **The rule existed and lived in the callers, which is why it held in one and not the other.**
 * `finishMesh` called `setZoneModeNative`; `finishScan` called `setZoneMode` — *the React state
 * setter one letter away from it* — so the label changed and the device did not. **A rule kept in
 * two callers holds until somebody writes a third.**
 *
 * The invariant is therefore about *where the rule lives*, not about today's two callers.
 */
describe("handing a scan mode back", () => {
  it("re-enters positioning and re-shows the preview inside the RoomPlan waiter", () => {
    // The waiter is the one place that knows RoomPlan has delivered and the session is live again.
    const waiter = /roomWaiter = \{[\s\S]*?\n        \}/.exec(ZONE_SRC)?.[0] ?? "";
    expect(waiter).not.toBe("");
    expect(waiter).toMatch(/enter\(\.positioning\)/);
    expect(waiter).toMatch(/showArPreview\?\(/);
  });

  it("never leaves the preview hidden with the session still running", () => {
    /* ⚑ `hideArPreview` is legitimate where the session is genuinely going away — pausing, closing,
       a hard failure. It is never legitimate as the last act of a delivery that keeps the session.
       Asserted as *the waiter does not hide*, which holds however the rest of the file changes. */
    const waiter = /roomWaiter = \{[\s\S]*?\n        \}/.exec(ZONE_SRC)?.[0] ?? "";
    expect(waiter).not.toMatch(/hideArPreview\?\(\)/);
  });
});

/**
 * ⛑ **A session run has to earn itself.**
 *
 * Field question 2026-09-05: *"shouldn't reinits be 0?"* ⚑ **The first cannot be — that one is the
 * session starting.** Every one after it is a re-establishment of tracking, and the 2026-08-30 walk
 * reached that line 111 times across five zones with ARKit reporting `limited(initializing)` on 109
 * of them. A re-run that also changes `videoFormat` costs a measured ~15 mm pose jump on top.
 *
 * Mesh and positioning were written as two configurations while the doctrine beside them said they
 * were one — *"the mode is a UI contract about what the person is doing, not a different
 * configuration"* — so every switch between them paid both costs to arrive where it already was.
 *
 * The invariant is **not** the count in any particular walk, which depends on what the concierge
 * did. It is that **a mode change carrying an identical configuration does not re-run the session**.
 */
describe("what a mode change costs", () => {
  it("treats mesh and positioning as one configuration", () => {
    // Written as one case, so they cannot drift apart again in two separate branches.
    expect(ZONE_SRC).toMatch(/case \.mesh, \.positioning:/);
  });

  it("compares the configuration rather than the mode label", () => {
    /* ⚑ The mode is a UI contract; the session only cares what is behind it. Comparing modes would
       re-run whenever the label changed and skip whenever it did not — both wrong. */
    expect(ZONE_SRC).toMatch(/signature == lastConfigSignature/);
  });

  it("still re-runs when the session is paused, has failed, or RoomPlan touched it", () => {
    /* ⛑ Each of these means the live session is not what our signature says it is. Skipping any of
       them reports a running session that is stopped, dead, or configured by somebody else — the
       thing consulted not being the thing that governs, which is this repo's oldest failure. */
    const guard = /if !mustReset, !paused, next != \.roomplan, mode != \.roomplan, signature == lastConfigSignature \{/;
    expect(ZONE_SRC).toMatch(guard);
    // And RoomPlan's own turn clears the signature rather than storing one it is about to invalidate.
    expect(ZONE_SRC).toMatch(/lastConfigSignature = next == \.roomplan \? nil : signature/);
  });
});
