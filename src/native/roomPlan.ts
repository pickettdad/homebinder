/**
 * Stage 0 RoomPlan bridge. Reached through the Capacitor runtime's `window.Capacitor.Plugins`
 * (injected only inside the native shell) rather than importing `@capacitor/core`, so the web
 * bundle stays free of the native SDK — same stance as `app/platform.ts`. In the browser/PWA the
 * plugin is absent and everything here reports "unsupported".
 */
interface NativeRoomPlan {
  isSupported(): Promise<{ supported: boolean }>;
  scan(): Promise<{ roomJson: string }>;
}

function nativePlugin(): NativeRoomPlan | null {
  if (typeof window === "undefined") return null;
  const cap = (window as { Capacitor?: { Plugins?: { RoomPlan?: NativeRoomPlan } } }).Capacitor;
  return cap?.Plugins?.RoomPlan ?? null;
}

/** True only in the native shell on LiDAR hardware; false in the browser and on non-LiDAR devices. */
export async function roomPlanSupported(): Promise<boolean> {
  const plugin = nativePlugin();
  if (!plugin) return false;
  try {
    return (await plugin.isSupported()).supported;
  } catch {
    return false;
  }
}

export class ScanCancelled extends Error {
  constructor() {
    super("Scan cancelled");
    this.name = "ScanCancelled";
  }
}

/**
 * Present Apple's room scanner and resolve with the CapturedRoom JSON (the raw Codable encode —
 * the corpus that pins the schema and feeds the browser projection). Rejects with `ScanCancelled`
 * if the user backs out, or a plain Error if the plugin is unavailable / the scan fails.
 */
export async function scanRoom(): Promise<string> {
  const plugin = nativePlugin();
  if (!plugin) throw new Error("Room scanning is only available in the native iPad app.");
  try {
    const { roomJson } = await plugin.scan();
    return roomJson;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) throw new ScanCancelled();
    throw err instanceof Error ? err : new Error(message);
  }
}
