# HouseSteady Field Assistant — v2 Redesign (2026-07-22)

**What this document is:** the definitive statement of where the project stands and where
it goes next, written after two field tests falsified the core UX of v0.5/v1a. It serves
three audiences: a fresh Claude Code session starting the v2 build ("read this first"),
the owner's Claude project for design discussions (upload this file as context), and the
repo's own record. It supersedes the build-sequencing in docs/HANDOFF.md; the
architecture foundations described there still stand.

---

## 1. Where the project stands

**Shipped and deployed** (Netlify, installed as PWA on the owner's iPad Pro 11" 3rd gen,
M1, LiDAR, iPadOS 26): v0.5 — offline-first capture app with zone/slot route, photos +
voice notes, deterministic zone gates, append-only event log in IndexedDB, atomic
capture persistence, crash-resume, per-zone zip export with sha256-verified manifest.
v1a — "Second look": server-side Claude review proxy (Netlify Function, shared-token
auth), review jobs riding the sync outbox, AI findings as provenance-stamped events,
findings UI at the gate. CI + automatic Claude PR review on the repo.

**Field test 1** (office, full mock route): all v0.5 mechanics validated — capture speed
via native camera, offline operation, crash recovery, storage, export integrity
(sha256 chain verified end-to-end). **Field test 2** (owner's house: setup + basement):
the two verdicts below.

## 2. What the field falsified (the reasons for v2)

1. **The slot list fails as the DRIVER of the walk.** Following prescribed capture slots
   heads-down meant significant misses in the utility room — the densest, most
   important space. The list works as *memory*, not as *eyes*. The walk must be free;
   completeness checking must move to an audit step.
2. **Batch AI review at zone close ("Second look") isn't worth it.** Findings were
   redundant with the inspector's own voice notes, irrelevant, or inaccurate. AI is
   wanted **on demand only**: "what is this equipment?", "is this right?", "what could
   this damage be?" — asked from the thing being inspected, with the conversation
   recorded so the report/binder can use it.
3. **Input preference:** text + iPad keyboard dictation (voice-to-text) as primary note
   input; voice notes remain an option, not the default.

## 3. The v2 model

**Zones** — rooms/areas, created as walked (not a fixed route). Plus a **session-level
misc bucket** for anything captured between zones; everything is retaggable later.

**Canvases** — each zone can have: a floor plan (RoomPlan scan; manual rough-rectangle
fallback for rooms that scan poorly) and/or wide photos. Exterior zones are photo-canvas
(RoomPlan doesn't work outdoors); a site-plan canvas is a future addition.

**Pins** — the core object. Tap a canvas → numbered pin (#16), global sequence,
**numbers are permanent, never reused or renumbered**. A pin has: a type from the
component library (water-heater, panel, receptacle, smoke-alarm, register, …, or
freeform), an optional flag (fine / monitor / issue), and attached photos, text notes,
voice notes, and AI chat threads.

**Anchors** — one pin, many anchors. A pin is the identity; anchors are where it appears
on canvases. The **plan anchor is canonical** (a pin without one is "incomplete" and the
zone audit nags); photo anchors are additional views and may exist alone temporarily —
essential for vertically-stacked equipment (one plan anchor, separate photo anchors for
feeder/tank/pump on the same wall) and for the pre-RoomPlan stage.

**Layers** — canvas views filtered by pin type/flag: "issues", "receptacles",
"shutoffs", "alarms", "comparison positions", "all". Layers ARE binder artifacts in the
making: the shutoffs layer is the Master Spec §1 emergency map; the issues layer is the
findings register's spatial index; comparison-position layer is §10's protocol.

**Checklists** — per zone-type verification lists, from config (data, not code — the
discipline stands). Items are *observations/actions* ("GFCIs tripped/reset", "TPR valve
piped", "sump bucket test run"), satisfiable by: linking a pin, a plain check, or a note.
Creating a typed pin auto-attaches matching checklist items (a water-heater pin brings
its TPR/pan/fittings items with it). **Zone close = STRONG ADVISORY audit**: unchecked
items surface loudly, closing is never blocked, a close note is recorded. (A future
backup-operator mode may flip the same checklist to hard-gate via config.)

**Global camera + inbox** — a shutter available from every screen; unassigned captures
land in a session inbox; assign to zone/pin/new-pin/misc later. Shoot first, file when
hands are free.

**AI: on-demand chat, scoped** — chat from a pin (context: its photos/notes/type) or a
zone (context: zone summary). Conversations are recorded as provenance-stamped events
(actor ai/human per message) and export in the manifest. Offline: "ask anyway" queues
the question via the existing outbox infra; the answer lands on the pin when signal
returns. **No automatic reviews of any kind.** Nameplate OCR is not a feature: it's what
chat does when asked at a nameplate photo; systematic batch OCR belongs to the binder
builder (separate product).

**Product separation** — this repo is the inspection/capture tool. The binder builder
(report generation, research, task lists, visit-two planning, batch OCR) is a separate
future app/process. **The export manifest is the contract between them** (manifest v3:
zones, canvases, pins with anchors and numbers, checklist state, chats, misc, media).

## 4. What carries over vs. what's removed

**Carries over unchanged:** append-only event log + fold pattern; atomic capture
persistence (event + blob + outbox in one transaction); IndexedDB storage layer; crash
resume; export/zip/share pipeline with sha256 integrity; provenance stamping (actor
human/ai/system + model ids); the Netlify Function proxy + queue/backoff/idempotency
(repurposed from batch review to chat transport); PWA shell, wake lock, camera/audio
capture; Netlify deploy + CI + PR review; config-as-pure-data discipline (Zod, versioned,
content-hashed, pinned per session).

**Removed:** the slot-driven capture loop as the primary UX; Second look batch reviews
(v1a UI + trigger — the transport stays); the v1b nameplate-verify-card plan (absorbed
into chat + binder builder). The route-config schema is reworked into: zone-type
checklists + the component/pin-type library (the old "discovery spawning" templates,
repurposed). Old guidance text is reusable raw material; the structure is not a port.

## 5. Build stages (RoomPlan ships early — owner's priority)

**Stage 0 — RoomPlan spike (parallel with Stage 1; the risk retired first):**
Apple Developer Program ($99 USD/yr, needed for TestFlight) → GitHub Actions macOS CI
building an iOS shell → TestFlight to the owner's iPad → Capacitor wrapper around the
CURRENT app → thin Swift module: RoomPlan scan → CapturedRoom JSON → 2D top-down wall
projection → tappable plan handed to the web layer. Acceptance test: scan the owner's
utility room (deliberately RoomPlan's worst case: clutter, pipes, dim light) and the
main floor; evaluate plan quality; auto-pin candidates from RoomPlan's detected objects.

**Stage 1 — v2A pin model (web, days-scale, testable immediately on the existing PWA):**
zones created ad hoc; pins + anchors on photo canvases; global camera + inbox +
retagging; flags + layers; checklist audit with advisory close + close notes; text-first
notes (iPad dictation free in any text field); on-demand chat at pin/zone with recorded
threads + offline ask-anyway; manifest v3.

**Stage 2 — converge:** plan canvas from the RoomPlan module becomes the primary canvas;
plan anchors; auto-pins from scan objects (confirm/dismiss); room dimensions +
window/door counts into the zone record; manual rough-plan fallback.

**Stage 3 — exterior/site canvas, layer polish, binder-builder handoff hardening.**

## 6. Platform realities (read before Stage 0)

- Owner's iPad: iPad Pro 11" 3rd gen (2021, M1) — LiDAR ✓, iPadOS 26 ✓. RoomPlan
  requirements met.
- Owner's Mac confirmed (2026-07-22, from About This Mac): **MacBook Air 13" Early 2015
  (A1466), 1.6 GHz dual-core i5, 4 GB RAM, macOS Monterey 12.7.6** (its max stock
  macOS). **Old Xcode cannot deploy to an iPadOS-26 device**: iPadOS 17 replaced
  Xcode's device stack (CoreDevice), so Xcode 14.2 (Monterey's max) can compile
  RoomPlan code but cannot install to the iPad — and since 2026-04-28 Apple rejects
  every App Store Connect upload (TestFlight included) not built with Xcode 26 / the
  iPadOS 26 SDK. Downloading old Xcode (xcodereleases.com) does NOT solve this.
- Path decision (settled with the spec confirmation; detail in PLAN-STAGE-0.md §1):
  (a) **cloud CI + TestFlight, no local Mac in the loop** — the path, not just the
  baseline; (b) OpenCore Legacy Patcher is **ruled out** for this machine — a 2015 Air
  takes Sequoia fine, but modern Xcode's practical floor is 8 GB RAM and this Air has
  4 GB; (c) a used **M1 Mac mini** (~$300–400) stays the escape hatch only if local
  native debugging ever becomes load-bearing — not needed to start.
- RoomPlan honesty: weakest in cluttered unfinished utility rooms and useless outdoors —
  which is why photo anchors are first-class forever and the manual plan fallback exists.

## 7. Decisions log (settled — do not relitigate casually)

1. Free walk + advisory audit, not prescriptive slots. Zone close never blocks; it
   surfaces and records.
2. AI on demand only, scoped to pin/zone, conversations recorded. No automatic reviews.
3. Text + dictation primary input; voice notes optional.
4. One pin, many anchors; plan anchor canonical; photo-only allowed but audited.
5. Pin numbers are global, sequential, permanent (gaps OK after deletion).
6. Session-level misc bucket + retag-later everywhere.
7. RoomPlan ships early (Stage 0 spike), via Capacitor shell + cloud CI + TestFlight.
8. Inspection tool and binder builder are separate products; manifest v3 is the contract.
9. Foundations (event log, provenance, offline-first, config-as-data) are kept.

## 8. Open questions (good material for design sessions)

- Pin-type taxonomy: seed list and categories for the component library (start from the
  old conditional-block/component templates + Master Spec §7 inventory groups).
- Checklist content rework: turning the Baseline process doc into per-zone-type
  verification items (the big content task; old slot guidance is raw material).
- Zone taxonomy: free-form names vs. typed zones (typed helps checklist matching;
  free-form matches reality — likely: type + editable label).
- Multi-room scans / whole-floor merging (RoomPlan structure builder, iOS 17+): later.
- Chat model + cost: trivial at this scale; pick per task at build time.
- Manifest v3 schema details; binder-builder repo kickoff (separate effort).

## 9. How to use this doc

**New Claude Code session:** "Read docs/REDESIGN-v2.md and docs/HANDOFF.md, then plan
Stage 0 + Stage 1." The repo is the source of truth; HANDOFF.md covers the surviving
foundations in detail.

**Claude project (design discussions):** upload this file as project knowledge. It
contains everything decided through 2026-07-22; anything not in it (or the linked repo
docs) is not yet decided.
