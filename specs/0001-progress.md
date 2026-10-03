# 0001: Progress: places, walked stretches, stats, stages, extra stamps in stages

Status: Done
Owner code: `src/lib/progress.ts`, `src/app/[locale]/dashboard/page.tsx`, `src/components/StageSection.tsx`,
`src/components/StampDescriptions.tsx`

## Goal

Turn a user's stamps into progress along the Országos Kéktúra: which stamping places are done, which
stretches count as walked, how many km that is, and the per-stage view of the list, including which stage each
extra stamp belongs to.

## Behaviour

### Places

- **AC-1**: Checkpoint rows that share a `place_key` (alternative stamps `_1`/`_2`/`_3` at one place)
  form one place. The place sits at the km of its furthest-along variant (the MTSZ table measures
  to it). Its label is `<stage>.<stage_seq>`, falling back to `seq`; its key falls back to `code`,
  then `id`. Places keep the order of their first variant. Today: 220 rows = 161 places.
- **AC-2**: A place is stamped when any of its variants is stamped.

### Walked stretches and stats

- **AC-3**: Stamps can be collected in any order. The stretch between two neighbouring places (in
  km order) counts as walked only when both are stamped. Touching stretches merge into one range.
  The map's blue line and the km/percent stats both come from these ranges.
- **AC-4**: Total km = last place km - first place km; walked km = sum of the ranges; remaining =
  total - walked (never negative); percent = walked / total, rounded. Kilometres are rounded to
  0.1. With no places everything is 0.
- **AC-5**: "Stamps per month" counts places, not variant rows, each in the month of its earliest
  stamp (`stamped_on`), oldest month first. Month labels and the tooltip are localized.

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
  they wrap onto a further line (by design under the text, right-aligned: checked by eye) instead of widening the
  page.

## Out of scope

Elevation-based stats; walked time; stamps outside the official 161 (stamping extra stamps is spec 0002; their
stage is AC-12 to AC-15); moving extra stamps into the stage's place list; changing the count of 161.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4, AC-5 (counting), AC-6, AC-7, AC-12, AC-15 | `src/lib/progress.test.ts` |
| AC-13, AC-14 | `e2e/extra-stamps-stages.spec.ts` (every extra stamp names a stage, in order along the trail; each stage's "go to extra stamps (N)" counts exactly its extra stamps and jumps to them; stages without any have no link; the counts add up) |
| AC-3, AC-4, AC-7 on the real dashboard | `e2e/stamping.spec.ts` |
| AC-5 (localized labels) | `e2e/account.spec.ts` (the month label on the account page's axis and in the tooltip, in en, ru and hu, each the way `Intl` writes it for that language) |
| AC-8, AC-9 | `src/components/StageSection.test.tsx` |
| AC-10 | `src/components/StampDescriptions.test.tsx` (every description rendered, no truncation classes), `e2e/stamping.spec.ts` (dashboard) and `e2e/friends.spec.ts` (a friend's page): nothing clipped or sticking out of its row at 375 px |
| AC-11 | `e2e/stamping.spec.ts` (375 px in en, hu and ru: no sideways scroll with every stage collapsed, expanded, and with a stamped place and extra stamp) |
| AC-11 (own line, right-aligned) | `e2e/stamping.spec.ts` (at 375 px a stamped row's controls start below the text and end at the row's right padding) |
