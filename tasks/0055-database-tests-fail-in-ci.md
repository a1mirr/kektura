# 0055: Database tests fail in CI instead of skipping

Status: Open
Specs: [0007](../specs/0007-ci.md) AC-2 (the database step), [0024](../specs/0024-friends-sharing.md) AC-12 (the rules these tests check)

## Goal

Make the database tests fail, not skip, when CI cannot reach the local Supabase, so a failed start can never turn the security
tests green without running them.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] One helper in `e2e/local-db.ts` decides skip or fail from `REQUIRE_LOCAL_DB`, and all three database test files use it:
      `tests/friends-migration.test.ts`, `tests/database-rules.test.ts` and `tests/seed-cleanup.test.ts` (which has its own
      `hasDatabase()` today)
- [ ] The E2E job's database step sets the variable and fails when no test ran or one was skipped
- [ ] The helper's own test and the repository test over the database test files exist
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0054 and 0055 (R-1 to R-9).

### Database tests that cannot skip

- [ ] **R-6**: One shared helper (in `e2e/local-db.ts`, next to `localSupabase` and `psql`) decides what an unreachable
  database means ("reachable" is `localSupabase()`'s own probe, `supabase status`; `tests/seed-cleanup.test.ts` moves to it
  from its `docker exec` check) for every database test file: skip when the environment variable `REQUIRE_LOCAL_DB` is not set, **fail**
  with a clear message ("the local Supabase is not running: `npm run testdb:start`") when it is. Only the end-to-end job's
  database step sets it. No test file repeats that decision.
- [ ] **R-7**: The first job ("Typecheck, lint, unit tests") has no database and keeps skipping: it does not set
  `REQUIRE_LOCAL_DB`, which is why R-6 does not key on `CI` alone. Outside CI nothing changes: without Docker the tests
  skip and say why.
- [ ] **R-8**: In CI, the database tests also fail if Supabase is running but lacks the schema a file expects, and CI's
  database step fails when the number of tests that ran is 0 or any of those files' tests was skipped, so a future file that
  forgets the helper cannot hide.
- [ ] **R-9**: A test of the helper (pure, with the environment passed in) covers: not required and unreachable gives a skip;
  required and unreachable gives a failure with the message; reachable gives neither. All three database test files on
  `main` use it: `tests/friends-migration.test.ts`, `tests/database-rules.test.ts` (both import `e2e/local-db.ts` and call
  `ctx.skip()` themselves today) and `tests/seed-cleanup.test.ts` (which has its own `hasDatabase()` and does not import
  the helper). A repository test fails when a file under `tests/` that touches the database (imports `e2e/local-db.ts`, or
  defines its own reachability check) has a `ctx.skip()` or a `hasDatabase()` of its own instead of the helper.

## Out of scope

Running the database tests in the first job (it needs Docker and 15 more minutes); making the CI jobs required status checks
(a repository setting); caching to make the jobs faster; a second "branch as written" run.

## Open questions

- **Other places that might set `REQUIRE_LOCAL_DB`.** This task says only `.github/workflows/ci.yml` does, not the Stop
  hook or the pre-push hook (no Docker on the author's machine).

## Tests to write

| Requirement | Test |
| --- | --- |
| R-6, R-7, R-9 | planned: `tests/local-db-helper.test.ts` and a repository test over the database test files |
| R-8 | planned: `tests/ci-workflow.test.ts` (the step runs the check of R-8 and sets `REQUIRE_LOCAL_DB`) and a unit test of the script that reads the JSON report (0 run, one skipped, all ran); manual (a real GitHub Actions run) for the whole: stop the Supabase step on a throwaway pull request and check that the database step fails. Last checked: never recorded. |

## Spec changes

Filled in when the task is built.

## Notes

From a fresh-context review finding on 2026-10-04: the database tests skip silently when Docker cannot be reached; all database
test files share that behaviour (seed-cleanup through its own check), and it was offered as a follow-up ("Fail DB tests in CI instead of skipping").

- The three files named in R-9 are the ones CI's "Database rule tests" step runs (spec 0007 AC-2). Two skip through
  `local-db`'s `localSupabase()`, one through its own `hasDatabase()`.
- In vitest the pattern is `it("…", (ctx) => { if (!local) return ctx.skip(); … })`: a helper such as `requireDb(ctx)` that
  skips or throws replaces each of those lines.

Code the work touches: `.github/workflows/ci.yml`, `e2e/local-db.ts`, `tests/friends-migration.test.ts`, `tests/database-rules.test.ts`, `tests/seed-cleanup.test.ts`
