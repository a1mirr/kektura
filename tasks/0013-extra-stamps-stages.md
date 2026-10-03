# 0013: Extra stamps in stages

Status: Done
Specs: [0001](../specs/0001-progress.md) AC-12 to AC-15 (this task was written as spec 0013; its behaviour now lives there)

## Goal

Link extra stamps to their corresponding official stages, so users know which stage an extra stamp belongs to, and
can easily jump to the extra stamps when looking at a stage.

## Done when

- [x] An extra stamp belongs to a stage by its `km_from_start` (was 0013 AC-1, now 0001 AC-12)
- [x] The Extra stamps section names the stage of each extra stamp (was AC-2, now 0001 AC-13)
- [x] A stage with extra stamps has a "go to extra stamps (N)" link (was AC-3, now 0001 AC-14)
- [x] A pure function `findStageForKm` maps a km to a stage (was AC-4, now 0001 AC-15)
- [x] An extra stamp's description is shown in full (was AC-5: it was already 0001 AC-10, so nothing moved)

## Spec changes

Four acceptance criteria moved into spec 0001 as AC-12 to AC-15; AC-5 duplicated 0001 AC-10 and was dropped. AC-12
gained a sentence the test already asserted: a km outside every stage belongs to none.

## Notes

- Extra stamps only have `km_from_start`, so they are mapped to stages dynamically from the stage boundaries.
- Out of scope then: changing the 161 count, moving extra stamps into the stage's place list.
