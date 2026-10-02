# 0013: Extra stamps in stages

Status: Accepted
Owner code: `src/app/[locale]/dashboard/page.tsx`, `src/lib/progress.ts`

## Goal

Link extra stamps to their corresponding official stages, so users know which stage an extra stamp belongs to, and can easily jump to the extra stamps when looking at a stage.

## Behaviour

- **AC-1**: An extra stamp belongs to a stage if its `km_from_start` is within the stage's start km (inclusive) and end km (exclusive, except for the final stage which is inclusive). The stage's start km is the km of its `startKey` (or the first place's km if it's the first stage). The stage's end km is the km of its last place.
- **AC-2**: Given an extra stamp in the "Extra Stamps" section, the UI mentions which stage it belongs to (e.g. as a subtle text/badge).
- **AC-3**: Given a stage that contains at least one extra stamp, its header/controls area in the "Checkpoints" section includes a link or button saying "go to extra stamps (N)", where N is the count of extra stamps in that stage. Clicking this navigates/scrolls to the Extra Stamps section, specifically highlighting or jumping to those stamps.
- **AC-4**: A pure function `findStageForKm(km, stages, placeKm)` returns the stage number for any given `km_from_start`.

## Out of scope

Modifying the official 161 checkpoints count, or moving extra stamps into the main stage checkpoint list.

## Notes

- Extra stamps only have `km_from_start`, so we map them to stages dynamically based on the stage boundaries.
- Stage boundaries can be determined by the `km` of the start place (from `startKey` or first place in `places`) and the `km` of the last place in `places`.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-4 | `src/lib/progress.test.ts` |
| AC-2, AC-3 | manual: view the dashboard, check stage lists and extra stamps list |
