# Specs

A spec is the contract of one **area**, a part of the product or of how the project is run, written as it behaves
**now**: numbered acceptance criteria, each one observable and testable. The tests prove it, the Stop hook keeps it
proven, and after every change the spec is edited until it mirrors the code again.
Specs are always written in English.

The work that changes an area is a **task** ([`tasks/`](../tasks/README.md)): why, which specs it touches, what is
done when. A task is history and never says how the product behaves; a spec never tells the story of a change.
Both folders share one number sequence (next number = the highest in `specs/` and `tasks/` plus one). Details:
[0034](0034-specs-and-tasks.md). A quick test for where a sentence belongs: will it still be true in a year if
nobody touches it? Yes: spec. No: task.

## Workflow

1. **Write or edit the spec.** A new area: copy [`_template.md`](_template.md) to `specs/NNNN-short-slug.md`,
   status `Draft`. A change to an existing area: edit the spec that owns it (add, change or remove ACs). Fill in
   the goal, the behaviour as numbered acceptance criteria (`AC-1`, `AC-2`, ...), what is out of scope and open
   questions. Each AC is one observable, testable statement: "given X, when Y, then Z". Then open the task
   (`tasks/NNNN-slug.md`) that lists the spec; a refactor or a CI change is only a task, a trivial fix needs
   neither.
2. **Agree on it.** Resolve the open questions and set status `Accepted` before implementing.
3. **Write the tests from the ACs.** `describe("spec NNNN: <area>")`, and every test title starts
   with the AC it covers (`it("AC-3: ...")`). An AC that can't be automated yet is listed as
   `manual` in the spec's coverage table: `manual (why it can't be automated): how to check it. Last checked: <date>`
   (spec 0034 AC-11). Prefer a test; a manual row is the exception, and its date is written by whoever did the check.
4. **Implement** until `npm run check` (typecheck + lint + tests) is green.
5. **Make the spec true.** Reread every spec the task touches against the code as built and edit it to mirror
   reality: an AC for behaviour that exists and no AC states, `Removed` for an AC that was dropped, status `Done`,
   the coverage table, the index below. Where code and spec disagree, decide which is right and fix that one.
   Write what changed in the task's "Spec changes" section and set the task `Done`.
6. **Review with a fresh agent** before the pull request is merged ([0022](0022-fresh-context-review.md)):
   spawn the `fresh-reviewer` agent with only the task number (the spec number for a change that is only a spec,
   `none` for a small change with neither) and the base branch. It has none of your context and reads the specs
   and the diff like a stranger would, in both directions. Fix its valid findings, answer the rest in the pull
   request, and review again after fixes that change code, tests or behaviour.

Never delete an AC number: mark it `Removed` so old references stay meaningful. `git grep "AC-3" -- '*0001*'
'src' 'tests'` finds a criterion's spec and tests. A spec found to disagree with the code at any other time is a
defect: correct it at once when that is small, otherwise open a task.

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
code changed but no spec did, it asks once whether behaviour changed (then the spec and its tests are
updated) or not (then say so in one line). Run the same checks yourself with `npm run check`. E2E tests need Docker, so the
hook doesn't run them: run `npm run e2e` before committing changes to user flows.

## Index

| Spec | Area | Status |
| --- | --- | --- |
| [0001](0001-progress.md) | Progress: places, walked stretches, stats, stages, extra stamps in stages | Done |
| [0002](0002-stamping.md) | Stamping: server actions, stamp buttons, cached reference data | Done |
| [0003](0003-map-route-planner.md) | Map lines, the route planner and how the map code is structured | Done |
| [0004](0004-trail-data.md) | Generated trail data and seeds | Done |
| [0005](0005-auth-routing-i18n.md) | Sign-in, routing, translations, typed message keys | Done |
| [0006](0006-test-server.md) | Test server with dummy login, E2E tests and how they sign in | Done |
| [0007](0007-ci.md) | CI, E2E caches and timing report, generated-types check, Dependabot | Done |
| [0008](0008-action-logging.md) | Server-side logging of failed actions | Done |
| [0012](0012-backups.md) | Weekly backup of production user data | Done |
| [0014](0014-pages-and-settings.md) | Footer pages, account page (sign out, chart, account deletion) | Done |
| [0016](0016-stamp-dates.md) | Stamp dates: validation, own time zone, safe editing, the yyyy-mm-dd field | Done |
| [0017](0017-feedback.md) | Feedback form with Telegram notifications | Done |
| [0018](0018-changelog.md) | Changelog page | Done |
| [0019](0019-useful-links.md) | Useful links page | Done |
| [0020](0020-origin-and-deploy.md) | Request origin behind the proxy; deploy files | Done |
| [0015](0015-about-page.md) | About page | Done |
| [0021](0021-pull-requests-only.md) | main only changes through pull requests (local pre-push guard; opening, merging and cleaning up after them with gh) | Done |
| [0022](0022-fresh-context-review.md) | A fresh-context agent reviews every change before it is merged | Done |
| [0023](0023-feature-flags.md) | Feature flags | Draft |
| [0024](0024-friends-sharing.md) | Sharing progress with friends | Done |
| [0026](0026-automatic-deploy.md) | Automatic migrations and deploy after a merge | Done |
| [0027](0027-feature-flags-via-telegram.md) | Switching feature flags from the Telegram bot | Draft |
| [0028](0028-landing-screenshots.md) | Screenshots on the landing page | Draft |
| [0029](0029-site-logo-link.md) | A logo that leads home, on every page | Draft |
| [0031](0031-e2e-sharding.md) | Sharded end-to-end tests: two parallel CI jobs | Draft |
| [0033](0033-translated-stamp-descriptions.md) | Stamp descriptions translated into ru and en | Done |
| [0034](0034-specs-and-tasks.md) | Specs and tasks: how work is written down | Done |
| [0040](0040-header-menu-and-page-width.md) | Header, account menu and page width | Draft |
| [0041](0041-stats-page.md) | My stats: a page, and the stamps-per-month chart | Draft |
| [0042](0042-stamp-lifecycle.md) | Stamp lifecycle: new, retired and moved stamps | Draft |
| [0043](0043-friends-comparison-and-feedback.md) | Friends: comparing progress, and buttons that respond | Draft |
| [0044](0044-bulk-stamp-dates.md) | Stamp dates in bulk | Draft |
| [0045](0045-ci-once-per-change.md) | CI runs once per change, and its database tests cannot skip | Draft |
