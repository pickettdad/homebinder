/**
 * Native-shell detection without importing @capacitor/core into the web bundle: the
 * Capacitor runtime injects `window.Capacitor` inside the native app; in the browser/PWA
 * it's absent. Used to no-op browser-only behavior (service-worker registration) that the
 * `capacitor://` scheme can't support.
 */
export function isNativePlatform(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
}
