# 0060: End-to-end tests at phone width, and accessibility checks

Status: Open
Specs: [0006](../specs/0006-test-server.md) (two ACs are added when this is built)

## Goal

The fresh reviewer is told to look for regressions on 375 px screens and for no-JS pages, and a mobile overflow bug
has already reached the code once (branch `fix/dashboard-mobile-overflow`), but every E2E test runs as desktop
Chrome at the default size, and nothing looks at accessibility. Turn the reviewer's reading into tests.

## Requirements

- The suite also runs at a phone's width. A second Playwright project, `mobile` (Chromium, 375 × 812, touch,
  `isMobile`), runs the tests tagged `@mobile` (the tag keeps it cheap): the landing page and the dummy sign-in,
  stamping a place on the dashboard, the stage list, the map page, the friends page and the account page. Each
  asserts that the page does not scroll sideways (`document.documentElement.scrollWidth <= window.innerWidth`) and
  that the page's main action is visible and can be clicked.
- The pages are checked for accessibility with axe (`@axe-core/playwright`): the landing page in all three
  locales, the dashboard, the account, friends and changelog pages, at the desktop width and at the phone width.
  A page with a `serious` or `critical` violation fails its test. A violation that exists today is listed in one
  allow-list with the rule, the page and the reason; the list can only shrink: a test fails when an allow-listed
  rule no longer fires, so it is removed.

## Done when

- [ ] A Playwright project `mobile` that runs the tests tagged `@mobile`, with the no-horizontal-scroll assertion in a helper
- [ ] `@axe-core/playwright` (a dev dependency) and an accessibility spec under `e2e/` for the pages above, with the allow-list of today's violations (rule, page, reason) that can only shrink
- [ ] The existing violations are listed honestly, not hidden; the biggest ones are fixed in this task or get tasks of their own
- [ ] The extra tests do not make the "End-to-end tests" job slower by more than a minute, measured on three runs; if they do, the project runs on one shard or sharding (the idea of spec 0031) is picked up
- [ ] The requirements are written into spec 0006 as ACs, with their coverage rows (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- The tests that sign in each use a fresh user (`signInAsNewUser`) and wait for hydration (`expandAllStages`) before
  clicking, as the other E2E tests do.
- Native browser UI and real screen-reader behaviour stay `manual`; axe finds roughly a third of accessibility problems, not all.
