import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Stage 0 native shell (PLAN-STAGE-0). Production loads the BUNDLED `dist` — never a
 * remote `server.url`, which would leave the app blank offline and defeat the whole
 * offline-first product. The default `capacitor://localhost` scheme is kept deliberately:
 * a custom host/port breaks getUserMedia (the voice-note path) on iOS.
 */
const config: CapacitorConfig = {
  appId: "ca.housesteady.field",
  appName: "HouseSteady Field",
  webDir: "dist",
};

export default config;
