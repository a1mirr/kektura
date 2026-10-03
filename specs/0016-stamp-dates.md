# 0016: Stamp dates

Status: Done
Owner code: `src/lib/stamp-date.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/components/StampDateInput.tsx`,
`StampButton.tsx`, `ExtraStampButton.tsx`, `StageStampButton.tsx`, `supabase/migrations/0007_edit_dates.sql`

## Goal

Every stamp has a date, and the user can correct it ("I collected this one in June"). The first version
(commit `fa0940f`) made the date argument of the stamp actions double as an "overwrite" flag and saved on
every `change` event of the date field. Chrome fires `change` for every typed digit, so typing the year
saved a date for every keystroke (`0002-…` while typing the year, `…-02` on the way to `…-26`), and the field disabled itself mid-typing and lost focus. It also accepted
`2026-13-45` and any far-past or far-future date, and gave new stamps the server's UTC date instead of the
user's own day. This spec replaces it.

## Behaviour

### Rules

- **AC-1**: A new stamp (single place, whole stage, extra stamp, or from the map popup) gets the user's own
  calendar day: the browser sends its local `YYYY-MM-DD`. If that isn't a sane stamp date by its own clock,
  nothing is sent and the database default (the server's day) applies. Stamping again never changes an
  existing stamp's date (ON CONFLICT DO NOTHING, spec 0002 AC-3).
- **AC-2**: A valid stamp date is a real calendar date written `YYYY-MM-DD`, from 1938-01-01 (the
  trail's first year) to tomorrow in UTC (a user ahead of UTC is already in "tomorrow"). `2026-02-30`,
  `2026-13-01`, `2026-9-5`, an empty string and non-strings are not.
- **AC-3**: `setPlacesStamped` and `setExtraStamped` take an optional `date`, the `stamped_on` of rows
  that are *created*. Something that isn't a real `YYYY-MM-DD` calendar date is invalid input
  (`failed`, one warning, no database access). A real date outside the valid range (see AC-2) is ignored
  and the default applies: a client can't know how far its clock is off, and stamping must not stop
  working because of it. (Editing a date, AC-4, is strict.)

### Editing a date

- **AC-4**: `setStampDate(placeKeys, date)` and `setExtraStampDate(extraId, date)` only **update**
  `stamped_on` of the signed-in user's existing rows (every variant of a place): they never insert a stamp,
  touch only the caller's rows (RLS and an explicit `user_id` filter), and answer `failed` when no row
  was updated (nothing was stamped). An invalid date is rejected without database access; a missing
  session is `unauthorized`. Both log failures like the other stamp actions (spec 0008).
- **AC-5**: Stamped places and extra stamps show a date field with an accessible label that only accepts
  dates from 1938-01-01 to tomorrow (UTC). Since spec 0032 it is a `yyyy-mm-dd` text field with a calendar
  button (first it was `<input type="date">`); the range limits sit on the calendar picker.
- **AC-6**: The field saves a valid, changed date after 700 ms without typing, or at once when the user
  leaves the field. It never sends an empty, incomplete, invalid, out-of-range or unchanged value; leaving
  the field with such a value restores the saved date.
- **AC-7**: While saving, the field stays enabled and keeps focus. A failed save restores the saved date and
  shows the usual "Couldn't save, try again." (spec 0002 AC-10); an expired session refreshes the page
  (0002 AC-11). Several quick edits are one save.
- **AC-8**: The dates are what the per-month statistics use (0001 AC-5), so correcting a date moves the
  stamp to its new month.

## Out of scope

Notes on a stamp; a time of day; editing many dates at once; a database check on the date range (it would
need `current_date`, which can't be part of a constraint that must hold when a dump is reloaded).

## Notes

- `0007_edit_dates.sql` adds the UPDATE policy on `user_extra_stamps` (`user_stamps` already had one):
  without it an update is silently ignored by RLS.
- The earlier `upsert(..., { onConflict })` overwrite is gone: an update-only action can't create rows by
  accident and doesn't depend on how PostgREST parses `on_conflict`.
- Checking the value isn't enough to avoid saving half-typed dates: correcting a typed date passes through
  other complete dates (changing the day of `2026-09-02` to `26` is `2026-09-02`, then `2026-09-2`, then
  `2026-09-26`; only complete `yyyy-mm-dd` strings count, so the prefixes of a typed year are never dates).
  The pause (or blur) protects against saving the intermediate ones. (With the native `<input type="date">`
  of the first versions every prefix of the year was a real date, e.g. `0002`, `0020`, `0202`, which the range
  check rejects.)

## Coverage

| AC | Test |
| --- | --- |
| AC-2 | `src/lib/stamp-date.test.ts` |
| AC-1 | `stamp-date.test.ts` (local day), `actions.test.ts` (date goes to new rows only), `e2e/stamp-dates.spec.ts` (a user far ahead of UTC gets their own day) |
| AC-3, AC-4 | `src/app/[locale]/dashboard/actions.test.ts`, `src/lib/stamp-date.test.ts` (calendar dates) |
| AC-5, AC-6, AC-7 | `src/components/StampDateInput.test.tsx` (timers, blur, invalid, failure, focus), `e2e/stamp-dates.spec.ts` (typing a whole date makes one request; a future date is refused and restored; persistence after reload; extra stamps) |
| AC-8 | `src/lib/progress.test.ts` (months from `stamped_on`) |
