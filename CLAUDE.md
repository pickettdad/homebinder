# CLAUDE.md

HouseSteady Field Assistant — offline-first iPad inspection PWA. Orientation order:
`docs/REDESIGN-v2.md` (the model), `docs/PLAN-STAGE-0.md` / `docs/PLAN-STAGE-1.md`
(build plans), `docs/CHECKLIST-MASTER.md` (checklist content — owner-edited, versioned).

## Standing rules

**Owner reports — "For David" section.** Every report to the owner ends with a section
titled **For David**, written for a non-programmer: what changed in field/inspection
terms, what decisions are needed from him and in what plain-language form, and what
happens next. Technical detail goes above that section, never in it.

**Verification budget.** The owner budgets API and usage spend during the build.
Default to single-session work with self-review; do not launch multi-agent
workflows/fleets unless the owner explicitly opts in for a specific task. Quality
still ships: CI gates stay green, and claims are verified before they're reported.
(The in-product inspection AI is exempt — it earns money; pick the best working
option there.)

**Config discipline.** `src/config/checklists.generated.ts` is generated from
`docs/CHECKLIST-MASTER.md` (`npm run gen:checklists`) — never hand-edit it; CI fails
on drift. The master itself is edited by the owner's side, never unilaterally here;
defects become change-requests in `docs/CHECKLIST-MASTER-REVIEW.md`. Same rule as
`route.baseline.ts`: config is data, ids are never renamed or reused.

**Tests state the invariant, not the inventory (2026-07-28).** A test that enumerates what
currently exists fires on every legitimate addition; a test that states what must hold does
not. This has cost two builds: the alias test asserted *some alias carries capitals* (never a
rule — just a fact about that version's data), and the provenance test asserted the *exact*
four Table I rows, so adding two correct ones failed CI. Write `every transcribed value has a
row, and every row's source is a photo capturable on the same pin` — which holds at seven rows
and at seventy. Where a floor is genuinely wanted (a retired id must never return, a known row
must not vanish), assert *containment*, never equality.

**Move keeps the id; redefine retires it (owner rule 2026-07-26).** An item that *moves* to a
different list but asks the same question — same text, same `attest` — keeps its id; the
prefix goes historical and that is fine, ids are opaque (`liv.egress`, `bsm.finished-behind`).
An item that is *redefined* — different question, or different `attest`, even in the same slot
— **retires**, and its replacement takes a new id (`bth.toilet-secure`, a check/action test,
→ `bth.toilet`, a pin/evidence linkage item). Restoring an id across a redefinition would let
a past pass/fail render as satisfying a different question: **false continuity is worse than
an honest orphan** — a stale test result silently vouching for something nobody checked.
A retired id is never reissued; `tests/engine/checklists.test.ts` enforces that.

**Master editing — whole file, never dictated edits (owner rule 2026-07-26).** Whoever
authors a master version produces the **complete file**. Dictated edits applied here as a
transcription are what forked v1.2.1: those six edits existed only in the repo, the owner's
copy stayed at v1.2, and v1.3 was written on top of it — silently reverting all six, one of
which (Table B `askAtCreation`) broke the generator outright. Corollaries: (1) **before the
owner authors a new version, send them the current repo copy** — they will not write blind;
(2) after applying any owner-adjudicated cell change here, bump the patch version and send
the file back, so the repo copy and the owner's copy never diverge again. A dictated edit
feels efficient and creates exactly the downstream fork the "never edited downstream"
discipline exists to prevent.

**Pull requests — one per run, always.** Every run ends with an open PR into the
default branch for that run's commits (owner decision 2026-07-25: "work I can't see is
work I can't test" — the owner merges, which triggers the Netlify deploy to the test
device). Never leave commits stranded on the branch with no PR. Reuse the run's open PR
if one already exists; otherwise open a fresh one.

**Re-base before pushing; verify ancestry after (2026-07-31, after three strandings).**
`git fetch origin main` and restart the branch from it **before** the first commit of any
turn, then after pushing run `git merge-base --is-ancestor <sha> origin/main` — the
one-command yes/no on whether the work actually reached main. Both, every turn.

*Why this shape.* Three PRs stranded the same way (#65/#66, #67/#68, and one before). The
tempting diagnosis is a race — the owner merging while a push is in flight — and the
tempting fix is announcing "safe to merge" at the end of a message. **The timestamps refute
it:** #67 merged at 01:34 UTC and the stranding commit was pushed at 12:33 UTC, eleven hours
later, onto a branch this session had not re-fetched. The failure is at the *start* of a
turn, not the end, so any end-of-turn signal misses it entirely. Announce "nothing further
to push" anyway — it removes real ambiguity mid-turn — but it is not the fix and must not be
mistaken for one. The owner merges on their own schedule between turns; that is correct and
the local branch must assume it happened.

*The general form:* **a PR's state is not a fact you can cache across a turn boundary.**
Same class as reusing a stale config reading — checked once, quoted later as if verified.

**The ancestry check does not answer the PR question (2026-08-07, fourth stranding).** `git
merge-base --is-ancestor <sha> origin/main` answers *"did this reach main"* and **nothing else**.
It was run, it correctly said "not in main", and that was read as "waiting in the open PR" —
but the PR had merged an hour earlier and the commit was in no PR at all. A stranded commit and
a commit awaiting review are **indistinguishable** by ancestry; they differ only in whether a PR
exists.

**So the end-of-turn check is two commands, not one:** ancestry *and* an open-PR list. If
ancestry says not-in-main and the PR list is empty, the work is stranded — open one. Never infer
a PR's existence from a commit's absence from main.

*And it is the message that gets it wrong.* "Nothing further to push, safe to merge" was said
four times against a PR that did not exist. **Naming the PR number in that sentence forces the
lookup** that would have caught it, so say "PR #N is safe to merge" and never the bare phrase.

**The browser path is a control, not a shipping surface (2026-08-03).** The concierge runs
the **native shell**; the walk that cleared the durability gate ran on TestFlight build 13.
The browser/PWA path **stays runnable and does not stay at capture parity** — no position, no
native viewfinder. It lands in the **declared no-position state** that Capture Mode spec §4
already requires for rooms RoomPlan cannot scan, so it is not a second implementation of the
same act; it is the degraded mode the contract carries anyway.

*Why it stays runnable at all, and it is not convenience:* when the native app black-screened
(#71), the question that halved the problem fastest was *"does the web version do the same?"*
A dev path that cannot run the app is not a control. Keeping it working is cheap; keeping it
at parity is not, and nothing requires it.

**Do not spend effort on browser-side capture parity.** Build one capture component with a
pluggable frame source — native viewfinder when `isNativePlatform()` (`src/app/platform.ts`),
`<input capture>` otherwise — so only frame acquisition differs and the loop, buttons and
post-capture path are shared. This is written here rather than left in a chat because an
unstated decision gets rediscovered as a question.

**The capture prompt names objects and places, never conditions (doctrine 2026-08-08).** The
Discovery capture prompt reads the property flags declaring `field` in Table A, and what it may
name is bounded: *pool*, *EV charger*, *generator*, *secondary suite* — **things that exist and
can be photographed.** It may not name a condition. `prior_water_entry` is the case that fixes
the line: a prompt reading *prior water entry* sends the concierge looking for damage, **which
is inspection wearing a capture label**, on the one visit that is deliberately capture-only. It
declares `binder`, and the fact reaches the desk where looking hard at basement photographs is
the right job.

*This is the test every future flag gets*, and it is the guard on a column that would otherwise
quietly re-import the classification-during-capture the three-visit redesign removed.

**A copy stays only if it has a named consumer (design ruling 2026-08-08).** The repo keeps **no
copy of a document that is replaced wholesale** — roadmaps, registers, State of Understanding
cuts. `docs/reference/` held one such copy, the 2026-08-07 roadmap, and was removed the next day
because a stale copy of a wholesale-replaced file is indistinguishable from a current one.

**But "design-session authored" is not the test — "replaced wholesale" is.** A carried document
with a named consumer stays. `docs/HouseSteady_Field-App_Capture-Mode_BuildSpec_2026-08-03.md`
and `docs/HouseSteady_Field-Track_Orientation_2026-08-03.md` **stay**: they are one-time specs
the code was built against, not status documents, and **nineteen test names cite them by section
number** — that citation is the named consumer. Deleting them orphans the references.

*The distinction is the whole rule.* Sweeping by author would have taken the specs the tests
point at; sweeping by "does it rot" takes exactly the files that rot.

**Docs the design session needs — flag them and hand over the file (owner rule 2026-08-03).**
Committing a doc to the repo does **not** deliver it. The design session does not read this
repo; the owner carries files between tracks by hand. So any turn that **creates or edits a
doc the design session needs to act on**, say so plainly and **attach the file**, rather than
describing the change and leaving the PR to speak for it. A PR body is a record for whoever
merges, not a delivery to another session.

*Two failure modes this prevents, both already observed.* A doc created here that the owner
has never seen looks, from their side, like an artifact that appeared without warning — and
they have to ask what it is. And a decision written into a repo doc the design session never
reads is invisible exactly where it was supposed to be binding, which is the "unstated
decision" failure with an extra step.

**Issue hygiene.** Docs (`REDESIGN-v2`, `PLAN-STAGE-*`, `CHECKLIST-MASTER-REVIEW`) carry
*planned* work; the GitHub Issues tab carries *field defects that aren't fixed the same
turn*. A defect found in testing and deferred becomes an issue; planned build steps never
do. Close an issue the same turn its fix ships.

**Chat model — pinned, upgraded deliberately.** The in-product assistant's model is **not**
hard-coded in a way that can drift. It reads from the Netlify env var `HS_CHAT_MODEL`; the
source only carries a `DEFAULT_CHAT_MODEL` fallback (`netlify/functions/chat.mts`), currently
`claude-sonnet-5`. Claude model ids are **pinned release snapshots by design** — the dateless
form (`claude-sonnet-5`) is a *fixed* release, not an evergreen "-latest" pointer, and a newer
model ships under a *new* id. Pinning is also required for us: the export manifest stamps the
model id on every recorded reply, so a silent model swap would corrupt the provenance record.
**Upgrade procedure (config change + deliberate test, never automatic):** (1) set
`HS_CHAT_MODEL` to the new id in Netlify → redeploy; (2) run one live chat and confirm the
reply's stamped model id is the new one and the answer quality holds; (3) update the
`DEFAULT_CHAT_MODEL` constant + this line to match, so source and config agree. Never bump the
model as a side effect of unrelated work. (Sonnet 5 note: omit `budget_tokens`/sampling — both
400; `thinking:{type:"disabled"}` is accepted and is how the proxy keeps replies under Netlify's
function timeout.)

**Stage 0 native shell — hard-won invariants.** (1) The CI **App Store Connect API key must
have the Admin role** — App Manager can create a Development cert but *not* the iOS Distribution
cert that TestFlight signing needs (the build fails at export otherwise). (2) The native build
**must set `VITE_API_BASE`** to the Netlify origin (`ios-testflight.yml`, from `vars.HS_API_BASE`)
— its own origin is `capacitor://localhost`, which has no functions, so a same-origin `/api`
falls back to the local bundle and the assistant silently never reaches the server. (3) Because
the shell calls Netlify cross-origin, `netlify/functions/*` carry **CORS headers + an `OPTIONS`
preflight**. (4) `ITSAppUsesNonExemptEncryption=false` is injected into `Info.plist` in CI (HTTPS
only) so export compliance auto-answers. The hello-shell milestone is **complete** (2026-07-24).

## Commands

`npm test` · `npm run typecheck` · `npm run validate:config` ·
`npm run gen:checklists` · `npm run build`
