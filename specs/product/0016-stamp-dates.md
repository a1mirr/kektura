# 0016: Stamp dates

Status: Done
Owner code: `src/lib/stamp-date.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/components/StampDateInput.tsx`,
`StampButton.tsx`, `ExtraStampButton.tsx`, `StageStampButton.tsx`, `supabase/migrations/0007_edit_dates.sql`,
`messages/*.json` (`dashboard.stampDate`, `dashboard.openCalendar`)

## Goal

Every stamp has a date, and the user can correct it ("I collected this one in June"). A new stamp gets the
user's own day. A date is only ever saved when it is a real, complete one, never a half-typed one, and it reads
`yyyy-mm-dd` in every language and browser (a native date field would show `10/02/2026`, which is 2 October or
10 February depending on who looks), with a calendar one click away.

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
- **AC-5**: Stamped places and extra stamps show a text field for the date, showing and accepting `yyyy-mm-dd`
  (`2026-10-02`): placeholder `yyyy-mm-dd`, at most 10 characters, the accessible label "Date of the stamp", the
  saved date as its value. It does not ask phones for a numeric keypad.
- **AC-6**: The field saves a valid, changed date after 700 ms without typing, or at once when the user
  leaves the field. It never sends an empty, incomplete, invalid, out-of-range or unchanged value, nor text in
  another format (`15/09/2026`, `2026-9-5`, `2026-02-30`); leaving the field with such a value restores the
  saved date.
- **AC-7**: While saving, the field stays enabled and keeps focus. A failed save restores the saved date and
  shows the usual "Couldn't save, try again." (spec 0002 AC-10); an expired session refreshes the page
  (0002 AC-11). Several quick edits are one save.
- **AC-8**: The dates are what the per-month statistics use (0001 AC-5), so correcting a date moves the
  stamp to its new month.
- **AC-9**: Next to the field is a calendar button (accessible name "Open calendar"). It opens the browser's date
  picker on the current date of the field, limited to the valid range (1938-01-01 to tomorrow, UTC). Picking a day
  fills the field and saves it at once (a pick is one complete date: no pause is needed); a picked day that is
  empty or out of range is not sent; failures and expired sessions behave as in AC-7.
- **AC-10**: The picker is an implementation detail of the button: it is hidden from keyboard and screen readers,
  so the text field is the only date field they meet (the calendar button stays reachable).
- **AC-11**: The calendar button's label exists in `ru`, `en` and `hu`. The placeholder is the format itself and
  is not translated.
- **AC-12**: The field follows the saved date when the server's value changes (the page refreshed after a save,
  another tab edited it), unless the user is in the middle of changing it: what they are typing is never
  overwritten.

- **AC-13**: A retired stamp (spec 0001 AC-22) is dated on its own and strictly: it has no "today" default, the date a user collects it with and
  the date of `setStampDate` must be a valid stamp date (AC-2) before its `retired_on` (spec 0002 AC-17), and a request that mixes
  it with other stamps is refused whole. Its date field's last day is the day before it retired: the calendar picker stops there and a later
  day typed in is never sent (it is restored on leaving the field).

## Out of scope

Notes on a stamp; a time of day; editing many dates at once; a database check on the date range (it would
need `current_date`, which can't be part of a constraint that must hold when a dump is reloaded); a custom-built
calendar widget. Other dates on the site (the changelog's long dates, the month labels of the "Stamps per month"
chart) keep their localized form: this spec covers the fields where a date is entered.

## Notes

- `0007_edit_dates.sql` adds the UPDATE policy on `user_extra_stamps` (`user_stamps` already had one): without it
  an update is silently ignored by RLS.
- The date is edited by an update-only action, not by stamping again: it can't create rows by accident and doesn't
  depend on how PostgREST parses `on_conflict`.
- The field must not save on every change: a text field fires `change` per keystroke, and correcting a typed date
  passes through other complete dates (changing the day of `2026-09-02` to `26` is `2026-09-02`, then
  `2026-09-2`, then `2026-09-26`; only complete `yyyy-mm-dd` strings count). The pause (or leaving the field)
  protects against saving the intermediate ones, and a disabled field would lose focus mid-typing, so it stays
  enabled while saving.
- `showPicker()` opens the native picker from a click; where a browser lacks it, or refuses, the button falls back
  to `click()` on the hidden date input. The hidden date input also keeps the browser's own range limits.
- The field does not ask phones for a numeric keypad (`inputmode`): the iPhone's digits-only keypad has no hyphen,
  so the date couldn't be typed there. The calendar button is the quick way on a phone.

## Coverage

| AC | Test |
| --- | --- |
| AC-2 | `src/lib/stamp-date.test.ts` |
| AC-1 | `stamp-date.test.ts` (local day), `actions.test.ts` (date goes to new rows only), `e2e/stamp-dates.spec.ts` (a user far ahead of UTC gets their own day) |
| AC-3, AC-4 | `src/app/[locale]/dashboard/actions.test.ts`, `src/lib/stamp-date.test.ts` (calendar dates) |
| AC-5, AC-6, AC-7, AC-9, AC-10, AC-12 | `src/components/StampDateInput.test.tsx` (timers, blur, invalid and other-format text, failure, focus, the calendar button and its fallbacks, the hidden picker, following the server), `e2e/stamp-dates.spec.ts` (typing a whole date makes one request; a future date is refused and restored; a day picked in the calendar is saved at once and the picker's range is 1938-01-01 to tomorrow in UTC; persistence after reload; extra stamps) |
| AC-9 (the native picker itself) | manual (native browser UI): click the calendar button in Chrome, Firefox and Safari (also on a phone): the picker opens on the field's date, a day that is picked appears in the field and is saved. Last checked: never recorded. |
| AC-8 | `src/lib/progress.test.ts` (months from `stamped_on`) |
| AC-11 | `tests/messages.test.ts` (parity) |
