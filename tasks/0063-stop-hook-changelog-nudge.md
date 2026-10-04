# 0063: The Stop hook also asks about the changelog

Status: Done
Specs: [0034](../specs/0034-specs-and-tasks.md) AC-10, AC-12 (AC-12 added)

## Goal

A user-visible change without a changelog entry is only caught by the fresh review, at the end. The Stop hook
already nudges once when app code changed without a spec; do the same for the changelog (spec 0018 AC-7), at the
moment the author still has the change in mind.

## Requirements

- Once the checks pass, when a file that users can see changed (`messages/*.json`, a `page.tsx` or `layout.tsx` under
  `src/app`, a component under `src/components` that is not a test) and `src/content/changelog.ts` did not, the
  hook asks once whether the change belongs in the changelog (then add the entry in three languages) or not (then
  say so in one line). It is part of the same turn-end nudge as the spec one, without a second round trip.
- The decision is a pure function of the changed paths, tested directly.

## Done when

- [x] The decision (which changed paths are "visible to users", and whether `src/content/changelog.ts` is among the changed ones) is a pure function in a module the hook imports, with a unit test (user-visible files without and with the changelog; tests and `.types.ts` ignored)
- [x] The hook asks once per turn end, together with the existing nudge
- [x] A `manual` row in spec 0034: change a message file only, finish a turn, and the hook asks once
- [x] The requirements are written into spec 0034 as an AC, with its coverage row (spec 0034 AC-6)

## Spec changes

- Spec 0034: added AC-12 (the changelog question in the same turn-end nudge, with the paths that count as visible to users and the pure function that decides), added `.claude/hooks/stop-nudges.mjs` and `tests/stop-nudges.test.ts` to Owner code, and two coverage rows (the unit test; a `manual` row for the hook in a real session, `Last checked: never recorded`). AC-10 is unchanged; its decision now lives in the same module.
- Spec 0018: AC-7 names the Stop hook as one more place that asks for the entry, with a coverage pointer to 0034 AC-12.
- `specs/README.md` (Regression gate) and `CLAUDE.md` (Workflow, step 2) say the hook asks about the changelog too.

## Notes

- It is a nudge, not a gate: a reply of one line ("no, internal") is enough, as with the spec nudge.
