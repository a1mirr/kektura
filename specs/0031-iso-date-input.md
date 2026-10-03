# 0031: Stamp dates as yyyy-mm-dd

Status: Done
Owner code: `src/components/StampDateInput.tsx`, `messages/*.json` (`dashboard.openCalendar`)

## Goal

The date field of a stamp was a native `<input type="date">`, which shows the date in the visitor's browser
format (`10/02/2026` is 2 October or 10 February, depending on who looks). A hiker comparing dates with a
friend, or reading their own list, shouldn't have to guess. Every date the user types or reads in that field is
written `yyyy-mm-dd`, in every language and browser, and a calendar is still one click away.

## Behaviour

- **AC-1**: The date of a stamp (places and extra stamps) is a text field showing and accepting `yyyy-mm-dd`
  (`2026-10-02`): placeholder `yyyy-mm-dd`, at most 10 characters. It has the
  accessible label "Date of the stamp" (spec 0016 AC-5) and shows the saved date.
- **AC-2**: The saving rules of spec 0016 AC-6 and AC-7 are unchanged. Text that isn't a valid stamp date
  (spec 0016 AC-2), such as `15/09/2026`, `2026-9-5` or `2026-02-30`, is never sent, and leaving the field
  restores the saved date.
- **AC-3**: Next to the field is a calendar button (accessible name "Open calendar"). It opens the browser's
  date picker on the current date of the field, limited to the valid range: 1938-01-01 to tomorrow (UTC). Picking a
  day fills the field and saves it at once (a pick is one complete date: no pause is needed); failures and
  expired sessions behave as in spec 0016 AC-7.
- **AC-4**: The picker is an implementation detail of the button: it is hidden from keyboard and screen
  readers, so the text field is the only date control they meet.
- **AC-5**: The button's label exists in `ru`, `en` and `hu`. The placeholder is the format itself and is not
  translated.

## Out of scope

Other dates on the site (the changelog's long dates, the month labels of the "Stamps per month" chart) keep
their localized form: this spec covers the fields where a date is entered. A custom-built calendar widget.

## Notes

- `showPicker()` opens the native picker from a click; where a browser lacks it the button falls back to
  `click()` on the hidden date input.
- The field does not ask phones for a numeric keypad (`inputmode`): the iPhone's digits-only keypad has no hyphen, so
  the date couldn't be typed there. The calendar button is the quick way on a phone.
- The hidden date input also keeps the browser's own range limits, so the calendar can't pick an invalid day.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4, AC-5 | `src/components/StampDateInput.test.tsx`, `tests/messages.test.ts` (parity) |
| AC-1, AC-2, AC-3 on the real dashboard | `e2e/stamp-dates.spec.ts` (the range of the picker: 1938-01-01 to tomorrow in UTC) |
| AC-3 (the native picker itself) | manual: click the calendar button in Chrome, Firefox and Safari (also on a phone): the picker opens on the field's date, a day that is picked appears in the field and is saved |
