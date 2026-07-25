import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/theme.css";

// The inline watchdog in index.html installs this; it paints a readable error on-device so a
// mount failure in the native shell shows text instead of a silent black screen.
declare global {
  interface Window {
    __hsBootError?: (title: string, detail?: string) => void;
    // Set true by App after the first successful React commit. The watchdog reads it to stop
    // being destructive post-boot — a runtime error mid-inspection must not wipe the app.
    __hsBooted?: boolean;
  }
}

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  window.__hsBootError?.(
    "Failed to render the app",
    err instanceof Error ? (err.stack ?? err.message) : String(err),
  );
  throw err;
}
