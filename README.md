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

## Quickstart

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
