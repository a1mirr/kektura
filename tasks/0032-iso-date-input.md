# 0032: Stamp dates as yyyy-mm-dd

Status: Done
Specs: [0016](../specs/0016-stamp-dates.md) AC-5, AC-6, AC-9 to AC-11 (this task was written as spec 0032; its behaviour now lives there)

## Goal

The date field of a stamp was a native `<input type="date">`, which shows the date in the visitor's browser format
(`10/02/2026` is 2 October or 10 February, depending on who looks). A hiker comparing dates with a friend, or
reading their own list, shouldn't have to guess. Every date the user types or reads in that field is written
`yyyy-mm-dd`, in every language and browser, and a calendar is still one click away.

## Done when

- [x] The date of a stamp is a `yyyy-mm-dd` text field with a placeholder, a label and a 10 character limit (was 0032 AC-1, now 0016 AC-5)
- [x] The saving rules are unchanged and other formats are never sent (was AC-2, now 0016 AC-6)
- [x] A calendar button opens the browser's date picker in the valid range and a pick is saved at once (was AC-3, now 0016 AC-9)
- [x] The picker is hidden from keyboard and screen readers (was AC-4, now 0016 AC-10)
- [x] The button's label exists in `ru`, `en` and `hu` (was AC-5, now 0016 AC-11)

## Spec changes

The five acceptance criteria of the original spec moved into spec 0016 (AC-5, AC-6, AC-9, AC-10, AC-11). Its notes
about `showPicker()`, the numeric keypad and the hidden input's range limits are in 0016's notes.

## Notes

- Other dates on the site (the changelog's long dates, the month labels of the chart) kept their localized form;
  a custom-built calendar widget was out of scope.
