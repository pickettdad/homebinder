# Stage 1 plan — v2A pin model on the web PWA (2026-07-22)

**What this is:** the build plan for REDESIGN-v2 §5 Stage 1, written against the actual
v1a codebase (every file named below exists and was read). Runs in parallel with Stage 0
(PLAN-STAGE-0.md); nothing here waits on TestFlight. Content source is
`docs/CHECKLIST-MASTER.md` as amended by `docs/CHECKLIST-MASTER-REVIEW.md` — the review's
runtime additions (N/A state, session items, `attest`) are build requirements here.

**Scope (in):** ad-hoc zones · pins + anchors on photo canvases · global camera + inbox +
retagging · flags + layers · checklist attachment + advisory audit + close notes ·
text-first notes · on-demand recorded chat at pin/zone with offline ask-anyway ·
manifest v3.
**Scope (out):** RoomPlan/plan canvases and auto-pins (Stage 2) · site-plan canvas
(Stage 3) · binder builder (separate product) · monthly/seasonal content passes ·
backup-operator hard-gate mode · any batch/automatic AI.

---

## 1. What carries, what inverts, what dies

**Carries unchanged:** `appendEvents()` single-writer atomic transaction
(`src/storage/sessionRepo.ts`) — events + blobs + outbox in one Dexie `rw` tx, seq from
`session.lastEventSeq`; the pure fold pattern; config pin-by-content-hash
(`configSnapshots` table, `canonical.ts`); crash-resume via refold + Web Lock; export
zip/share pipeline (`client-zip`, ≤250MB STORE chunks, per-file confirm); provenance
`Source` on every event; the review queue's transport mechanics (auth token, backoff
`[1s,5s,30s,120s,600s]` + jitter, `Idempotency-Key`, single-flight drain, 24s fetch
timeout, byte budget, `downscale.ts` verbatim); PWA shell (vite-plugin-pwa `prompt`
mode, wake lock, `PhotoInput`, `useVoiceRecorder`, `useMediaUrl`, `Sheet`/`BigButton`,
dark theme).

**Inverts:** `closeZone` currently **throws** on `gateOutstanding(zone).length > 0`
(`src/store/sessionStore.ts`). v2: close always succeeds; the audit surfaces and records.

**Dies:** slot machinery — `plan.ts` compile, `gate.ts`, slot-shaped selectors,
`route.baseline.ts` as the live config; screens `RouteScreen`, `CaptureScreen`,
`GateScreen`, `ExceptionSheet`, `SecondLook`; `enqueueZoneReview` + the `gate.review`
config field + `chunk.ts`; manifest v2's `slotStates`/`visitTwoGaps`/`aiReview`
sections. The deletion surface is exactly this list — the transport underneath it stays.

**Migration stance:** none. v2 sessions are a new model; v0.5/v1a sessions must be
exported before updating (the SW updates only on explicit tap via `UpdateBanner`, so the
owner controls timing). Old exports remain valid v2-manifest documents of their era.
Single-user reality; not worth machinery.

---

## 2. Config: the checklist pipeline (build this first)

New Zod schema `src/engine/schema/checklistConfig.ts` — the v2 analogue of
`routeConfig.ts`, same discipline (pure data, closed vocabularies, fail-closed
validation at startup + CI):

```
ChecklistConfig {
  configId: "checklists-baseline";  configVersion: semver;  // hash computed, not stored
  propertyFlags: {id, label, hint?}[]        // property.* — incl. the added property.gas
  zoneAttributes: {id, label, askAtCreation: boolean}[]   // zone.sleeping, zone.has_stairs, …
  zoneTypes: {id, label, inherits: baseListId[], typicalLabels: string[]}[]
  baseLists: {id, items: Item[]}[]           // interior-base, wet-base, rough-base, exterior-base
  zoneItems: {zoneTypeId, items: Item[]}[]
  sessionItems: Item[]                       // review §3.2 — alarm coverage, post-water-run checks
  componentTypes: {id, label, aliases?, items: Item[]}[]  // the §7 library, incl. stubs
  naReasons: {id, label, requiresNote?}[]    // successor of exceptionReasons
  layers: {id, label, predicate: {componentTypes?: string[], flags?: string[]}}[]
    // the named layer definitions (shutoffs, alarms, issues, …). In config — not app
    // code — because layers ARE binder artifacts (REDESIGN §3): the binder builder
    // must be able to derive the shutoffs map from the pinned snapshot alone.
}
Item {
  id; text; satisfy: "pin"|"check"|"note"|"measure"|"photo";
  tier: "core"|"standard"; scope: ("baseline"|"monthly"|"seasonal:…")[];
  attest: "evidence"|"action";               // review §3.3; DEFAULT "action" (fail safe)
  pinTypes?: string[];                       // review erratum 5 — array, any satisfies
  trigger?: WhenClause over property.*/zone.*/pin.*;      // closed vocabulary, allOf/anyOf/not
  guidance?; binder?: string[]; unit?;
}
```

**Generator (BUILT — step 1 landed):** `scripts/gen-checklists.mts` (pure lib in
`scripts/lib/genChecklists.ts`) parses the master's **v1.1 dialect**:
`id | text | satisfy | tier | attest [| scope] [| trigger]` for base/zone/session
tables (scope defaults to `[baseline]`), `id | text | satisfy | tier | attest` for §7
component tables (incl. shared headings serving multiple pin types and reserved-id
stubs), plus vocabulary tables A–D (property flags, zone attributes, N/A reasons,
layers) and the §4 taxonomy. Satisfy cells sub-parse pin types/alternatives and
`measure (unit)`; trigger cells sub-parse `a|b` as anyOf with namespace-prefix
inheritance; bold sub-headings become rendered-group keys on items (both decisions
recorded in review §6 pending §0 ratification). Malformed anything **fails closed**
naming the line. Emits `src/config/checklists.generated.ts` — **committed, not
gitignored** (deliberate divergence from the `gen-icons.mjs` pattern):
`tests/engine/checklists.test.ts` regenerates in-memory and asserts byte-identity,
schema validity, hash stability, and the content invariants (per-group core cap ≤ 8,
session items < 10); `validate:config` now runs it in CI. Session pinning reuses
`configSnapshots` verbatim: `SessionInitialized` carries
`configId`/`configVersion`/`configHash` exactly as today; `loadChecklists()`
(`src/config/loadChecklists.ts`) is the loader seam. The once-planned `overrides.ts`
is unnecessary — v1.1 authors everything the runtime needs.

---

## 3. Events + fold (the core of the stage)

`EVENT_SCHEMA_VERSION` → 2. New payloads join the `SessionEvent` union (old folds ignore
unknown types by design; v0.5 never sees v2 logs anyway). The `EventPayload` distributive
Omit, UUIDv7 ids, and appendEvents stamping all apply unchanged.

**Zones (now from events, not config):**
- `ZoneCreated {zoneId, zoneType, label, attributes: Record<attrId, boolean>}`
- `ZoneRenamed {zoneId, label}` · `ZoneRetyped {zoneId, zoneType}` (rare, allowed —
  checklist re-derives) · `ZoneAttributesSet {zoneId, attributes}`
- `ZoneClosed {zoneId, note?, audit: {coreUnresolved: itemId[], standardUnresolved: number,
  naCount: number}}` — payload replaces the v1 summary; `ZoneReopened` unchanged.

**Pins and anchors:**
- `PinCreated {pinId, pinNumber, zoneId?}` — `pinNumber` is the **global, permanent,
  never-reused** sequence: assigned from a new `session.lastPinNumber` counter inside
  the same transaction, the `lastEventSeq` pattern (gaps after deletion are fine per
  REDESIGN Decision 5). One mechanical note: `seq` is stamped by `appendEvents` as an
  EventBase field, while `pinNumber` lives in the *payload* — so this is a small
  `appendEvents` extension (fill the counter into `PinCreated` payloads in-tx) or a
  dedicated `createPin` repo function sharing the transaction. `zoneId` absent =
  session misc bucket.
- `PinTyped {pinId, componentType} | {pinId, freeform: label}` (also retype; REDESIGN
  §3 makes freeform a first-class type and the master's `utl.unidentified` depends on
  it — a freeform pin satisfies no `satisfy: pin` item, and pairs with chat per that
  item's "chat-asked") · `PinFlagged {pinId, flag: "fine"|"monitor"|"issue"|null}` ·
  `PinAssigned {pinId, zoneId?}` (retag/move) · `PinRetired {pinId, note?}`
  (append-only "delete"; number never reused)
- `AnchorPlaced {anchorId, pinId, canvasId, x, y}` (normalized 0–1 coords) ·
  `AnchorMoved {anchorId, x, y}` · `AnchorRemoved {anchorId}`

**Canvases:** `CanvasAdded {canvasId, zoneId, kind: "photo", media: CaptureMediaMeta}` ·
`CanvasRetired {canvasId}`. (Stage 2 adds `kind: "plan"` — the schema leaves room.)

**Media/notes, generalized from slot-addressing to target-addressing:**
`Target = {kind: "pin"|"zone"|"canvas"|"inbox", id?}`.
- `PhotoAdded {mediaId→CaptureMediaMeta, target}` · `VoiceNoteAdded {…, target,
  durationMs?}` · `MediaDiscarded {mediaId}` · `MediaReassigned {mediaId, target}` (the
  inbox→pin retag path) · `NoteAdded {noteId, target, text}` · `NoteEdited {noteId,
  text}` · `NoteReassigned {noteId, target}` (retag-later applies to notes too —
  REDESIGN §3's "everything is retaggable")
- The old `PhotoCaptured`/`VoiceNoteAttached` slot events are not reused — new names,
  no payload ambiguity.

**Checklist:**
- `ItemResolved {zoneId | scope:"session", itemId, resolution:
  {kind:"satisfied", via: "pin"|"check"|"note"|"measure"|"photo",
   evidence?: {pinId? | noteId? | mediaId? | value?, unit?}} |
  {kind:"na", reasonId, note?}}`
- `ItemReopened {zoneId | scope:"session", itemId}`
- **Derived vs recorded:** which items *exist* for a zone is pure derivation (zone type
  + inheritance + triggers over flags/attributes/pins) — never evented, so a config or
  pin change re-derives cleanly. Satisfaction is always **recorded** via
  `ItemResolved`, and the `attest` class governs how the tap happens — **attest always
  wins over satisfy kind**:
  - `attest: "evidence"` items: matching evidence (e.g. a typed pin for a
    `satisfy: pin` item) surfaces the item as **proposed-satisfied — one confirming
    tap** records it with the evidence link (review §3.3: software proposes, a human
    tap always confirms). Retiring the evidencing pin reopens the item.
  - `attest: "action"` items are satisfiable **only** by a deliberate human tap — no
    proposal, no derivation, no suggestion, ever. This includes `satisfy: pin` action
    items: creating a `sump-pump` pin never touches "bucket-tested"; creating a
    `garage-door` pin never touches "auto-reverse tested". The pin link may be
    *attached as evidence* when the human records the action, but the pin's existence
    proves nothing was performed. Action items are **tests** (owner decision in review
    §3.3): resolving one records a `result: "pass" | "fail"` + optional note in the
    evidence field — text-documented, no media expected — and a *fail* prompts
    creating an issue-flagged pin so the finding lands on the canvas.

**Chat:** `ChatMessageSent {threadId, target: pin|zone, text, mediaIds[]}` (actor
human) · `ChatReplyRecorded {threadId, model, text, usage}` (actor ai, actorId = model
id — the existing provenance doctrine) · `ChatFailed {threadId, jobId, code}`.

**Fold state v2** (`SessionState`): `zones: {zoneId, type, label, attributes,
closedAt?, closeNote?, canvases[]}[]` (open = no `closedAt`; there is no gate concept
in v2) · `pins: {pinId, number, zoneId?, type?, flag?, anchors[], photos[],
voiceNotes[], notes[], chatThreadIds[]}[]` · `inbox: CaptureRef[]` · `checklist:
derived+recorded item state per zone and session` · `chats` · `lastPinNumber` · plus
the unchanged session/provenance fields. Layers are evaluated by **selectors** against
the config's `layers` definitions — `selectors.ts` gains `layerPins(state, config,
layerId)`, `auditOutstanding(state, config, zoneId)`, `sessionAudit(state, config)`.

**Anchors stance for Stage 1** (REDESIGN §3 + Decision 4): the canonical-**plan**-anchor
rule cannot operate yet — plan canvases don't exist until Stage 2 — so the plan-anchor
nag is explicitly suspended. What the Stage 1 zone audit *does* flag: **pins with zero
anchors** ("unplaced pins" — easy to create via inbox→new-pin, legal per REDESIGN's
photo-anchors-may-exist-alone rule, but audited so they get placed before close).
Convergence note (the PLAN-STAGE-0 §7 pattern): Stage 2 activates the full
plan-anchor-canonical incompleteness audit when plan canvases arrive.

---

## 4. Storage (Dexie `version(3)`)

- `media`: `slotInstanceId` index replaced by nullable `targetKind`/`targetId` (upgrade
  fn maps old rows without loss — but note the v2 app does **not** render or export
  v0.5 sessions (§1 migration stance: export before updating); a leftover legacy
  session appears on Home as "legacy — delete only").
- `sessions`: add `lastPinNumber` (counter, bumped in-transaction).
- `chatJobs` table modeled on `reviewJobs` (`jobId` doubles as Idempotency-Key, status
  pending|inflight|done|failed, attempts, nextAttemptAt); `outbox.refType` gains
  `"chat"`.
- `reviewJobs` stays (dead reads are harmless; drop at a later cleanup version).
- Migration test in `tests/storage/` with fake-indexeddb, mirroring the existing
  sessionRepo atomicity test.

---

## 5. Screens and interaction (reusing the v0.5 kit)

Navigation stays the hand-rolled `Screen` union in `sessionStore.ts` — no router. New
union: `home · setup · walk · zone{zoneId} · pin{pinId} · canvas{canvasId} ·
inbox · audit{zoneId} · export`.

- **Setup** (reworked): property label + property.* flags from config. No room
  enumeration — zones are created on the walk.
- **Walk** (replaces RouteScreen): zone cards in creation order + "New zone" (type
  picker with `typicalLabels` + editable label + `askAtCreation` attributes) + misc
  bucket + inbox badge.
- **Zone**: canvas strip (wide photos; tap one → Canvas), pin list (number, type, flag),
  checklist panel split into two top-level sections — **Documentation** (attest:
  evidence) and **Tests** (attest: action) — never mixed (owner decision, review §3.3),
  each grouped per review verdict 3/4: core loud, standard quiet, satisfied collapsed.
  Close → **Audit sheet**: same Documentation/Tests split, unresolved core items loud,
  N/A affordance per item (reason + optional note), close note field, **"Close anyway"
  always enabled** (records `ZoneClosed` with the audit snapshot).
- **Canvas**: pinch-zoom photo (CSS transform container); tap → new pin (or place anchor
  for an existing pin); anchor dots show pin numbers; layer chips filter (`issues`,
  `shutoffs`, `alarms`, `receptacles`, `comparison`, `all`).
- **Pin sheet** (bottom sheet, reusing `Sheet`): number + type picker (zone-type-prior
  ordering — the deterministic suggestion of review §3.4 — plus a **freeform** entry,
  always available) + flag + photos (PhotoInput) +
  text notes (plain `<textarea>` — iPad dictation is free) + voice note (optional,
  never auto-start) + chat thread.
- **Global camera**: FAB mounted in `App.tsx` beside the existing overlay pills,
  visible on every in-session screen; captures land in **inbox** unless the current
  screen is a pin/zone, which becomes the default (changeable) target.
- **Inbox**: capture grid; multi-select → assign to zone / pin / new pin / misc.
- **Audit-at-session-close**: before `SessionCompleted`, run `sessionItems` (alarm
  coverage, post-water-run re-checks) with the same sheet.

---

## 6. Chat (repurposing the transport)

- New `netlify/functions/chat.mts` + `src/chat/protocol.ts` (`CHAT_API_VERSION = 1`):
  request `{jobId, scope: {kind: "pin"|"zone", snapshot}, thread: {role, text,
  images?}[]}` — server stays **stateless**; the client sends the whole thread each
  turn. Response `{jobId, model, text, usage}`. Reuses: `X-HS-Token` constant-time auth,
  daily cap, byte/image caps, error envelope (`protocol.ts` error codes carry over),
  `downscale.ts` for attached photos.
- Context assembly: pin scope = type, flag, notes, chosen photos (downscaled), zone
  label/type; zone scope = zone summary + pin index. System prompt keeps the
  `reviewCore.ts` doctrine — identify, never adjudicate; the word-lint survives as a
  reply post-filter.
- Model: default `claude-sonnet-5` (identification quality is the point; volume is a
  handful of asks per visit — cost negligible; intro pricing $2/$10 per MTok through
  2026-08-31), env-overridable like today. **Verified migration facts for `chat.mts`**
  (owner note 2026-07-23, confirmed against current API docs): omitting `thinking`
  runs **adaptive thinking by default** (leave it on — identification benefits);
  `budget_tokens` and non-default `temperature`/`top_p`/`top_k` are **rejected with a
  400** (`review.mts` sets neither — nothing to strip); the new tokenizer runs **~30%
  more tokens** for the same text vs Sonnet 4.6. Consequences: `max_tokens` must NOT
  be ported from `review.mts`'s 2000 — adaptive thinking counts against it, so a
  tight cap yields mostly-thinking + truncated answer; use ≥ 8192 and check
  `stop_reason == "max_tokens"` server-side. The byte caps (3.5 MB client budget,
  5.5 MB body, 20 images) are byte-based and carry over unchanged; the daily cap is
  request-based and carries over. No assistant prefill (irrelevant here — the thread's
  assistant turns are history, not a trailing prefill).
- Queue: `enqueueChat` writes `chatJobs` + outbox + `ChatMessageSent` in one
  transaction ("ask anyway" offline is therefore free); the existing drain triggers
  (online listener, visibilitychange, interval — currently in `App.tsx`) re-point to
  the chat drain. Reply applies idempotently in one tx (the `applyResponse` pattern:
  job-status guard + `ChatReplyRecorded` append + outbox sync).
- `review.mts`/`reviewCore.ts` are deleted with the SecondLook UI once chat lands
  (same PR, so the function surface never has two AI endpoints).
- **API base URL becomes configurable** (`VITE_API_BASE`, default same-origin `/api`) —
  the recon flagged that `capacitor://` origins break the same-origin assumption; doing
  it now costs nothing and unblocks Stage 0's shell pointing at Netlify.

## 7. Manifest v3 (the binder-builder contract)

`MANIFEST_SCHEMA_VERSION = 3`. Keeps the self-contained doctrine: full config snapshot +
verbatim event log + per-media sha256. Top level:

```
session (+ lifecycle[]: {type: completed|reopened, at, reason?} — the full
         complete/reopen history, so re-work is auditable, owner req 2026-07-24) ·
config (checklist snapshot + hash — includes the layers definitions) ·
zones[]: {zoneId, type, label, level?, attributes, closedAt?, closeNote?,
          canvases[], audit: {items: [{itemId, tier, attest, status:
          satisfied|na|unresolved, via?, evidence?, naReason?}]}} ·
pins[]:  {pinId, number, zoneId?, type?, label?, flag?, anchors[], mediaIds[],
          noteIds[], chatThreadIds[]} ·
sessionAudit · inbox[] (unassigned at export — explicitly listed, never dropped) ·
notes[] · chats[]: {threadId, target, messages[] with per-message Source} ·
media[] (paths: `media/<zone-or-_misc>/pin-<number>/<mediaId>.<ext>`; canvas photos
under `media/<zone>/_canvas/`; zone-targeted media with no pin under
`media/<zone>/_zone/`) · totals · orphanEvents · events
```

**Vocabulary telemetry (owner req 2026-07-24, manifest-only — no UI).** The type field on
each pin must make two things machine-identifiable so the component library can grow from
real usage:
- **Freeform types** are flagged distinctly with their verbatim text (e.g.
  `type: {kind: "freeform", label: "mystery box"}` — do NOT collapse to a bare string).
  Aggregated across visits, recurring freeform labels are the signal a new component type
  is warranted.
- **Nicknames** (`pin.label`) export as their own field, never merged into the type.
  Repeated nicknames under one component type are the split signal — three "softener"
  nicknames under `water-treatment` means `water-softener` wants its own component list.
  This is the empirical input to the CHECKLIST-MASTER-REVIEW §8 sub-type request; the
  taxonomy is decided in the content pass, not invented here.

Zip grouping stays per-zone (+ one `_misc`/inbox zip); `exportSession.ts` needs only the
grouping key and path fn swapped. Layer *views* need no separate manifest section
because the manifest carries both the ingredients (pins with type/flag/anchors) and the
definitions (the config snapshot's `layers`) — the binder builder derives the shutoffs
map / issues index from those two, and the schema comment says so.

## 8. Testing + acceptance

- Unit (Vitest, extending the existing suites): fold v2 (zones/pins/anchors/retag/
  audit derivation, orphan handling), trigger evaluation, generator round-trip +
  content-hash stability, audit selectors (core cap per group), manifest v3, chat queue
  idempotency + failure/backoff (port `review.test.ts` patterns), Dexie v3 migration.
- `validate:config` gains the checklist schema + drift check; CI job otherwise
  unchanged (ubuntu, node 22).
- Manual smoke on the deployed PWA at iPad viewport before handing to the owner (no
  committed e2e harness exists — unchanged posture).
- **Acceptance = field test 3** at the owner's house: free-walk 2–3 zones including the
  utility room; audit catches at least the known field-test-2 misses; close-with-note
  works one-handed; inbox retag round-trip; one chat from a nameplate photo (online +
  ask-anyway offline); export + verify sha256 chain; checklist noise judgment (core cap
  restatement — review verdict 3) explicitly reviewed with the owner.

## 9. Build order (each step lands green on CI)

1. ✅ Checklist schema + generator + generated config + drift CI (§2)
2. ✅ Events v2 + fold v2 + Dexie v3 + tests (§3–4) — app still renders v1 UI at this point
3. ✅ Walk/Zone/Pin/Canvas screens + global camera + inbox (§5) — field test 3 ran here
4. ✅ Checklist panel + advisory close + session audit (§5) — landed with the field-test-3
   feedback batch: zone storey levels, canvas stamp mode + anchor removal, searchable
   type picker, inbox delete/caption, wake-lock gesture retry, voice reframed as audio
   evidence. Video evidence noted as a future capture kind (owner request, not yet built).
5. Layers (selectors + canvas chips)
6. Chat: protocol, function, queue, pin/zone UI, offline path (§6)
7. Manifest v3 + export rework; delete slot machinery + SecondLook + review function (§1)
8. Deploy, smoke, field test 4

Steps 2–7 are the days-scale core; nothing blocks on Stage 0, and the moment step 3
exists the owner can walk a real zone on the installed PWA.

## 10. Risks

- **Checklist noise** is the load-bearing UX bet; the audit-sheet grouping + core cap
  restatement is falsifiable at field test 3 — plan for one content-tuning pass after.
- **Anchor placement precision** on photos needs pinch-zoom before tap; build the zoom
  container early in step 3, not as polish.
- **Master v1.1 dependency** is decoupled via generator overrides (§2), but the §7
  component-library normalization gates full component-item coverage — flag to owner.
- **Event-union growth**: 20+ new types in one stage; the fold stays a single pure
  function with per-type handlers, and unknown-type tolerance is already the contract.
- **Chat scope creep**: no streaming, no tools, no automatic anything — one request,
  one recorded reply, per the decisions log.
