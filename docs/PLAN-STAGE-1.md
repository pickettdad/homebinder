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
- **Interaction model — desk-side review is first-class (owner, 2026-07-25).** The likely
  *common* case is asynchronous: the inspector photographs and moves on in the field, then
  works through pins **at the desk that evening**. In-field chat is the exception (ask on
  site to capture more before leaving). So the thread is a normal pin/zone panel — full
  history, readable and continuable at a desk — **not** a one-handed field widget. The
  recorded-not-streamed design already fits this: an ask enqueues, a reply lands whenever
  it lands (evening, online), and the thread reads like a conversation either place.

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

**Pin flag vocabulary — declared here because this is its source (change request via owner,
2026-07-31).** §7 listed `flag?` in the shape above and never said what it could hold, so a
consumer transcribing this contract had nothing to transcribe. That is a defect in this
document, and the correction is the **full form**, not a list of today's values:

- **v3 vocabulary is `fine | monitor | issue`**, plus `null` for unflagged. Source of truth:
  `PinFlag` in `src/engine/v2/events.ts`; all three are settable in the shipping app
  (`PinScreen.tsx`). There is no config declaration — `propertyFlags[]` is an unrelated thing
  (house-level intake facts like `well`, `septic`), so a consumer cannot read this vocabulary
  out of the config snapshot and must take it from here.
- **`monitor` and `fine` retire at v4**, per the ratified Object/Concern model §1: monitoring
  is a severity decision about a *concern*, owned by the builder, not a property of an object;
  and "I looked and it's fine" is what a satisfied checklist item already records. `issue`
  decomposes the same way — object plus attached concern — so v4's pin flag is not a smaller
  enum so much as a retired concept.
- **Archived exports carry all three forever.** The event log is append-only and v3 exports are
  immutable, so the retirement shrinks what is *emitted*, never what exists. A consumer whose
  recognised set follows v4 will meet `monitor` and `fine` in historical data indefinitely, and
  must fail open — preserve, display, count, mark as unrecognised; never drop, never guess.

*Why the full form rather than the current list:* a contract stating three values today and two
tomorrow is stale by design, and the retirement date is already ratified. The same applies to
any vocabulary either side publishes — **state the schedule with the set, or the reader cannot
tell a value they should reject from one they simply have not met yet.**

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

**Owner decisions folded into step 7 (2026-07-25):**
- **A completed inspection is not "done" until it has been exported cleanly OUT of the app**
  (owner, refined 2026-07-25). Explicitly **not** "off device": saving the manifest + media into
  the iPad's Files counts. The point is that nothing can be lost *with the app* — getting the
  files onward to cloud/USB is the **next stage of the process**, not this gate. Verification =
  the pre-export integrity sweep passes **and** every produced file is confirmed handed off (the
  per-file `shared|downloaded` confirmation). A completed-but-unexported visit is surfaced loudly
  as "not yet exported"; the same export runs mid-visit as an **emergency backup**.
- **Provenance stays integrity-only** (owner, 2026-07-25) — and the *reasoning* is recorded so it
  isn't re-litigated: the threat model is **not** "someone altered the report," it is **"did you
  actually perform the inspection you billed for."** Timestamped events plus photos already answer
  that the way any ordinary business record does. Cryptographic signing matters only if
  HouseSteady is ever *accused of falsifying* a record — real but remote. So: per-media sha256 +
  config hash for corruption detection; a signed chain-of-custody is **deferred, not planned**.
  Revisit only if an actual dispute happens; do not build it on spec.
- **Pin moved to a different zone drops its anchors** (owner: "if a pin is legitimately moving
  zones, they'd need to be removed" — rare case). Anchors belong to a zone's canvases, so a
  cross-zone move clears the pin's `anchors[]`. This is a **fold rule** (`foldV2`), independent
  of export; add it where the pin-move/re-target event is handled, with a test.
- **RoomPlan is a launch requirement but parked** pending a *borrowed* Mac for local native
  debugging (owner: "yes … we'll park roomplan while I borrow"). Tracked in issue #36; not a
  step-7 concern.

### 7a. The manifest is a ROUND TRIP, not a one-way export (owner, 2026-07-25)

Field → binder builder is the manifest above. **Binder builder → field is a *session
plan***: a per-property, per-visit list of carried items imported at session start and
surfaced *alongside* the standard checklist:

- deferred / no-access gaps from prior visits, monitors due for re-measure, comparison
  positions due for re-shoot, owner-flagged follow-ups, equipment service verifications.

**Contract — specify both sides in step 7 even though the import can't be built until the
binder builder exists:**
- **Session plan is SESSION DATA, never config.** Config stays versioned /
  content-hashed / byte-identical everywhere; the session plan is per-property and must
  never touch the generated config or its hash. It rides in as its own import artifact,
  folds into session state as (probably) session-scoped items + pre-seeded pin
  expectations, and is provenance-tagged `system` with its source binder id.
- **Why this is load-bearing, not a nicety:** it is *the recurring-visit mechanism*. A
  monthly visit = standard monthly-scope items **+ this house's open items**. Without the
  import the app can only run generic visits — it can't know this house carried three
  deferred gaps and a monitor due for re-measure. Design the import shape now so step 7's
  manifest is the matching half of the contract.

### 7a-ii. The plan must carry INSPECTOR DECISIONS, not just identity (owner, 2026-07-28)

**Requirement, for when the import is built. Nothing to change today — the import does not
exist yet — but the reasoning is recorded here while it is fresh, because the failure it
prevents is silent and lands on visit two.**

> **The session plan must replay explicit zone attribute values, not just zone identity.**

**The case.** A bungalow with the furnace in a basement corner — the exact house
`mechanical-base` was built for. Visit one: the inspector creates a `basement` zone and ticks
`has_mechanicals`, an explicit `true`. Visit two: the plan recreates that zone. If it carries
identity but not attributes, the attribute arrives **absent**, falls through to the zone-type
default — and `basement` has none. **The mechanical checklist is empty on visit two.**

**Verified, not assumed:** `defaultsTrueFor` is `has_mechanicals → utility` and nothing else.
**Twelve of thirteen zone types have no default at all** — `basement`, `crawlspace`, `garage`,
`site`, and the rest. The derivation-level default (§17.4 of CHECKLIST-MASTER-REVIEW) rescues
`utility` zones only; it cannot rescue the case the feature exists for.

**Why this is worse than the visit-one version of the same bug.** On visit one an empty
mechanical list is visibly wrong. On visit two it reads as *"already handled last time."*
An empty list is indistinguishable from a completed one at a glance.

**Good news on scope: the export already carries both halves.** This is an obligation on the
*importer*, not a gap in the manifest.
- Zone attributes: `manifestV3` exports `zones[].attributes` verbatim (v3 §217).
- N/A reasons: `resolutions[]` carries the full `ItemResolution`, including
  `{kind:"na", reasonId}`. `no-access` and `deferred` are the two reasons with
  `feedsGapList: true`, and both survive the export intact.

So the plan builder has the data. The requirement is that it **replays** it.

**The general form, which will recur across the whole round trip:**

> **Anything the inspector decided that is not re-derivable from observation must survive the
> session plan, or it silently reverts to a default.**

Re-derivable state is safe to drop and recompute — pin proposals, audit counts, trigger
evaluation. *Decisions* are not: a zone attribute the inspector ticked, an N/A with a reason,
a deliberate `false` where a default would say true. The test for any field crossing the round
trip is simply: *could the app work this out again by looking at the house?* If no, it must be
carried explicitly.

**Acceptance test to write alongside the importer:** a `basement` zone with
`has_mechanicals: true` and an item resolved `na`/`deferred`, exported and re-imported, must
produce a mechanical checklist and a gap-list entry identical to the originating visit.

### 7a-iii. Two measured facts the importer must be built against (2026-07-31)

**Recorded for the same reason as 7a-ii: the import does not exist yet, but both facts are
easier to design around than to discover afterwards.** Both were measured against the reference
export (`config 1.2.1`) reviewing the binder's session-plan v0 contract, not assumed.

**1. A plan cannot answer a question that did not exist at the visit — so `unanswered` must be
computed at the RECEIVER, against the receiving config.**

The v1.2.1 config declares **five** zone attributes: `finished`, `sleeping`, `has_stairs`,
`has_plumbing`, `exterior_wall`. v1.11 declares **six** — `has_mechanicals` arrived in v1.6.1.
So a zone rebuilt from a v1.2.1-era plan arrives with `has_mechanicals` **absent**, and that is
the one attribute in the whole config carrying a `defaultsTrueFor` (→ `utility`). A basement
with the furnace in the corner therefore lands in exactly 7a-ii's failure — absent, no default,
empty mechanical checklist — and no emitter fix can prevent it, because the question did not
exist when the house was walked.

Consequence for the contract: an emitter cannot know the receiving config version, so an
emitter-computed "unanswered" list is a claim it is not positioned to make. At the receiver the
list is pure derivation — *attributes my config declares* minus *keys present in the verbatim
attribute map* — and both terms are already in hand. **Take the verbatim map; derive the rest
here.** (`defaultsTrueFor` is not merely empty in that config, it is an absent key — the field
did not exist yet.)

**2. `false` in a zone attribute map means "the box was not ticked," which is weaker than "the
inspector said no."**

Zone creation writes an explicit boolean for every `askAtCreation: true` attribute and nothing
at all for the others (`WalkScreen.tsx`):

```ts
const attributes: Record<string, boolean> = {};
for (const a of askAttrs) attributes[a.id] = attrs.has(a.id);
```

There is no skip path — the sheet is default-off toggles, so an untouched question and a
considered negative are both written `false`. The reference export shows the consequence: its
`bedroom` carries `finished: false, sleeping: false`, i.e. a bedroom that is neither finished
nor slept in. Those are three toggles left alone, not three answers.

This does **not** change the round-trip requirement — the verbatim map is still exactly right,
because it preserves the field's own state including its ambiguity. What it forbids is any
downstream text that renders `false` as *"we established there is none."* Only the field can
make `false` mean that, and doing so is a field change — a tri-state, or a confirm step at zone
close — **not** a plan-contract change. Scope it deliberately if the distinction ever needs to
carry weight; it is not scoped today.

### 7b. Equipment-registry guarantees (future third product: regional equipment analytics)

Cross-client regional equipment analytics is a future product; the manifest is its data
source, so every **equipment pin** must carry, guaranteed:
- **canonical component type** where one exists (not just the freeform/nickname);
- **verbatim nickname and freeform text** (already in §7 telemetry);
- a **nameplate photo reference** (the mediaId of the nameplate shot);
- any **age evidence** — install date, serial — captured as structured fields, not buried
  in a note.
- **Longitudinal identity: the join key is `pinId`, not the pin number (corrected 2026-08-04,
  F-29).** `pinId` is a uuid, minted offline at creation, permanent, and **adopted by the
  binder as canonical** rather than mapped to an id of its own — so there is no reconciliation
  layer and no server round trip in a basement. That is the field a cross-visit or
  cross-client aggregator joins on.

  **The human-facing pin number is session-scoped and restarts at #1 every visit.** The
  counter lives on the session row (`lastPinNumber`, stamped in-transaction by
  `appendEvents`), so a second visit to the same house mints #1 again for a different object.
  It is a label for saying *"pin #4"* out loud in a room, and it is sound for that.

  **What actually carries identity across visits is the session-plan import** (§7a), which is
  why the Object/Concern Model calls it the cross-visit identity mechanism rather than a
  convenience: without it a five-year-old leak is minted fresh every visit and nothing lines
  up.

*Superseded wording, kept so the correction is legible rather than silent:* this section
previously read *"permanent pin numbers already give a pin the same identity across visits."*
That is false, and it contradicted `DESIGN-OBJECT-CONCERN-MODEL` v1.1 §3, which is ratified,
binds both apps, and was verified in code. It survived because **nothing was built on it** —
the false sentence sat in the document a fresh session would read to understand the subject,
with the correction living in a header note somewhere else. Second instance in a fortnight of
that exact shape.

**Checked, not assumed (F-29 §4):** nothing in the field app reads or writes on the assumption
that a pin number is stable across visits — every use is within one session. The number is
displayed (`#N`), carried in the chat scope snapshot, used as an audit group label, and
exported as `pins[].number`. **The field app has no cross-visit surface at all**, since the
session-plan import does not exist yet, so there was nothing to break.

**One consequence that follows, and belongs here because §7b is the aggregator's contract:**
export media paths embed the pin number — `media/<zone-or-_misc>/pin-<number>/<mediaId>.<ext>`.
Those paths are therefore **unique within one export and will collide across visits to the
same property.** That is correct today (an export is one visit) and it means **an aggregator
must key media on `mediaId` and the owning `pinId`, never on the path.** The path is for a
human browsing a zip.

The other four guarantees above are unaffected by this correction and stand as written.

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
5. ✅ Layers (selectors + canvas chips) — config-driven layer predicates
   (`engine/v2/layers.ts`); canvas chip row filters anchor dots by flag/component
   type, only offering layers that match a pin on that canvas. Export layer views
   reuse the same predicate (per §7).
6. ✅ Chat: protocol, function, queue, pin/zone UI, offline path (§6) — recorded
   (not streamed) `claude-sonnet-5` assistant; `src/chat/{protocol,queue}.ts` +
   `netlify/functions/chat.mts` + `lib/chatCore.ts` (doctrine + word-lint backstop);
   pin-scoped `ChatPanel` (desk-side first-class); "ask anyway" offline via the
   ChatMessageSent-then-queue path; AI provenance on replies. Zone scope is wired
   through the engine; the zone-scope UI is a fast follow. (Note: the v1 SecondLook
   review function is retired in step 7, not here — chat runs alongside it until then.)
7. Manifest v3 + export rework; delete slot machinery + SecondLook + review function (§1)
8. Deploy, smoke, field test 4

Steps 2–7 are the days-scale core; nothing blocks on Stage 0, and the moment step 3
exists the owner can walk a real zone on the installed PWA.

### 9a. Capture mode — build order (2026-08-03)

Steps 1–8 above are **complete**. This is the continuation, against
`HouseSteady_Field-App_Capture-Mode_BuildSpec_2026-08-03.md`. Capture mode is **not a new
stage**: same data model, same manifest, one mode switch (orientation §5), so it belongs here
rather than in a plan of its own.

**§7's four defects are done** — the measure unit, the verdict on a measured value, the
authoring marks on screen (#72), and the brand palette (#73).

**Everything below is buildable without position (F-26/the Mac).** Ordering is Field Code's
call, per the design session 2026-08-03:

1. **Visit kind on `SessionInitialized`.** Nothing renders differently, but §1's mode has no
   trigger without it and every other item is downstream. **No correction event** — a fact
   about *what we came to do* is set by the schedule and never discovered in a basement, which
   is what distinguishes it from `PropertyFlagsCorrected` (a fact about the *house* that
   proved wrong on site). The log is append-only, so adding one later stays cheap if that is
   ever wrong.
2. **§5 notes internal by default.** Independent of everything, and the deliverable is a
   *data-model guarantee* rather than a UI change — "no code path sets a note client-visible"
   is a scan. It gets harder to assert once more note paths exist, so it is cheap now and
   dearer later.
3. **§2 the capture-mode screen, with §3's loop.** Not separable — the loop lives on the
   screen. The bulk of the work, and the hard part is **§2.1's *absent***: checklist and
   open-counts are currently woven through the zone screen rather than sitting in a panel that
   can simply be omitted. That is the refactor, not the new screen.
4. **§6 empty-zone reason at close**, with any existing resolution offered as a candidate and
   **never pre-filled**.

**Why this order:** 1 unblocks the rest; 2 is cheap now and dearer later; 3 is the bulk; 4
touches zone close, which 3 will already have moved. **If the Mac arrives mid-way, F-26 slots
into 3 without rework** — the pluggable frame source (CLAUDE.md, the browser-path rule) is the
same seam either way.

**Not in this sequence and deliberately so:** F-4's `scope[]` capture/inspection split is an
owner-authored content pass; inspection mode needs the session plan, which has no receiver;
the zone-attribute tri-state (F-20) is registered and out of scope.

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
