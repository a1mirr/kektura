# 0039: Audit the manual coverage rows

Status: Done
Specs: [0034](../specs/0034-specs-and-tasks.md) AC-8, AC-11 (new), and the coverage tables of 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0012, 0016, 0020, 0021, 0022, 0024, 0026, 0033

## Goal

A `manual` row is an AC that nobody re-checks, so it drifts. About 50 rows across the specs said "manual" without
saying why, and none said when the check was last made. Turn every one that a test can replace into a test, give
the rest a reason, a way to check and a date, and make the rule mechanical.

## Done when

- [x] Every manual row was looked at; the ones a test could replace became tests (see Spec changes)
- [x] The rest say `manual (reason)` and `Last checked: <date | never recorded | every pull request>` (0034 AC-11), and `tests/specs.test.ts` fails on a row of a Done or Accepted spec that doesn't
- [x] The reviewer re-checks the manual rows of the areas a change touches (0034 AC-8; the reviewer's brief, `CLAUDE.md`, `specs/README.md`)
- [x] The spec of the deploy (0026) is `Done`: a merge deployed by itself (run 37158189942)

## Spec changes

New tests for what was manual:

- 0007 AC-1 to AC-7 (the CI jobs, caches, report; Dependabot): `tests/ci-workflow.test.ts`
- 0012 AC-1 to AC-3 (the backup workflow), and that every table the migrations create is dumped or excluded: `tests/backup-workflow.test.ts`; the restore drill (AC-4) was run again with six tables
- 0002 RLS and 0006 AC-1 (seed counts): `tests/database-rules.test.ts`, run by CI's `e2e` job against the local database
- 0002 AC-10, AC-11 (map popup), AC-13, AC-14, AC-15, AC-16 (the date field waits for the server, no optimistic stats, the reference data is read from the database once): `e2e/map.spec.ts`, `e2e/stamping.spec.ts`
- 0003 AC-9, AC-12, AC-13, AC-16 (detailed route request and retry, popup saves, the extras layer, the map keeps its place): `e2e/map.spec.ts`
- 0001 AC-5 (month labels, tooltip) and AC-11 (controls on their own right-aligned line): `e2e/account.spec.ts`, `e2e/stamping.spec.ts`
- 0005 AC-4 and 0020 AC-3 (the callback's failure paths and the address it redirects to): `e2e/auth.spec.ts`
- 0006 AC-4 (no dummy login on the public address): the deploy workflow's smoke test now POSTs to `/auth/test-login` and expects 404 (0026 AC-8)
- 0033 AC-5: `tests/stamp-descriptions.test.ts`

Still manual, with a reason: 0002 advisors, 0003 canvas checks (line colours, amber highlight, restaurants, "Show in list"),
0004 AC-9, the success path of the OAuth callback (0005 AC-4, 0020 AC-3), 0006 AC-2, 0016 AC-9 (the native picker),
0021 AC-6, 0022 AC-3, 0024 AC-15, 0026 AC-4 and AC-13 against a real database, AC-5 and AC-9, 0034 AC-10.

## Notes

- Most remaining rows say "never recorded": that is the truth, not a gap in the audit. The date is only written by
  whoever did the check; the browser pane could not draw the map canvas reliably, so the canvas rows stay undated.
- The backup (0012) has never run on GitHub yet and would have failed on its first run: `profiles`, `friendships`
  and `user_feedback` were on neither list. The owner chose to back up `profiles` and `friendships` and exclude
  `user_feedback` (its messages also reach the developer's Telegram); the test above keeps this from happening again.
