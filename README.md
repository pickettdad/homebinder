# HouseSteady Field Assistant — v0.5

The route card, interactive. An offline-first PWA that renders the Baseline Inspection
Process as a zone-by-zone capture checklist: photos into slots, a voice note per capture,
deterministic completeness gates, and a structured export for the processing pipeline.

**v0.5 scope:** the completeness engine (Tier 1) only. No AI, no server, no sync — but the
seams for all three are built in (provenance fields on every record, a dormant sync outbox,
a `GateReviewer` interface whose v0.5 implementation is a pass-through).

## Stack

React 19 + TypeScript + Vite + Tailwind · Dexie (IndexedDB) · Zod · Zustand · Vitest ·
`vite-plugin-pwa` (full offline precache) · `client-zip` (export packaging).

The completeness engine (`src/engine/`) is pure TypeScript with zero DOM/framework
imports — unit-tested to death, reusable server-side in v1.

## Getting it onto your iPad — the simple path

The app is a website that installs like an app. For the camera and microphone to work,
Apple requires it to live at a secure `https://` web address — so the one-time job is
connecting this GitHub repository to a free hosting service. Everything below happens
in a web browser; no terminal, nothing to install on a computer.

**One-time setup (~10 minutes):**

1. If the newest code is still on a branch, merge it first: on this repository's
   GitHub page, open the **Pull requests** tab, open the pull request, and press
   **Merge pull request**. (No pull request listed? It's already merged — carry on.)
2. Go to **netlify.com** and sign up for a free account, choosing **Sign up with
   GitHub**.
3. Press **Add new site → Import an existing project → Deploy with GitHub**, and pick
   the **homebinder** repository from the list.
4. Netlify detects the build settings by itself. If it asks, the two answers are:
   build command `npm run build`, publish directory `dist`. Press **Deploy**.
5. Wait a minute or two. Netlify shows the app's new web address, something like
   `https://wonderful-name-123.netlify.app`. You can change the name under
   **Site configuration → Change site name**.

**On the iPad (~2 minutes):**

6. Open that address in **Safari**.
7. Tap the **Share** button (the square with the arrow pointing up), then
   **Add to Home Screen**, then **Add**. *This step is required, not cosmetic — it is
   what lets the iPad keep a whole visit's photos safely on the device.*
8. From now on, always open the app from its home-screen icon, like any other app.
9. The first time you tap **Add voice note**, choose **Allow** when iPad asks about
   the microphone.

**Checking it worked:** the app's front screen should say **"persistent"** in the small
print at the bottom. Turn on Airplane Mode and tap around — everything should still
work, because nothing in a visit ever needs the internet.

**Getting updates later:** whenever new code lands on GitHub, Netlify rebuilds the site
by itself. Next time the app is open with internet, a banner appears — "A new version
is ready — Reload". Tap it when you're *not* mid-visit.

(Vercel and Cloudflare Pages work the same way if you prefer them; Netlify is just the
example.)

## Code review

Automatic per-PR AI review was removed (2026-07-22): with a solo maintainer merging
minutes after CI goes green, async reviews consistently landed *after* the merge — cost
without influence. Reviews now happen on demand inside the Claude Code session that
writes the change (`/code-review` before pushing), where findings can actually shape the
diff. The `ANTHROPIC_API_KEY` repository secret is no longer used by any workflow and
can be deleted from GitHub; the Netlify env var of the same name (used by the in-app AI)
is separate and unaffected.

## "Second look" — the AI zone reviewer (v1a)

When you close a reviewed zone, the app quietly sends that zone's photos (downscaled
copies — originals never leave the iPad) to Claude for a batch check: reshoot requests
("glare on the water-heater serial"), anomaly suggestions ("possible efflorescence —
worth a moisture reading before you leave?"), and consistency notes. Findings are
**advisory only**: the deterministic gate never waits on them, nothing blocks, and every
finding is dispositioned by you — Clear, Defer (→ visit-two list), or Reshoot. Offline,
reviews queue silently and run when there's signal.

**One-time setup (~5 minutes):**

1. In Netlify: **Site configuration → Environment variables**, add two variables:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com (mark as secret). Typical cost is
     **under $1 per full visit**; usage is recorded in every export manifest.
   - `HS_APP_TOKEN` — any long random string you invent (30+ characters). This stops
     strangers from using your review endpoint.
2. Redeploy the site (Deploys → Trigger deploy).
3. In the app: on the home screen, tap **"Second look: not configured"** and paste the
   same `HS_APP_TOKEN` value. Done — the next reviewed zone close will get a second look.

Which zones get reviewed is route policy: `gate: { review: "ai" }` per zone in
`src/config/route.baseline.ts` (currently the six equipment-heavy zones). Remove the
line to turn a zone's review off.

## Developer quickstart

```bash
npm install
npm run dev        # desktop-fixture development (file picker instead of camera)
npm test           # engine test suite
npm run validate:config   # route-config gate (also part of `npm test`)
npm run typecheck
npm run build && npm run preview
```

Desktop browsers open a file picker where the iPad opens the camera — that is the
intended desktop-fixture workflow. Everything else behaves identically.

## The route is a config file

`src/config/route.baseline.ts` defines the entire inspection: zones, capture slots,
required shots, minimum counts, voice-note policy, conditional blocks (well / septic /
wood heat), room templates, exception reasons. Editing the inspection = editing that one
file. See **docs/route-config.md** before touching it.

The config is pure serializable data validated by a Zod schema (`npm run validate:config`
fails closed in CI and at app startup). Every session pins the config's semver **and its
content hash**; exports embed the full snapshot, so an export is always interpretable even
after the route evolves.

## Architecture notes

- **Append-only event log.** Every capture/exception/gate-pass is an immutable event in
  IndexedDB, written atomically with its media blob and sync-outbox row. State is a pure
  fold over the log (`src/engine/fold.ts`): a crash mid-visit costs at most the one
  in-flight capture, and resume = replay.
- **Native camera capture** (`<input capture>`) for full-resolution stills — nameplate
  legibility feeds the future OCR pipeline. An in-app viewfinder is a deliberate
  non-goal until field timing data says otherwise (see `src/capture/PhotoInput.tsx`).
- **Export = manifest.json + per-zone zips** (~250MB chunks, STORE mode) via the share
  sheet. Never one giant archive — Safari memory and share-sheet limits are real.
- Platform boundaries (camera, audio, storage, export) are thin modules, not an adapter
  framework — swappable later (e.g. Capacitor) without ceremony.

## iPad field validation checklist (run from the FIRST capture flow, not at the end)

1. Serve over HTTPS (e.g. `npm run build && npm run preview -- --host` behind a TLS proxy,
   or deploy) — camera/mic/PWA install all require a secure context.
2. **Install to home screen** (Share → Add to Home Screen). This is mandatory for storage
   protection, not cosmetic. Home screen shows "persistent" in the app footer.
3. Camera round-trip time per capture — measure across ~20 captures; this decides whether
   the native-camera choice holds.
4. Photo quality on nameplates in a dark basement (the real test of the capture path).
5. Voice notes: record/stop/playback; mic permission persists across captures
   (Settings → HouseSteady → Microphone → Allow).
6. Offline recovery: force-quit mid-zone, relaunch — lands on the same zone, nothing lost.
7. Storage: run a full mock visit (~200 photos), watch the footer usage figure.
8. Export: prepare files, share each zip to Files/AirDrop, verify sizes and that the
   manifest lists every file.
9. Wake lock: screen stays on through a 15-minute idle stretch mid-session (iPadOS 18.4+).

## Roadmap seams (do not build early)

- v1: AI zone review behind `GateReviewer` · nameplate OCR · finding dictation ·
  outbox drain loop to a real server.
- v1.5: voice throughout, safety interrupts, sensor integrations.
- v2: native shell (RoomPlan) — Capacitor can wrap this codebase if field testing
  demands native APIs earlier.
