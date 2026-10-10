# 0016: Stamp dates

Status: Done
Owner code: `src/lib/stamp-date.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/components/StampDateInput.tsx`,
`StampButton.tsx`, `ExtraStampButton.tsx`, `StageStampButton.tsx`, `CalendarButton.tsx`, `supabase/migrations/0007_edit_dates.sql`; for setting many dates at once
(AC-14 to AC-22): `src/lib/bulk-dates.ts`, `BulkDatesProvider.tsx`, `BulkDateBar.tsx`, `BulkCheckbox.tsx`, `BulkStageButton.tsx`,
`supabase/migrations/0080_bulk_stamp_dates.sql`, `0137_bulk_dates_everywhere.sql`; `messages/*.json` (`dashboard.stampDate`, `dashboard.openCalendar`, `dashboard.bulk*`)

## Goal

Every stamp has a date, and the user can correct it ("I collected this one in June"). A new stamp gets the
user's own day. A date is only ever saved when it is a real, complete one, never a half-typed one, and it reads
`yyyy-mm-dd` in every language and browser (a native date field would show `10/02/2026`, which is 2 October or
10 February depending on who looks), with a calendar one click away. A stretch walked on one day is dated in one go: the user chooses rows, stamped or not yet, and gives one date, which re-dates the stamped ones and stamps the others.

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
- **AC-8**: The dates are what the per-month statistics use (spec 0037), so correcting a date moves the
  stamp, and the km that depend on it, to its new month.
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

### Setting many dates at once

- **AC-14**: On the dashboard a "Set dates" button floats on the screen and stays there while the page scrolls (AC-21); it opens the "Set dates"
  mode, in which the button is gone and the bar (AC-16) is open. In the mode every place and extra stamp has a checkbox whose name is
  "Select" and its name, stamped or not, and so has a retired stamp that is stamped (an unstamped retired stamp is collected on its own, AC-13).
  Outside the mode no row has one. Leaving the mode (Cancel, Escape, or a saved change) forgets the choice, gives the focus back to the button
  (an Escape that closes a row's open note is the note's: the mode stays); the next visit starts empty. Opening the mode moves the focus into
  the bar. Without JavaScript the mode is not offered (the button, the bar, the checkboxes and the stage buttons of AC-15 are not in the
  server's HTML) and the single date fields stay. The button is only on the dashboard, not on a friend's page.
- **AC-15**: In the mode a click on a checkbox chooses or unchooses its row. A click with Shift held gives the rows from the last
  clicked one to this one the state this row gets, in the order of the page: each stage's places with a retired stamp where it stands,
  then the extra stamps (so a range can run from a place into the extras). Each stage's header has "Select stage" (in the mode only), which
  adds every place of that stage, stamped or not, and the stamped retired stamps (the extra stamps are no stage's), and the bar has "Select all" and "Clear" ("Clear"
  keeps the mode). The number chosen is in a status region ("5 selected"). A chosen row that is no longer on the page is no longer chosen or counted.
- **AC-16**: In the mode a bar shows the number chosen and, when some of them are not stamped yet, how many ("5 selected · 2 not stamped
  yet"), a date field and "Apply". The field is the `yyyy-mm-dd` text field of AC-5 with its calendar button (AC-9), limited as in AC-2
  (the picker offers 1938-01-01 to tomorrow, UTC). Apply is disabled for nothing chosen, and for an empty, incomplete, other-format,
  impossible or out-of-range date, and while a retired stamp stands in the way (AC-18). Nothing is sent before Apply: not while the date is
  typed, not on leaving the field, not when a day is picked in the calendar (a pick fills the field, unlike AC-9). Enter in the date field
  applies. While saving the bar is busy ("Saving…"), a second press or Enter sends nothing, and Escape and Cancel do not close it.
- **AC-17**: `setStampDates(placeKeys, extraIds, date)` is one server action that gives the signed-in user's places (every variant of
  each) and extra stamps one date: a row that is stamped is re-dated, one that is not stamped yet is stamped with it (a new stamp is created,
  as stamping does). It touches only the caller's rows (row level security, and the function writes the caller's own user id) and never
  deletes. It takes 1 to 500 places and extra stamps together (more than the 161 places and 72 extra stamps, so "select all" always fits) and
  a valid stamp date (AC-2); anything else is refused without database access (`failed`, one warning); a missing session is `unauthorized`.
  The database function `set_stamp_dates` does the work in one transaction, so it is all or nothing: when a place or extra stamp does not exist it
  answers false, nothing changes and the result is `failed`. A refusal by the function is logged as one warning with no input (spec 0008 AC-3:
  `request refused`, never sent to Telegram); a database error is `failed` and logged like the other stamp actions (spec 0008); it never
  throws. Only a signed-in user may call the function, and it runs as the caller (`security invoker`).
- **AC-18**: A retired stamp (spec 0001 AC-22) may only get a date before the day it retired, also in a request with other stamps (a
  request that holds one with a date on or after it is refused whole, by the function too). The bar names the chosen retired stamps that
  the typed date cannot go to and keeps Apply disabled until the date is earlier or they are unchosen.
- **AC-19**: After a save that went through, the page shows the new dates, the mode is closed, the choice is cleared and a status
  message names the count ("12 dates set", "1 date set"; it is gone when the mode is opened again). After a failure the
  dates and the choice are kept, the bar shows "Couldn't save, try again." (spec 0002 AC-10) and Apply works again; an expired session
  refreshes the page (spec 0002 AC-11). The new dates are what the statistics use (AC-8).
- **AC-20**: Removed. A stage's "Set date" outside the mode is gone: the way into the mode is the floating button (AC-14), and "Select stage" (AC-15) is inside the mode.
- **AC-21**: The floating button is fixed to the bottom right of the screen at every width, a target of at least 44 px, and from 1024 px under
  the map's block like the bar. On a phone the bar is fixed to the bottom of the screen and rides above the on-screen keyboard (the visual viewport's
  inset); from 1024 px it sticks to the top of the list's column (spec 0036) while the stages scroll, below the map's block, so a fullscreen map covers it (spec 0003 AC-11). At 375 and 320 px the page does
  not scroll sideways and the bar fits; its buttons, the date field and the calendar button, and the checkboxes (their label) are at
  least 44 x 44 px targets. With the keyboard: Tab reaches each checkbox, Space toggles it, Enter in the date field applies.
- **AC-22**: The texts of the mode (`dashboard.bulk*`) exist in every language with the same placeholders; the count message has
  the plural forms of each language.

## Out of scope

Notes on a stamp; a time of day; a different date per row or a range of dates when setting many; unstamping many; undo after Apply; a database check on the date range (it would
need `current_date`, which can't be part of a constraint that must hold when a dump is reloaded); a custom-built
calendar widget. Other dates on the site (the changelog's long dates, the month labels of the stats page's
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

- Many dates are one database function, not client writes, because the places and the extra stamps are two tables and two
  requests cannot be one transaction. The function checks everything (the places and extra stamps exist, no retired stamp gets a day on or after
  its retirement) before it writes, so "nothing" needs no rollback; it writes with `insert … on conflict do update`, so a row that another
  transaction deleted meanwhile is simply stamped again. It replaces the update-only function of migration 0080 under the same name and signature,
  so the code that runs while the migration is applied keeps working. A request that fails does not refresh the page: the choice stays.
- The mode keeps the stage list calm for visits that do not set dates: the checkboxes exist only while it is on. The button is `position: fixed` with `mb-0`: the list's wrapper spaces its children with a margin that would lift a fixed box. `BulkCheckbox` reads
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
| AC-8 | `src/lib/month-stats.test.ts` (months from `stamped_on`, a changed date moves a stamp and its km), `e2e/stamp-dates.spec.ts` (dates changed in bulk: the stats page's new month has the stamps) |
| AC-11 | `tests/messages.test.ts` (parity) |
| AC-13 | `src/app/[locale]/dashboard/actions.test.ts` (a retired stamp's date: before the retirement day, strict, mixed requests refused), `src/components/RetiredStampControl.test.tsx` (the field never sends a later day and restores it) |
| AC-13 (the calendar picker's last day) | manual (native browser UI, like AC-9's row): open the calendar of a collected retired stamp: days after the day before it retired cannot be picked. Last checked: never recorded. |
| AC-14, AC-15, AC-16, AC-19 | `src/components/BulkDateBar.test.tsx` (the floating button and its classes, the mode, a checkbox on every row whether stamped or not and none on a row the page does not hand over, leaving it and the focus going back to the button, the focus moving into the bar, the server's HTML without the button, bar and stage buttons, no stage button outside the mode, range and stage and all/clear choices, the "not stamped yet" count, the bar's Apply states, nothing sent before Apply, pending, success and failure messages), `src/lib/bulk-dates.test.ts` (order of the rows, unstamped places and extras listed, an unstamped retired stamp left out, ranges, the request, the count of new stamps), `e2e/stamp-dates.spec.ts` (a click, a shift-click, Space, a stage, Enter; every place and extra stamp has a checkbox; one request; unstamped rows stamped with the date next to re-dated ones; the new dates and stamp count and the stats page's new month; Escape and Cancel and the focus; a stamp removed meanwhile; no checkbox for an uncollected retired stamp; no JavaScript) |
| AC-17 | `src/app/[locale]/dashboard/actions.test.ts` (what is sent to the function, the limit of 500, invalid input, `unauthorized`, a refused request, a database error and its log line), `tests/database-rules.test.ts` (the function itself: stamps rows that are not stamped yet, every variant, and re-dates the others; only the caller's rows, all or nothing for a place or extra stamp that does not exist, who may call it, never deletes, security invoker, and a stamp deleted by another transaction meanwhile is stamped again: two sessions) |
| AC-18 | `src/lib/bulk-dates.test.ts`, `src/components/BulkDateBar.test.tsx` (the bar names the stamps), `tests/database-rules.test.ts` (the function refuses the day it retired or later, for a stamped and for an uncollected retired stamp), `e2e/stamp-dates.spec.ts` |
| AC-21 | `src/components/BulkDateBar.test.tsx` (the button's fixed position, z-index and height; the keyboard's gap from a stubbed visual viewport: it follows a resize and a scroll, is 0 while pinch-zoomed or without a viewport, and the listeners go with the bar), `e2e/mobile.spec.ts` (the button and the mode at 375 and 320 px: no sideways scroll, the button at the bottom corner and still on screen after scrolling, the bar inside the window at the bottom, targets of 44 px, choosing a stamped and an unstamped place and applying with taps), `e2e/stamp-dates.spec.ts` (Space and Enter; the fullscreen map is topmost over the button and over the bar at 1280 px), `e2e/accessibility.spec.ts` (`dashboard-change-dates`, both widths) |
| AC-21 (the bar above a real keyboard) | manual (the unit test feeds the gap from a stub; only a real phone shows what its keyboard does to the visual viewport): on a phone, open "Set dates", tap the date field and check that the bar rides just above the keyboard with the field and Apply visible. Last checked: never recorded. |
| AC-22 | `tests/messages.test.ts` (parity and placeholders; the plural forms are ICU, read by `BulkDateBar.test.tsx` for English) |
