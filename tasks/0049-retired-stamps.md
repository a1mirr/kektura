# 0049: Keep retired stamps and show them to the people who could have collected them

Status: Open
Specs: [0042](../specs/0042-stamp-lifecycle.md) AC-18 to AC-27 (added), [0004](../specs/0004-trail-data.md) AC-9 (changed: retired
rows are kept), [0016](../specs/0016-stamp-dates.md) AC-2 and AC-4 (changed: a retired stamp's latest date), [0001](../specs/0001-progress.md) AC-7
(changed: stage stamping skips retired rows), [0003](../specs/0003-map-route-planner.md) (no retired markers), [0024](../specs/0024-friends-sharing.md)
AC-12 (changed: the friend functions skip them)

## Goal

Stop the seed regeneration from deleting a retired stamp together with the stamps users have on it, keep it as a retired row, and
show it with a short note to users whose walk dates are before the retirement.

## Done when

- [ ] The source for the retired stamp's code, coordinates and position is found in an official MTSZ publication (spec 0042's
      open question), or the owner decides to enter the position by hand
- [ ] The open questions for retired stamps are settled (does a missing one unverify a stretch, the monthly chart) and the part of
      the spec is `Accepted`
- [ ] `scripts/data/okt-retired-stamps.json`, `build-data.mjs`, the migration `0049_retired_stamps.sql` (local first) and the
      list, toggle and notes are built with the tests of the coverage table
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: show retired stamps when the neighbours' visit dates are before the retirement, with a
short note in the list. The one retirement on the OKT in the MTSZ's list is Nyírjesi-erdészház (replaced by Vércverés,
2014-11-21). Depends on task 0048 (the dates file and the walk-date rule).
