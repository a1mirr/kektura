# 0054: CI runs once per change

Status: Done
Specs: [0007](../specs/0007-ci.md) Goal, AC-1, AC-2, AC-8 (reworded), AC-9 and AC-10 (added); [0026](../specs/0026-automatic-deploy.md) AC-1 (relied on, one sentence added); [0022](../specs/0022-fresh-context-review.md) AC-5 (the "Review recorded" job, unchanged)

## Goal

Stop every commit pushed to an open pull request from running both CI jobs twice: trigger on `pull_request` and on `push` to
`main` only, cancel superseded runs of a pull request, and keep the job names. Also stop paying for the end-to-end job on a
pull request that changes only Markdown. Both save GitHub Actions minutes: the repository is private on the Free plan, 1,309
of the 2,000 monthly minutes were used by 2026-10-04, and the counter resets on 1 November.

## Done when

- [x] The open questions below are settled with the owner before any code is written
- [x] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [x] `ci.yml` has the new trigger and a concurrency group, and `tests/ci-workflow.test.ts` checks them
- [x] A pull request that changes only Markdown skips the "End-to-end tests" job (R-10): `scripts/ci-changes.mjs`, the `code_changed` output of the check job, `e2e` with `needs` and `if`; `tests/ci-changes.test.ts` and `tests/ci-workflow.test.ts` check it
- [x] Everything that says CI runs "on every push" says pull request updates and `main` instead: `CLAUDE.md` (workflow intro, and what green means in steps 2 and 7),
      `README.md` (the `npm run check` bullet), spec 0007 (its Goal and AC-1) and the test that matches the trigger
- [x] Task 0031 (sharding) says in its Notes that it is parked
- [ ] ~~After the first merge, a run on `main` exists (the manual check under "Tests to write" is dated)~~ Not something a pull request can do: it needs the merge. The `manual` rows of spec 0007 AC-9 and AC-10 say `Last checked: never recorded` until whoever looks at the first runs after the merge dates them.
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)
- [x] Fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0054 and 0055 (R-1 to R-9) and this task's addition (R-10).

### One run per change

- [x] **R-1**: `ci.yml` is triggered by `pull_request` (every update of a pull request) and by `push` only on `main`. A push to
  a topic branch with an open pull request starts one CI run, not two. `pull_request` tests the result of merging the
  branch into `main`, the better signal for merging.
- [x] **R-2**: A merge into `main`, and a direct push to `main` (which the pre-push guard of spec 0021 refuses locally but
  GitHub does not), runs CI on `main`: it catches a bad merge and gives the deploy workflow (spec 0026 AC-1) a run to depend
  on.
- [x] **R-3**: The job names stay "Typecheck, lint, unit tests" and "End-to-end tests"; the merge step in `CLAUDE.md` and any
  required status checks refer to them by name.
- [x] **R-4**: A topic branch without a pull request is not tested by CI, and neither is a pull request that has a merge
  conflict (GitHub starts no `pull_request` run for it). `npm run check` and the Stop hook run the same checks locally,
  and a pull request is the workflow's next step.
- [x] **R-5**: A `concurrency` group per pull request cancels the earlier run when a new push arrives
  (`cancel-in-progress` for `pull_request`). Runs on `main` are grouped by commit (`github.sha`), never cancelled and never
  replaced by a later merge, so every merge commit is tested.

### Only what the change needs

- [x] **R-10** (added by the owner on 2026-10-04): a pull request whose changed files are all Markdown (`*.md`) skips the
  "End-to-end tests" job, including its database rule tests and generated-types check. The cheap "Typecheck, lint, unit tests"
  job always runs (it already runs `tests/specs.test.ts` and the review-process tests, which guard the Markdown files). Any
  non-Markdown change in the diff runs everything. On `push` to `main` everything always runs: the deploy workflow depends on a
  successful CI run of the merge commit (spec 0026 AC-1), and a skipped end-to-end job must neither break nor wrongly trigger
  it. A skipped job shows as skipped; no check is required today, so what a skipped "End-to-end tests" means for the merge
  step of `CLAUDE.md` is written down: green means passed, or skipped for a Markdown-only pull request. "Review recorded"
  keeps working unchanged.

## Out of scope

Running the database tests in the first job (it needs Docker and 15 more minutes); making the CI jobs required status checks
(a repository setting); caching to make the jobs faster; a second "branch as written" run; sharding the end-to-end tests
(task 0031, parked).

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3, R-5 | `tests/ci-workflow.test.ts` (spec 0007 AC-9: the triggers, the concurrency group, the job names) |
| R-10 | `tests/ci-changes.test.ts` (the decision, the files of a real merge commit, the script's output) and `tests/ci-workflow.test.ts` (spec 0007 AC-10: the step, the output, `needs` and `if`, the end-to-end job runs for every push, no extra job) |
| R-2 | manual (a real GitHub Actions run): after the first merge, check that a run on `main` exists with both jobs. Last checked: never recorded. |
| R-4 | manual (a real GitHub Actions run): push a branch without a pull request and check that no run starts. Last checked: never recorded. |
| R-10 (on GitHub) | manual (real pull requests): a Markdown-only pull request shows "End-to-end tests" as skipped. Last checked: never recorded. |

## Spec changes

- [0007](../specs/0007-ci.md): Goal and AC-1 reworded (pull request updates and pushes to `main`); AC-2 says `e2e` waits for
  `check` and is skipped for a Markdown-only pull request; AC-8 says the job may be skipped for one; new section "Once per
  change, and only what the change needs" with **AC-9** (triggers, a run on `main`, no run for a branch without a pull request,
  the concurrency group, the job names, drafts run CI) and **AC-10** (Markdown-only pull requests skip `e2e`, how it is
  detected, a push always runs everything, what skipped means for the merge step); Owner code, Out of scope, a note on why
  (the Actions minutes) and the Coverage table (AC-9, AC-10 and three `manual` rows, `Last checked: never recorded`).
- [0026](../specs/0026-automatic-deploy.md) AC-1: one sentence (CI always runs both jobs on a push to `main`); the coverage row
  names `tests/ci-workflow.test.ts`.
- [0022](../specs/0022-fresh-context-review.md) and `specs/README.md`: wording only ("every pull request update", skipped
  allowed for a Markdown-only pull request). No AC of spec 0022 changed.
- Not spec text: `CLAUDE.md` (workflow intro, steps 2 and 7), `README.md`, `.github/pull_request_template.md` (its checklist line
  says "or skipped because only Markdown changed").

## Notes

Proposed by the owner on 2026-10-04: run `push` only for `main` and keep a run on every pull request update, which tests the
merge result, plus a run on `main` after a merge. A branch without a pull request gets no CI run: accepted.

- Draft pull requests (the open question): the owner answered on 2026-10-04 that they stay as they are, they run CI.
- The R-numbers: tasks 0054 and 0055 share R-1 to R-9, so the Markdown-only requirement is R-10.
- Design: the detection is a step of the `check` job (a job is billed in whole minutes, so a separate "detect changes" job would
  cost at least one more). `scripts/ci-changes.mjs` lists the changed files of the merge commit GitHub checks out for a pull
  request (`HEAD^1` to `HEAD`, which needs a checkout of depth 2) and writes `code_changed` to the job output. It answers `true`
  when it cannot tell. `e2e` has `needs: check`, so it also starts after `check`, about a minute later, and a failed `check`
  stops it (`if` without a status function implies `success()`).
- The deploy workflow (spec 0026 AC-1) reacts to a completed CI run on `main` with conclusion `success`. On `main` the `e2e`
  condition is true (the event is a push), so both jobs run there; a failed `check` skips `e2e` and the run fails.
- `backup.yml` has its own schedule.

Code the work touches: `.github/workflows/ci.yml`, `scripts/ci-changes.mjs`, `tests/ci-workflow.test.ts`, `tests/ci-changes.test.ts`, `tests/review-recorded.test.ts`
