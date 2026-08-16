/**
 * The Field 4 bridge probe — one method out, one event stream back.
 *
 * Reached through `window.Capacitor.Plugins` rather than by importing `@capacitor/core`, the
 * same stance as `app/platform.ts` and `native/roomPlan.ts`: the web bundle stays free of the
 * native runtime, and in the browser the plugin is simply absent.
 *
 * `HS_SHELL_JS_NAME` is the contract with `HSShellPlugin.swift`'s `jsName`. Nothing checks that
 * pairing at compile time on either side — a mismatch shows up only as a plugin that is never
 * there, which is indistinguishable from running in a browser — so it is asserted in
 * `tests/native/pluginPackage.test.ts` instead.
 */

export const HS_SHELL_JS_NAME = "HSShell";

export interface HSShellEcho {
  /** The value this side sent, returned unchanged — proof the argument crossed going out. */
  sentAt: number;
  /** Native clock, ISO-8601. Not comparable with `sentAt` across the clock boundary. */
  receivedAt: string;
  device: { model: string; hardware: string; systemVersion: string };
  plugin: { version: string; buildConfiguration: string };
}

/**
 * Thermal and battery, readable with the camera shut down.
 *
 * ⚑ The camera's own `modeStatus` carries the same two figures, and `stop()` invalidates its
 * timer — so the arm of the thermal walk that runs with the camera CLOSED had no instrument at
 * all. `level` is 0…1 and iOS reports it in 5% steps, which is a fact about the instrument and
 * the reason a drain figure needs tens of minutes before it means anything.
 */
export interface HSDeviceStatus {
  thermalState: "nominal" | "fair" | "serious" | "critical" | "unknown";
  battery: { level: number; state: string };
  /** The device's own clock, so a pasted reading carries its time rather than a remembered one. */
  at: string;
}

export interface HSShellHeartbeat {
  beat: number;
  of: number;
  at: string;
}

/** What `addListener` hands back. `remove` may or may not be async — neither side promises. */
interface ListenerHandle {
  remove: () => unknown;
}

interface NativeHSShell {
  echo(options: { sentAt: number }): Promise<HSShellEcho>;
  /** Resolves with the value `UIApplication` actually holds, not the one that was asked for. */
  setIdleTimerDisabled(options: { disabled: boolean }): Promise<{ disabled: boolean }>;
  deviceStatus(): Promise<HSDeviceStatus>;
  /**
   * ⚑ Returns the handle SYNCHRONOUSLY, not a promise for one — proven on device 2026-08-14.
   * `@capacitor/core`'s typed wrapper returns `Promise<PluginListenerHandle>`, and the raw
   * `window.Capacitor.Plugins` proxy this module uses does not. Typing it as a promise and
   * calling `.catch()` on the result is a TypeError that takes the whole screen down, and it
   * type-checks perfectly — the declaration here is an assertion about a runtime nobody
   * compiles against. Accept both shapes rather than betting on either.
   */
  addListener(
    event: "heartbeat",
    handler: (data: HSShellHeartbeat) => void,
  ): ListenerHandle | Promise<ListenerHandle>;
}

function nativePlugin(): NativeHSShell | null {
  if (typeof window === "undefined") return null;
  const cap = (window as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.[HS_SHELL_JS_NAME] as NativeHSShell | undefined) ?? null;
}

/** True only inside the native shell with the plugin registered; false in the browser/PWA. */
export function hsShellAvailable(): boolean {
  return nativePlugin() !== null;
}

export interface BridgeProbe {
  echo: HSShellEcho;
  /** What this side actually sent — kept so `echo.sentAt` is checked against it, not itself. */
  sentAt: number;
  /**
   * Wall-clock milliseconds measured entirely on this side. Deliberately not `receivedAt -
   * sentAt`: those are two different clocks, and subtracting them reports the offset between
   * them dressed up as a duration.
   */
  roundTripMs: number;
}

/** Call `echo` and time the round trip. Rejects if the plugin is absent or the call fails. */
export async function probeBridge(): Promise<BridgeProbe> {
  const plugin = nativePlugin();
  if (!plugin) throw new Error("The HSShell plugin is not present — this is the browser, or it failed to register.");
  const sentAt = Date.now();
  const echo = await plugin.echo({ sentAt });
  return { echo, sentAt, roundTripMs: Date.now() - sentAt };
}

/**
 * Subscribe to the native heartbeat. Returns an unsubscribe function; a no-op in the browser,
 * so callers do not need their own platform branch.
 */
export function onHeartbeat(handler: (beat: HSShellHeartbeat) => void): () => void {
  const plugin = nativePlugin();
  if (!plugin) return () => {};
  let removed = false;
  // Promise.resolve normalises both shapes; the catch covers a bridge that rejects on subscribe,
  // and the try covers one that throws outright. A diagnostic screen that cannot subscribe should
  // report a missing heartbeat, not disappear — the failure it is there to show would be replaced
  // by a failure to show anything.
  let pending: Promise<ListenerHandle | null>;
  try {
    pending = Promise.resolve(plugin.addListener("heartbeat", handler)).catch(() => null);
  } catch {
    return () => {};
  }
  return () => {
    if (removed) return;
    removed = true;
    void pending.then((handle) => handle?.remove()).catch(() => {});
  };
}

/**
 * Hold the screen awake through the native shell, and report what the system ended up holding.
 *
 * ⚑ This is the mechanism the shipping surface has. `navigator.wakeLock` is a Safari API and a
 * Capacitor app is a `WKWebView`, so in the app the web hook's "not supported" branch was always
 * the true one — which is why the iPad slept through a 45-minute thermal run on 2026-08-15 with
 * a banner on screen and nobody in the room to read it.
 *
 * Returns `null` in the browser rather than throwing: the caller falls back to the web API
 * there, which is the declared control path and the one place `navigator.wakeLock` exists.
 */
export async function setNativeIdleTimerDisabled(disabled: boolean): Promise<boolean | null> {
  const plugin = nativePlugin();
  if (!plugin || typeof plugin.setIdleTimerDisabled !== "function") return null;
  const result = await plugin.setIdleTimerDisabled({ disabled });
  return result?.disabled === true;
}

/** Thermal + battery from the shell. `null` in the browser, which has neither to report. */
export async function readDeviceStatus(): Promise<HSDeviceStatus | null> {
  const plugin = nativePlugin();
  if (!plugin || typeof plugin.deviceStatus !== "function") return null;
  return plugin.deviceStatus();
}

/**
 * Did the echo come back intact? Separated from the call so the screen states a verdict before
 * it states detail — a screen that prints fields without saying whether they are right leaves
 * the reading to whoever is holding the iPad.
 */
export function echoIsWellFormed(probe: BridgeProbe): boolean {
  const { echo, sentAt } = probe;
  return (
    echo.sentAt === sentAt &&
    typeof echo.receivedAt === "string" &&
    echo.receivedAt.length > 0 &&
    !!echo.device?.hardware &&
    !!echo.device?.systemVersion &&
    !!echo.plugin?.version &&
    (echo.plugin?.buildConfiguration === "Debug" || echo.plugin?.buildConfiguration === "Release")
  );
}
