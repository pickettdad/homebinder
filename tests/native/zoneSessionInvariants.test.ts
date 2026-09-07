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

/**
 * ⛑ **Which world origin a measurement belongs to — the fact that decides whether the desk may
 * combine a floorplan with a photograph.**
 *
 * ⚑ *Owner, 2026-09-05:* **"floorplan positioning is needed to line up with captures, because the
 * desk uses both to place object containers in the room."** They do line up: `run(config,
 * options: [])` keeps the origin, so re-entering positioning after RoomPlan re-establishes tracking
 * and never the frame. **`.resetTracking` does change the frame**, and it fires on a session that
 * genuinely died — *silently, because the poses still look like poses and are simply measured from
 * somewhere else.*
 *
 * The invariant is **not** that resets never happen. It is that **a reset is distinguishable from a
 * re-init at the desk**, on the plan, the mesh and every pose alike.
 */
describe("which origin a measurement belongs to", () => {
  it("advances the epoch only on a reset, never on a plain re-init", () => {
    // ⚑ The whole distinction. Tying it to `reinitCount` would make every mode change look like a
    // new coordinate frame and the desk would refuse work that is perfectly comparable.
    /* ⛑ Restated 2026-09-06: this matched the one-LINE form and failed when the block grew to mint
       an origin id beside the increment. ⚑ *A test that pins a formatting is a test that fires on
       the fix.* The rule is that the increment happens under `mustReset` and under nothing else. */
    expect(ZONE_SRC).toMatch(/if mustReset \{[\s\S]{0,240}?originEpoch \+= 1/);
    // The only increment in the file is that one — an unconditional one would advance on a re-init.
    expect((ZONE_SRC.match(/originEpoch \+= 1/g) ?? []).length).toBe(1);
    expect(ZONE_SRC).not.toMatch(/reinitCount \+= 1\s*\n\s*originEpoch \+= 1/);
  });

  it("stamps it on the pose, the floorplan and the mesh alike", () => {
    /* ⛑ All three or none: an epoch on the poses with none on the plan tells the desk which
       photographs agree with each other and nothing about whether they agree with the room. */
    const stamps = ZONE_SRC.match(/"originEpoch": (?:self\.)?originEpoch/g) ?? [];
    expect(stamps.length).toBeGreaterThanOrEqual(4); // capture, position, plan, mesh (empty + full)
  });
});

/**
 * ⛑ **A scan that is still finalising owns the session, and everything else must say so.**
 *
 * The 2026-09-05 walk pressed Finish on the floorplan and opened mesh fourteen seconds later while
 * delivery was still pending. Three separate things then went wrong, and each is asserted here
 * because each failed silently:
 *
 * 1. `enter(.mesh)` re-ran the `ARSession` under RoomPlan and **the plan was never delivered** —
 *    four walls, three doors and one window, scanned and gone with nothing recording the loss.
 * 2. The 30-second backstop fired **into a session that had moved on**, running `enter(.positioning)`
 *    and taking the concierge out of mesh mid-scan.
 * 3. Finish on the mesh then found `mode` already `.positioning`, so the walked mesh was discarded.
 *
 * ⚑ The invariant is that **a pending delivery is either honoured or recorded — never dropped**, and
 * that a backstop **reports** rather than steers.
 */
describe("a floorplan that is still finalising", () => {
  it("records the loss, from every path that could cause it", () => {
    /* ⛑ **Asserted as one rule with all its callers, not as a code shape.** The first cut of this
       test matched the inline block in `setMode` — so when a *second* caller was found (starting a
       new floorplan over a pending one) and the rule was moved into a function, the test failed on
       the fix. ⚑ *A test that pins an implementation argues against improving it.*

       The rule: **a pending delivery is honoured or recorded, never dropped** — and it lives in one
       function so a third caller cannot miss it. */
    expect(ZONE_SRC).toMatch(/private func supersedeRoomPlan\(because why: String\)/);
    expect(ZONE_SRC).toMatch(/roomSuperseded/);
    const callers = ZONE_SRC.match(/supersedeRoomPlan\(because:/g) ?? [];
    // Both known entry points: another mode opening, and another floorplan starting.
    expect(callers.length).toBeGreaterThanOrEqual(2);
  });

  it("lets the backstop report but never steer a session that moved on", () => {
    /* ⛑ The waiter restores positioning because it normally runs while RoomPlan is still the mode.
       Thirty seconds later that assumption is exactly what took a concierge out of mesh. */
    expect(ZONE_SRC).toMatch(/if self\.mode == \.roomplan \{[\s\S]{0,200}?roomTimedOutElsewhere/);
  });

  it("records both ends of the build, because the gap between them lost a plan", () => {
    // A delegate that never fires and a builder that never returns are indistinguishable without these.
    for (const marker of ["roomDidEnd", "roomBuilding", "roomBuilt"]) {
      expect(ZONE_SRC).toContain(marker);
    }
  });
});

/**
 * ⛑ **Keeping a view must re-assert every condition that makes it visible.**
 *
 * The placement check fixed the first black mesh screen and caused the second: it returned early on
 * *is it in the right place*, skipping the transparency block below it — and the capture path makes
 * the host opaque again when it tears its own preview down. ⚑ **A fast path that re-checks one
 * precondition and inherits the rest is wrong the moment a different one moves.**
 */
describe("keeping an existing preview", () => {
  const PLUGIN_SRC = readFileSync(PLUGIN, "utf8");

  it("asserts transparency on the keep path, not only on the build path", () => {
    const keep = /if placed && ordered \{[\s\S]*?arPreviewKept[\s\S]*?\]\)/.exec(PLUGIN_SRC)?.[0] ?? "";
    expect(keep).not.toBe("");
    expect(keep).toMatch(/if web\.isOpaque \{/);
  });

  it("logs what governs visibility rather than what was checked", () => {
    /* ⚑ The old line recorded the index alone, so a black screen and a working one printed the
       same row — an instrument that agrees with the bug. */
    const keep = /arPreviewKept", \[[\s\S]*?\]\)/.exec(PLUGIN_SRC)?.[0] ?? "";
    expect(keep).toMatch(/webOpaque/);
  });
});

/**
 * ⛑ **The function that takes the lens is the function that hands the screen over.**
 *
 * ⚑ *Audit 2026-09-06, confirmed high by three independent lenses.* `enter()` calls `needCamera?()`
 * unconditionally — which stops the capture session — while `showArPreview` lived in **five
 * callers**. `wake()`, the path an ordinary photograph takes through `position()`, was caller six.
 *
 * So the plain capture door took the camera away from AVFoundation on the first shutter press and
 * **never put anything in its place**: the viewfinder froze on one frame for the rest of the zone
 * while the shutter, containers, filmstrip and delete all kept working. *It used to be survivable
 * because `sleepSession()` handed the lens back within seconds — that function has since been
 * deleted for want of a caller.*
 *
 * The invariant is **where the rule lives**, not how many callers exist today.
 */
describe("taking the lens and handing over the screen", () => {
  it("shows the preview from enter(), the one place that always takes the camera", () => {
    const enterFn = /private func enter\(_ next: Mode[\s\S]*?\n    \}/.exec(ZONE_SRC)?.[0] ?? "";
    expect(enterFn).not.toBe("");
    expect(enterFn).toMatch(/needCamera\?\(\)/);
    // Both exits: the unchanged fast path and the full run. A fast path that skips the handover is
    // the arPreviewKept bug again.
    expect((enterFn.match(/showArPreview\?\(session\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("hides it wherever the lens goes back, pause included", () => {
    /* ⛑ pause() restarts the capture session and re-attaches ITS preview — underneath ARKit's,
       still showing the last frame before the pause. A frozen picture over a live one reads as a
       working viewfinder aimed at the wrong thing, which is worse than black. */
    const pauseFn = /func pause\(\) -> \[String: Any\] \{[\s\S]*?\n    \}/.exec(ZONE_SRC)?.[0] ?? "";
    expect(pauseFn).not.toBe("");
    expect(pauseFn).toMatch(/hideArPreview\?\(\)/);
    expect(pauseFn).toMatch(/releaseCamera\?\(\)/);
  });
});

/**
 * ⛑ **Camera ownership is released by whoever takes the session away.**
 *
 * `openZone` replaced `self.zone` and let the outgoing session go. ⚑ *`zoneOwnsCamera` is cleared by
 * exactly one thing — the outgoing session's `releaseCamera`, fired from its `closeZone`* — so
 * walking from one room to the next stranded the flag at **true for the rest of the app's life**,
 * and every later room took the deferred branch with a camera nobody could reclaim.
 */
describe("replacing a zone", () => {
  it("closes the outgoing session rather than dropping it", () => {
    const PLUGIN_SRC = readFileSync(PLUGIN, "utf8");
    const openFn = /func openZone\(_ call: CAPPluginCall\)[\s\S]*?\n    \}\n/.exec(PLUGIN_SRC)?.[0] ?? "";
    expect(openFn).not.toBe("");
    expect(openFn).toMatch(/outgoing\.closeZone\(\)/);
  });
});

/**
 * ⛑ **A surface the field reports is one it MEASURED, and the record says by what.**
 *
 * ⚑ *Field 2026-09-06, zone "Bedroom 4".* Two photographs of one table lamp, two minutes apart in
 * one unbroken session, moved the surface point **0.905 m across a 0.771 m walk** — per-axis ratios
 * 1.53 / 1.04 / 1.30, all near 1 and none near 0. A point on the object barely moves when the
 * observer does. **It was tracking the photographer**, because both capture doors asked for
 * `allowing: .estimatedPlane`, which fits a plane to the feature points around the ray at that
 * instant rather than hitting anything.
 *
 * ⚑ **`ARRaycastTarget` has three cases and all three are planes**, so this cannot be fixed by
 * choosing a different one — which is why the invariant is stated as *the session builds no
 * ray-cast query at all*. That holds however many capture doors are added; a list of today's two
 * would fire on the third and say nothing about it.
 *
 * *Why a source assertion:* the rule lives entirely in Swift and the failure mode is a **new** door
 * measuring its own way. A behavioural test would need the device that already found the bug.
 */
describe("what the surface point is measured against", () => {
  const zoneLines = ZONE_SRC.split("\n");

  it("asks ARKit for no plane ray-cast anywhere in the session", () => {
    expect(ZONE_SRC).not.toMatch(/ARRaycastQuery\(/);
  });

  it("has doors that ask at all — a test that finds nothing passes for the wrong reason", () => {
    // The shutter and `takePosition`. Containment, never equality: a third door is welcome.
    expect((ZONE_SRC.match(/HSSurface\.ahead\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("never writes a surface it did not get from that one answer", () => {
    /* ⚑ The rule is *where the value comes from*, not how many callers there are. A door that
       hand-rolled its own point would be the whole defect returning under a different name. */
    const strays = zoneLines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /\["surface"\]\s*=/.test(line) && !/aim\.payload/.test(line))
      // Named, not counted: a count tells a maintainer there is a problem and not where.
      .map(({ line, i }) => `line ${i + 1}: ${line.trim()}`);
    expect(strays).toEqual([]);
  });

  it("refuses to export anything it did not measure", () => {
    /* ⛑ The desk ranks by `surface.distance`, closest wins, and reads the field without asking
       where it came from — so a labelled guess would keep flowing into placements through every
       consumer that did not check the label. An honest orphan beats false continuity. */
    expect(ZONE_SRC).toMatch(/var payload: \[String: Any\]\? \{\s*\n\s*guard source\.measured/);
  });

  it("says which source answered, in the export and in the log", () => {
    // An estimate and a measurement were byte-identical in the manifest, and the desk holds both.
    expect(ZONE_SRC).toMatch(/"source": source\.rawValue/);
    // ⚑ A word, not a boolean: `surface: true` was how a 96% rate of inventing planes read as
    // validation for four weeks.
    expect(ZONE_SRC).toMatch(/"surface": source\.rawValue/);
  });

  it("reads every buffer's own layout rather than assuming it", () => {
    /* ⛑ `harvestMesh` states this rule for the same buffers — layout is ARKit's to change, and an
       assumption that holds today works until an OS release. A depth map that is not float32, or a
       16-bit index buffer read as 32-bit, fails silently and by metres. */
    const surface = /enum HSSurface \{[\s\S]*$/.exec(ZONE_SRC)?.[0] ?? "";
    expect(surface).not.toBe("");
    expect(surface).toMatch(/verts\.stride/);
    expect(surface).toMatch(/verts\.offset/);
    expect(surface).toMatch(/bytesPerIndex/);
    expect(surface).toMatch(/indexCountPerPrimitive == 3/);
    expect(surface).toMatch(/kCVPixelFormatType_DepthFloat32/);
  });

  it("bounds the mesh work so a dense room cannot stall the shutter", () => {
    // ⚑ A stall guard, and recorded when it fires rather than silently applied — a capped answer
    // that says nothing is an answer nobody can compare with the next room's.
    const surface = /enum HSSurface \{[\s\S]*$/.exec(ZONE_SRC)?.[0] ?? "";
    expect(surface).toMatch(/triangleBudget/);
    expect(surface).toMatch(/budgetHit = true/);
  });
});

/**
 * ⛑ **Two origins must never wear the same name.**
 *
 * ⚑ *Found by the owner's question, 2026-09-06: "I have used the same zone for 2 tests about 25
 * minutes apart — has any of the positioning changed during those down times and app rebuilds?"*
 * It had, completely. The export shows both runs in one zone reporting `originEpoch: 1`, each with
 * `reinits: 1`, `sinceInitSec: 1.4` and a pose within a millimetre of `(0,0,0)` — **two fresh
 * origins, indistinguishable in the record.**
 *
 * `originEpoch` is a per-process counter, so the first origin of every launch is `1`. And equal
 * epochs are precisely what the desk is told means *comparable*. ⚠️ **That is the false-continuity
 * failure the field was built to prevent, committed by the instrument itself.**
 *
 * The invariant is **not** that the id is a uuid — that is an implementation. It is that **the name
 * is minted where the origin is**, so it cannot be a counter that restarts.
 */
describe("naming an origin", () => {
  it("mints a new name wherever it resets the frame, in the same statement", () => {
    // ⚑ Beside the epoch increment, under the one condition that creates a new frame. A name minted
    // anywhere else could name a frame that already existed.
    expect(ZONE_SRC).toMatch(/if mustReset \{[\s\S]{0,200}?originEpoch \+= 1[\s\S]{0,200}?originId = UUID\(\)/);
  });

  it("carries it on the pose, the plan and the mesh, wherever the epoch goes", () => {
    /* ⛑ All or none: an id on the poses with none on the plan tells the desk which photographs
       agree with each other and nothing about whether they agree with the room. */
    const epochs = (ZONE_SRC.match(/"originEpoch":/g) ?? []).length;
    const ids = (ZONE_SRC.match(/"originId":/g) ?? []).length;
    expect(ids).toBeGreaterThanOrEqual(epochs - 1); // the log row is the one that may differ
    expect(ids).toBeGreaterThanOrEqual(3);
  });

  it("does not restore a saved world map, so a launch genuinely is a new frame", () => {
    /* ⚠️ `saveWorldMap` writes on pause and **nothing sets `initialWorldMap`** — the map is saved and
       never restored. That is why a new launch is a new origin, and it is recorded here rather than
       rediscovered: if a future change starts restoring maps, this test fails and the name becomes a
       question worth re-asking rather than an assumption. */
    expect(ZONE_SRC).toMatch(/getCurrentWorldMap/);
    expect(ZONE_SRC).not.toMatch(/initialWorldMap/);
  });
});
