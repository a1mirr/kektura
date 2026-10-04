# 0044: End-to-end tests at phone width, and accessibility checks

Status: Open
Specs: [0006](../specs/0006-test-server.md) AC-10, AC-11 (added)

## Goal

The fresh reviewer is told to look for regressions on 375 px screens and for no-JS pages, and a mobile overflow bug
has already reached the code once (branch `fix/dashboard-mobile-overflow`), but every E2E test runs as desktop
Chrome at the default size, and nothing looks at accessibility. Turn the reviewer's reading into tests.

## Done when

- [ ] A Playwright project `mobile` (375 × 812, touch) that runs the tests tagged `@mobile` (AC-10), with the no-horizontal-scroll assertion in a helper
- [ ] `@axe-core/playwright` (a dev dependency) and an `e2e/a11y.spec.ts` for the pages of AC-11, with the allow-list of today's violations (rule, page, reason) that can only shrink
- [ ] The existing violations are listed honestly, not hidden; the biggest ones are fixed in this task or get tasks of their own
- [ ] The extra tests do not make the "End-to-end tests" job slower by more than a minute, measured on three runs; if they do, the project runs on one shard or sharding (the draft 0031 idea) is picked up
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- The tests that sign in each use a fresh user (`signInAsNewUser`) and wait for hydration (`expandAllStages`) before
  clicking, as the other E2E tests do.
- Native browser UI and real screen-reader behaviour stay `manual`; axe finds roughly a third of accessibility problems, not all.
