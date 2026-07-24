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

**Pull requests — one per run, always.** Every run ends with an open PR into the
default branch for that run's commits (owner decision 2026-07-25: "work I can't see is
work I can't test" — the owner merges, which triggers the Netlify deploy to the test
device). Never leave commits stranded on the branch with no PR. Reuse the run's open PR
if one already exists; otherwise open a fresh one.

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

## Commands

`npm test` · `npm run typecheck` · `npm run validate:config` ·
`npm run gen:checklists` · `npm run build`
