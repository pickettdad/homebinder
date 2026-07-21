/**
 * Screen Wake Lock for the 3-hour visit. The lock is auto-released on every visibility
 * change — which happens on every native-camera capture — so re-acquisition on
 * visibilitychange is the load-bearing part, not the initial request.
 */
import { useEffect } from "react";

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        if (!disposed && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {
        // Denied (low battery etc.) — non-fatal; the inspector can raise Auto-Lock in Settings.
      }
    };

    const onVisibility = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
