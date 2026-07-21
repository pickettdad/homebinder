/**
 * Screen Wake Lock for the 3-hour visit, with visible status.
 *
 * Field run 1 found the screen sleeping mid-session on iPadOS 26 — well past the
 * version where standalone wake lock works — and the old hook swallowed every failure,
 * so there was nothing to diagnose with. This version (a) re-acquires when the SYSTEM
 * releases the lock (camera round-trips, battery pressure — release can happen without
 * a visibility change), and (b) reports held/error state so the UI can show when the
 * screen is actually at risk and why (NotAllowedError typically = Low Power Mode).
 */
import { useEffect, useState } from "react";

export interface WakeLockStatus {
  supported: boolean;
  held: boolean;
  /** DOMException name from the last failed request, e.g. "NotAllowedError". */
  error: string | null;
}

export function useWakeLock(active: boolean): WakeLockStatus {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [status, setStatus] = useState<WakeLockStatus>({ supported, held: false, error: null });

  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        lock = acquired;
        setStatus({ supported, held: true, error: null });
        acquired.addEventListener("release", () => {
          if (disposed) return;
          setStatus((s) => ({ ...s, held: false }));
          // Delay avoids a tight loop if the system insists on releasing.
          setTimeout(() => void acquire(), 1000);
        });
      } catch (err) {
        setStatus({ supported, held: false, error: (err as DOMException).name || "unknown" });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
      setStatus({ supported, held: false, error: null });
    };
  }, [active, supported]);

  return status;
}
