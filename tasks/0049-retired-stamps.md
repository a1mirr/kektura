# 0049: Keep retired stamps and show them to the people who could have collected them

Status: Open
Specs: [0001](../specs/0001-progress.md) AC-1, AC-7 (retired rows are not stage stamps), [0003](../specs/0003-map-route-planner.md) (no retired markers), [0004](../specs/0004-trail-data.md) AC-1 to AC-3, AC-9 (retired rows are kept), [0016](../specs/0016-stamp-dates.md) AC-1 to AC-4 (a retired stamp is stamped with a chosen past date), [0024](../specs/0024-friends-sharing.md) AC-7, AC-12 (the friend functions skip them)

## Goal

Stop the seed regeneration from deleting a retired stamp together with the stamps users have on it, keep it as a retired row, and
show it with a short note to users whose walk dates are before the retirement.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The source for the retired stamp's code, coordinates and position is found in an official MTSZ publication (see the open question below), or the owner decides to enter the position by hand
- [ ] `scripts/data/okt-retired-stamps.json`, `build-data.mjs`, the migration `0049_retired_stamps.sql` (local first) and the
      list, toggle and notes are built with the tests under "Tests to write"
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0048, 0049 and 0050 (R-1 to R-35): they were one piece of planning, and the three tasks refer to each other's numbers.

### Retired stamps

A retired stamp is the mirror of a new one: the people who walked before the retirement collected it, and it belongs in
their record. Example: Vércverés replaced Nyírjesi-erdészház on 2014-11-21.

- [ ] **R-18**: A retired stamp is a checkpoint row that is **kept**: it has a `retired_on` date (the first day it is no
  longer valid), optionally the place that replaced it (`replaced_by`, a place key) and where it sat
  (`after_place_key`, the current place it followed in trail order, so it has a position in its stage). Current stamps
  have `retired_on` null. Its `place_key` is its own code (non-null and unique, so stamping by key works). A retired row is outside the 161 places and the trail order: its `seq` is above every current
  row's, its `stage_seq` is null (its place in the list comes from `after_place_key`), its `km_from_start` is that of the
  place it follows (not measured), and `buildPlaces` and the checks of spec 0004 AC-1 to AC-3 look at current rows only.
- [ ] **R-19**: Retired stamps come from `scripts/data/okt-retired-stamps.json`: code, name, stage, `after_place_key`,
  `retired_on`, `replaced_by`, optional `lat` and `lng` (from an official source, kept for the record: a retired stamp is never a map marker, R-24) and
  the official URL, under the rules of R-2 and R-3. `build-data.mjs` writes them as
  rows with `retired_on` set and never deletes one (this amends spec 0004 AC-9: rows the source no longer has are
  deleted, except retired ones).
- [ ] **R-20**: A user's stamps are never lost when a stamp is retired: regenerating the seed for a stamp that becomes
  retired keeps every `user_stamps` row on it and does not move them to another variant.
- [ ] **R-21**: A retired stamp appears in its stage's list, at its position, for a user if **either** they already have a
  stamp on it (always) **or** their walk date is before `retired_on`. The walk date is read as in R-4 but with the
  **earlier** of the two neighbouring dates: the stamp was collectable if the user passed any time before the
  retirement. With no stamped neighbour and no stamp of its own it is not shown.
- [ ] **R-22**: A toggle on the stage controls, "Show retired stamps" (off by default, remembered like the other stage-list
  preferences), shows every retired stamp, for a user who walked the old route without stamping neighbours first.
- [ ] **R-23**: A retired stamp has no "today" default (spec 0016 AC-1 would date it after `retired_on`): ticking it opens its
  date field and the stamp is created with the date the user enters, which must be before `retired_on` (and obey spec 0016
  AC-2). Editing the date (`setStampDate`) or changing it in bulk (task 0053) follows the same rule. Unlike spec 0016 AC-3
  (an out-of-range date on creation is ignored and the default applies), a date on or after `retired_on`, or no date at all (the database default would be today), is refused as `failed`, without a write:
  the action reads `retired_on` first, as it already reads `checkpoints` for the ids. A request that mixes a retired stamp with
  others is refused as a whole. The field's `max` is the day before.
- [ ] **R-24**: Retired stamps never count towards "N / 161", the walked km, the stage's "complete" state or the monthly
  counts (task 0047). They show on their own: "Retired stamps collected: n" under the stage list and a separate mark
  in the stage row. (The old route is not in the data, so no stretch can be drawn or measured.) A retired stamp never
  blocks a stretch: it is a record, not a requirement. It is also left out of "Stamp stage" (spec 0001 AC-7), the map's
  markers, the route planner and the hops, although its row has coordinates.
- [ ] **R-25**: A retired stamp's row carries a short note, visible without a hover, in three languages: "Retired stamp:
  valid until 20 Nov 2014. Replaced by Vércverés." The replacement is a link to its row when there is one. The row is
  muted with a "retired" badge (not by colour alone) and its checkbox's accessible name includes "retired". The
  replacing stamp's own note mentions the retired one, so the two rows explain each other.
- [ ] **R-26**: A friend's page does not list retired stamps and counts none of them: it filters them out of what
  `get_friend_stamps` returns.
- [ ] **R-27**: The notes wrap at 320 and 375 px, and the badge does not push the date field off the screen.

## Out of scope

Temporary warnings, detours, closures and construction notices (the MTSZ's own warnings page covers them);
automatic detection of changes (see Open questions); counting or drawing the old route of a retired stamp; stamps of
the Alföldi and Dél-dunántúli trails; stamps retired before 2014; the history of a stamp's earlier locations;
letting a user declare their own waivers.

## Open questions

- **Data for retired stamps.** The MTSZ list gives only the name and the date. The retired stamp's code, coordinates and
  stage position are not in it, and a web search found no code. They must come from an official source (an older GPX of
  the stamping places, or the 2009 booklet). Should the stamp wait for it, or ship with the position entered by hand?
- **Does a missing retired stamp unverify a stretch?** By the mirror of R-4, someone who walked before the change needed
  the old stamp. R-24 says it never blocks (nobody can collect it any more). Does the MTSZ still require it for an old
  booklet?
- **Per-month chart.** R-24 leaves retired stamps out; a stamp collected in June 2013 is still a stamp that month.
  Include it in the month's stamp count of task 0047, with km untouched?
- **Retired stamps in the chart** is asked here and in task 0047; settle it once, in task 0047.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-18, R-19, R-20 | planned: `tests/trail-data.test.ts` (the retired file and the generated seed), and a database test beside `tests/seed-cleanup.test.ts` (a retired row kept and its stamps kept after a regeneration) |
| R-21, R-24 (the rules) | planned: `src/lib/progress.test.ts` |
| R-22, R-24 (the toggle, its memory, the count and the mark) | planned: `src/components/StageControls.test.tsx`, `src/components/StageSection.test.tsx` |
| R-23 | planned: `src/app/[locale]/dashboard/actions.test.ts`, `src/lib/stamp-date.test.ts` |
| R-25, R-26, R-27 | planned: `src/components/StageSection.test.tsx`, `src/lib/friends.test.ts`, `e2e/stamping.spec.ts` (375 px) |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: show retired stamps when the neighbours' visit dates are before the retirement, with a
short note in the list. The one retirement on the OKT in the MTSZ's list is Nyírjesi-erdészház (replaced by Vércverés,
2014-11-21). Depends on task 0048 (the dates file and the walk-date rule).

Code the work touches: `scripts/data/okt-stamp-dates.json` (new), `scripts/data/okt-retired-stamps.json` (new), `scripts/build-data.mjs`, `src/lib/progress.ts`, `src/lib/map-popups.ts`, `src/components/trail-map/*`, `src/components/StageSection.tsx`, `src/app/[locale]/dashboard/actions.ts`, `supabase/migrations/` (one per task)
