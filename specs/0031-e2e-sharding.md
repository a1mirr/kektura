# 0031: Sharded end-to-end tests

Status: Draft
Owner code: `.github/workflows/ci.yml`, `scripts/slowest-tests.mjs`

## Goal

The `e2e` job is the longest check of every pull request (about 4 to 5 minutes). Its tests already run as fast as the
2-core runner allows: more Playwright workers in one job were slower (spec 0030 AC-5, 162 s against 143 s), because
Next, Postgres and Chromium use both cores. The only way left to use more cores without a paid runner is more jobs.
Split the suite across two parallel jobs (Playwright `--shard`), so the check finishes in roughly 3 minutes, and
keep what depends on the check's name working.

## Behaviour

- **AC-1**: The `e2e` job is a matrix of two shards; shard N runs `npx playwright test --shard=N/2` against its own
  local Supabase and its own build of the test server. Together the shards run every test exactly once.
- **AC-2**: The check keeps its name. A final job named `End-to-end tests` depends on all shards (`needs`, and
  `if: always()`) and fails unless every shard succeeded, so branch protection and `CLAUDE.md` step 7 (which name
  "Typecheck, lint, unit tests" and "End-to-end tests") keep working. The shard jobs themselves have other names
  (`E2E shard 1/2`, `E2E shard 2/2`).
- **AC-3**: The checks that need the database but not the tests (`types:check`, the friends-migration rule tests
  of spec 0024) run once, in shard 1 only, not in both.
- **AC-4**: Each shard saves its own Playwright report and JSON report under a name that includes the shard number
  (the report is uploaded when the shard fails), and prints its own slowest-tests table to its job summary
  (spec 0030 AC-4). The browser and Next build caches of spec 0030 AC-3 are shared by both shards and still drop
  `fetch-cache` after the restore.
- **AC-5**: It is only kept if it is faster. The spec's Notes record the E2E check's wall time (pull request event,
  caches restored) on at least three runs before and three after; if the median is not clearly lower, sharding is
  not merged.

## Out of scope

More than two shards (each shard repeats about 2 minutes of setup, so a third gains little), a paid larger runner,
and changes to the tests themselves.

## Open questions

- Is the extra runner time acceptable? Two shards use about 2 minutes more of runner time per run (the setup is
  done twice).
- Should the shards be balanced by test duration rather than by Playwright's default split (by file)? The friends
  and map files are the slowest; a bad split could leave one shard much longer than the other.
- Branch protection: does it require the check by name? If the aggregating job is not enough, the owner has to
  change the required check in the repository settings.

## Notes

Numbers from spec 0030 (single job, 2-core runner): whole job 4 m 00 s to 4 m 52 s; of that Supabase start about
60 s, npm ci about 15 to 20 s, browser install about 17 s, build about 13 s with a cache hit, tests about 120 s.
Two shards would give about 60 s of tests plus the same setup, so roughly 3 minutes, if the split is even.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | manual: the `Running N tests` lines of both shard logs add up to the suite size |
| AC-2 | manual: the pull request shows one `End-to-end tests` check; failing a shard on purpose in a throwaway branch fails it |
| AC-3 | manual: `types:check` and the rule tests appear only in the shard 1 log |
| AC-4 | manual: both shard summaries list their slowest tests; a failed shard uploads its report |
| AC-5 | manual: the before/after table in Notes |
