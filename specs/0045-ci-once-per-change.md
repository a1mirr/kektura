# 0045: CI runs once per change, and its database tests cannot skip

Status: Draft
Owner code: `.github/workflows/ci.yml`, `e2e/local-db.ts`, every `tests/*-migration.test.ts` (today
`tests/friends-migration.test.ts`)

Folds into [0007](0007-ci.md) (AC-1, the triggers; and the E2E job's steps) when it is built.

## Goal

CI should cost one run per change and should never go green having tested nothing. Today `ci.yml` triggers on both `push`
and `pull_request`, so a commit pushed to an open pull request runs both jobs twice (typecheck, lint and unit tests; and the
heavy end-to-end job with its Docker Supabase). And the database rule tests skip themselves when the local Supabase cannot
be reached (`if (!local) return ctx.skip()`): right on a laptop without Docker, wrong in CI, where a failed `supabase start`
would end the job green with every security test skipped.

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
- **AC-4**: A topic branch without a pull request is not tested by CI. `npm run check` and the Stop hook run the same
  checks locally, and a pull request is the workflow's next step.
- **AC-5**: A `concurrency` group per ref cancels the earlier run of a pull request when a new push arrives
  (`cancel-in-progress` for `pull_request`, not for `main`).

### Database tests that cannot skip

- **AC-6**: One shared helper (in `e2e/local-db.ts`, next to `localSupabase` and `psql`) decides what an unreachable
  database means for every database test file: skip when the environment variable `REQUIRE_LOCAL_DB` is not set, **fail**
  with a clear message ("the local Supabase is not running: `npm run testdb:start`") when it is. Only the end-to-end job's
  database step sets it. No test file repeats that decision.
- **AC-7**: The first job ("Typecheck, lint, unit tests") has no database and keeps skipping: it does not set
  `REQUIRE_LOCAL_DB`, which is why AC-6 does not key on `CI` alone. Outside CI nothing changes: without Docker the tests
  skip and say why.
- **AC-8**: In CI, the database tests also fail if Supabase is running but lacks the schema a file expects, and CI's
  database step fails when the number of tests that ran is 0 or any of those files' tests was skipped, so a future file that
  forgets the helper cannot hide.
- **AC-9**: A test of the helper (pure, with the environment passed in) covers: not required and unreachable gives a skip;
  required and unreachable gives a failure with the message; reachable gives neither. A repository test fails when a file
  that imports `../e2e/local-db` lacks the helper or has a `ctx.skip()` of its own.

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
- A review finding led to the second half: three database test files share the skip; only
  `tests/friends-migration.test.ts` is on `main` today, and the helper must cover the others when they land.
- In vitest the pattern is `it("…", (ctx) => { if (!local) return ctx.skip(); … })`: a helper such as `requireDb(ctx)` that
  skips or throws replaces each of those lines.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-3, AC-5 | planned: `tests/ci-workflow.test.ts` (parses `ci.yml`: triggers, job names, concurrency) |
| AC-2 | manual (a real GitHub Actions run): after the first merge, check that a run on `main` exists. Last checked: never recorded. |
| AC-4 | manual (a real GitHub Actions run): push a branch without a pull request and check that no run starts. Last checked: never recorded. |
| AC-6, AC-7, AC-9 | planned: `tests/local-db-helper.test.ts` and a repository test over the database test files |
| AC-8 | planned: the CI step in `ci.yml`; checked by CI itself (a deliberately broken run is the check) |
