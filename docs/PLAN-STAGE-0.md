# Stage 0 plan — RoomPlan spike via Capacitor shell + cloud CI + TestFlight (2026-07-22)

**What this is:** the build plan for REDESIGN-v2 §5 Stage 0. Goal: **retire the RoomPlan
risk first** — prove scan → CapturedRoom JSON → 2D top-down plan → tappable canvas in
the web layer, on the owner's iPad, and evaluate quality where RoomPlan is weakest.
Runs in parallel with Stage 1 (PLAN-STAGE-1.md); neither blocks the other. Platform
facts below were verified against current (July 2026) Apple/GitHub/Capacitor sources
during planning; REDESIGN-v2 §6 is updated in the same commit.

---

## 1. The Mac question — resolved

The owner's Mac is confirmed: **MacBook Air 13" Early 2015 (A1466), 1.6 GHz i5, 4 GB
RAM, macOS Monterey 12.7.6** (its max stock macOS). Verdict: **it plays no build,
debug, or upload role — the pipeline is 100 % cloud CI.**

- Stock Monterey caps at Xcode 14.2, which cannot talk to an iPadOS-26 device (Xcode 15
  moved device comms to CoreDevice; the old DeviceSupport-folder trick died with
  iOS 17) and cannot upload anywhere: since **April 28, 2026** every App Store Connect
  upload — TestFlight included — must be built with **Xcode 26 / the iOS 26 SDK**
  (Apple upcoming-requirements notice 02032026a).
- OpenCore Legacy Patcher could put Sequoia 15.x on a 2015 Air (Tahoe support is
  nightly-only and uncertain), and Xcode 26 wants Sequoia 15.6+ — but community
  consensus puts modern Xcode's practical floor at 8 GB RAM ("nearly unusable" even
  there; 16 GB recommended). On 4 GB it is not a real tool. **Don't bother.**
- A used M1 Mac mini remains the escape hatch **only if** local native debugging ever
  becomes load-bearing (repeated native-crash diagnosis). Not needed to start; keep as
  the economics-session line item REDESIGN-v2 already carries.
- The Air is still fine for App Store Connect in a browser. Enrollment/identity
  verification can run on the iPad (Apple Developer app).

## 2. Toolchain (decided versions)

| Piece | Decision | Why |
|---|---|---|
| Wrapper | **Capacitor 8** (current major, Dec 2025; `@capacitor/ios` 8.4.x) | Requires Xcode 26+ — exactly what Apple's upload floor demands anyway; SPM by default (no CocoaPods on CI) |
| iOS deployment target | **17.0** | Capacitor 8 minimum is 15; RoomPlan needs 16, its StructureBuilder 17; the only device is on iPadOS 26 — no reason to reach lower |
| CI service | **GitHub Actions**, not Xcode Cloud | Xcode Cloud is included with the membership but is configured *from Xcode*, which needs a capable Mac the owner doesn't have (the 2015 Air can't run Xcode 26). GitHub Actions is set up entirely from a browser/iPad — a YAML file + four secrets — so it's the only option that fits the no-Mac constraint. Revisit Xcode Cloud only if an M-series Mac is acquired. |
| CI runner | **`macos-26` pinned** (never `macos-latest`) | Ships Xcode 26.0.1–26.6 (26.5 default as of the 2026-07-15 image); pin the Xcode via `xcode-select` in the workflow, not the image default (it drifts weekly) |
| Upload path | **`xcodebuild -exportArchive` → destination `upload` with App Store Connect API key** (`-authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`) | Apple's first-party CLI path. Deliberately **no fastlane**: fastlane's transporter is `altool`, which has active breakage churn under Xcode 26 and reportedly rejects Individual-account API keys — the owner's account type. Fastlane stays the documented fallback only |
| Signing | **Automatic ("cloud") signing on CI**: `-allowProvisioningUpdates` + the same API key (App Manager role) | No cert/profile juggling, no match repo. Fallback if flaky: manual distribution cert + profile as GH secrets |
| Distribution | **TestFlight, internal tester = the owner** (Account Holder) | Internal builds need **no Beta App Review** — available minutes after processing. 90-day build expiry is irrelevant at spike cadence |

## 3. Owner actions (human-gated; start these first)

> **Layman walkthrough:** `docs/STAGE-0-OWNER-SETUP.md` expands every item below into
> click-by-click steps written for a non-programmer (incl. the "why not Xcode Cloud"
> answer). This section is the terse engineering reference; that doc is what the owner
> follows.

1. **Enroll in the Apple Developer Program** (individual, $99 USD/yr): Apple Account
   with 2FA, legal name/address, government photo-ID verification via the Apple
   Developer app — the iPad does this fine. Typically ~24–48 h to approval. This gates
   everything; start today.
2. In App Store Connect → Users and Access → Integrations: **create an API key** (role
   App Manager), download the `.p8` (one-time download).
3. Add GitHub repo secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (file
   contents), plus `APPLE_TEAM_ID`.
4. Pick the app identity once, forever: name (TestFlight display) and bundle id
   (suggest `ca.housesteady.field` or similar — owner's call, never changes).
5. Install TestFlight on the iPad; accept the internal-tester invite.

## 4. Repo work

**Shell (wraps the CURRENT app, per REDESIGN-v2 §5):**
- `npx cap add ios` → `ios/` project committed; `capacitor.config.ts` at root
  (`webDir: "dist"`; add it to `tsconfig.json`'s `include` — the current list stops at
  `src/tests/scripts/netlify`). Production loads the **bundled** dist — never
  `server.url` (dev-only; a remote-URL production shell would be blank offline and
  defeats the whole product).
- **Guard service-worker registration**: `useRegisterSW` (in `UpdateBanner.tsx`) must
  no-op under `Capacitor.isNativePlatform()` — SWs can't register on the
  `capacitor://` scheme, and bundled assets don't need one.
- **API base** becomes `VITE_API_BASE` (default same-origin `/api`) so the shell can
  reach the Netlify function origin — shared work item with PLAN-STAGE-1 §6; whichever
  lands first carries it.
- `Info.plist`: `NSCameraUsageDescription` (RoomPlan **and** the existing
  `<input capture>` path — a missing key crashes WKWebView's Take Photo) +
  `NSMicrophoneUsageDescription` (voice notes). Keep the default
  `capacitor://localhost` — custom host/port breaks `getUserMedia`.

**Native module (the only Swift in the spike — keep it minimal and stable):**
- `RoomPlanPlugin` (`CAPPlugin` + `CAPBridgedPlugin`; registered via a
  `CAPBridgeViewController` subclass's `capacitorDidLoad`). Three methods:
  - `isSupported()` → `{supported: bool}` (`RoomCaptureSession.isSupported`)
  - `scan()` → presents **`RoomCaptureView`** (Apple's full scanning UX: coaching,
    live model, done/retry) full-screen over the webview; on done, encodes the
    `CapturedRoom` via `Codable` → returns `{roomJson: string, version}` to JS
    (typically 100s of KB — fine inline)
  - `exportScan()` → same scan as USDZ + JSON files handed to the share sheet
    (builds the sample corpus; also our archive of raw scans)
- **No custom AR UI, no StructureBuilder/multi-room, no auto-alignment** — out of
  spike scope (REDESIGN-v2 §8 parks multi-room merging).

**Web-layer work (all iteration happens here, not in Swift):**
- 2D projection in TypeScript: CapturedRoom `walls/doors/windows/openings` (4×4
  transforms + dimensions) → top-down polylines; `objects` (16 furniture/appliance
  categories with oriented boxes) → **auto-pin candidate markers**. Two verify-first
  caveats from research: Apple doesn't formally document the Codable JSON schema
  (pin it from our own sample encodes; it carries a `version` field), and the
  wall-axis convention (x = width, thin z) is community-consistent but unconfirmed —
  confirm both against the first real scan before polishing the math.
- **Sample-scan harness**: a dev-flagged screen in the web app that loads a
  CapturedRoom JSON file and renders the projected plan as tappable SVG (tap →
  normalized x/y readout). This is the acceptance demo *and* the iteration loop —
  projection work runs on sample JSON in the browser, no TestFlight round-trip.

## 5. CI workflow (`.github/workflows/ios-testflight.yml`)

- **Trigger: `workflow_dispatch` only** (optionally tags `ios-v*`). Never per-push/PR:
  macOS minutes bill at ~10× included-minute drain (third-party-confirmed; GitHub's
  post-Jan-2026 docs publish $/min instead — macOS $0.062/min vs Linux $0.006) and a
  build runs 10–15 min wall-clock → **~100–150 included minutes per build** against
  2,000 (Free) / 3,000 (Pro) per month. Manual-only keeps the spike inside the free
  tier (~13–30 builds/month); the existing ubuntu CI is untouched by `ios/`.
- Steps: checkout → setup-node 22 + `npm ci` → `npm run build` → `npx cap sync ios` →
  pin Xcode (`sudo xcode-select -s /Applications/Xcode_26.5.app` with an existence
  check) → write `.p8` from secret → `xcodebuild archive` (automatic signing,
  `-allowProvisioningUpdates`, API-key flags) → `xcodebuild -exportArchive` with
  `ExportOptions.plist` `{method: app-store-connect, destination: upload}`.
- First milestone build is the **"hello shell"**: the current v1a app wrapped, no
  RoomPlan code — proves enrollment, signing, upload, TestFlight install end-to-end
  before any Swift exists. Everything after is incremental.

**Scaffolding status (2026-07-25).** The web-side shell (`capacitor.config.ts`,
`@capacitor/*` deps, SW native no-op via `src/app/platform.ts`, `VITE_API_BASE`) and the
`ios-testflight.yml` workflow are committed and the web build stays green. Two deliberate
deviations from the plan-as-written, both forced by the no-Mac constraint:
- **The `ios/` project is GENERATED on the runner** (`npx cap add ios`, `ios/` gitignored),
  not committed — there's no Mac to generate/commit one, and the hello shell has zero
  native code so the scaffold is deterministic. This flips to a committed `ios/` + a
  `cap sync` step once the RoomPlan plugin (real Swift) lands.
- **The workflow is authored but unproven from Linux.** iOS signing/export is inherently
  un-testable off a Mac; the first `workflow_dispatch` (available only after this merges to
  the default branch) is the real test, and the archive/export/signing step is exactly the
  "budget one debugging session" line item in §7 — expect one iteration there.

**Signing iteration (2026-07-24).** The first `workflow_dispatch` consumed the §7 budgeted
debugging session. Everything up to signing succeeded (npm ci, web build, Xcode 26.5,
`cap add ios`, SPM resolve, plist edits); the **archive** step failed asking for an *iOS App
Development* provisioning profile. Root cause: automatic signing signs the archive with an
Apple Development identity, and a development profile requires ≥1 registered device on the
team — this account has none. TestFlight wants *distribution* signing anyway, so registering a
device would have been a detour. Fix (in `ios-testflight.yml`): archive **unsigned**
(`CODE_SIGNING_ALLOWED=NO`, no profile needed → no device needed), then do distribution signing
at **export** via `signingStyle=automatic` + the ASC API key — an App Store distribution profile
carries no device list, so cloud-signing generates one on demand for a device-less team. This is
the cleaner of the two candidate paths (the other was: register a device UDID and keep automatic
development signing); distribution-at-export needs no device at all. Fallback if a runner ever
rejects exporting an unsigned archive: register one device and restore automatic dev signing at
archive. This supersedes §5's original `xcodebuild archive (automatic signing …)` sketch.

**✅ HELLO-SHELL MILESTONE COMPLETE (2026-07-24).** Signing solved, pipeline proven end to end,
build installed on the owner's iPad. It took **two** fixes, both real and sequential:
1. **Code (workflow):** the unsigned-archive + distribution-at-export change above got the build
   past the archive/dev-profile block (run #1 on the original workflow failed there).
2. **Account (ASC key role):** with the new workflow, export then failed with "No signing
   certificate 'iOS Distribution' found" (run #2) — the App Store Connect API key had the **App
   Manager** role, which can create a Development certificate but **not** an iOS Distribution
   certificate. Regenerating the key with the **Admin** role (new `.p8`, updated `ASC_KEY_ID` +
   `ASC_KEY_P8`, issuer unchanged) fixed it; the same workflow then **succeeded** (run #3) and
   uploaded to TestFlight. **Standing requirement: the CI ASC key MUST be Admin role.**
3. **Two manual App Store Connect steps** to install: add self to an Internal Testing group;
   answer export compliance once ("None of the above" — HTTPS only). The latter is now
   **automated** via `ITSAppUsesNonExemptEncryption = false`, injected into `Info.plist` in the
   CI plist step (survives every `cap sync`), so future builds don't prompt.

**Native-shell assistant bug + fix (2026-07-24).** On the installed build, everything local
(camera, pins) worked but the **AI assistant hung on "Thinking…"** forever. Diagnosis (against
the real request path, not assumed): the native web origin is `capacitor://localhost`, which has
no functions; the iOS build had **never set `VITE_API_BASE`**, so `API_BASE` fell back to
same-origin `/api` → `capacitor://localhost/api/chat` → the local bundle's SPA fallback, never
Netlify. (Not a missing token — the token was present, which is why the UI showed "Thinking…"
and not "set the token".) Fix, three parts: (a) the workflow build step now sets `VITE_API_BASE`
to the Netlify origin (`vars.HS_API_BASE`, default `https://housesteady.netlify.app/api`); (b)
the chat + review functions now send **CORS** headers and answer the `OPTIONS` preflight, since
the request from `capacitor://localhost` is cross-origin; (c) the chat drain now **fast-fails**
on a 2xx-non-JSON response (the SPA-fallback signature) with a non-retryable `misrouted` error,
so a wrong-origin misconfig surfaces immediately instead of backing off into an apparent hang.
Fallback if WKWebView still blocks the cross-origin call despite CORS: enable Capacitor's native
HTTP (`CapacitorHttp`) to route `fetch` through the native layer (bypasses WKWebView CORS).

## 6. Acceptance test (REDESIGN-v2 §5, made concrete)

At the owner's house, on the installed TestFlight build:

1. **Scan the utility room** — deliberately RoomPlan's documented worst case
   (WWDC guidance: ≥50 lux, keep distance from walls, mirrors/glass/dark surfaces
   degrade; a cluttered pipe-dense room stresses all of it). Run it twice: ambient
   light, then with a work light — lighting is the cheapest fix if it fails.
2. **Scan the main floor** as 2–3 separate single-room scans (multi-room merge is out
   of scope).
3. `exportScan()` each → JSON corpus into the repo's test fixtures (pins the schema,
   feeds the harness).
4. In the harness: is the wall plan **usable as a tappable canvas**? Doors/windows
   roughly where reality has them? What did object detection find in the utility room —
   expectation set accordingly: RoomPlan's category vocabulary is furniture-grade
   (washer/dryer, sink, stove, storage…; there is **no water-heater/furnace/panel
   category**), so utility equipment will surface as generic boxes at best. The
   question is whether *position + box* is still a useful pin seed, not whether labels
   are right.
5. Verdict with the owner, feeding Stage 2: plan canvas becomes primary (REDESIGN §5
   Stage 2 proceeds as written) / plan canvas is supplementary (photo canvases stay
   primary; manual rough-rectangle fallback gets promoted) / RoomPlan only for
   simple rooms. **A "poor in the utility room" result is information, not failure —
   the fallbacks are already first-class in the v2 model.**

## 7. Risks

- **Iteration latency** (any native change = CI build + TestFlight processing,
  ~15–30 min): mitigated by keeping the native surface to three plugin methods and
  doing all projection/UI work in the browser harness. Batch native changes.
- **Cloud-signing flakiness on CI** is the most likely time sink (first-run
  provisioning, API-key role issues). Fallback ladder: manual cert+profile secrets →
  fastlane. Budget one debugging session; the "hello shell" milestone exists to spend
  it early.
- **WKWebView storage durability — a Stage 2 GATE, not a note** (owner decision
  2026-07-23): IndexedDB in the shell persists and Safari's 7-day ITP eviction doesn't
  apply in practice, but iOS may reclaim webview storage under disk pressure and
  `navigator.storage.persist()` is a no-op. Fine for Stage 0 because the shell is a
  scan instrument, not the data store (the PWA remains the daily driver; scans are
  exported immediately). **The shell does not become the daily driver until the native
  durability mitigation (filesystem export or SQLite mirror via plugin) exists and is
  verified on-device.** When PLAN-STAGE-2 is written, this gate transfers into it as
  an entry criterion.
- **Runner-image drift**: Xcode default on `macos-26` changes ~weekly; the explicit
  `xcode-select` pin plus a listed fallback keeps builds reproducible.
- **Enrollment delay** (24–48 h, occasionally longer on ID verification) gates the
  first upload — which is why owner actions are step one and repo work proceeds in
  parallel.

## 8. Sequencing

1. Owner: enrollment → API key → secrets → TestFlight on iPad (§3).
2. Repo: Capacitor shell + SW guard + `VITE_API_BASE` + plugin skeleton returning a
   canned CapturedRoom JSON; CI workflow; **"hello shell" on TestFlight**.
3. Real `RoomPlanPlugin` (RoomCaptureView, Codable export, share sheet).
4. Owner scans (utility room ×2, main-floor rooms); JSON corpus lands in fixtures.
5. Projection + tappable-SVG harness against the corpus; axis/schema verification.
6. Acceptance review with the owner (§6) → Stage 2 go/shape decision.

**Cost envelope:** $99/yr Apple Developer + $0 CI if manual-triggered within included
minutes (each build ≈ 100–150 of 2,000–3,000 monthly; overage would be ~$0.62–0.93 per
build at $0.062/min). No new hardware.
