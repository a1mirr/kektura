# Specs

Every task (feature, behaviour change, non-trivial bug fix) gets a spec here **before** code. Specs are always written in English. The
spec is the contract; tests prove it; the Stop hook keeps it proven.

## Workflow

1. **Write the spec.** Copy [`_template.md`](_template.md) to `specs/NNNN-short-slug.md` (next free
   number), status `Draft`. Fill in the goal, the behaviour as numbered acceptance criteria
   (`AC-1`, `AC-2`, ...), what is out of scope and open questions. Each AC is one observable,
   testable statement: "given X, when Y, then Z".
2. **Agree on it.** Resolve the open questions and set status `Accepted` before implementing.
3. **Write the tests from the ACs.** `describe("spec NNNN: <area>")`, and every test title starts
   with the AC it covers (`it("AC-3: ...")`). An AC that can't be automated yet is listed as
   `manual` in the spec's coverage table, with how to check it.
4. **Implement** until `npm run check` (typecheck + lint + tests) is green.
5. **Close the spec**: status `Done`, coverage table filled in.
6. **Review with a fresh agent** before the pull request is merged ([0022](0022-fresh-context-review.md)):
   spawn the `fresh-reviewer` agent with only the spec number (`none` for a small change with no spec) and
   the base branch. It has none of your context and reads the spec and the diff like a stranger would. Fix
   its valid findings, answer the rest in the pull request, and review again after fixes that change code,
   tests or behaviour.

Changing existing behaviour means editing the spec that owns it (add/change/remove ACs) in the same
change as the code and tests. Never delete an AC number: mark it `Removed` so old references stay
meaningful. `git grep "AC-3" -- '*0001*' 'src' 'tests'` finds a criterion's spec and tests.

## Where tests live

| What | Where | Environment |
| --- | --- | --- |
| Domain logic (pure functions) | `src/lib/*.test.ts`, next to the module | Node |
| Server actions (Supabase mocked) | next to the action, e.g. `src/app/[locale]/dashboard/actions.test.ts` | Node |
| Client components | `src/components/*.test.tsx`, first line `// @vitest-environment jsdom` | jsdom + Testing Library |
| Cross-cutting checks (generated data, translations) | `tests/*.test.ts` | Node |
| User flows through the real app and database | `e2e/*.spec.ts` (Playwright, `npm run e2e`) | Test server (spec 0006) |

Async Server Components (pages) can't be rendered by Vitest: keep their logic in `src/lib` and test
it there, and cover the page-level behaviour with a few E2E tests. E2E tests sign in as a fresh
dummy user each (`signInAsNewUser` in `e2e/helpers.ts`), so they never depend on each other.

## Regression gate

`.claude/settings.json` runs [`.claude/hooks/stop-check.mjs`](../.claude/hooks/stop-check.mjs) whenever
Claude Code is about to finish a turn with changed source files: typecheck, lint and tests in
parallel. A failure is sent back to Claude to fix (up to 3 attempts, then you get a message). If app
code changed but no spec and no test did, it asks once for the spec/test update or a one-line reason
why none is needed. Run the same checks yourself with `npm run check`. E2E tests need Docker, so the
hook doesn't run them: run `npm run e2e` before committing changes to user flows.

## Index

| Spec | Area | Status |
| --- | --- | --- |
| [0001](0001-progress.md) | Progress: places, walked stretches, stats, stages | Done |
| [0002](0002-stamping.md) | Stamping: server actions and stamp buttons | Done |
| [0003](0003-map-route-planner.md) | Map lines and the route planner | Done |
| [0004](0004-trail-data.md) | Generated trail data and seeds | Done |
| [0005](0005-auth-routing-i18n.md) | Sign-in, routing, translations | Done |
| [0006](0006-test-server.md) | Test server with dummy login, E2E tests | Done |
| [0007](0007-ci.md) | CI, generated-types check, Dependabot | Done |
| [0008](0008-action-logging.md) | Server-side logging of failed stamp actions | Done |
| [0009](0009-fast-stamping.md) | Cached reference data, instant stamp buttons | Done |
| [0010](0010-typed-translations.md) | Typed translation keys | Done |
| [0011](0011-trailmap-split.md) | Split TrailMap, map E2E safety net | Done |
| [0012](0012-backups.md) | Weekly backup of production user data | Done |
| [0013](0013-extra-stamps-stages.md) | Extra stamps linked to stages | Done |
| [0014](0014-pages-and-settings.md) | Footer pages, account page, account deletion | Done |
| [0016](0016-stamp-dates.md) | Stamp dates: validation, own time zone, safe editing | Done |
| [0017](0017-feedback.md) | Feedback form with Telegram notifications | Done |
| [0018](0018-changelog.md) | Changelog page | Done |
| [0019](0019-useful-links.md) | Useful links page | Done |
| [0020](0020-origin-and-deploy.md) | Request origin behind the proxy; deploy files | Done |
| [0015](0015-about-page.md) | About page | Done |
| [0021](0021-pull-requests-only.md) | main only changes through pull requests (local pre-push guard; opening, merging and cleaning up after them with gh) | Done |
| [0022](0022-fresh-context-review.md) | A fresh-context agent reviews every change before it is merged | Done |
| [0023](0023-feature-flags.md) | Feature flags | Draft |
| [0024](0024-friends-sharing.md) | Sharing progress with friends | Done |
| [0025](0025-account-page.md) | Account page: sign out moves in, "Settings" becomes "Account" | Done |
| [0026](0026-automatic-deploy.md) | Automatic migrations and deploy after a merge | Draft |
| [0027](0027-feature-flags-via-telegram.md) | Switching feature flags from the Telegram bot | Draft |
| [0028](0028-landing-screenshots.md) | Screenshots on the landing page | Draft |
| [0029](0029-site-logo-link.md) | A logo that leads home, on every page | Draft |
| [0030](0030-faster-e2e.md) | Faster end-to-end tests: API sign-in, CI caches, timing report | Done |
| [0031](0031-e2e-sharding.md) | Sharded end-to-end tests: two parallel CI jobs | Draft |
