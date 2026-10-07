# 0001: Progress: places, walked stretches, stats, stages, extra stamps in stages

Status: Done
Owner code: `src/lib/progress.ts`, `src/app/[locale]/dashboard/page.tsx`, `src/components/StageSection.tsx`,
`src/components/StampDescriptions.tsx`, `src/components/RequiredFrom.tsx`, `src/lib/new-stamps.ts`,
`src/components/RetiredRow.tsx`, `src/components/RetiredStampControl.tsx`, `src/components/RetiredToggle.tsx`, `src/lib/retired-toggle.ts`

## Goal

Turn a user's stamps into progress along the Országos Kéktúra: which stamping places are done, which
stretches count as walked, how many km that is, and the per-stage view of the list, including which stage each
extra stamp belongs to. A stamp the MTSZ put up later is required only from its official date, so nobody who
walked before it is shown as missing it.

## Behaviour

### Places

- **AC-1**: Checkpoint rows that share a `place_key` (alternative stamps `_1`/`_2`/`_3` at one place)
  form one place. The place sits at the km of its furthest-along variant (the MTSZ table measures
  to it). Its label is `<stage>.<stage_seq>`, falling back to `seq`; its key falls back to `code`,
  then `id`. Places keep the order of their first variant. Today: 220 rows = 161 places (retired rows, AC-22, are not places).
- **AC-2**: A place is stamped when any of its variants is stamped.

### Walked stretches and stats

- **AC-3**: Stamps can be collected in any order. The stretch between two neighbouring places (in
  km order) counts as walked only when both are stamped; a place the user was not missing (AC-17) is not a
  neighbour, the stretch runs across it (AC-18). Touching stretches merge into one range.
  The map's blue line and the km/percent stats both come from these ranges.
- **AC-4**: Total km = last place km - first place km; walked km = sum of the ranges; remaining =
  total - walked (never negative); percent = walked / total, rounded. Kilometres are rounded to
  0.1. With no places everything is 0.
- **AC-5**: Removed. The per-month figures (stamps, km, stages) are spec 0037's.

### Stamps required from a date

The MTSZ publishes the day on which each new stamp became required (spec 0004 AC-10): a hiker who passes the place on or
after it must have its stamp in the book, one who passed earlier is not missing anything.

- **AC-16**: A place has an optional `requiredFrom` date (`YYYY-MM-DD`; `checkpoints.required_from`, filled by the seed): the
  earliest of its variants' dates. A place with no date, or any variant without one, is required from the beginning.
- **AC-17**: A place with a `requiredFrom` that the user has not stamped is **waived** when the user walked past it before that
  day. The day is read from the stamp dates (spec 0016) of the nearest stamped places on either side of it in trail order, however far
  away: the **later** of the two dates (the one date there is, when only one side has a stamped place). If it is before
  `requiredFrom` the place is waived; on or after it, the stamp is required and the place blocks its stretches like any
  unstamped place. With no stamped place on either side nothing is waived. A stamped place is never waived, so stamping it later (on any
  date) takes nothing away from it. The rule reads the neighbours' dates, so a late stamp (or a changed date, spec 0016) on a
  neighbour can make an adjacent new place required again.
- **AC-18**: A waived place is not a neighbour of a stretch: the stretch runs across it, from the stamped place before it to the one
  after, so the walked ranges, km, percent and the map's blue line are the same as before the place existed. A stretch whose
  neighbours were stamped on or after the date still needs the new stamp.
- **AC-19**: Every place with a `requiredFrom` shows, in its row (also on a friend's page, spec 0024 AC-7), "Stamp required from
  <date>" in the page's language, a short hint ("New stamp: needed if you walked this stretch from that day on"; on a friend's page worded for them) or, when the place is
  waived, the badge "Not required for your walk" in the hint's place (on a friend's page: "Not required for their walk"), which is words, not colour alone. The date is a
  button, reachable by tap and keyboard, that opens a note: "This stamp became required on that day; a hiker who walked earlier is
  not missing it." For a stamp the MTSZ announced a one-month tolerance for (`tolerance_note` in the dates file, spec 0004 AC-10:
  the announcements of 2025 and 2026) the note adds that the MTSZ allows a month after the date when a booklet is inspected. The stats
  do not apply that tolerance. Escape closes the note. Without JavaScript the note is plain text (`<noscript>`).
- **AC-20**: The count "N / 161" (and the friend's) counts stamps only and keeps its denominator: a waived place is not a stamp. A
  stage's progress counts a waived place as done, so a stage whose places are all stamped or waived is complete; the row still shows
  it as not stamped, with the badge of AC-19. The stage's button follows the stamps alone: with a waived place unstamped it still reads
  "Stamp stage" and marks it (AC-7).
- **AC-21**: The date, hint, badge and note wrap under the place's name at 375 px and never widen the page (the
  text uses `overflow-wrap: anywhere`; checked in English and German).

### Retired stamps

A stamp that no longer exists (Nyírjesi-erdészház, replaced by Vércverés on 2014-11-21) is the mirror of a new one: the people who
walked before it retired collected it, and it belongs in their record.

- **AC-22**: A retired stamp is a checkpoint row that is kept: it has a `retired_on` date (the first day it is no longer valid),
  optionally the place that replaced it (`replaced_by`, a place key) and the current place it followed in trail order
  (`after_place_key`, which gives it its position in the stage list). Its `place_key` is its own code. It is outside the places
  and the trail order: its `seq` is above every current row's, its `stage_seq` is null, its `km_from_start` is that of the place it
  followed (not measured), and `buildPlaces` skips it, so it is never a place, never a neighbour of a stretch and never in a
  count of places. `buildRetired` reads these rows.
- **AC-23**: A retired stamp is listed in its stage, right after the place it followed, for a user who has a stamp on it (always) or who walked
  past its position before it retired. That is read from the stamp dates of the nearest stamped places on either side of the position
  (the place it followed counts as before it, nothing is read from places that were not stamped): the **earlier** of the two (the one
  there is, with a single neighbour) is before `retired_on`. With no stamped neighbour and no stamp of its own it is not listed.
- **AC-24**: A checkbox on the stage controls, "Show retired stamps", is off by default, is remembered in localStorage like the open state
  of the stages (also when storage refuses a write: the page then follows the choice without remembering it) and lists every retired
  stamp, for a user who walked the old route without stamping its neighbours first. It exists only while there is a retired stamp.
- **AC-25**: A retired stamp has no "today": collecting it opens a date field and the stamp is created with the day the user enters, which
  must be a real day before `retired_on` (spec 0002 AC-17, spec 0016 AC-13); the button is disabled until it is, and the field of a
  collected one never saves a later day. Retired stamps never count towards "N / 161", the walked km, a stage's totals or "complete" state,
  the monthly counts, "Stamp stage" (its places and starting point), the map's markers, the route planner or the hops, and one never
  blocks a stretch: it is a record, not a requirement. They show on their own: "Retired stamps collected: n" at the end of the
  stage's list and "+n retired" next to its count in the stage header, for the stages where the user has any.
- **AC-26**: A retired stamp's row is muted, with a "retired" badge (words, not colour alone), no number, a note that is visible without hovering:
  "Retired stamp: valid until <the last day>." and, when something replaced it, "Replaced by <place>." with the place as a link to its row;
  where its position is not from an official source (`position_approximate`) it adds "Its position in the list is approximate."
  The controls' accessible names say "retired" ("Add retired stamp <name>"). The row of the replacing stamp has its own line,
  "Replaces the retired stamp <name> (valid until <the last day>).", so the two rows explain each other.
- **AC-27**: The notes of AC-26 wrap under the name at 375 px, in every language, and the badge and the date field never push
  a control off the screen or widen the page.

### Stages

- **AC-6**: The list groups places by official stage (1..27) in stage order. A stage's starting
  point is the previous stage's last place, unless the stages don't join (Visegrád -> Nagymaros,
  the ferry): then it has none.
- **AC-7**: "Stamp stage" marks the stage's places plus its starting point, so its first stretch
  counts as walked; "Clear stage" removes only the stage's own places.
- **AC-8**: Stages start collapsed; their rows stay in the DOM (so map clicks can find them). The
  header toggles a stage and the choice is remembered per stage (localStorage), restored after mount.
- **AC-9**: A stage event opens/closes one stage (a map click on a stamp in a collapsed stage) or all
  stages (expand all / collapse all).

### Descriptions

- **AC-10**: Every place row on the dashboard and on a friend's page (spec 0024), and every extra stamp row,
  shows the official description of each of its stamps (in the page's language, spec 0033) in full: long text wraps onto further lines, it is
  never cut off with an ellipsis, and it never sticks out of its row (also at 375 px).

### Extra stamps and stages

- **AC-12**: An extra stamp belongs to a stage when its `km_from_start` is within the stage's start km (inclusive)
  and end km (exclusive; inclusive for the final stage). The stage's start km is the km of its starting point (the
  first place's km for a stage with no starting point); its end km is the km of its last place. An extra stamp outside every
  stage (in the gap between two stages that don't join, or beyond the trail) belongs to none.
- **AC-13**: Every extra stamp that lies on a stage names it in its row of the "Extra stamps" section ("· Stage N" after the
  km, in the page's language); the list is in km order, so the stage numbers only stay or grow.
- **AC-14**: A stage that contains at least one extra stamp has a "go to extra stamps (N)" link in its header
  controls, N being the number of its extra stamps; it scrolls to the first of those stamps in the Extra stamps section (its anchor `#extra-<id>`).
  Stages without extra stamps have no such link.
- **AC-15**: A pure function `findStageForKm(km, stages, placeKm)` returns the stage number of a `km_from_start`,
  or `null` for none.

### Layout

- **AC-11**: The dashboard never scrolls sideways on a phone: at 375 px wide, in every language, the page is
  no wider than the viewport (`scrollWidth <= innerWidth`) with every stage collapsed and with every stage
  expanded, also when places and extra stamps are stamped (their date fields add controls to the row). Where a
  row's controls (show on map, date, stamp / remove) or a stage header's actions don't fit beside the text,
  they wrap onto a further line (by design under the text, right-aligned) instead of widening the
  page.
- **AC-28**: From 1024 px the dashboard has two columns (spec 0036 owns the page width), 5 : 7: the four figures (two by two) and the map
  on the left, the stage list and the extra stamps on the right. The map's block (title, map, legend and toggles) stays in view while
  the page scrolls (`position: sticky`, 16 px below the top of the window); the figures above it scroll away with the page. The block
  is never taller than the window: when its content is taller (a route panel under the map, a very short window, a language whose text
  wraps more) it scrolls inside itself, so everything in it stays reachable (spec 0003 AC-24), and the fullscreen map (spec 0003 AC-11)
  still covers the whole page. The header row (the title) is above both columns. Below 1024 px the page is one column, in
  the order figures, map, stage list, extra stamps, and nothing sticks. "Show in list" (spec 0003 AC-12), the 📍 buttons and the "go to
  extra stamps" links keep bringing their row or the map into view in both layouts.

## Out of scope

Stamps that moved (the same stamp at a new place); counting or drawing the old route of a retired stamp; retired stamps in the monthly figures;
letting a user declare that they walked a place before it
was required; applying the MTSZ's one-month tolerance in the figures (AC-19 only says it); elevation-based stats; walked time; stamps outside the official 161 (stamping extra stamps is spec 0002; their
stage is AC-12 to AC-15); moving extra stamps into the stage's place list; changing the count of 161.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-12, AC-15 | `src/lib/progress.test.ts` |
| AC-13, AC-14 | `e2e/extra-stamps-stages.spec.ts` (every extra stamp names a stage, in order along the trail; each stage's "go to extra stamps (N)" counts exactly its extra stamps and jumps to them; stages without any have no link; the counts add up) |
| AC-3, AC-4, AC-7 on the real dashboard | `e2e/stamping.spec.ts` |
| AC-8, AC-9 | `src/components/StageSection.test.tsx` |
| AC-22, AC-23 | `src/lib/progress.test.ts` (a retired row is no place and no neighbour; the rows read; listed with a stamp, by the earlier neighbour's date, on and after the retirement day, one neighbour, none) |
| AC-24 | `src/components/RetiredRow.test.tsx` (hidden by default, the checkbox shows it, remembered, storage refusing), `src/components/StageControls.test.tsx` (the checkbox only while there is a retired stamp) |
| AC-25 | `src/components/RetiredStampControl.test.tsx` (no default day, disabled until a real day before the retirement, the date field keeps to it, the remove button), `e2e/retired-stamps.spec.ts` (the count, km, stage totals and "Stamp stage" ignore it; the collected line and the stage mark), `src/lib/month-stats.test.ts` (a stamp on a retired row is no month's stamp and does not stretch the months) |
| AC-26, AC-27 | `e2e/retired-stamps.spec.ts` (the note, badge, link, approximate position, the replacing stamp's line; 375 px in English, Hungarian, German and Russian) |
| AC-16, AC-17, AC-18, AC-20 | `src/lib/progress.test.ts` (the earliest date of the variants; the later neighbour decides, on and after the date, one neighbour, none; a stamped place never waived; the stretch across a waived place and the opposite case; a waived place is done for its stage but no stamp), `src/lib/friends.test.ts` and `src/lib/compare.test.ts` (the same on a friend's page) |
| AC-19 | `src/components/RequiredFrom.test.tsx` (the date in the page's language, hint and badge, the button that opens the note and Escape, the tolerance sentence), `src/lib/new-stamps.test.ts` (which stamps carry the tolerance) |
| AC-17, AC-18, AC-19, AC-20, AC-21 on the real dashboard | `e2e/stamp-required.spec.ts` (a walk before the date: badge, "2 / 161", the km across the place, a later stamp changes nothing; a walk after it: the stamp is needed; the tolerance note; a friend's page with the waiver as theirs; 375 px in English and German) |
| AC-10 | `src/components/StampDescriptions.test.tsx` (every description rendered, no truncation classes), `e2e/stamping.spec.ts` (dashboard) and `e2e/friends.spec.ts` (a friend's page): nothing clipped or sticking out of its row at 375 px |
| AC-11 | `e2e/stamping.spec.ts` (375 px in the default language and in German: no sideways scroll with every stage collapsed, expanded, and with a stamped place and extra stamp) |
| AC-28 | `e2e/layout.spec.ts` (from 1024 px the aside is left of the list, in two columns of figures; after a long scroll the map's block is 16 px below the top, inside the window, and the figures have scrolled away; below it one column in the order, nothing sticks, the list as wide as the window; the "go to extra stamps" link still reaches the extra stamps at 1280 x 720), `e2e/map.spec.ts` (the 📍 button: in two columns the map is in view already and the row does not move, in one column the map scrolls into view; "Show in list" in both layouts), `src/components/PageShell.test.tsx` (the aside and its order, stretching), `tests/page-shell.test.ts` (the sticky block has a z-index) |
| AC-11 (own line, right-aligned) | `e2e/stamping.spec.ts` (at 375 px a stamped row's controls start below the text and end at the row's right padding) |
