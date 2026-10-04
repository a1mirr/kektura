# 0053: Change the date of many stamps at once

Status: Open
Specs: [0044](../specs/0044-bulk-stamp-dates.md) AC-1 to AC-11 (added), [0016](../specs/0016-stamp-dates.md) (relied on; its out-of-scope
note changes), [0041](../specs/0041-stats-page.md) AC-7 (relied on: the chart follows the dates), [0042](../specs/0042-stamp-lifecycle.md)
AC-23 (relied on: a retired stamp's latest date, once that is built)

## Goal

Let a user select several stamped places and set one date for all of them, as one all-or-nothing action, on desktop and on a
phone.

## Done when

- [ ] The open questions (the 500 limit, a per-stage shortcut, a mode versus visible checkboxes) are settled and the spec is
      settled in the spec (it stays `Draft` until it is built: `tests/specs.test.ts` requires every file an Accepted or Done spec names to exist, so `Accepted` and `Done` are set when those files do)
- [ ] The selection mode, the bar, the server action and (if needed) the migration `0053_bulk_stamp_dates.sql`, local first, are
      built with the tests of the coverage table
- [ ] `npm run types:gen` if the schema changed; `npm run e2e`; checked at 320 and 375 px; the changelog entry in all three
      languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: bulk change of date for stamps.
