# Specs

A spec is the contract of one **area**, a part of the product or of how the project is run, written as it behaves
**now**: numbered acceptance criteria, each one observable and testable. The tests prove it, the Stop hook keeps it
proven, and after every change the spec is edited until it mirrors the code again.
Specs are always written in English.

The work that changes an area is a **task**, a GitHub issue labelled `task` (`gh issue list --label task`): why, which
specs it touches, the requirements of planned behaviour and what is done when. A task is history and never says how the
product behaves; a spec never tells the story of a change, and never describes behaviour that is not built yet (its
status is always `Done`).
Spec numbers are their own sequence (next number = the highest in `specs/` plus one); a task's number is its issue
number. Details: [0034](project/0034-specs-and-tasks.md). A quick test for where a sentence belongs: will it still be true in
a year if nobody touches it? Yes: spec. No: task.

## Workflow

1. **Open a task.** A feature or a behaviour change starts as an issue (`gh issue create`, from the template
   [`../.github/ISSUE_TEMPLATE/task.md`](../.github/ISSUE_TEMPLATE/task.md)): the goal, the specs it will touch, the
   requirements as a checklist of outcomes and the open questions. No spec is written or changed yet. A refactor or a CI change is only
   a task without requirements, a trivial fix needs neither.
2. **Agree on it.** Resolve the open questions with the owner before implementing.
3. **Write the ACs and the tests as you build.** Edit the spec that owns the area (add, change or remove ACs); a new
   area: copy [`_template.md`](_template.md) to `specs/product/NNNN-short-slug.md` (what users and the running app see and do) or `specs/project/NNNN-short-slug.md` (how the project builds, checks, ships and is run), with the next number (the highest in `specs/` plus one), status `Done`, and add it to the index under a heading. Turn each requirement
   into numbered acceptance criteria (`AC-1`, `AC-2`, ...), each one observable, testable statement: "given X, when
   Y, then Z". Then the tests: `describe("spec NNNN: <area>")`, and every test title starts
   with the AC it covers (`it("AC-3: ...")`). An AC that can't be automated yet is listed as
   `manual` in the spec's coverage table: `manual (why it can't be automated): how to check it. Last checked: <date>`
   (spec 0034 AC-11). Prefer a test; a manual row is the exception, and its date is written by whoever did the check.
4. **Implement** until `npm run check` (typecheck + lint + tests) is green.
5. **Make the spec true.** Reread every spec the task touches against the code as built and edit it to mirror
   reality: an AC for behaviour that exists and no AC states, `Removed` for an AC that was dropped, status `Done`,
   the coverage table, the index below; every requirement of the task is built or struck with the reason. Where code and spec disagree, decide which is right and fix that one.
   Write what changed in the pull request description's "Spec changes" section; the merge closes the task issue (`Closes #N`).
6. **Review with a fresh agent** before the pull request is merged ([0022](project/0022-fresh-context-review.md)):
   spawn the `fresh-reviewer` agent with only the task's issue number (the spec number for a change that is only a spec,
   `none` for a small change with neither) and the base branch. It has none of your context and reads the specs
   and the diff like a stranger would, in both directions. Fix its valid findings, answer the rest in the pull
   request, and review again after fixes that change code, tests or behaviour.

Never delete an AC number: mark it `Removed` so old references stay meaningful. `git grep "AC-3" -- '*0001*'
'src' 'tests'` finds a criterion's spec and tests. A spec found to disagree with the code at any other time is a
defect: correct it at once when that is small, otherwise open a task issue.

## Where tests live

| What | Where | Environment |
| --- | --- | --- |
| Domain logic (pure functions) | `src/lib/*.test.ts`, next to the module | Node |
| Server actions (Supabase mocked) | next to the action, e.g. `src/app/[locale]/dashboard/actions.test.ts` | Node |
| Client components | `src/components/*.test.tsx`, first line `// @vitest-environment jsdom` | jsdom + Testing Library |
| Cross-cutting checks (generated data, translations) | `tests/*.test.ts` | Node |
| User flows through the real app and database | `e2e/*.spec.ts` (Playwright, `npm run e2e`); a test tagged `@mobile` runs at 375 px as a phone, and `e2e/accessibility.spec.ts` runs axe | Test server (spec 0006) |

Tests that need the local database (`tests/*-database.test.ts` and the like) ask `requireDatabase` of `e2e/local-db.ts`: they skip, saying why, when it isn't running, and fail where `REQUIRE_LOCAL_DB` is set, which only CI's end-to-end job does ([0007](project/0007-ci.md) AC-12, AC-13).

Async Server Components (pages) can't be rendered by Vitest: keep their logic in `src/lib` and test
it there, and cover the page-level behaviour with a few E2E tests. E2E tests sign in as a fresh
dummy user each (`signInAsNewUser` in `e2e/helpers.ts`), so they never depend on each other.

## Regression gate

`.claude/settings.json` runs [`.claude/hooks/stop-check.mjs`](../.claude/hooks/stop-check.mjs) whenever
Claude Code is about to finish a turn with changed source files: typecheck, lint and tests in
parallel. A failure is sent back to Claude to fix (up to 3 attempts, then you get a message). If app
code changed but no spec did, it asks once whether behaviour changed (then the spec and its tests are
updated) or not (then say so in one line); in the same message it asks whether a change to a file users can see
(messages, a page, a layout, a component) belongs in the changelog when `src/content/changelog.ts` did not change
([0034](project/0034-specs-and-tasks.md) AC-10, AC-12). Run the same checks yourself with `npm run check`. E2E tests need Docker, so the
hook doesn't run them: CI's "End-to-end tests" job is the authority and must be green on the pull request
(skipped for one that changes only Markdown, [0007](project/0007-ci.md) AC-10; [0007](project/0007-ci.md) AC-8); run `npm run e2e` locally only to reproduce a failure.

## Index

Specs live in `product/` (what users and the running app see and do) or `project/` (how the project builds,
checks, ships and is run). The headings below only group the index: moving a spec between headings changes no file.

### `product/`

#### Stamps

| Spec | Area | Status |
| --- | --- | --- |
| [0001](product/0001-progress.md) | Progress: places, walked stretches, stats, stages, extra stamps in stages | Done |
| [0002](product/0002-stamping.md) | Stamping: server actions, stamp buttons, cached reference data | Done |
| [0016](product/0016-stamp-dates.md) | Stamp dates: validation, own time zone, safe editing, changing many at once, the yyyy-mm-dd field | Done |
| [0033](product/0033-translated-stamp-descriptions.md) | Stamp descriptions translated into ru, en and de | Done |

#### Map and trail data

| Spec | Area | Status |
| --- | --- | --- |
| [0003](product/0003-map-route-planner.md) | Map lines, the route planner, the comparison map of a friend's page and how the map code is structured | Done |
| [0004](product/0004-trail-data.md) | Generated trail data and seeds | Done |

#### Friends

| Spec | Area | Status |
| --- | --- | --- |
| [0024](product/0024-friends-sharing.md) | Sharing progress with friends | Done |

#### Pages

| Spec | Area | Status |
| --- | --- | --- |
| [0014](product/0014-pages-and-settings.md) | Footer pages, site logo, account page (sign out, chart, account deletion) | Done |
| [0015](product/0015-about-page.md) | About page | Done |
| [0017](product/0017-feedback.md) | Feedback form with Telegram notifications | Done |
| [0018](product/0018-changelog.md) | Changelog page | Done |
| [0019](product/0019-useful-links.md) | Useful links page | Done |
| [0036](product/0036-page-layout.md) | Page layout: one 64 rem width and shared edges for the logo, the page and the footer, reading columns, two columns on the dashboard and the friends pages | Done |

#### Platform

| Spec | Area | Status |
| --- | --- | --- |
| [0005](product/0005-auth-routing-i18n.md) | Sign-in, routing, languages (Hungarian default, German), the language dropdown, typed message keys | Done |
| [0008](product/0008-action-logging.md) | Server-side logging of failed actions | Done |
| [0020](product/0020-origin-and-deploy.md) | Request origin behind the proxy; deploy files | Done |

### `project/`

#### Workflow

| Spec | Area | Status |
| --- | --- | --- |
| [0021](project/0021-pull-requests-only.md) | main only changes through pull requests (a GitHub ruleset and a pre-push guard; opening, merging and cleaning up with gh); work happens in worktrees from a fresh origin/main (worktree guard hook, tidy) | Done |
| [0022](project/0022-fresh-context-review.md) | A fresh-context agent reviews every change before it is merged | Done |
| [0034](project/0034-specs-and-tasks.md) | Specs and tasks: how work is written down | Done |

#### Delivery and operations

| Spec | Area | Status |
| --- | --- | --- |
| [0006](project/0006-test-server.md) | Test server with dummy login, E2E tests and how they sign in, the tests at a phone's width (`@mobile`), accessibility checks with axe and their allow-list | Done |
| [0007](project/0007-ci.md) | CI once per change (Markdown-only pull requests skip E2E), E2E caches and timing report, database tests that fail in CI instead of skipping, generated-types check, security checks (npm audit with an expiring allow-list, gitleaks), Dependabot | Done |
| [0012](project/0012-backups.md) | Weekly backup of production user data | Done |
| [0026](project/0026-automatic-deploy.md) | Automatic migrations and deploy after a merge | Done |
| [0035](project/0035-feature-flags.md) | Feature flags: merge a feature dark, switch it on for the developer, testers or everybody without a deploy | Done |
