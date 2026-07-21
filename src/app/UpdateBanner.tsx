/**
 * New-version banner. Never auto-reloads: an inspector mid-house must not get a
 * surprise refresh. The waiting service worker activates only on an explicit tap.
 */
import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-teal-600 px-4 py-2 text-slate-950">
      <span className="text-sm font-medium">A new version is ready.</span>
      <button
        type="button"
        className="rounded-lg bg-slate-950 px-3 py-1.5 text-sm text-teal-300"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload now
      </button>
    </div>
  );
}
