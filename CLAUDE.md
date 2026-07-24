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

## Commands

`npm test` · `npm run typecheck` · `npm run validate:config` ·
`npm run gen:checklists` · `npm run build`
