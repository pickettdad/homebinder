/**
 * The bridge probe's browser behaviour and its verdict.
 *
 * The verdict matters more than it looks: the acceptance test for the skeleton is read off a
 * screen on an iPad, twice, by eye. `echoIsWellFormed` is what stops "an object came back" from
 * reading as "the bridge crossed" — a stub, a cached response, or a half-registered plugin can
 * all produce an object.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  echoIsWellFormed,
  HS_SHELL_JS_NAME,
  hsShellAvailable,
  onHeartbeat,
  probeBridge,
  type BridgeProbe,
} from "../../src/native/hsShell";

const wellFormed = (): BridgeProbe => ({
  sentAt: 1_700_000_000_000,
  roundTripMs: 7,
  echo: {
    sentAt: 1_700_000_000_000,
    receivedAt: "2026-08-14T20:00:00.000Z",
    device: { model: "iPad", hardware: "iPad13,4", systemVersion: "26.0" },
    plugin: { version: "0.1.0", buildConfiguration: "Debug" },
  },
});

describe("without the native shell", () => {
  it("reports itself unavailable rather than throwing", () => {
    expect(hsShellAvailable()).toBe(false);
  });

  it("rejects the probe with a message that says which of the two cases this is", () => {
    return expect(probeBridge()).rejects.toThrow(/not present/i);
  });

  it("subscribes to nothing and unsubscribes cleanly", () => {
    const off = onHeartbeat(() => {});
    expect(() => {
      off();
      off();
    }).not.toThrow();
  });
});

/**
 * ⚑ The subscribe path, against both shapes a Capacitor bridge can hand back.
 *
 * This is a regression test with a date on it. On the first tethered run (2026-08-14) the raw
 * `window.Capacitor.Plugins` proxy returned the listener handle SYNCHRONOUSLY, while this module
 * had it typed as `Promise<handle>` and called `.catch()` on it — a TypeError that took the whole
 * screen down at the moment of subscribing. It type-checked perfectly, because a hand-written
 * interface for a runtime object is an assertion, not a check. The invariant is that subscribing
 * and unsubscribing work whichever shape arrives.
 */
describe("subscribing, whichever shape the bridge returns", () => {
  const install = (addListener: () => unknown) => {
    (globalThis as { window?: unknown }).window = {
      Capacitor: { Plugins: { [HS_SHELL_JS_NAME]: { addListener } } },
    };
  };

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  /** Removal is normalised through promises either way; drain the microtasks, don't count them. */
  const settle = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };

  it("removes the listener when the handle arrives synchronously", async () => {
    const remove = vi.fn();
    install(() => ({ remove }));
    onHeartbeat(() => {})();
    await settle();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("removes the listener when a promise for the handle arrives", async () => {
    const remove = vi.fn();
    install(() => Promise.resolve({ remove }));
    onHeartbeat(() => {})();
    await settle();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("survives a bridge that throws on subscribe rather than taking the screen down", () => {
    install(() => {
      throw new Error("bridge refused");
    });
    expect(() => onHeartbeat(() => {})).not.toThrow();
  });
});

describe("the verdict", () => {
  it("accepts a complete round trip", () => {
    expect(echoIsWellFormed(wellFormed())).toBe(true);
  });

  it("refuses an argument that came back altered", () => {
    const probe = wellFormed();
    probe.echo.sentAt += 1;
    expect(echoIsWellFormed(probe)).toBe(false);
  });

  it("refuses a build configuration that is neither of the two the proof distinguishes", () => {
    // Not pedantry: Debug-vs-Release IS the discriminator between the tethered run and the
    // TestFlight run. A third word, or an empty one, means the comparison cannot be made.
    const probe = wellFormed();
    probe.echo.plugin.buildConfiguration = "";
    expect(echoIsWellFormed(probe)).toBe(false);
  });

  it("refuses a device the web layer could have invented", () => {
    const probe = wellFormed();
    probe.echo.device.hardware = "";
    expect(echoIsWellFormed(probe)).toBe(false);
  });
});
