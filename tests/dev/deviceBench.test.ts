/**
 * The bench's refusals, which are the reason to trust anything it reports.
 *
 * ⚑ What is asserted here is the INVARIANT — *a run with no evidence in it cannot return a verdict
 * about a mode* — not the inventory of today's verdict words. A test that enumerates the words fires
 * on every legitimate addition; a test that states the rule holds at five verdicts and at fifty.
 */
import { describe, expect, it } from "vitest";
import {
  BENCH_ORDER,
  batterySlope,
  benchStalled,
  benchVerdict,
  samplerLying,
  type BenchSample,
} from "../../src/dev/deviceBench";

const sample = (over: Partial<BenchSample> & { t: number }): BenchSample => ({
  battery: 0.9,
  batteryState: "unplugged",
  thermal: "nominal",
  frames: Math.round(over.t * 60),
  meshAnchors: 0,
  meshFaces: 0,
  cooling: false,
  ...over,
});

const run = (
  samples: BenchSample[],
  over: Partial<{
    endedBecause: "thermal" | "cap" | "stopped" | "running";
    secondsToFirstTransition: number;
  }> = {},
) => ({
  samples,
  endedBecause: "cap" as "thermal" | "cap" | "stopped" | "running",
  secondsToFirstTransition: -1,
  ...over,
});

describe("benchStalled", () => {
  it("catches a session that stopped producing frames while still under load", () => {
    const s = [sample({ t: 0, frames: 0 }), sample({ t: 30, frames: 1800 }), sample({ t: 60, frames: 1800 })];
    expect(benchStalled(s)).toBe(true);
  });

  it("does not call a healthy run stalled", () => {
    expect(benchStalled([sample({ t: 0 }), sample({ t: 30 }), sample({ t: 60 })])).toBe(false);
  });

  it("ignores the cool-down, where the counter is SUPPOSED to freeze", () => {
    // ⚑ The load is deliberately stopped here. Treating this as a stall would reject every run
    // that completed, which is the opposite of what the check is for.
    const s = [
      sample({ t: 0, frames: 0 }),
      sample({ t: 30, frames: 1800 }),
      sample({ t: 60, frames: 1800, cooling: true }),
      sample({ t: 90, frames: 1800, cooling: true }),
    ];
    expect(benchStalled(s)).toBe(false);
  });
});

describe("samplerLying", () => {
  it("catches drain reported while the device says it is charging", () => {
    const s = [
      sample({ t: 0, battery: 0.8, batteryState: "charging" }),
      sample({ t: 60, battery: 0.7, batteryState: "charging" }),
    ];
    expect(samplerLying(s)).toBe(true);
  });

  it("passes a charging run whose level holds or rises", () => {
    const s = [
      sample({ t: 0, battery: 0.8, batteryState: "charging" }),
      sample({ t: 60, battery: 0.82, batteryState: "charging" }),
    ];
    expect(samplerLying(s)).toBe(false);
  });

  it("says nothing about a run that was never on charge — absent is not the same as passing", () => {
    expect(samplerLying([sample({ t: 0, battery: 0.8 }), sample({ t: 60, battery: 0.7 })])).toBe(false);
  });
});

describe("batterySlope", () => {
  it("cannot hand back a rate without the resolution behind it", () => {
    const s = [
      sample({ t: 0, battery: 0.9 }),
      sample({ t: 1800, battery: 0.89 }),
      sample({ t: 3600, battery: 0.85 }),
    ];
    const out = batterySlope(s);
    // The invariant: every field a caller could quote arrives together with its sample count.
    expect(out.percentPerHour).not.toBeNull();
    expect(out.steps).toBeGreaterThan(0);
    expect(out.spanSeconds).toBe(3600);
  });

  it("counts steps the level actually moved, not samples taken", () => {
    // Thirty samples, one movement. A rate quoted off this has the resolution of ONE step.
    const s = Array.from({ length: 30 }, (_, i) => sample({ t: i * 60, battery: i < 29 ? 0.9 : 0.89 }));
    expect(batterySlope(s).steps).toBe(1);
  });

  it("returns null rather than a number when there is nothing to slope", () => {
    expect(batterySlope([sample({ t: 0 })]).percentPerHour).toBeNull();
  });
});

describe("benchVerdict", () => {
  const healthy = [sample({ t: 0 }), sample({ t: 30 }), sample({ t: 60 })];

  it("refuses before it reports: every run with no evidence in it is rejected, whatever ended it", () => {
    /* ⚑ THE invariant of this file. A stalled session, a lying sampler and a run with nothing in it
       must never be reported as a mode that stayed cool — regardless of what `endedBecause` says,
       because `endedBecause` is exactly what a broken run still fills in confidently. */
    const stalled = [sample({ t: 0, frames: 0 }), sample({ t: 30, frames: 0 }), sample({ t: 60, frames: 0 })];
    const lying = [
      sample({ t: 0, battery: 0.8, batteryState: "charging" }),
      sample({ t: 30, battery: 0.7, batteryState: "charging" }),
    ];
    for (const ended of ["thermal", "cap", "stopped", "running"] as const) {
      expect(benchVerdict(run(stalled, { endedBecause: ended }))).not.toBe("held");
      expect(benchVerdict(run(lying, { endedBecause: ended }))).not.toBe("held");
      expect(benchVerdict(run([], { endedBecause: ended }))).not.toBe("held");
    }
  });

  it("only says held when the run reached its cap with work in it", () => {
    expect(benchVerdict(run(healthy, { endedBecause: "cap" }))).toBe("held");
  });

  it("reports a transition only when one was actually timed", () => {
    expect(benchVerdict(run(healthy, { endedBecause: "thermal", secondsToFirstTransition: 720 }))).toBe(
      "transitioned",
    );
    // Ended by hand: not a claim about any duration, so it must not read as one.
    expect(benchVerdict(run(healthy, { endedBecause: "stopped" }))).toBe("cut-short");
  });
});

describe("BENCH_ORDER", () => {
  it("puts the control first, because a broken harness must cost twenty minutes not three hours", () => {
    expect(BENCH_ORDER[0]?.mode).toBe("control");
  });

  it("offers no mode that is not built — RoomPlan is absent rather than silently something else", () => {
    expect(BENCH_ORDER.map((m) => String(m.mode))).not.toContain("roomPlan");
  });
});
