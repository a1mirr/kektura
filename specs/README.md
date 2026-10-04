# Specs

A spec is the contract of one **area**, a part of the product or of how the project is run, written as it behaves
**now**: numbered acceptance criteria, each one observable and testable. The tests prove it, the Stop hook keeps it
proven, and after every change the spec is edited until it mirrors the code again.
Specs are always written in English.

The work that changes an area is a **task** ([`tasks/`](../tasks/README.md)): why, which specs it touches, the
requirements of planned behaviour and what is done when. A task is history and never says how the product behaves; a
spec never tells the story of a change, and never describes behaviour that is not built yet (its status is always
`Done`).
Both folders share one number sequence (next number = the highest in `specs/` and `tasks/` plus one). Details:
[0034](0034-specs-and-tasks.md). A quick test for where a sentence belongs: will it still be true in a year if
nobody touches it? Yes: spec. No: task.

## Workflow

1. **Open a task.** A feature or a behaviour change starts as `tasks/NNNN-slug.md` (copy
   [`../tasks/_template.md`](../tasks/_template.md)): the goal, the specs it will touch, the requirements as a
   checklist of outcomes and the open questions. No spec is written or changed yet. A refactor or a CI change is only
   a task without requirements, a trivial fix needs neither.
2. **Agree on it.** Resolve the open questions with the owner before implementing.
3. **Write the ACs and the tests as you build.** Edit the spec that owns the area (add, change or remove ACs); a new
   area: copy [`_template.md`](_template.md) to `specs/NNNN-short-slug.md`, status `Done`. Turn each requirement
   into numbered acceptance criteria (`AC-1`, `AC-2`, ...), each one observable, testable statement: "given X, when
   Y, then Z". Then the tests: `describe("spec NNNN: <area>")`, and every test title starts
   with the AC it covers (`it("AC-3: ...")`). An AC that can't be automated yet is listed as
   `manual` in the spec's coverage table: `manual (why it can't be automated): how to check it. Last checked: <date>`
   (spec 0034 AC-11). Prefer a test; a manual row is the exception, and its date is written by whoever did the check.
4. **Implement** until `npm run check` (typecheck + lint + tests) is green.
5. **Make the spec true.** Reread every spec the task touches against the code as built and edit it to mirror
   reality: an AC for behaviour that exists and no AC states, `Removed` for an AC that was dropped, status `Done`,
   the coverage table, the index below; every requirement of the task is built or struck with the reason. Where code and spec disagree, decide which is right and fix that one.
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
updated) or not (then say so in one line); in the same message it asks whether a change to a file users can see
(messages, a page, a layout, a component) belongs in the changelog when `src/content/changelog.ts` did not change
([0034](0034-specs-and-tasks.md) AC-10, AC-12). Run the same checks yourself with `npm run check`. E2E tests need Docker, so the
hook doesn't run them: CI's "End-to-end tests" job is the authority and must be green on the pull request
(skipped for one that changes only Markdown, [0007](0007-ci.md) AC-10; [0007](0007-ci.md) AC-8); run `npm run e2e` locally only to reproduce a failure.

## Index

| Spec | Area | Status |
| --- | --- | --- |
| [0001](0001-progress.md) | Progress: places, walked stretches, stats, stages, extra stamps in stages | Done |
| [0002](0002-stamping.md) | Stamping: server actions, stamp buttons, cached reference data | Done |
| [0003](0003-map-route-planner.md) | Map lines, the route planner and how the map code is structured | Done |
| [0004](0004-trail-data.md) | Generated trail data and seeds | Done |
| [0005](0005-auth-routing-i18n.md) | Sign-in, routing, translations, typed message keys | Done |
| [0006](0006-test-server.md) | Test server with dummy login, E2E tests and how they sign in | Done |
| [0007](0007-ci.md) | CI once per change (Markdown-only pull requests skip E2E), E2E caches and timing report, generated-types check, Dependabot | Done |
| [0008](0008-action-logging.md) | Server-side logging of failed actions | Done |
| [0012](0012-backups.md) | Weekly backup of production user data | Done |
| [0014](0014-pages-and-settings.md) | Footer pages, site logo, account page (sign out, chart, account deletion) | Done |
| [0016](0016-stamp-dates.md) | Stamp dates: validation, own time zone, safe editing, the yyyy-mm-dd field | Done |
| [0017](0017-feedback.md) | Feedback form with Telegram notifications | Done |
| [0018](0018-changelog.md) | Changelog page | Done |
| [0019](0019-useful-links.md) | Useful links page | Done |
| [0020](0020-origin-and-deploy.md) | Request origin behind the proxy; deploy files | Done |
| [0015](0015-about-page.md) | About page | Done |
| [0021](0021-pull-requests-only.md) | main only changes through pull requests (pre-push guard; opening, merging and cleaning up with gh); work happens in worktrees from a fresh origin/main (worktree guard hook, tidy) | Done |
| [0022](0022-fresh-context-review.md) | A fresh-context agent reviews every change before it is merged | Done |
| [0024](0024-friends-sharing.md) | Sharing progress with friends | Done |
| [0026](0026-automatic-deploy.md) | Automatic migrations and deploy after a merge | Done |
| [0033](0033-translated-stamp-descriptions.md) | Stamp descriptions translated into ru and en | Done |
| [0034](0034-specs-and-tasks.md) | Specs and tasks: how work is written down | Done |
