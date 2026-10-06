# 0016: Stamp dates

Status: Done
Owner code: `src/lib/stamp-date.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/components/StampDateInput.tsx`,
`StampButton.tsx`, `ExtraStampButton.tsx`, `StageStampButton.tsx`, `CalendarButton.tsx`, `supabase/migrations/0007_edit_dates.sql`; for changing many dates at once
(AC-14 to AC-22): `src/lib/bulk-dates.ts`, `BulkDatesProvider.tsx`, `BulkDateBar.tsx`, `BulkCheckbox.tsx`, `BulkStageButton.tsx`,
`StageControls.tsx`, `supabase/migrations/0080_bulk_stamp_dates.sql`; `messages/*.json` (`dashboard.stampDate`, `dashboard.openCalendar`, `dashboard.bulk*`)

## Goal

Every stamp has a date, and the user can correct it ("I collected this one in June"). A new stamp gets the
user's own day. A date is only ever saved when it is a real, complete one, never a half-typed one, and it reads
`yyyy-mm-dd` in every language and browser (a native date field would show `10/02/2026`, which is 2 October or
10 February depending on who looks), with a calendar one click away. A stretch walked on one day is dated in one go: the user chooses the stamps and gives one date.

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
  it with other stamps is refused whole (changing many dates at once has its own rule, AC-18). Its date field's last day is the day before it retired: the calendar picker stops there and a later
  day typed in is never sent (it is restored on leaving the field).

### Changing many dates at once

- **AC-14**: The dashboard has a "Change dates" mode, switched on and off by a button next to the stage controls ("Expand all"). In the
  mode every stamped place, retired stamp and extra stamp has a checkbox whose name is "Select" and the stamp's name; a stamp that is not
  stamped has none. Outside the mode no row has one. Leaving the mode (the button again, Cancel, Escape, or a saved change) forgets the
  choice; the next visit starts empty. Without JavaScript the mode is not offered (its button and the stage buttons of AC-20 are not
  in the server's HTML) and the single date fields stay. The button is only on the dashboard, not on a friend's page.
- **AC-15**: In the mode a click on a checkbox chooses or unchooses its row. A click with Shift held gives the rows from the last
  clicked one to this one the state this row gets, in the order of the page: each stage's places with a retired stamp where it stands,
  then the extra stamps (so a range can run from a place into the extras). Each stage's header has "Select stage", which adds the
  stamped places and retired stamps of that stage (the extra stamps are no stage's), and the bar has "Select all" and "Clear" ("Clear"
  keeps the mode). The number chosen is in a status region ("5 selected"). A chosen stamp that is no longer on the page (removed
  meanwhile) is no longer chosen or counted.
- **AC-16**: In the mode a bar shows the number chosen, a date field and "Apply". The field is the `yyyy-mm-dd` text field of AC-5 with
  its calendar button (AC-9), limited as in AC-2 (the picker offers 1938-01-01 to tomorrow, UTC). Apply is disabled for nothing chosen,
  and for an empty, incomplete, other-format, impossible or out-of-range date, and while a retired stamp stands in the way (AC-18).
  Nothing is sent before Apply: not while the date is typed, not on leaving the field, not when a day is picked in the calendar (a
  pick fills the field, unlike AC-9). Enter in the date field applies. While saving the bar is busy ("Saving…"), a second press or
  Enter sends nothing, and Escape and Cancel do not close it.
- **AC-17**: `setStampDates(placeKeys, extraIds, date)` is one server action that only **updates** `stamped_on` of the signed-in user's
  existing rows (every variant of each place, and the extra stamps), never inserts, and touches only the caller's rows (row level
  security and an explicit `user_id` filter). It takes 1 to 500 places and extra stamps together (more than the 161 places and 72
  extra stamps, so "select all" always fits) and a valid stamp date (AC-2); anything else is refused without database access
  (`failed`, one warning); a missing session is `unauthorized`. The database function `set_stamp_dates` does the work in one transaction,
  so it is all or nothing: when a place or extra stamp has no row of the caller (removed in another tab, or never stamped) it answers
  false, nothing changes and the result is `failed`. A database error is `failed` and logged like the other stamp actions (spec 0008);
  it never throws. Only a signed-in user may call the function, and it runs as the caller (`security invoker`).
- **AC-18**: A retired stamp (spec 0001 AC-22) may only get a date before the day it retired, also in a request with other stamps (a
  request that holds one with a date on or after it is refused whole, by the function too). The bar names the chosen retired stamps that
  the typed date cannot go to and keeps Apply disabled until the date is earlier or they are unchosen.
- **AC-19**: After a save that went through, the page shows the new dates, the mode is closed, the choice is cleared and a status
  message names the count ("12 dates changed", "1 date changed"; it is gone when the mode is opened again). After a failure the
  dates and the choice are kept, the bar shows "Couldn't save, try again." (spec 0002 AC-10) and Apply works again; an expired session
  refreshes the page (spec 0002 AC-11). The new dates are what the statistics use (AC-8).
- **AC-20**: On a stage's header "Set date" (outside the mode) opens the mode with the stage's stamped places and retired stamps
  chosen, so a whole stage is dated in two steps; in the mode the same place offers "Select stage" (AC-15). A stage with no stamp has
  neither. Its accessible name says which stage ("Set date: Stage 3").
- **AC-21**: On a phone the bar is fixed to the bottom of the screen and rides above the on-screen keyboard (the visual viewport's
  inset); from 1024 px it sticks to the top of the list's column (spec 0036) while the stages scroll, below the map's block, so a fullscreen map covers it (spec 0003 AC-11). At 375 and 320 px the page does
  not scroll sideways and the bar fits; its buttons, the date field and the calendar button, and the checkboxes (their label) are at
  least 44 x 44 px targets. With the keyboard: Tab reaches each checkbox, Space toggles it, Enter in the date field applies.
- **AC-22**: The texts of the mode (`dashboard.bulk*`) exist in every language with the same placeholders; the count message has
  the plural forms of each language.

## Out of scope

Notes on a stamp; a time of day; a different date per row or a range of dates when changing many; undo after Apply; dates for
places that are not stamped yet (stamping with a date is AC-1); a database check on the date range (it would
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

- Many dates are one database function, not two client updates, because the places and the extra stamps are two tables and two
  requests cannot be one transaction. The function locks the rows it counts (`for update`) and checks everything before it writes, so "nothing" needs no rollback and a row deleted by another transaction meanwhile makes it answer false instead of changing fewer rows. A request
  with a stamp that vanished meanwhile fails whole and the page is not refreshed: the choice stays, and the stamp drops out of it the
  next time the page is drawn.
- The mode keeps the stage list calm for visits that do not change dates: the checkboxes exist only while it is on. `BulkCheckbox` reads
  Shift from the click event (React raises a checkbox's change from the click); `BulkDateBar` does not reuse `StampDateInput`, whose
  saving after a pause is the opposite of Apply.
- On a phone the bar is `position: fixed`; a keyboard that only shrinks the visual viewport (Chrome and Safari do) would cover it, so
  its `bottom` follows the gap between the layout and the visual viewport (not while the page is pinch-zoomed).

## Coverage

| AC | Test |
| --- | --- |
| AC-2 | `src/lib/stamp-date.test.ts` |
| AC-1 | `stamp-date.test.ts` (local day), `actions.test.ts` (date goes to new rows only), `e2e/stamp-dates.spec.ts` (a user far ahead of UTC gets their own day) |
| AC-3, AC-4 | `src/app/[locale]/dashboard/actions.test.ts`, `src/lib/stamp-date.test.ts` (calendar dates) |
| AC-5, AC-6, AC-7, AC-9, AC-10, AC-12 | `src/components/StampDateInput.test.tsx` (timers, blur, invalid and other-format text, failure, focus, the calendar button and its fallbacks, the hidden picker, following the server), `e2e/stamp-dates.spec.ts` (typing a whole date makes one request; a future date is refused and restored; a day picked in the calendar is saved at once and the picker's range is 1938-01-01 to tomorrow in UTC; persistence after reload; extra stamps) |
| AC-9 (the native picker itself) | manual (native browser UI): click the calendar button in Chrome, Firefox and Safari (also on a phone): the picker opens on the field's date, a day that is picked appears in the field and is saved. Last checked: never recorded. |
| AC-8 | `src/lib/progress.test.ts` (months from `stamped_on`), `e2e/stamp-dates.spec.ts` (dates changed in bulk: the chart shows the new month) |
| AC-11 | `tests/messages.test.ts` (parity) |
| AC-13 | `src/app/[locale]/dashboard/actions.test.ts` (a retired stamp's date: before the retirement day, strict, mixed requests refused), `src/components/RetiredStampControl.test.tsx` (the field never sends a later day and restores it) |
| AC-13 (the calendar picker's last day) | manual (native browser UI, like AC-9's row): open the calendar of a collected retired stamp: days after the day before it retired cannot be picked. Last checked: never recorded. |
| AC-14, AC-15, AC-16, AC-19, AC-20 | `src/components/BulkDateBar.test.tsx` (the mode, the checkboxes of stamped rows only, leaving it, the server's HTML without the buttons, range and stage and all/clear choices, the bar's Apply states, nothing sent before Apply, pending, success and failure messages), `src/lib/bulk-dates.test.ts` (order of the rows, ranges, the request), `e2e/stamp-dates.spec.ts` (a click, a shift-click, Space, a stage, Enter; one request; the new dates and the chart's new month; Escape and Cancel; a vanished stamp; no JavaScript) |
| AC-17 | `src/app/[locale]/dashboard/actions.test.ts` (what is sent to the function, the limit of 500, invalid input, `unauthorized`, a refused request, a database error and its log line), `tests/database-rules.test.ts` (the function itself: the caller's rows and every variant only, all or nothing, who may call it, no inserts, security invoker, and a stamp deleted by another transaction meanwhile makes it answer false: two sessions) |
| AC-18 | `src/lib/bulk-dates.test.ts`, `src/components/BulkDateBar.test.tsx` (the bar names the stamps), `tests/database-rules.test.ts` (the function refuses the day it retired or later), `e2e/stamp-dates.spec.ts` |
| AC-21 | `e2e/mobile.spec.ts` (the mode at 375 and 320 px: no sideways scroll, the bar inside the window at the bottom, targets of 44 px, choosing and applying with taps), `e2e/stamp-dates.spec.ts` (Space and Enter; the fullscreen map is topmost over the bar at 1280 px), `e2e/accessibility.spec.ts` (`dashboard-change-dates`, both widths) |
| AC-21 (the bar above a real keyboard) | manual (a phone's on-screen keyboard cannot be opened by a test): on a phone, open "Change dates", tap the date field and check that the bar stays above the keyboard. Last checked: never recorded. |
| AC-22 | `tests/messages.test.ts` (parity and placeholders; the plural forms are ICU, read by `BulkDateBar.test.tsx` for English) |
