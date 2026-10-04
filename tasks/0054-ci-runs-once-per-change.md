# 0054: CI runs once per change

Status: Open
Specs: [0007](../specs/0007-ci.md) Goal, AC-1 (the triggers), [0026](../specs/0026-automatic-deploy.md) AC-1 (relied on)

## Goal

Stop every commit pushed to an open pull request from running both CI jobs twice: trigger on `pull_request` and on `push` to
`main` only, cancel superseded runs of a pull request, and keep the job names.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] `ci.yml` has the new trigger and a concurrency group, and `tests/ci-workflow.test.ts` checks them
- [ ] Everything that says CI runs "on every push" says pull request updates and `main` instead: `CLAUDE.md` (workflow intro),
      `README.md` (the `npm run check` bullet), spec 0007 (its Goal and AC-1) and the test that matches the trigger
- [ ] After the first merge, a run on `main` exists (the manual check under "Tests to write" is dated)
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0054 and 0055 (R-1 to R-9).

### One run per change

- [ ] **R-1**: `ci.yml` is triggered by `pull_request` (every update of a pull request) and by `push` only on `main`. A push to
  a topic branch with an open pull request starts one CI run, not two. `pull_request` tests the result of merging the
  branch into `main`, the better signal for merging.
- [ ] **R-2**: A merge into `main`, and a direct push to `main` (which the pre-push guard of spec 0021 refuses locally but
  GitHub does not), runs CI on `main`: it catches a bad merge and gives the deploy workflow (spec 0026 AC-1) a run to depend
  on.
- [ ] **R-3**: The job names stay "Typecheck, lint, unit tests" and "End-to-end tests"; the merge step in `CLAUDE.md` and any
  required status checks refer to them by name.
- [ ] **R-4**: A topic branch without a pull request is not tested by CI, and neither is a pull request that has a merge
  conflict (GitHub starts no `pull_request` run for it). `npm run check` and the Stop hook run the same checks locally,
  and a pull request is the workflow's next step.
- [ ] **R-5**: A `concurrency` group per pull request cancels the earlier run when a new push arrives
  (`cancel-in-progress` for `pull_request`). Runs on `main` are grouped by commit (`github.sha`), never cancelled and never
  replaced by a later merge, so every merge commit is tested.

## Out of scope

Running the database tests in the first job (it needs Docker and 15 more minutes); making the CI jobs required status checks
(a repository setting); caching to make the jobs faster; a second "branch as written" run.

## Open questions

- **Draft pull requests.** `pull_request` also runs on drafts. Skipping E2E for drafts would save more minutes but delay the
  signal. Leave it for now?

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3, R-5 | planned: `tests/ci-workflow.test.ts`, extended (it exists and asserts the old triggers; it parses `ci.yml`: triggers, job names, concurrency) |
| R-2 | manual (a real GitHub Actions run): after the first merge, check that a run on `main` exists. Last checked: never recorded. |
| R-4 | manual (a real GitHub Actions run): push a branch without a pull request and check that no run starts. Last checked: never recorded. |

## Spec changes

Filled in when the task is built.

## Notes

Proposed by the owner on 2026-10-04: run `push` only for `main` and keep a run on every pull request update, which tests the
merge result, plus a run on `main` after a merge. A branch without a pull request gets no CI run: accepted.

- The proposed trigger: `on: { push: { branches: [main] }, pull_request: }`. `backup.yml` has its own schedule.

Code the work touches: `.github/workflows/ci.yml`, `e2e/local-db.ts`, `tests/friends-migration.test.ts`, `tests/database-rules.test.ts`, `tests/seed-cleanup.test.ts`
