/**
 * The two camera rules that must not live inside a component.
 *
 * Both are doctrine with a known failure mode, and doctrine inside a component cannot be scanned
 * or tested — the same reason `globalCameraApplies` and `offersVerdict` are predicates. What is
 * asserted here is the rule, not the palette: nothing below names a colour.
 */
import { describe, expect, it } from "vitest";
import {
  CAMERA_MODES,
  cameraAvailable,
  frameLabel,
  framesNeedingEyes,
  framesTurnedFromStamp,
  frameStateOf,
  glareSuspected,
  lensPolicyFor,
  shouldOfferRetake,
  captureWantsRetake,
  positionForSibling,
  projectionFor,
  storedFrameLabel,
  traverseDiagnosis,
  traverseVerdict,
  type TraverseFrame,
  type TraversePair,
} from "../../src/native/hsCamera";
import type { CameraLens } from "../../src/native/hsCamera";

const running = (mode: (typeof CAMERA_MODES)[number], unmet: string[] = []) => ({
  mode,
  unmet,
  sessionRunning: true,
});

describe("the viewfinder frame state", () => {
  it("is off when there is no session, and says so rather than guessing a mode", () => {
    expect(frameStateOf(null)).toBe("off");
    expect(frameStateOf({ mode: "text", unmet: [], sessionRunning: false })).toBe("off");
  });

  it("follows the ACHIEVED mode for every mode the camera declares", () => {
    // Every mode, not a sample: a mode added later with no frame state would be invisible in the
    // one place the concierge looks to know which camera they are holding.
    for (const mode of CAMERA_MODES) {
      expect(frameStateOf(running(mode))).toBe(mode);
    }
  });

  it("goes degraded when a goal that changes what the photograph IS could not be reached", () => {
    // ⚑ The failure this exists for: twenty plates shot without close focus or plate metering.
    // Every one of them looks fine, and none of them reads.
    expect(frameStateOf(running("text", ["closeFocus"]))).toBe("degraded");
    expect(frameStateOf(running("text", ["spotMetering"]))).toBe("degraded");
  });

  it("does NOT go degraded for a goal that only costs convenience", () => {
    // A missing level bubble is an inconvenience; a frame that cried wolf about it would be a
    // frame nobody reads on the plate that mattered.
    expect(frameStateOf(running("text", ["level"]))).toBe("text");
    expect(frameStateOf(running("text", ["bracketing"]))).toBe("text");
  });
});

describe("the retake trigger", () => {
  it("stays silent when nothing was read", () => {
    // ⚑ Most captures legitimately contain no text — a pipe, a floor stain, a wide shot. A trigger
    // that fires here nags on the majority case and is ignored by the time a plate needs it.
    expect(shouldOfferRetake({ characterCount: 0, marginal: false })).toBe(false);
    expect(shouldOfferRetake({ characterCount: 0, marginal: true })).toBe(false);
  });

  it("fires when characters were detected and read badly", () => {
    expect(shouldOfferRetake({ characterCount: 14, marginal: true })).toBe(true);
  });

  it("stays silent on a confident read", () => {
    expect(shouldOfferRetake({ characterCount: 14, marginal: false })).toBe(false);
  });

  /**
   * ⚑ The rule asked of a photograph rather than of the live loop — the form that has a reader.
   * It reads the PRIMARY frame, because that is the one that counts and the only one any count
   * sees; a bracket exposure reading badly is what a bracket is for.
   */
  describe("asked of a capture", () => {
    const frame = (ocr?: { characterCount: number; marginal: boolean }) => ({
      path: "/tmp/f.jpg",
      bytes: 1,
      index: 0,
      exifOrientation: 1,
      torch: false,
      ocr: ocr
        ? { lines: [], text: "x", meanConfidence: 0.4, engine: "e", osVersion: "26", ...ocr }
        : undefined,
    });

    it("says nothing about a capture that read nothing, which is most captures", () => {
      expect(captureWantsRetake({ frames: [frame()] })).toBe(false);
    });

    it("offers a retake when the primary frame held characters and read them badly", () => {
      expect(captureWantsRetake({ frames: [frame({ characterCount: 22, marginal: true })] })).toBe(true);
    });

    it("judges the primary, not whichever frame happens to have read worst", () => {
      // A bracket exposure reading badly is the bracket working. The primary is the photograph.
      expect(
        captureWantsRetake({
          frames: [frame({ characterCount: 22, marginal: false }), frame({ characterCount: 4, marginal: true })],
        }),
      ).toBe(false);
    });

    it("does not fire on a capture with no frames at all", () => {
      expect(captureWantsRetake({ frames: [] })).toBe(false);
    });
  });
});

describe("without the native shell", () => {
  it("reports the camera absent rather than throwing", () => {
    expect(cameraAvailable()).toBe(false);
  });
});

describe("what a traverse amounts to", () => {
  const pair = (contiguity: TraversePair["contiguity"], from = 0): TraversePair => ({
    from,
    to: from + 1,
    measured: contiguity !== "unverified",
    contiguity,
  });

  it("says nothing about a traverse with no adjacent pairs to judge", () => {
    expect(traverseVerdict({ pairs: [] })).toBe("empty");
  });

  it("⚑ never reports a gap when the mechanism merely could not measure", () => {
    // The walked-corner case. Saying "gap" here sends somebody back to a room already covered,
    // which the owner ruled worse than saying nothing (2026-08-16).
    expect(traverseVerdict({ pairs: [pair("unverified"), pair("unverified", 1)] })).toBe("unverified");
    expect(traverseVerdict({ pairs: [pair("contiguous"), pair("unverified", 1)] })).toBe("unverified");
  });

  it("reports a gap whenever one adjacent pair genuinely lost contact", () => {
    expect(traverseVerdict({ pairs: [pair("contiguous"), pair("gap", 1)] })).toBe("gaps");
  });

  it("does not let an unverified pair hide a real gap elsewhere in the run", () => {
    expect(traverseVerdict({ pairs: [pair("unverified"), pair("gap", 1)] })).toBe("gaps");
  });

  it("confirms contiguity only when every pair was measured and held", () => {
    expect(traverseVerdict({ pairs: [pair("contiguous"), pair("contiguous", 1)] })).toBe("contiguous");
  });

  it("⚑ will not headline a gap on a run it mostly could not describe", () => {
    /*
     The 2026-08-16 L-walk, to shape: 15 pairs, 1 gap, 13 unverified, 1 contiguous — reported to
     the concierge as the single word `gaps`. A confident claim about a run where the mechanism
     could not describe thirteen of the fifteen pairs it was asked about, landing on the false
     alarm the owner ruled worse than no flag at all.

     The invariant is about proportion, not about these counts: a gap is headlined only when the
     mechanism described most of the run. Stated this way it holds at fifteen pairs and at fifty.
    */
    const lWalk = [
      ...Array.from({ length: 13 }, (_, i) => pair("unverified", i)),
      pair("gap", 13),
      pair("contiguous", 14),
    ];
    expect(traverseVerdict({ pairs: lWalk })).toBe("unverified");
  });

  it("still headlines the gap once most of the run was actually measured", () => {
    // The other side of the same rule — the unverified pairs must not become a way to hide a real
    // gap in a run the mechanism otherwise handled fine.
    const measured = [
      ...Array.from({ length: 8 }, (_, i) => pair("contiguous", i)),
      pair("gap", 8),
      pair("unverified", 9),
    ];
    expect(traverseVerdict({ pairs: measured })).toBe("gaps");
  });
});

describe("what a traverse's own numbers say about why it could not describe itself", () => {
  const measured = (disparityX: number, disparityY: number, from = 0): TraversePair => ({
    from,
    to: from + 1,
    measured: true,
    disparity: Math.hypot(disparityX, disparityY),
    disparityX,
    disparityY,
    contiguity: "unverified",
    reason: "disparity",
  });

  it("⚑ names no cause when neither axis dominates", () => {
    /*
     The gate, and it is the whole point. Two runs on 2026-08-16 came back 87% and 86% unverified
     at two different frame spacings, which refutes the reason the spacing was halved and leaves
     several candidates. An attribution printed on ambiguous data is this project's named alarm
     failure — *a diagnostic decides whether there is anything to say before it says what* —
     landing on the one question where a confident wrong answer costs another wasted round.
    */
    expect(traverseDiagnosis({ pairs: [measured(0.05, 0.05), measured(0.06, 0.05, 1)] }).dominant).toBeNull();
    // Just short of the ratio is still "no": the threshold is a claim about separation, not a
    // formality to be rounded through.
    expect(traverseDiagnosis({ pairs: [measured(0.02, 0.039)] }).dominant).toBeNull();
  });

  it("names the axis only once it genuinely dominates", () => {
    expect(traverseDiagnosis({ pairs: [measured(0.01, 0.09)] }).dominant).toBe("vertical");
    expect(traverseDiagnosis({ pairs: [measured(0.09, 0.01)] }).dominant).toBe("horizontal");
  });

  it("keeps the numbers even when it has nothing to conclude from them", () => {
    // ⚑ Gate the prose on a verdict and keep the diagnostic computed, so a later run under
    // different conditions stays comparable. Losing the medians because no cause was named would
    // throw away the evidence that decides the next round.
    const diagnosis = traverseDiagnosis({ pairs: [measured(0.05, 0.05), measured(0.07, 0.05, 1)] });
    expect(diagnosis.dominant).toBeNull();
    expect(diagnosis.medianDisparityX).toBeCloseTo(0.06);
    expect(diagnosis.medianDisparityY).toBeCloseTo(0.05);
  });

  it("says nothing at all rather than dividing by an empty run", () => {
    const empty = traverseDiagnosis({ pairs: [] });
    expect(empty.medianDisparity).toBeNull();
    expect(empty.dominant).toBeNull();
    expect(empty.measured).toBe(0);
  });

  it("counts every kind of cannot-say apart from every other", () => {
    /*
     ⚑ Asserted as the RULE, not as a list of the kinds that happen to exist today.

     The first cut compared the whole `reasons` object with `toEqual` against three names — an
     inventory — and adding two legitimate kinds broke it, which is the exact failure the standing
     rule names: *a test that enumerates what currently exists fires on every legitimate addition.*
     Written here as "each pair is counted under its own reason and under no other", which held at
     three kinds and holds at five.
    */
    const kinds = ["unregistered", "impossiblyStill", "implausibleShift", "crossCheck"] as const;
    const pairs: TraversePair[] = kinds.map((reason, i) => ({
      from: i,
      to: i + 1,
      measured: false,
      contiguity: "unverified" as const,
      reason,
    }));
    const { reasons } = traverseDiagnosis({ pairs });

    for (const kind of kinds) expect(reasons[kind]).toBe(1);
    // And nothing is double-counted: the tally accounts for every pair exactly once.
    expect(Object.values(reasons).reduce((a, b) => a + b, 0)).toBe(pairs.length);
  });
});

describe("what a stored frame is called", () => {
  const f = (frame?: { role: "primary" | "evidence" | "insurance"; torch?: boolean; ev?: number }) => ({ frame });

  it("names a bracket by its exposure and a pair by its torch", () => {
    expect(storedFrameLabel(f({ role: "insurance", ev: -1 }))).toBe("−1 EV");
    expect(storedFrameLabel(f({ role: "insurance", ev: 1 }))).toBe("+1 EV");
    expect(storedFrameLabel(f({ role: "evidence", torch: false }))).toBe("no torch");
  });

  it("⚑ names a traverse frame by its POSITION, which is the one place the ordinal is the answer", () => {
    /*
     `frameLabel` rejects the ordinal — "frame 2" answers a question nobody has about a bracket,
     whose frames differ by exposure. A traverse is the opposite: its frames differ by where along
     the walk they were taken, which the ordinal *is*.

     And the panel names pairs by index — *look at frames 3, 4* — so without this every button on a
     nineteen-frame walk read "frame" and the instruction could not be followed. That is what the
     owner hit.
    */
    expect(storedFrameLabel(f({ role: "evidence" }), 2)).toBe("3");
    expect(storedFrameLabel(f({ role: "primary" }), 0)).toBe("1");
  });

  it("⚑ never gives two frames of one capture the same label", () => {
    // The invariant, not the strings: a label that repeats cannot be followed, whatever it says.
    const walk = Array.from({ length: 19 }, () => f({ role: "evidence" as const }));
    const labels = walk.map((frame, i) => storedFrameLabel(frame, i));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("which frames a person has to look at", () => {
  const pair = (from: number, reason?: TraversePair["reason"]): TraversePair => ({
    from,
    to: from + 1,
    measured: reason === undefined,
    contiguity: reason === undefined ? "contiguous" : "unverified",
    reason,
  });

  it("⚑ names both frames of a pair whose MEASUREMENT is in doubt", () => {
    /*
     `implausibleShift` says the reading is wrong, not that coverage was lost — and those pairs
     report overlaps of 0.083–0.115, so if the reading is wrong the true overlap is simply unknown.
     That is a question a concierge settles in five seconds by looking at two photographs, and
     arithmetic cannot settle it at all.
    */
    expect(framesNeedingEyes({ pairs: [pair(0), pair(1, "implausibleShift"), pair(2)] })).toEqual([1, 2]);
  });

  it("stays quiet about the failures a person cannot help with", () => {
    // A crossCheck disagreement is a smaller claim, and a genuine gap already reports itself as
    // one. Sending someone to look at every imperfect pair is the alarm-on-the-majority-case
    // failure wearing a helpful face.
    const pairs = [pair(0, "crossCheck"), pair(1, "impossiblyStill"), pair(2, "unregistered"), pair(3)];
    expect(framesNeedingEyes({ pairs })).toEqual([]);
  });

  it("names each frame once however many pairs implicate it", () => {
    // Adjacent rejects share a frame; asking twice for the same photograph is noise.
    const pairs = [pair(4, "implausibleShift"), pair(5, "implausibleShift")];
    expect(framesNeedingEyes({ pairs })).toEqual([4, 5, 6]);
  });
});

describe("which lens a door opens on", () => {
  /*
   ⚑ The owner's ruling, 2026-08-16, which overturned the design session's position that the app
   should choose: **the concierge chooses, the mode sets the default.** The lens is a substitute for
   stepping backwards, and in a tight mechanical room you often cannot step backwards.

   Asserted as the two rules — refusal, and default-by-door — rather than as a table of every
   mode/intent pair, so a mode or a door added later is covered by the rule it falls under.
  */
  it("⚑ never goes wide where characters are the point, whatever door was used", () => {
    // Edge distortion on a plate buys nothing and costs reads. The refusal outranks any intent,
    // because a plate is a plate however it was reached.
    for (const intent of [undefined, "room-shot", "run-trace", "traverse"] as const) {
      expect(lensPolicyFor("text", intent)).toEqual({ default: "normal", locked: true });
      expect(lensPolicyFor("document", intent)).toEqual({ default: "normal", locked: true });
    }
  });

  it("defaults wide for the doors whose job is fitting the whole of something in", () => {
    expect(lensPolicyFor("object", "room-shot").default).toBe("wide");
    expect(lensPolicyFor("object", "traverse").default).toBe("wide");
  });

  it("leaves the choice open wherever it is the concierge's to make", () => {
    // The locked flag is the whole of the ruling's second half: outside Text, nothing may take the
    // decision away from the person standing in the room.
    for (const mode of CAMERA_MODES.filter((m) => m !== "text" && m !== "document")) {
      expect(lensPolicyFor(mode).locked).toBe(false);
      expect(lensPolicyFor(mode, "room-shot").locked).toBe(false);
    }
  });

  it("does not assume a door into the ruling that the ruling did not name", () => {
    // Run trace follows a pipe rather than framing a room, and the owner did not name it. Guessing
    // it into "wide" would be the app choosing, which is the thing that was overturned.
    expect(lensPolicyFor("object", "run-trace").default).toBe("normal");
  });
});

describe("what a frame is called", () => {
  const frame = (index: number, torch: boolean) => ({
    path: `/tmp/f${index}.jpg`,
    bytes: 1,
    index,
    exifOrientation: 6,
    torch,
  });

  /**
   * ⚑ The invariant, and it is deliberately not a list of expected strings: **no two frames of one
   * capture may carry the same label.** A label is what a frame leaves the device under, so a
   * collision is lost evidence — which is not hypothetical, it is what happened to three of the
   * four frames the owner sent on 2026-08-16.
   *
   * Stated this way it holds for any capture shape a future mode invents; an inventory of
   * "torch · −1 EV" strings would pass today and fire on the next legitimate addition.
   */
  const allLabelsDistinct = (shot: Parameters<typeof frameLabel>[0]) => {
    const labels = shot.frames.map((_, i) => frameLabel(shot, i));
    return new Set(labels).size === labels.length;
  };

  it("⚑ gives every frame of a bracketed torch pair a label of its own", () => {
    // The shape that broke: three lit bracket frames, then the unlit companion.
    const shot = {
      frames: [frame(0, true), frame(1, true), frame(2, true), frame(3, false)],
      torchPaired: true,
      bracketed: true,
    };
    expect(allLabelsDistinct(shot)).toBe(true);
    // And the companion is still named for the thing that makes it worth keeping.
    expect(frameLabel(shot, 3)).toBe("no torch");
  });

  it("keeps labels distinct for a bare pair and a bare bracket alike", () => {
    expect(
      allLabelsDistinct({
        frames: [frame(0, true), frame(1, false)],
        torchPaired: true,
        bracketed: false,
      }),
    ).toBe(true);
    expect(
      allLabelsDistinct({
        frames: [frame(0, false), frame(1, false), frame(2, false)],
        torchPaired: false,
        bracketed: true,
      }),
    ).toBe(true);
  });

  it("names a frame by what it is rather than by where it sits", () => {
    // The ordinal was rejected on purpose: "frame 2" answers a question nobody has. It survives
    // only as the fallback for a capture with nothing else to say about its frames.
    const plain = { frames: [frame(0, false)], torchPaired: false, bracketed: false };
    expect(frameLabel(plain, 0)).toBe("frame 1");
  });
});

describe("the torch pair", () => {
  it("stays silent when no pair was taken — there is nothing to compare", () => {
    expect(glareSuspected({ torchPaired: false })).toBe(false);
    expect(glareSuspected({ torchPaired: false, torchPairAgreement: 0.1 })).toBe(false);
  });

  it("stays silent when a pair was taken but neither frame produced text", () => {
    // A pipe, a stain, a wide shot with the torch on. Nothing was read, so nothing disagrees.
    expect(glareSuspected({ torchPaired: true })).toBe(false);
  });

  it("speaks when the two reads of one plate disagree", () => {
    expect(glareSuspected({ torchPaired: true, torchPairAgreement: 0.62 })).toBe(true);
  });

  it("stays silent when they agree, which is the ordinary case", () => {
    expect(glareSuspected({ torchPaired: true, torchPairAgreement: 0.99 })).toBe(false);
  });
});

describe("framesTurnedFromStamp", () => {
  const frame = (index: number, deviceRotationAngle?: number): TraverseFrame => ({
    path: `/tmp/f${index}.jpg`,
    bytes: 1,
    index,
    // Every frame of a leg carries the SAME stamp — that is the thing under test, not a fixture
    // detail. The connection's rotation is frozen at `startTraverse` and the file inherits it.
    exifOrientation: 6,
    ...(deviceRotationAngle === undefined ? {} : { deviceRotationAngle }),
    at: "2026-08-19T11:49:45Z",
  });

  it("names every frame turned a quarter turn or more from the leg's opening angle, and no other", () => {
    const frames = [frame(0, 90), frame(1, 96), frame(2, 180), frame(3, 90), frame(4, 0)];
    const named = framesTurnedFromStamp({ frames });
    // The invariant, stated rather than the inventory: membership is exactly the quarter-turn rule.
    for (const f of frames) {
      const raw = Math.abs((f.deviceRotationAngle as number) - 90) % 360;
      const turned = Math.min(raw, 360 - raw) >= 90;
      expect(named.includes(f.index)).toBe(turned);
    }
  });

  it("measures the shortest way round the circle, so 350 and 10 are twenty degrees apart", () => {
    expect(framesTurnedFromStamp({ frames: [frame(0, 350), frame(1, 10)] })).toEqual([]);
  });

  it("reports nothing when no frame carries an angle — absent is not the same as agreeing", () => {
    expect(framesTurnedFromStamp({ frames: [frame(0), frame(1), frame(2)] })).toEqual([]);
  });

  it("takes its baseline from the first frame that has one, not from a constant", () => {
    // A leg begun in landscape must not report every one of its own frames as turned.
    expect(framesTurnedFromStamp({ frames: [frame(0, 0), frame(1, 0), frame(2, 0)] })).toEqual([]);
  });
});

/**
 * ⚑ **The wide frame of a sibling pair refuses a position; it does not quietly lack one.**
 *
 * This is the doctrine's own test case. The ultra-wide is not offered to world tracking on this
 * iPad (`HSLensProbe`, 2026-08-24) — a hardware fact **no reader can derive from an absence** — and
 * a room shot files to the zone, where an absent position already means *nobody knows*. Without the
 * refusal the record would say *nobody knows* about the one frame whose reason is known exactly.
 *
 * ⛑ And only that frame gets it: stamping a refusal on every bracket exposure would make
 * `positioned: false` the majority case and drown the refusals worth reading.
 */
describe("the sibling pair's record", () => {
  const frame = (lens: CameraLens) => ({
    path: `/tmp/${lens}.jpg`,
    bytes: 1,
    index: 0,
    exifOrientation: 1,
    torch: false,
    lens,
  });

  it("refuses on the wide frame, with a reason a person can act on", () => {
    const refusal = positionForSibling(frame("wide"), true);
    expect(refusal?.positioned).toBe(false);
    // The reason must name the hardware fact, not merely restate the absence.
    expect(refusal && "why" in refusal ? refusal.why : "").toMatch(/world tracking/);
  });

  it("stays silent on an ordinary sibling, so refusals keep meaning something", () => {
    expect(positionForSibling(frame("normal"), true)).toBeUndefined();
  });

  it("stays silent when no pair was taken, whatever a frame calls its lens", () => {
    // A capture the concierge shot on wide by hand is not a sibling pair, and its frames are
    // ordinary captures that inherit the usual way.
    expect(positionForSibling(frame("wide"), false)).toBeUndefined();
  });
});

/**
 * ⚑ **A pose and a camera model are two facts in one object** (owner ruling 2026-08-28).
 *
 * `x/y/z` is where the concierge stood and survives any lens. `transform` additionally describes
 * ARKit's own 1× camera — the ultra-wide is not offered to world tracking — so a 120° image cannot
 * be projected through it. ⛑ The invariant under test is **not** which lens is which: it is that
 * *every positioned frame answers the question*, and that a frame which cannot be projected
 * **names the frame that can, or says plainly that there is none.**
 */
describe("whether a pose describes the image it is stamped on", () => {
  const f = (lens?: CameraLens) => ({ path: "/tmp/x.jpg", bytes: 1, index: 0, exifOrientation: 1, torch: false, lens });
  const at = "2026-08-28T22:53:00Z";

  it("says yes for an ordinary capture, on the lens ARKit models", () => {
    expect(projectionFor({ frames: [f("normal")], at })).toEqual({ projectable: true });
  });

  it("says no for a wide primary, and names the sibling the matrix does describe", () => {
    const p = projectionFor({ frames: [f("wide"), f("normal")], at });
    expect(p.projectable).toBe(false);
    // The pointer is captureId + lens — both already on every frame, so no join has to be invented.
    expect(p.projectable === false && p.projectableFrame).toEqual({ captureId: at, lens: "normal" });
  });

  it("says no AND null when the pair was refused, because there is nothing to point at", () => {
    // ⛑ A wide room shot whose sibling was refused has a real pose and no projectable frame at
    // all. That is a different sentence from "look next door" and must not read as the same one.
    const p = projectionFor({ frames: [f("wide")], at });
    expect(p.projectable === false && p.projectableFrame).toBeNull();
  });

  it("gives a reason naming the lens, not a symptom", () => {
    const p = projectionFor({ frames: [f("wide"), f("normal")], at });
    expect(p.projectable === false && p.why).toMatch(/wide/);
    expect(p.projectable === false && p.why).toMatch(/transform/);
  });

  it("treats a capture written before the field existed as projectable, not unknown", () => {
    // Every such capture was taken on the lens ARKit models, so yes is the honest answer and
    // `unknown` would be a fabricated doubt about frames nobody can re-examine.
    expect(projectionFor({ frames: [f(undefined)], at })).toEqual({ projectable: true });
  });
});
