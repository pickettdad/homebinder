/**
 * New-version banner. Never auto-reloads: an inspector mid-house must not get a
 * surprise refresh. The waiting service worker activates only on an explicit tap.
 */
import { useRegisterSW } from "virtual:pwa-register/react";
import { isNativePlatform } from "./platform";

export function UpdateBanner() {
  // Inside the native shell the app is the bundled `dist`; a service worker can't register
  // on the `capacitor://` scheme (and isn't needed), so skip auto-registration there.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ immediate: !isNativePlatform() });
  if (!needRefresh) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-brass-600 px-4 py-2 text-slate-950">
      <span className="text-sm font-medium">A new version is ready.</span>
      <button
        type="button"
        className="rounded-lg bg-slate-950 px-3 py-1.5 text-sm text-brass-300"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload now
      </button>
    </div>
  );
}
