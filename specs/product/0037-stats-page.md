# 0037: My stats: the stats page and its monthly chart

Status: Done
Owner code: `src/app/[locale]/stats/page.tsx`, `src/components/MonthChart.tsx`, `src/lib/month-stats.ts`, `src/app/[locale]/dashboard/page.tsx`
(the header link), `messages/*.json` (`stats.*`, `dashboard.stats`)

## Goal

A page of its own for a signed-in user's progress over time: the figures of the dashboard and a chart with a bar for every month between the
first and the last stamp, empty months included, where pointing at a month says how many stamps and kilometres it holds and which stages.
It answers "when did I walk what", and is the only place the stamps-per-month chart lives.

## Behaviour

### The page

- **AC-1**: `/stats` (under every language prefix) is for signed-in users; a signed-out visitor is sent to the landing page. The dashboard's header has
  a link "My stats" to it, next to "Account" (spec 0014 AC-14). Other pages link to it by the same address.
- **AC-2**: The page's document title and `h1` are "My stats" (`ru`: Моя статистика, `hu`: Statisztikáim, `de`: Meine Statistik); the dashboard's header link has the same
  words.
- **AC-3**: Under the heading are four figures, in the dashboard's cards: the stamps ("N / 161", places not variant rows, spec 0001 AC-1), the walked
  kilometres, the remaining kilometres (spec 0001 AC-4) and the completed stages ("N / 27": a stage whose places are all stamped or waived, spec 0001 AC-20).
  They come from the same functions as the dashboard's, so the two pages never disagree. Below them is the "Stamps per month" chart in a card.
  A user with no stamp (no place and no extra stamp) sees a note instead of the chart. The page is one column in the page shell (spec 0036).

### What a month holds

- **AC-4**: For every calendar month from the first to the last stamp date, inclusive, places and extra stamps both, there is an entry, oldest first,
  including the months in which nothing was stamped (stamps 0). A stamp date is a day as written (`2026-06-30` is June): no time zone moves it.
  A stamp on a retired row (spec 0001 AC-22) is no stamp here and does not stretch the span.
- **AC-5**: A month's **stamps** are the places first stamped in it: places, not variant rows, each in the month of its earliest stamp.
- **AC-6**: A month's **stages** are the official stage numbers (1 to 27), ascending, of the places first stamped in it, so a stage that spans months appears in each
  month in which one of its places was stamped. An extra stamp (spec 0001 AC-12) dated in the month is counted apart, in `extraStamps`
  (never in the stamps), and its own stage is in the list too; one outside every stage adds no stage.
- **AC-7**: A month's **km** are the kilometres that became walked in it. A stretch between two neighbouring places (spec 0001 AC-3, a waived place is
  no neighbour: AC-18 there) belongs to the month of the **later** of its two stamp dates: a stamp placed next to one of an earlier month
  adds the whole stretch to the month it was stamped in. A stretch is never counted twice and never lost, so the months, summed unrounded and rounded to 0.1,
  are the dashboard's walked km. Only a month with a stamp can hold kilometres.
- **AC-8**: Changing a stamp's date (spec 0016) moves the stamp and the km that depend on it to the new month, and removing a stamp takes the stretches it made
  walked out of the month they were in: the months are a function of the stamps as they are now.
- **AC-9**: These are pure functions of the stamps and the places, `monthlyProgress` and its helpers in `src/lib/month-stats.ts`, returning for every month
  `{ month, stamps, extraStamps, stages, km }`. The page only reads (AC-16), calls them and writes the month names and sentences;
  the chart component draws what it is given.

### The chart

- **AC-10**: The chart has a bar for every month, of the height of its stamps, and the month axis names every month: the language's short month name,
  with the year under January and under the first bar, so no month is unlabelled and none is hidden. When the months do not fit the width, the chart
  scrolls sideways inside its own frame (a column is at least 46 px wide), never the page: no sideways scroll of the page at 375 and 320 px. A chart that scrolls
  opens on its newest months.
- **AC-11**: Hovering a month with a mouse, tapping it (AC-12) or focusing it with the keyboard opens a tooltip with the month's full name and year
  (localized) and its lines, one each: the stamps ("2 stamps"), the km rounded to 0.1 with the unit, the extra stamps when it has any, and the stages
  ("Stage 4", "Stages 3, 4, 5"; a run of four or more is written "3-7"). A month with no place and no extra stamp says "No stamps this month"; a month with only extra
  stamps names how many ("1 extra stamp") and has no km line. The tooltip stays inside the chart's frame and never widens the page.
- **AC-12**: A tap (touch or pen) on a month toggles its tooltip and needs no hover; a tap anywhere but on a month closes it; a mouse's hover opens it and
  leaving closes it (a click does not close what hovering opened). With the keyboard Tab reaches the chart once (one tab stop for all the months, first on the newest), Left and Right move to the previous and next month, Home and End to the first and last, focus alone shows the tooltip,
  Escape closes it and Enter or Space toggles it.
- **AC-13**: A month with no stamp has no bar but a faint baseline mark, and the whole column of the month is a target for AC-11 and AC-12, so a gap reads as zero.
- **AC-14**: The page, the figures, the month names, the tooltip and the axis are in every language (`stats.*`, `dashboard.stats`; the month names come
  from `Intl` in the page's language, in UTC so the month is the date's own). The tooltip texts have ICU plurals, so the forms of each language are right
  (`ru`: "1 печать", "2 печати", "5 печатей").
- **AC-15**: Every month is a button in a group named like the heading, and its accessible name is the month followed by the lines of its tooltip
  ("January 2026: 2 stamps, 8.1 km, Stage 1"); the tooltip itself and the axis are hidden from assistive technology as duplicates.
- **AC-16**: The page reads the user's own rows with the user's session (`user_stamps`, `user_extra_stamps`, under row level security: never another user's, never the
  service role) and the shared reference data through the dashboard's cached read (spec 0002 AC-15, AC-16).
- **AC-17**: The page passes the accessibility checks of spec 0006 AC-11 at both widths and its chart works on a phone (spec 0006 AC-10): a month's column is a target of at
  least 44 px wide.

## Out of scope

Weekly or daily views; a year selector; folding old years into one bar (a wrong year, stamp dates run from 1938, gives a long, mostly empty chart that scrolls);
a switch between stamps and km (the km are in the tooltip); a comparison with a friend's months (friends share no dates, spec 0024); a cumulative line; exporting the data;
retired stamps in the figures (spec 0001 AC-25); a feature flag.

## Notes

- Recharts draws the axes and sizes the bars; the bars are the component's own `shape` and the tooltip its own element, because Recharts' tooltip does not toggle on a tap,
  does not show for a zero-height bar and does not follow the keyboard. Everything handed to Recharts must keep its identity from one render to the next
  (module-level constants, the shape and the ticks as elements): Recharts takes a `shape` or a `tick` function for a component type, so a new function on every render
  rebuilds every bar and a focused bar loses its focus.
- The stage list of a tooltip is built from the official numbers, not from names: the start and end towns would not fit one line.
- A place first stamped in a month and a variant stamped later in another month count once, in the first; the later variant's date does not extend the span.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 | `e2e/stats.spec.ts` (signed out; the header link of the dashboard), `e2e/layout.spec.ts` and `e2e/site-logo.spec.ts` (the page among the signed-in pages) |
| AC-2 | `e2e/stats.spec.ts` (title and heading, in every language), `tests/messages.test.ts` (the words are the header link's) |
| AC-3 | `e2e/stats.spec.ts` (the four figures, the dashboard's values after a walk, completed stages, the note for a new user, only the user's own stamps), `e2e/layout.spec.ts` (shared edges, no sideways scroll at five widths in four languages) |
| AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 | `src/lib/month-stats.test.ts` (gaps and years, the span of places and extra stamps, a day is its own month, places not rows, retired stamps ignored, stages and extras, the later stamp's month, the order of stamps, the sum equal to the walked km, a waived place, a changed date, a removed stamp), `e2e/stats.spec.ts` (the six months of a walk in a browser, their km summing to the dashboard's), `e2e/stamp-dates.spec.ts` (dates changed in bulk: the new month has the stamps) |
| AC-10 | `e2e/stats.spec.ts` (every month named, years under January and the first bar; a 14-month walk scrolls inside its frame at 375 and 320 px, opens on the newest months, drops no label; fits at 1280 px), `e2e/mobile.spec.ts` (17 months at 375 px) |
| AC-11, AC-13 | `src/lib/month-stats.test.ts` (the stage list, the lines of a month, the empty and extra-only months), `e2e/stats.spec.ts` (every month's tooltip text in a browser, the bar heights, the mark of an empty month) |
| AC-12 | `e2e/stats.spec.ts` (mouse hover and leaving; Tab, arrows, Home, End, Escape, Enter, Space, one tab stop), `e2e/mobile.spec.ts` (a tap opens, a second tap closes, a tap elsewhere closes; the tooltip inside the screen) |
| AC-14 | `tests/messages.test.ts` (every key in every language, same placeholders), `src/lib/month-stats.test.ts` (Russian's four plural forms and the other languages' words from the real messages), `e2e/stats.spec.ts` (the month names, axis and tooltip as `Intl` writes them in every language; Russian plurals) |
| AC-15 | `e2e/stats.spec.ts` (the buttons' names, the group's name) |
| AC-16 | `e2e/stats.spec.ts` (a second user sees none of the first user's stamps); `src/lib/dashboard-data.ts` is the dashboard's, spec 0002 |
| AC-17 | `e2e/accessibility.spec.ts` (the stats page with six months drawn, both widths), `e2e/mobile.spec.ts` (the month's column is tappable: 44 px by `expectTappable`) |
