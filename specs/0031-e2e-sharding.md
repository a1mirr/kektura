# 0031: Sharded end-to-end tests

Status: Draft
Owner code: `.github/workflows/ci.yml`, `scripts/slowest-tests.mjs`

## Goal

The `e2e` job is the longest check of every pull request (about 4 to 5 minutes). Its tests already run as fast as the
2-core runner allows: more Playwright workers in one job were slower (spec 0007, notes: 162 s against 143 s), because
Next, Postgres and Chromium use both cores. The only way left to use more cores without a paid runner is more jobs.
Split the suite across two parallel jobs (Playwright `--shard`), so the check finishes in roughly 3 minutes, and
keep what depends on the check's name working.

## Behaviour

- **AC-1**: The `e2e` job is a matrix of two shards; shard N runs `npx playwright test --shard=N/2` against its own
  local Supabase and its own build of the test server. Together the shards run every test exactly once. The matrix sets `fail-fast: false`, so a failing
  shard never cancels the other one: both always finish and report, and a run shows every failure at once.
- **AC-2**: The check keeps its name. A final job named `End-to-end tests` depends on all shards (`needs`, and
  `if: always()`) and fails unless every shard succeeded (a cancelled or skipped shard counts as failed). That gives a
  pull request one E2E result to read, keeps the job names `CLAUDE.md` step 7 names ("Typecheck, lint, unit tests"
  and "End-to-end tests") true, and means a branch protection rule turned on later needs no change. The shard jobs
  themselves have other names (`E2E shard 1/2`, `E2E shard 2/2`).
- **AC-3**: The checks that need the database but not the tests (`types:check`, the friends-migration rule tests
  of spec 0024) run once, in shard 1 only (`if: matrix.shard == 1`), not in both.
- **AC-4**: Each shard saves its own Playwright report and JSON report under a name that includes the shard number
  (the report is uploaded when the shard fails), and prints its own slowest-tests table to its job summary
  (spec 0007 AC-7). The browser and Next build caches of spec 0007 AC-6 are restored by both shards and still drop
  `fetch-cache` after the restore. Both shards have the same cache key, so only the first to finish can save it
  (the other logs a harmless "Unable to reserve cache" warning); to avoid the noise only shard 1 saves.
- **AC-5**: It is only kept if it is faster. The spec's Notes record the E2E check's wall time (pull request event,
  caches restored) on at least three runs before and three after; if the median is not clearly lower, sharding is
  not merged.

## Out of scope

More than two shards (each shard repeats about 2 minutes of setup, so a third gains little), a paid larger runner,
and changes to the tests themselves.

## Open questions

- Is the extra runner time acceptable? Two shards use about 2 minutes more of runner time per run (the setup is
  done twice).
- Is Playwright's default split even enough? `fullyParallel: true` is set, so it shards individual tests, not files,
  and the slow friends and map tests spread over both shards. Check the two shards' times on the first real runs;
  only if they differ a lot is a hand-made split worth it.

## Notes

Numbers from task 0030 (single job, 2-core runner): whole job 4 m 00 s to 4 m 52 s; of that Supabase start about
60 s, npm ci about 15 to 20 s, browser install about 17 s, build about 13 s with a cache hit, tests about 120 s.
Two shards would give about 60 s of tests plus the same setup, so roughly 3 minutes, if the split is even.

Specs that say "the `e2e` job" and become wrong when this lands, and are reworded in the same change as the workflow:
`0007-ci.md` AC-2, AC-3, AC-6 and AC-7 (one job runs `npm run e2e` and `types:check`; one job, one JSON report, one
summary) and the pointer in `0006-test-server.md` AC-6; `CLAUDE.md` step 7 only if the
check's name changes.

`main` has no branch protection (the repository is private on the free plan, where GitHub offers neither protection
rules nor rulesets: the settings API answers 403 "Upgrade to GitHub Pro or make this repository public"), so no check
is required by name today and CI gates merges only by the convention in `CLAUDE.md` step 7. The aggregating job of
AC-2 is therefore for readability and for the day protection is switched on, not a requirement of it. Spec 0021 owns the pull request rules and says why protection
is off; if that changes, this note goes stale.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | manual: the `Running N tests` lines of both shard logs add up to the suite size |
| AC-2 | manual: the pull request shows one `End-to-end tests` check; failing a shard on purpose in a throwaway branch fails it |
| AC-3 | manual: `types:check` and the rule tests appear only in the shard 1 log |
| AC-4 | manual: both shard summaries list their slowest tests; a failed shard uploads its report |
| AC-5 | manual: the before/after table in Notes |
