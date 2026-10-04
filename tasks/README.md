# Tasks

A task is one piece of work: a feature to build, a refactor, a CI change, a rename, a data update. It says what is
being done and why, which specs it touches, and what is done when. It never says how the product behaves: that
is what the **specs** are for ([`specs/README.md`](../specs/README.md), [0034](../specs/0034-specs-and-tasks.md)).
A finished task stays as history and is not updated when behaviour changes later.

- Copy [`_template.md`](_template.md) to `tasks/NNNN-short-slug.md`. The number is the next one after the
  highest in `specs/` **and** `tasks/` (one sequence over both folders), status `Open`. Written in English.
- A task has no acceptance criteria. If you are writing "given X, when Y, then Z", it belongs in a spec.
- A feature or behaviour change edits or drafts the spec first, then gets its task. A refactor, CI or deploy
  change or data update is only a task. A trivial fix needs no task.
- Statuses: `Open`, `In progress`, `Done`, `Dropped` (say why in Notes).
- Before a task is `Done` its **Spec changes** section says what changed in the specs, and those specs mirror the
  code as built.
- A migration is named after the number of the task that adds it.

## Index

| Task | What | Status |
| --- | --- | --- |
| [0009](0009-fast-stamping.md) | Fast stamping: cached reference data, instant buttons (now spec 0002) | Done |
| [0010](0010-typed-translations.md) | Typed translation keys (now spec 0005) | Done |
| [0011](0011-trailmap-split.md) | Split TrailMap, map E2E safety net (now spec 0003) | Done |
| [0013](0013-extra-stamps-stages.md) | Extra stamps linked to stages (now spec 0001) | Done |
| [0025](0025-account-page.md) | Account page: sign out moves in, "Settings" becomes "Account" (now spec 0014) | Done |
| [0030](0030-faster-e2e.md) | Faster end-to-end tests (now specs 0006 and 0007) | Done |
| [0032](0032-iso-date-input.md) | Stamp dates as yyyy-mm-dd (now spec 0016) | Done |
| [0035](0035-specs-and-tasks.md) | Introduce tasks next to specs | Done |
| [0036](0036-reshape-specs.md) | Turn the existing specs into area specs and tasks | Done |
| [0037](0037-regenerate-seeds.md) | Regenerate the seeds with the current generator | Done |
| [0038](0038-deploy-gh-retry.md) | Retry the GitHub API calls of the deploy workflow | Done |
| [0039](0039-manual-coverage-rows.md) | Audit the manual coverage rows | Done |
| [0046](0046-header-menu-and-page-width.md) | Account menu and one wide page layout (spec 0040) | Open |
| [0047](0047-stats-page-and-monthly-chart.md) | My stats page and a monthly chart that names every month (spec 0041) | Open |
| [0048](0048-new-stamps-required-from-date.md) | New stamps are required only from their official date (spec 0042) | Open |
| [0049](0049-retired-stamps.md) | Keep retired stamps and show them to the people who could have collected them (spec 0042) | Open |
| [0050](0050-relocated-stamps-on-the-map.md) | Relocated stamps: the latest location on the map, with a note (spec 0042) | Open |
| [0051](0051-friends-comparison.md) | Compare progress with a friend (spec 0043) | Open |
| [0052](0052-friends-buttons-respond.md) | Friends page buttons respond (spec 0043) | Open |
| [0053](0053-bulk-stamp-dates.md) | Change the date of many stamps at once (spec 0044) | Open |
| [0054](0054-ci-runs-once-per-change.md) | CI runs once per change (spec 0045) | Open |
| [0055](0055-database-tests-fail-in-ci.md) | Database tests fail in CI instead of skipping (spec 0045) | Open |
