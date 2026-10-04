# 0055: Database tests fail in CI instead of skipping

Status: Open
Specs: [0045](../specs/0045-ci-once-per-change.md) AC-6 to AC-9 (added), [0007](../specs/0007-ci.md) AC-2 (relied on: the E2E job's
database step), [0024](../specs/0024-friends-sharing.md) AC-12 (the rules these tests check)

## Goal

Make the database tests fail, not skip, when CI cannot reach the local Supabase, so a failed start can never turn the security
tests green without running them.

## Done when

- [ ] One helper in `e2e/local-db.ts` decides skip or fail from `REQUIRE_LOCAL_DB`, and all three database test files use it:
      `tests/friends-migration.test.ts`, `tests/database-rules.test.ts` and `tests/seed-cleanup.test.ts` (which has its own
      `hasDatabase()` today)
- [ ] The E2E job's database step sets the variable and fails when no test ran or one was skipped
- [ ] The helper's own test and the repository test over the database test files exist
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

From a fresh-context review finding on 2026-10-04: the database tests skip silently when Docker cannot be reached; all database
test files share that behaviour (seed-cleanup through its own check), and it was offered as a follow-up ("Fail DB tests in CI instead of skipping").
