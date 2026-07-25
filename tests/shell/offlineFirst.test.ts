/**
 * Offline-first invariant gate for the native shell.
 *
 * The iPad works in rural dead zones, so the app SHELL must load entirely from the local
 * bundle — never over the network. Capacitor loads from a URL only when `server.url` is set;
 * without it, the shell is served from the bundled `webDir` at `capacitor://localhost`.
 * A stray `server.url` would silently break offline-first (blank app with no signal) and is
 * exactly the failure mode that was (wrongly) suspected behind the launch black screen. This
 * test fails CI if that invariant is ever violated. (The AI assistant still calls the network
 * by design — that is a data call, not the shell load, and is unaffected by this guard.)
 */
import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

describe("native shell — offline-first invariant", () => {
  it("serves the app from the local bundle via webDir", () => {
    expect(config.webDir).toBe("dist");
  });

  it("never loads the shell from a remote URL (no server.url)", () => {
    expect(config.server?.url).toBeUndefined();
  });
});
