# 0047: My stats page and a monthly chart that names every month

Status: Open
Specs: [0001](../specs/0001-progress.md) AC-5 and its coverage row (per-month counting), [0014](../specs/0014-pages-and-settings.md) Goal, AC-8, its Notes line, its coverage row and its index row (the chart leaves `/account`)

## Goal

Move the stamps-per-month chart to a stats page of its own, show every month (including the empty ones), and let a hover or
tap say how many stamps, how many km and which stages that month holds.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The pure month functions, the chart and `/stats` are built, with the tests under "Tests to write"
- [ ] The chart's tests move with it: `e2e/account.spec.ts` (the chart on the account page, the only check of spec 0001 AC-5's
      localized labels) becomes a stats-page test, and spec 0014's coverage row for AC-8 follows
- [ ] The months' km add up to the dashboard's walked km (a test)
- [ ] Checked at 320 and 375 px: the chart frame scrolls, the page does not
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here.

### The page

- [ ] **R-1**: `/stats` is for signed-in users; a signed-out visitor is sent to the landing page. It shows the user's
  stamps (N of the official places), walked km, remaining km, completed stages and the stamps-per-month chart. The
  chart is no longer on `/account` (this replaces spec 0014 AC-8).
- [ ] **R-2**: The page title and `h1` are "My stats" (`ru`: Моя статистика, `hu`: Statisztikáim), and the page is
  reachable from the account menu (task 0046 R-2).

### What a month holds

- [ ] **R-3**: For every month between the first and the last stamp date (places and extra stamps both), inclusive, the chart has a bar, including the
  months in which nothing was stamped (a bar of height 0, with the month labelled). No month is skipped.
- [ ] **R-4**: A month's **stamps** are the places first stamped in it, as in spec 0001 AC-5 (places, not variant rows,
  each in the month of its earliest stamp).
- [ ] **R-5**: A month's **stages** are the stages that have at least one place first stamped in that month, as stage
  numbers in order. A stage that spans months appears in each month in which one of its places was stamped. Extra
  stamps (spec 0001 AC-12) are listed in their own stage's list too, and counted apart, in `extraStamps`, not in the
  stamp count of R-4. The page reads `user_stamps` and `user_extra_stamps`.
- [ ] **R-6**: A month's **km** are the kilometres that became walked in it. A stretch between two neighbouring places
  (spec 0001 AC-3) is walked when the second of the two is stamped, and its km belong to the month of the **later** of
  its two stamp dates. So a stamp placed next to a stamp of an earlier month adds that whole stretch to *this*
  month, and the km of all months add up to the walked km of the dashboard (spec 0001 AC-4): the months are summed unrounded and
  rounded to 0.1 only for display, so the sum matches the dashboard's figure. A
  stretch is never counted twice and never lost. Once tasks 0048 to 0050 is built, a stretch that runs across a place it waives (no
  stamp, so no date) is one stretch between the stamped places on either side of it, dated by the later of their two
  dates.
- [ ] **R-7**: Changing a stamp's date (spec 0016, bulk: task 0053) moves the stamp and the km that depend on it to the
  new month; removing a stamp removes the stretches it made walked, from the month they were in.
- [ ] **R-8**: These are pure functions of the stamps and the places; nothing is read or computed in the component. They
  return, for every month, `{ month, stamps, extraStamps, stages: number[], km }`, oldest first.

### The chart

- [ ] **R-9**: Hovering (desktop) or tapping (mobile) a bar opens a tooltip with the month's full name and year
  (localized), the number of stamps, the km (rounded to 0.1, with the unit) and the stages ("Stages 3, 4, 5", runs
  abbreviated as "Stages 3-7", one line at most). A month with no place and no extra stamp says "No stamps this
  month"; a month with only extra stamps names how many. Tapping toggles the tooltip, it needs no hover, and keyboard
  focus on a bar shows it too.
- [ ] **R-10**: The month axis labels every month, as short as it takes: a three-letter month, with the year under
  January and under the first bar, so months stay unambiguous without hiding any. When twelve labels do not fit at 320
  or 375 px, the chart scrolls horizontally inside its own frame (not the page) with a minimum bar width, instead of
  dropping labels.
- [ ] **R-11**: A month with 0 stamps shows a faint baseline mark and the tooltip of R-9, so a gap reads as zero.
- [ ] **R-12**: A toggle ("Stamps" / "Km") switches what the bars show; the tooltip is the same under either.
- [ ] **R-13**: The title, tooltip, axis and toggle are translated in all three languages. The tooltip text comes from
  message keys with ICU plurals, so Russian (`ru`: "1 печать", "2 печати", "5 печатей") and Hungarian forms are
  correct.
- [ ] **R-14**: The chart is usable with a screen reader: a visually hidden table (month, stamps, km, stages) carries the
  same data, or each bar has an `aria-label` with the same sentence as the tooltip.

## Out of scope

Weekly or daily views; a year selector; comparing with a friend's months (friends share no dates, spec 0024); a
cumulative line; exporting the data.

## Open questions

- **Which month does a stretch belong to?** R-6 uses the later of the two stamps. Example: A is stamped in June and C in
  August; B, between them, is stamped last, in September. A-B and B-C are both walked in September, because B is the later
  stamp of both pairs. (Had B been stamped in July, A-B would count in July and B-C in August.) Is that the intended
  outcome?
- **A mistyped year.** Stamp dates run from 1938 (spec 0016 AC-2), so one wrong year gives a chart of a hundred empty
  months. This task shows every month of the span; the alternative is to show empty months only inside the last 60 and
  fold older ones into a per-year bar.
- **Stage numbers or names?** The tooltip lists the official stage numbers (1 to 27). The start and end towns would
  make it too long; leave them out?
- **The toggle.** Is a Stamps/Km toggle wanted, or are km only in the tooltip? It is an addition to what was asked.
- **Retired and moved stamps** (tasks 0048 to 0050) do not change this: retired stamps are left out of the counts here unless the owner decides otherwise in task 0049's open question.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-2 | planned: `e2e/stats.spec.ts` (signed in and out, the chart is gone from `/account`, the title) |
| R-3, R-4, R-5, R-6, R-7, R-8 | planned: `src/lib/progress.test.ts` (gaps, a stamp next to an earlier month, the A-C-B order, the sum equals `doneKm`, extras) |
| R-9, R-10, R-11, R-12, R-14 | planned: the sentences and labels in `src/lib/progress.test.ts` or a pure formatter test; `e2e/stats.spec.ts` for the tooltip, tap, keyboard focus and axis labels (Recharts has no layout in jsdom, so a component test would assert nothing real) |
| R-13 | `tests/messages.test.ts`, plus the plural forms in the formatter test |
| R-10 (320 and 375 px) | planned: `e2e/stats.spec.ts` (the frame scrolls, the page does not) |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: hovering a month should show stage numbers and distance, with a stamp placed next to
one of an earlier month adding the whole stretch to the current month; the month labels were incomplete and months with
0 km were confusing. The menu entry that leads here is task 0046.

- `stampedPlaceKeys` already returns each place's earliest date; the km come from the ordering `walkedRanges` uses
  (`src/lib/progress.ts`): sum `b.km - a.km` per month of the later of the two dates for every pair of neighbours with
  both stamped. A test checks that the sum equals `progressSummary().doneKm` within the 0.1 rounding.
- A stamp date such as `2026-06-30` belongs to its calendar month, as the dashboard treats stamp dates (a day, not an
  instant). Do not convert time zones.
- Recharts hides ticks that overlap by default (`interval="preserveEnd"`), the cause of the unnamed months: set
  `interval={0}` and size the chart to its data.

Code the work touches: `src/lib/progress.ts` (`stampsPerMonth`, or a new `monthlyProgress`), `src/components/StampsChart.tsx`, `src/app/[locale]/stats/page.tsx` (new), `src/app/[locale]/account/page.tsx`
