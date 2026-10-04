# 0045: CI runs once per change, and its database tests cannot skip

Status: Draft
Owner code: `.github/workflows/ci.yml`, `e2e/local-db.ts`, `tests/friends-migration.test.ts`, `tests/database-rules.test.ts`,
`tests/seed-cleanup.test.ts`

Amends, when built: [0007](0007-ci.md) Goal and AC-1 (the triggers) and AC-2 (the database step of the E2E job).
Owner code also: the script that reads the JSON report for AC-8 (`scripts/check-db-tests.mjs`, new).

## Goal

CI costs one run per change and never goes green having tested nothing. A change is tested once per pull request update
(the merge result), and once on `main` after a merge, not twice for the same commit. The database rule tests skip when
there is no local Supabase, which is right on a laptop without Docker and wrong in CI, where an unreachable database must
fail the job instead of letting every security test pass unrun.

## Behaviour

### One run per change

- **AC-1**: `ci.yml` is triggered by `pull_request` (every update of a pull request) and by `push` only on `main`. A push to
  a topic branch with an open pull request starts one CI run, not two. `pull_request` tests the result of merging the
  branch into `main`, the better signal for merging.
- **AC-2**: A merge into `main`, and a direct push to `main` (which the pre-push guard of spec 0021 refuses locally but
  GitHub does not), runs CI on `main`: it catches a bad merge and gives the deploy workflow (spec 0026 AC-1) a run to depend
  on.
- **AC-3**: The job names stay "Typecheck, lint, unit tests" and "End-to-end tests"; the merge step in `CLAUDE.md` and any
  required status checks refer to them by name.
- **AC-4**: A topic branch without a pull request is not tested by CI, and neither is a pull request that has a merge
  conflict (GitHub starts no `pull_request` run for it). `npm run check` and the Stop hook run the same checks locally,
  and a pull request is the workflow's next step.
- **AC-5**: A `concurrency` group per pull request cancels the earlier run when a new push arrives
  (`cancel-in-progress` for `pull_request`). Runs on `main` are grouped by commit (`github.sha`), never cancelled and never
  replaced by a later merge, so every merge commit is tested.

### Database tests that cannot skip

- **AC-6**: One shared helper (in `e2e/local-db.ts`, next to `localSupabase` and `psql`) decides what an unreachable
  database means ("reachable" is `localSupabase()`'s own probe, `supabase status`; `tests/seed-cleanup.test.ts` moves to it
  from its `docker exec` check) for every database test file: skip when the environment variable `REQUIRE_LOCAL_DB` is not set, **fail**
  with a clear message ("the local Supabase is not running: `npm run testdb:start`") when it is. Only the end-to-end job's
  database step sets it. No test file repeats that decision.
- **AC-7**: The first job ("Typecheck, lint, unit tests") has no database and keeps skipping: it does not set
  `REQUIRE_LOCAL_DB`, which is why AC-6 does not key on `CI` alone. Outside CI nothing changes: without Docker the tests
  skip and say why.
- **AC-8**: In CI, the database tests also fail if Supabase is running but lacks the schema a file expects, and CI's
  database step fails when the number of tests that ran is 0 or any of those files' tests was skipped, so a future file that
  forgets the helper cannot hide.
- **AC-9**: A test of the helper (pure, with the environment passed in) covers: not required and unreachable gives a skip;
  required and unreachable gives a failure with the message; reachable gives neither. All three database test files on
  `main` use it: `tests/friends-migration.test.ts`, `tests/database-rules.test.ts` (both import `e2e/local-db.ts` and call
  `ctx.skip()` themselves today) and `tests/seed-cleanup.test.ts` (which has its own `hasDatabase()` and does not import
  the helper). A repository test fails when a file under `tests/` that touches the database (imports `e2e/local-db.ts`, or
  defines its own reachability check) has a `ctx.skip()` or a `hasDatabase()` of its own instead of the helper.

## Out of scope

Running the database tests in the first job (it needs Docker and 15 more minutes); making the CI jobs required status checks
(a repository setting); caching to make the jobs faster; a second "branch as written" run.

## Open questions

- **Draft pull requests.** `pull_request` also runs on drafts. Skipping E2E for drafts would save more minutes but delay the
  signal. Leave it for now?
- **Other places that might set `REQUIRE_LOCAL_DB`.** This draft says only `.github/workflows/ci.yml` does, not the Stop
  hook or the pre-push hook (no Docker on the author's machine).

## Notes

- The proposed trigger: `on: { push: { branches: [main] }, pull_request: }`. `backup.yml` has its own schedule.
- The three files named in AC-9 are the ones CI's "Database rule tests" step runs (spec 0007 AC-2). Two skip through
  `local-db`'s `localSupabase()`, one through its own `hasDatabase()`.
- In vitest the pattern is `it("…", (ctx) => { if (!local) return ctx.skip(); … })`: a helper such as `requireDb(ctx)` that
  skips or throws replaces each of those lines.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-3, AC-5 | planned: `tests/ci-workflow.test.ts`, extended (it exists and asserts the old triggers; it parses `ci.yml`: triggers, job names, concurrency) |
| AC-2 | manual (a real GitHub Actions run): after the first merge, check that a run on `main` exists. Last checked: never recorded. |
| AC-4 | manual (a real GitHub Actions run): push a branch without a pull request and check that no run starts. Last checked: never recorded. |
| AC-6, AC-7, AC-9 | planned: `tests/local-db-helper.test.ts` and a repository test over the database test files |
| AC-8 | planned: `tests/ci-workflow.test.ts` (the step runs the check of AC-8 and sets `REQUIRE_LOCAL_DB`) and a unit test of the script that reads the JSON report (0 run, one skipped, all ran); manual (a real GitHub Actions run) for the whole: stop the Supabase step on a throwaway pull request and check that the database step fails. Last checked: never recorded. |
