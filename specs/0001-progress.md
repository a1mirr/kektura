# 0001: Progress: places, walked stretches, stats, stages

Status: Done
Owner code: `src/lib/progress.ts`, `src/app/[locale]/dashboard/page.tsx`, `src/components/StageSection.tsx`,
`src/components/StampDescriptions.tsx`

## Goal

Turn a user's stamps into progress along the Országos Kéktúra: which stamping places are done, which
stretches count as walked, how many km that is, and the per-stage view of the list.

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

- **AC-10**: Every place row on the dashboard and on a friend's page (spec 0024), and every extra stamp row (spec 0013),
  shows the official description of each of its stamps in full: long text wraps onto further lines, it is
  never cut off with an ellipsis, and it never sticks out of its row (also at 375 px).

## Out of scope

Elevation-based stats; walked time; stamps outside the official 161 (see extra stamps in 0002).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4, AC-5 (counting), AC-6, AC-7 | `src/lib/progress.test.ts` |
| AC-3, AC-4, AC-7 on the real dashboard | `e2e/stamping.spec.ts` |
| AC-5 (localized labels) | manual: switch locale on the dashboard, check month labels and tooltip |
| AC-8, AC-9 | `src/components/StageSection.test.tsx` |
| AC-10 | `src/components/StampDescriptions.test.tsx` (every description rendered, no truncation classes), `e2e/stamping.spec.ts` (nothing clipped or sticking out of its row at 375 px) |
