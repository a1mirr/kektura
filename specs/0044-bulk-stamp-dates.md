# 0044: Stamp dates in bulk

Status: Draft
Owner code: `src/lib/stamp-date.ts`, `src/app/[locale]/dashboard/actions.ts`, `src/components/BulkDateBar.tsx` (new),
`src/components/StageSection.tsx`, `src/components/StageControls.tsx`

Amends, when built: [0016](0016-stamp-dates.md) (its out-of-scope line about editing many dates; AC-4 gains a bulk sibling).

## Goal

A user who adds a whole day's walk, or enters a past trip of fourteen stamps, can set one date for all of them in one
step instead of editing fourteen fields. It works on desktop and on a phone.

## Behaviour

### Selecting

- **AC-1**: The dashboard has a "Change dates" mode (a button next to the stage controls). In it every stamped place and
  extra stamp has a checkbox; unstamped ones have none and cannot be chosen. Leaving the mode (Cancel, Escape, or after a
  save) clears the selection.
- **AC-2**: In the mode each stage header has "select all stamped of this stage" (it ignores unstamped places) and the bar
  has "select all" and "clear". The count of selected stamps is announced ("5 selected", `aria-live`).
- **AC-3**: On desktop, shift-click selects the range between the last chosen row and the clicked one in trail order. On
  mobile, tapping checkboxes is enough.

### Setting the date

- **AC-4**: A sticky bar (bottom on mobile, kept inside the visible area while the on-screen keyboard is open; top on desktop) shows the number selected, a date
  field and an "Apply" button. The field is the `yyyy-mm-dd` text field of spec 0016 AC-5 with its calendar button (AC-9),
  and the same limits (a real date, `min` 1938-01-01, `max` tomorrow in UTC, spec 0016 AC-2). Apply is disabled for an empty, invalid or out-of-range date and when nothing is selected.
- **AC-5**: Nothing is sent until Apply (spec 0016 AC-6: never save on `change`). While saving, the bar shows a pending
  state and a second press sends nothing.
- **AC-6**: `setStampDates(placeKeys, extraIds, date)` is one server action: it only **updates** `stamped_on` of the
  signed-in user's existing rows (every variant of a place), never inserts, touches only the caller's rows (RLS and a
  `user_id` filter) and refuses a request over 500 items (more than the 161 places and the 72 extra stamps, so "select all" always fits). An invalid date is rejected without database access (`failed`),
  a missing session is `unauthorized`, nothing updated is `failed`. It is all or nothing: a failure leaves every date as
  it was. Once spec 0042 is built, a request that contains a retired stamp with a date on or after its `retired_on` is refused as a whole
  (`failed`), and the bar names those stamps before Apply. It never throws and logs failures like the others (specs 0008, 0016).
- **AC-7**: After success the page shows the new dates, the selection is cleared, the mode closes and a message names the
  count ("12 dates changed"). After a failure the saved dates and the selection are kept, "Couldn't save, try again." shows
  (spec 0002 AC-10), and an expired session refreshes the page (spec 0002 AC-11).
- **AC-8**: The new dates feed the statistics as in spec 0016 AC-8: a stamp moves to its new month in the chart of spec
  0041.
- **AC-9**: The mode works at 320 and 375 px (the bar fits, checkboxes have 44 x 44 px targets) and on desktop, and with
  the keyboard (Tab to a checkbox, Space to toggle, Enter in the date field applies).
- **AC-10**: Without JavaScript the mode is not offered; the single date fields of spec 0016 stay.
- **AC-11**: The texts are translated in `ru`, `en` and `hu`.

## Out of scope

Dates for places that are not stamped yet (stamping with a date, spec 0016 AC-1); a date range or a different date per
row; undo after Apply; a "same day for a whole stage" shortcut beyond AC-2's select-all.

## Open questions

- **Limit.** 500 per request leaves room for everything (161 places plus 72 extras are 233). Is a limit needed at all?
- **Stage as a unit.** A quick "set the date of this stage" on each stage header (no mode) may be what people want most.
  Add it next to AC-2, or leave it?
- **A mode or an always-visible checkbox.** A mode keeps the stage list calm for the visits that do not edit dates.

## Notes

- Extra stamps use `setExtraStampDate` today (`user_extra_stamps`; migration `0007_edit_dates.sql` has the UPDATE policy);
  bulk needs both tables in one call. A `security invoker` database function makes "all or nothing" real, because two
  client updates cannot be one transaction: a migration is likely, local first, named after its task's number.
- `StampDateInput` (spec 0016) saves 700 ms after typing: the bulk field must not reuse that behaviour.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 | planned: `src/components/StageSection.test.tsx`, `src/components/StageControls.test.tsx` (checkboxes on stamped rows only, select all per stage and overall, shift ranges in trail order) |
| AC-4, AC-5 | planned: `src/components/BulkDateBar.test.tsx` (the field, Apply disabled states, nothing sent before Apply, pending); manual (a real phone keyboard, which no test can open): on a phone, tap the date field in the bar and check that the bar stays above the keyboard. Last checked: never recorded. |
| AC-6 | planned: `src/app/[locale]/dashboard/actions.test.ts`, plus a database test for the function if one is added |
| AC-7, AC-8, AC-9, AC-10 | planned: `e2e/stamp-dates.spec.ts` (select, apply, the new month in the chart, 375 px, keyboard) |
| AC-11 | `tests/messages.test.ts` |
