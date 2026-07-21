# Project state — v0.5 handoff (2026-07-21)

Read this first when picking the project up in a new session. Pair it with the three
spec documents (Field Assistant spec v1, Baseline Inspection Process v1, Home Binder
Master Spec v1) — the owner has the originals and re-uploads them per session.

## What this is

HouseSteady Field Assistant v0.5 — offline-first iPad PWA rendering the Baseline
Inspection Process as an interactive route card. Full plan and rationale in README.md
and docs/route-config.md. v0.5 = completeness engine only (Tier 1): no AI, no server,
no sync — but their seams are built (provenance stamps, dormant outbox, GateReviewer
pass-through).

## State: BUILT AND VERIFIED, NOT YET PUSHED, NOT YET FIELD-TESTED

- 21 engine tests green · typecheck clean · production PWA build clean
- 10-step Chromium smoke run green at iPad Pro 11" viewport (setup → capture with a
  real file through the input path → voice-note bar → exception → gate → close zone →
  conditional well slots → crash-resume via reload → export prepare)
- NOT yet run on a physical iPad — the README's 9-point field checklist is the next
  milestone and gates everything else

## Branch and push status

Work lives on `claude/home-inspection-assistant-arch-utm1rs` (5 commits, this file's
commit last). The original session could not push: its git-proxy credential 403'd on
all git operations and the GitHub connector token was read-only ("Resource not
accessible by integration" on every write; reads fine). The owner created `main` on
the remote by hand (README only) while debugging.

**To restore in a fresh session** (owner uploads `housesteady-v0.5.bundle`):

```bash
git clone https://github.com/pickettdad/homebinder.git && cd homebinder
git fetch /path/to/housesteady-v0.5.bundle \
  claude/home-inspection-assistant-arch-utm1rs:claude/home-inspection-assistant-arch-utm1rs
git checkout claude/home-inspection-assistant-arch-utm1rs
# Histories are unrelated to main's hand-made README commit (repo was empty when work
# began). Rebase so future PRs work:
git rebase origin/main
git push -u origin claude/home-inspection-assistant-arch-utm1rs
```

The rebase will surface one trivial conflict at most (README.md vs the hand-made one —
keep the repo's full README).

## Load-bearing architecture decisions (agreed with owner — don't relitigate casually)

1. **Route = pure data, authored as a typed TS module** (`src/config/route.baseline.ts`),
   Zod-validated, semver + content hash pinned into every session and export. External
   JSON loading is a deliberate later step behind `loadRoute()` — trigger: route
   variants, server push, or a non-dev editor. Conditionals are a CLOSED flag vocabulary
   (allOf/anyOf/not) — never an expression language; logic becomes code that emits a flag.
2. **Append-only event log** in IndexedDB; state = pure fold (`src/engine/fold.ts`).
   Capture writes are atomic (event + blob + outbox row, one Dexie transaction).
   The fold reads ONLY the pinned config snapshot — never the live config module.
3. **Native camera via `<input capture>`** for full-res stills (nameplate legibility →
   future OCR). In-app viewfinder only if field timing data demands it — that trade
   costs resolution and needs explicit owner sign-off.
4. **Voice notes optional by default**; per-slot policy disabled/optional/recommended/
   required. Post-photo bar: Retake · Add voice note · Next (Next primary; required
   voice blocks Next). Owner-specified — do not auto-start recording.
5. **Export = manifest.json + per-zone ≤250MB STORE zips** via share sheet, per-file
   confirmation, sha256 everything. Never one big archive.
6. **Tablet-first responsive** (11" iPad Pro target), usable on phone. Thin platform
   boundaries (capture/audio/storage/export modules) — no adapter framework, no
   Capacitor unless field testing demands native.
7. Never rename/reuse slot ids; route edits = process doc first, then config, then
   configVersion bump, same commit (docs/route-config.md).

## Next milestones (owner's sequencing)

1. Push the branch (above), CI green (workflow included: validate-config + tests +
   typecheck + build).
2. Deploy over HTTPS somewhere reachable by the iPad; install to home screen.
3. Run the README field checklist at the owner's own house — especially: camera
   round-trip timing across ~20 captures (decides the native-camera choice), nameplate
   photos in the dark basement, mic permission persistence, force-quit recovery,
   ~200-photo storage soak, share-sheet export with real zip sizes, wake lock.
4. Feed findings back: route edits per docs/route-config.md; timing data decides the
   open capture-path question.
5. Only then: v1 seams (GateReviewer AI review, outbox drain, nameplate OCR).

## Open questions parked with evidence pending

- Camera round-trip vs. resolution (field timing decides; see decision 3)
- Voice-note defaults per slot after real-route friction is felt
- Export handoff reliability on real iPadOS (share sheet with multiple ~200MB zips) —
  fallback: smaller chunks or local-network handoff
- Whether visit two runs the pinned config version or the current one (deferred until
  the visit-two workflow exists; leaning pinned-with-explicit-upgrade)
