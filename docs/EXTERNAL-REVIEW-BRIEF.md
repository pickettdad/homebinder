# External review brief — for an outside reviewer (e.g. ChatGPT) with full repo access

You have been asked to review this repository and give the owner insight. This document
orients you: what the project is, what it is trying to achieve, where it stands today, how to
read the codebase efficiently, and — importantly — the ground rules for a **grounded, honest**
review. Read it fully before forming conclusions.

---

## 0. Ground rules for your review (read first)

This repository was recently the subject of a **confidently wrong** AI analysis: an external
design-session AI claimed the native app loads over the internet via a Capacitor `server.url`
and that this caused a launch black screen. **There is no `server.url` anywhere in this repo**
(see `capacitor.config.ts` — the string appears only in a comment explaining why it is
deliberately absent). That false premise wasted a review cycle. Do not repeat it.

Therefore:

1. **Ground every factual claim in a real file.** Cite `path:line`. If you cannot point to it,
   label it a hypothesis, not a fact.
2. **Verify before you assert.** Do not infer behavior from names or conventions — open the file.
   Capacitor/Vite/iOS defaults are frequently misremembered; check the actual config and the
   vendored source under `node_modules/@capacitor/ios` if behavior matters.
3. **Separate three buckets explicitly** in your output: (a) **Confirmed** (verified in code),
   (b) **Recommendation** (your judgment), (c) **Question for the owner** (needs a human decision).
4. **Be specific and actionable.** A pointed finding with a file reference beats a generic
   best-practices lecture. Assume the reader has limited time.
5. **Respect the constraints in §5** — advice that assumes a team, a Mac, or unlimited spend is
   not useful here. If the best answer violates a constraint, say so and explain the trade-off.
6. **Flag what you could not verify.** "I didn't check X" is valuable; a confident guess is not.

---

## 1. What HouseSteady is

An **offline-first iPad app for home inspectors** to capture a walkthrough in the field and
produce a structured report with photo/audio evidence. It runs as a PWA (browser) and as a
native iOS shell (Capacitor → TestFlight) for LiDAR features. It is built by a single Claude
Code session directed by the **owner, a working home inspector who is not a programmer** — so
the code, the docs, and the decisions are all optimized for that reality.

The product metaphor (see `docs/REDESIGN-v2.md`): "the route card, interactive." The inspector
walks **zones**, drops **pins** on findings, attaches photos to **canvases** (photo-based floor
plans), and works a **checklist** — all offline, in a basement, with gloves on, with the screen
possibly asleep and no signal.

## 2. What we are trying to achieve

- **Fast, glove-friendly, offline-first field capture** that never waits on a network. Losing
  inspection data is catastrophic, so durability and offline correctness are paramount.
- **A structured, exportable record** (event-sourced; an export manifest with provenance).
- **An in-product AI assistant** (on-demand chat + a review pass) that helps the inspector in
  the field — this is the one component allowed to require the network, and the one where
  spending on the best model is justified (it earns money).
- **Stretch: RoomPlan LiDAR floor plans** (Stage 0) as a *better* canvas when they work; the
  design already treats hand-built photo canvases as the first-class fallback, so RoomPlan is
  valuable-but-not-load-bearing.

## 3. Where the project is right now (verify against the repo)

- **Stage 1 (web pin model): mostly built.** Walk / zone / pin / canvas / inbox flow, checklist,
  camera, session lifecycle, an offline AI chat/review queue. Event-sourced core with a fold,
  persisted in Dexie/IndexedDB. ~105 tests; CI gates on typecheck, tests, build, and
  checklist-config drift. **NOT yet built: the pin-model (manifest v3) export.** The current
  exporter (`src/engine/export/manifest.ts`, `src/screens/ExportScreen.tsx`) is the legacy
  slot-model v2 exporter and cannot export a pin-model session; the v3 contract is specified in
  `docs/PLAN-STAGE-1.md` §7 but not implemented. This is the top functional gap — a pin-model
  inspection currently has no structured off-device export.
- **Stage 0 (native shell): working end-to-end on-device.** Capacitor 8 → GitHub Actions →
  TestFlight. Owner-confirmed on "build 5": the native app launches and the AI assistant works.
- **RoomPlan: parked.** A native plugin-injection approach black-screened the app on device
  (the storyboard repoint), and blind CI-only iteration (no Mac) could not diagnose it. Reverting
  it restored a working shell. The Swift + web bridge remain in the repo, unwired, for a
  re-approach. Tracked in the Issues tab.
- **Offline-first shell is real:** the app is served from the local bundle (`webDir: "dist"`),
  never a remote URL. A CI test guards this (`tests/shell/offlineFirst.test.ts`).
- **AI model is pinned by design** (provenance is stamped into the export manifest). See the
  `HS_CHAT_MODEL` / `DEFAULT_CHAT_MODEL` note in `CLAUDE.md`.

## 4. How to read the codebase (efficient order)

1. `CLAUDE.md` — the standing rules, invariants, and how the build is run. **Start here.**
2. `docs/REDESIGN-v2.md` — the product model (the north star).
3. `docs/PLAN-STAGE-1.md` — the web pin-model build plan (what most of `src/` implements).
4. `docs/PLAN-STAGE-0.md` — the native shell + RoomPlan plan, incl. the black-screen post-mortem.
5. `docs/CHECKLIST-MASTER.md` — the inspection checklist content (owner-owned, versioned; the
   generator `scripts/gen-checklists.mts` produces `src/config/checklists.generated.ts`).
6. Source, roughly in dependency order:
   - `src/engine/` — the event model + fold (v2 in `src/engine/v2/`), ids, canonical hashing,
     manifest. This is the correctness core; scrutinize it.
   - `src/storage/` — Dexie schema + the single-writer session repo (durability lives here).
   - `src/store/sessionStore.ts` — the Zustand app store wiring engine + storage + UI.
   - `src/screens/`, `src/screens/v2/` — the field UI.
   - `src/chat/`, `src/review/` — the AI assistant client (queues, protocols, chunking).
   - `netlify/functions/chat.mts`, `review.mts` — the serverless AI endpoints (CORS for the
     native origin; model read from `HS_CHAT_MODEL`).
   - `capacitor.config.ts`, `.github/workflows/ios-testflight.yml` — the native shell + CI.
   - `.github/workflows/ci.yml` — the web CI gates.

## 5. Constraints your recommendations must respect

- **Owner is not a programmer.** Advice is executed by an AI coding session on the owner's
  instruction. Favor changes that are safe, testable, and reversible; explain trade-offs plainly.
- **No Mac.** All native/iOS work is currently blind (CI-only, ~15–30 min per build, no runtime
  visibility). This is the single biggest constraint on native progress. A used Mac mini is on
  the table but not yet bought; weigh recommendations against this.
- **Verification/spend budget.** Single-session work with self-review is the default; no
  multi-agent fleets. CI gates must stay green. The in-product AI is the exception (spend for
  quality there).
- **Config discipline.** `src/config/checklists.generated.ts` and other generated files are
  never hand-edited (CI fails on drift). The checklist master is owner-owned; defects become
  change-requests in `docs/CHECKLIST-MASTER-REVIEW.md`, never unilateral edits.
- **One test device**, updated only when the owner merges a PR (which triggers the Netlify
  deploy / a TestFlight build). So on-device iteration is expensive and owner-gated.

## 6. What we want from you (focus areas)

Prioritize by impact. You do not have to cover everything; go deep where you see risk.

1. **Offline-first & durability correctness.** Is there any hidden network dependency at boot or
   in a core flow? Is the Dexie/event-log design safe against data loss (partial writes, schema
   migrations, quota/eviction on iOS WKWebView, concurrent writers)? This matters more than
   anything — lost inspection data is the worst outcome.
2. **The event-sourcing model.** Is the events→fold design sound and future-proof? Id stability,
   versioning/migration, canonical hashing, the export manifest's provenance guarantees.
3. **Native strategy.** Given a no-Mac solo builder: is Capacitor + cloud CI + TestFlight the
   right path? Is the planned RoomPlan **plugin-package** re-approach sound, or is a Mac mini the
   pragmatic call? Are there ways to de-risk native launch bugs without a Mac (e.g. the on-device
   error overlay already added in `index.html`)?
4. **The AI assistant.** Review the chat/review client and serverless functions: prompt design,
   model choice and pinning, cost controls, offline queueing/retry, CORS/timeout handling, and
   the provenance stamping. Any correctness or cost concerns?
5. **Field UX and product fit.** Will the zone/pin/canvas/checklist/photo model hold up in a real
   inspection? What's missing or awkward for a gloved, offline, one-handed workflow?
6. **Risks we're not seeing / over-engineering / gaps.** Backup & recovery, multi-device, report
   output format, accessibility, security of the AI token path, anything that bites in production.
7. **Sequencing.** For a solo non-programmer owner + an AI builder, what should the next few
   moves be, and what is safe to defer?

## 7. Output we'd like

- A **prioritized findings list**, each tagged **Confirmed / Recommendation / Question**, with
  `path:line` references for anything Confirmed.
- A short **plain-language summary for the owner** (non-programmer) at the top: what's solid,
  what's risky, and the 2–3 things most worth doing next — in field/inspection terms, not jargon.
- Explicit callouts of **anything you could not verify** or that needs an owner decision.
