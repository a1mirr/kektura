# Tasks

A task is one piece of work: a feature to build, a refactor, a CI change, a rename, a data update. It says what is
being done and why, which specs it touches, the requirements of any behaviour it plans, and what is done when. It
never says how the product behaves now: that is what the **specs** are for ([`specs/README.md`](../specs/README.md), [0034](../specs/0034-specs-and-tasks.md)).
A finished task stays as history and is not updated when behaviour changes later.

- Copy [`_template.md`](_template.md) to `tasks/NNNN-short-slug.md`. The number is the next one after the
  highest in `specs/` **and** `tasks/` (one sequence over both folders), status `Open`. Written in English.
- A task has no acceptance criteria. Planned behaviour is a **Requirements** checklist of outcomes (`R-1`, `R-2`,
  ...), with the **Open questions** that must be settled with the owner before coding. When the behaviour is built,
  the requirements become numbered ACs in the owning spec and the task is not updated again. If you are writing
  "given X, when Y, then Z" about how the product behaves now, it belongs in a spec.
- A feature or behaviour change starts as a task; the spec is edited while it is built, never drafted beforehand. A
  refactor, CI or deploy change or data update is only a task. A trivial fix needs no task.
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
| [0023](0023-feature-flags.md) | Feature flags: per-user flags without a redeploy | Open |
| [0025](0025-account-page.md) | Account page: sign out moves in, "Settings" becomes "Account" (now spec 0014) | Done |
| [0027](0027-feature-flags-via-telegram.md) | Switch feature flags from the Telegram bot | Open |
| [0028](0028-landing-screenshots.md) | Screenshots on the landing page | Open |
| [0029](0029-site-logo-link.md) | A logo that leads home, on every page (now spec 0014) | Done |
| [0030](0030-faster-e2e.md) | Faster end-to-end tests (now specs 0006 and 0007) | Done |
| [0031](0031-e2e-sharding.md) | Sharded end-to-end tests: two parallel CI jobs | Open |
| [0032](0032-iso-date-input.md) | Stamp dates as yyyy-mm-dd (now spec 0016) | Done |
| [0035](0035-specs-and-tasks.md) | Introduce tasks next to specs | Done |
| [0036](0036-reshape-specs.md) | Turn the existing specs into area specs and tasks | Done |
| [0037](0037-regenerate-seeds.md) | Regenerate the seeds with the current generator | Done |
| [0038](0038-deploy-gh-retry.md) | Retry the GitHub API calls of the deploy workflow | Done |
| [0039](0039-manual-coverage-rows.md) | Audit the manual coverage rows | Done |
| [0046](0046-header-menu-and-page-width.md) | Account menu and one wide page layout | Open |
| [0047](0047-stats-page-and-monthly-chart.md) | My stats page and a monthly chart that names every month | Open |
| [0048](0048-new-stamps-required-from-date.md) | New stamps are required only from their official date | Open |
| [0049](0049-retired-stamps.md) | Keep retired stamps and show them to the people who could have collected them | Open |
| [0050](0050-relocated-stamps-on-the-map.md) | Relocated stamps: the latest location on the map, with a note | Open |
| [0051](0051-friends-comparison.md) | Compare progress with a friend | Done |
| [0052](0052-friends-buttons-respond.md) | Friends page buttons respond | Done |
| [0053](0053-bulk-stamp-dates.md) | Change the date of many stamps at once | Open |
| [0054](0054-ci-runs-once-per-change.md) | CI runs once per change; a Markdown-only pull request skips E2E (now spec 0007) | Done |
| [0055](0055-database-tests-fail-in-ci.md) | Database tests fail in CI instead of skipping | Open |
| [0056](0056-specs-describe-built-behaviour-only.md) | Specs describe only behaviour that is built | Done |
| [0057](0057-worktrees-and-tidy.md) | Work only in worktrees from a fresh origin/main, and tidy after a merge (spec 0021) | Done |
| [0058](0058-review-recorded-check.md) | A CI check that a review was recorded (spec 0022) | Done |
| [0059](0059-backup-before-migration.md) | A backup before every migration (specs 0012, 0026) | Done |
| [0060](0060-production-monitoring.md) | Know when production is broken: an external uptime service (written up in deploy/README.md; the owner creates the monitor) | Done |
| [0061](0061-mobile-and-accessibility-e2e.md) | End-to-end tests at phone width, and accessibility checks (spec 0006) | Open |
| [0062](0062-security-checks-in-ci.md) | Free security checks in CI (spec 0007) | Open |
| [0063](0063-stop-hook-changelog-nudge.md) | The Stop hook also asks about the changelog (spec 0034) | Done |
| [0064](0064-ci-is-the-e2e-authority.md) | CI is the authority for the end-to-end tests (specs 0007, 0022) | Done |
| [0065](0065-worktree-base-ref-fresh.md) | Claude Code's own worktrees start from the remote's default branch (spec 0021) | Done |
| [0066](0066-telegram-for-failed-actions.md) | Failed server actions reach Telegram (spec 0008) | Open |
| [0067](0067-hungarian-default-and-german.md) | Hungarian is the default language, German is added, the language is chosen from a dropdown (now specs 0005, 0033) | Done |
| [0069](0069-ci-up-to-date-with-main.md) | A pull request that is behind main is flagged by CI and never merged (specs 0007, 0021, 0022) | Done |
| [0070](0070-desktop-layout.md) | Use the room on a desktop screen: shared width and edges, side-by-side blocks, 375 px as the narrowest promise | Open |
| [0071](0071-compare-map-list-and-labels.md) | The comparison map leads to the list and names places with their number (spec 0003) | Done |
