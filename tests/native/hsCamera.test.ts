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
  frameStateOf,
  glareSuspected,
  shouldOfferRetake,
  traverseVerdict,
  type TraversePair,
} from "../../src/native/hsCamera";

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
