/**
 * Hold the screen awake for the 3-hour visit, with visible status.
 *
 * ⚑ **Two mechanisms, and the native one is the shipping one.** The whole of this hook used to
 * be `navigator.wakeLock`, which is a **Safari** API — and the concierge runs a `WKWebView`,
 * where it is simply absent. So in the app the "not supported" branch was always the true one,
 * and on 2026-08-15 the iPad slept through a 45-minute thermal run with an amber banner on
 * screen and nobody in the room to read it. Every previous fix here — re-acquire on release,
 * retry on the next pointerdown — was tuning a path the shipping build never took.
 *
 * `UIApplication.isIdleTimerDisabled` is what an app has: no user gesture, no Low Power Mode
 * refusal, no release behind our back. Those three are, between them, every wake-lock defect
 * this project has logged.
 *
 * The web path stays for the browser, which is a **control, not a shipping surface**
 * (CLAUDE.md): when the app misbehaves the fastest question is "does the web version do the
 * same", and a control that cannot stay awake cannot answer it.
 *
 * `mechanism` is reported rather than inferred, because "wake lock held" meant two different
 * things on two platforms and only one of them was ever true.
 */
import { useEffect, useState } from "react";
import { hsShellAvailable, setNativeIdleTimerDisabled } from "../native/hsShell";

export interface WakeLockStatus {
  supported: boolean;
  held: boolean;
  /** DOMException name from the last failed request, e.g. "NotAllowedError". */
  error: string | null;
  /** Which path is holding it. `none` means neither exists here. */
  mechanism: "native" | "web" | "none";
}

const webSupported = () => typeof navigator !== "undefined" && "wakeLock" in navigator;

export function useWakeLock(active: boolean): WakeLockStatus {
  const native = hsShellAvailable();
  const mechanism: WakeLockStatus["mechanism"] = native ? "native" : webSupported() ? "web" : "none";
  const [status, setStatus] = useState<WakeLockStatus>({
    supported: mechanism !== "none",
    held: false,
    error: null,
    mechanism,
  });

  useEffect(() => {
    if (!active || mechanism === "none") return;
    let disposed = false;
    const settle = (held: boolean, error: string | null) => {
      if (!disposed) setStatus({ supported: true, held, error, mechanism });
    };

    if (mechanism === "native") {
      // Re-asserted when the app comes back to the foreground. The flag survives backgrounding
      // in principle; re-asserting costs one bridge call and removes a class of "in principle".
      const assert = () => {
        void setNativeIdleTimerDisabled(true)
          .then((held) => settle(held === true, null))
          .catch((err) => settle(false, err instanceof Error ? err.message : "unknown"));
      };
      const onVisibility = () => {
        if (document.visibilityState === "visible") assert();
      };
      assert();
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        disposed = true;
        document.removeEventListener("visibilitychange", onVisibility);
        // Released on the way out. An app that leaves the idle timer disabled after the visit
        // flattens the iPad overnight, and nothing on screen would say why.
        void setNativeIdleTimerDisabled(false).catch(() => {});
      };
    }

    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        lock = acquired;
        settle(true, null);
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
          if (disposed) return;
          setStatus((s) => ({ ...s, held: false }));
          // Delay avoids a tight loop if the system insists on releasing.
          setTimeout(() => void acquire(), 1000);
        });
      } catch (err) {
        settle(false, (err as DOMException).name || "unknown");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    // Auto-resume at launch requests the lock with NO user gesture, which iPadOS denies
    // (NotAllowedError) — and it stays denied until the user happens to navigate. Any tap counts
    // as a gesture, so retry on the next pointerdown whenever the lock isn't held.
    const onPointerDown = () => {
      if (!lock) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onPointerDown);
      void lock?.release().catch(() => {});
    };
  }, [active, mechanism]);

  return status;
}
