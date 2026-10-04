# 0041: My stats: a page, and the stamps-per-month chart

Status: Draft
Owner code: `src/lib/progress.ts` (`stampsPerMonth`, or a new `monthlyProgress`), `src/components/StampsChart.tsx`,
`src/app/[locale]/stats/page.tsx` (new), `src/app/[locale]/account/page.tsx`

Amends, when built: [0001](0001-progress.md) AC-5 (per-month counting: the months are now all shown, and carry stages
and km) and [0014](0014-pages-and-settings.md) AC-8 (the chart leaves `/account`, replaced by AC-1 here).

## Goal

A signed-in user's own statistics on a page of their own: how many stamps, how many km and stages, and how their
walking spread over the months. The monthly chart says, for every month, how many stamps, how many kilometres and
which stages, and names every month, so a month with nothing in it reads as a zero and not as a missing label.
It works on desktop and on a phone.

## Behaviour

### The page

- **AC-1**: `/stats` is for signed-in users; a signed-out visitor is sent to the landing page. It shows the user's
  stamps (N of the official places), walked km, remaining km, completed stages and the stamps-per-month chart. The
  chart is no longer on `/account` (this replaces spec 0014 AC-8).
- **AC-2**: The page title and `h1` are "My stats" (`ru`: Моя статистика, `hu`: Statisztikáim), and the page is
  reachable from the account menu (spec 0040 AC-2).

### What a month holds

- **AC-3**: For every month between the first and the last stamp date, inclusive, the chart has a bar, including the
  months in which nothing was stamped (a bar of height 0, with the month labelled). No month is skipped.
- **AC-4**: A month's **stamps** are the places first stamped in it, as in spec 0001 AC-5 (places, not variant rows,
  each in the month of its earliest stamp).
- **AC-5**: A month's **stages** are the stages that have at least one place first stamped in that month, as stage
  numbers in order. A stage that spans months appears in each month in which one of its places was stamped. Extra
  stamps (spec 0001 AC-12) are counted like places in their own stage's list, not in the stamp count of AC-4.
- **AC-6**: A month's **km** are the kilometres that became walked in it. A stretch between two neighbouring places
  (spec 0001 AC-3) is walked when the second of the two is stamped, and its km belong to the month of the **later** of
  its two stamp dates. So a stamp placed next to a stamp of an earlier month adds that whole stretch to *this*
  month, and the km of all months add up to the walked km of the dashboard (spec 0001 AC-4, rounded to 0.1). A
  stretch is never counted twice and never lost. A stretch that runs across a place waived under spec 0042 (it has no
  stamp and so no date) is one stretch between the stamped places on either side of it, dated by the later of their two
  dates.
- **AC-7**: Changing a stamp's date (spec 0016, bulk: spec 0044) moves the stamp and the km that depend on it to the
  new month; removing a stamp removes the stretches it made walked, from the month they were in.
- **AC-8**: These are pure functions of the stamps and the places; nothing is read or computed in the component. They
  return, for every month, `{ month, stamps, stages: number[], km }`, oldest first.

### The chart

- **AC-9**: Hovering (desktop) or tapping (mobile) a bar opens a tooltip with the month's full name and year
  (localized), the number of stamps, the km (rounded to 0.1, with the unit) and the stages ("Stages 3, 4, 5", runs
  abbreviated as "Stages 3-7", one line at most). A month with no place and no extra stamp says "No stamps this
  month"; a month with only extra stamps names how many. Tapping toggles the tooltip, it needs no hover, and keyboard
  focus on a bar shows it too.
- **AC-10**: The month axis labels every month, as short as it takes: a three-letter month, with the year under
  January and under the first bar, so months stay unambiguous without hiding any. When twelve labels do not fit at 320
  or 375 px, the chart scrolls horizontally inside its own frame (not the page) with a minimum bar width, instead of
  dropping labels.
- **AC-11**: A month with 0 stamps shows a faint baseline mark and the tooltip of AC-9, so a gap reads as zero.
- **AC-12**: A toggle ("Stamps" / "Km") switches what the bars show; the tooltip is the same under either.
- **AC-13**: The title, tooltip, axis and toggle are translated in all three languages. The tooltip text comes from
  message keys with ICU plurals, so Russian (`ru`: "1 печать", "2 печати", "5 печатей") and Hungarian forms are
  correct.
- **AC-14**: The chart is usable with a screen reader: a visually hidden table (month, stamps, km, stages) carries the
  same data, or each bar has an `aria-label` with the same sentence as the tooltip.

## Out of scope

Weekly or daily views; a year selector; comparing with a friend's months (friends share no dates, spec 0024); a
cumulative line; exporting the data.

## Open questions

- **Which month does a stretch belong to?** AC-6 uses the later of the two stamps. Example: A is stamped in June and C in
  August; B, between them, is stamped last, in September. A-B and B-C are both walked in September, because B is the later
  stamp of both pairs. (Had B been stamped in July, A-B would count in July and B-C in August.) Is that the intended
  outcome?
- **A mistyped year.** Stamp dates run from 1938 (spec 0016 AC-2), so one wrong year gives a chart of a hundred empty
  months. This draft shows every month of the span; the alternative is to show empty months only inside the last 60 and
  fold older ones into a per-year bar.
- **Stage numbers or names?** The tooltip lists the official stage numbers (1 to 27). The start and end towns would
  make it too long; leave them out?
- **The toggle.** Is a Stamps/Km toggle wanted, or are km only in the tooltip? It is an addition to what was asked.
- **Retired and moved stamps** (spec 0042) do not change this: retired stamps are left out of the counts.

## Notes

- `stampedPlaceKeys` already returns each place's earliest date; the km come from the ordering `walkedRanges` uses
  (`src/lib/progress.ts`): sum `b.km - a.km` per month of the later of the two dates for every pair of neighbours with
  both stamped. A test checks that the sum equals `progressSummary().doneKm` within the 0.1 rounding.
- A stamp date such as `2026-06-30` belongs to its calendar month, as the dashboard treats stamp dates (a day, not an
  instant). Do not convert time zones.
- Recharts hides ticks that overlap by default (`interval="preserveEnd"`), the cause of the unnamed months: set
  `interval={0}` and size the chart to its data.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2 | planned: `e2e/stats.spec.ts` (signed in and out, the chart is gone from `/account`, the title) |
| AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | planned: `src/lib/progress.test.ts` (gaps, a stamp next to an earlier month, the A-C-B order, the sum equals `doneKm`, extras) |
| AC-9, AC-10, AC-11, AC-12, AC-14 | planned: `src/components/StampsChart.test.tsx` |
| AC-13 | `tests/messages.test.ts`, plus the plural forms in `src/components/StampsChart.test.tsx` |
| AC-10 (320 and 375 px) | planned: `e2e/stats.spec.ts` (the frame scrolls, the page does not) |
