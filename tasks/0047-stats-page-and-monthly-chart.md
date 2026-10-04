# 0047: My stats page and a monthly chart that names every month

Status: Open
Specs: [0041](../specs/0041-stats-page.md) AC-1 to AC-14 (added), [0001](../specs/0001-progress.md) AC-5 (changed: per-month
counting), [0014](../specs/0014-pages-and-settings.md) AC-8 (changed: the chart leaves `/account`)

## Goal

Move the stamps-per-month chart to a stats page of its own, show every month (including the empty ones), and let a hover or
tap say how many stamps, how many km and which stages that month holds.

## Done when

- [ ] The open questions of spec 0041 are settled (the month a stretch belongs to, the toggle) and the spec is settled in the spec (it stays `Draft` until it is built: `tests/specs.test.ts` requires every file an Accepted or Done spec names to exist, so `Accepted` and `Done` are set when those files do)
- [ ] The pure month functions, the chart and `/stats` are built, with the tests of the coverage table
- [ ] The chart's tests move with it: `e2e/account.spec.ts` (the chart on the account page, the only check of spec 0001 AC-5's
      localized labels) becomes a stats-page test, and 0014's coverage row for AC-8 follows
- [ ] The months' km add up to the dashboard's walked km (a test)
- [ ] Checked at 320 and 375 px: the chart frame scrolls, the page does not
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: hovering a month should show stage numbers and distance, with a stamp placed next to
one of an earlier month adding the whole stretch to the current month; the month labels were incomplete and months with
0 km were confusing. The menu entry that leads here is task 0046.
