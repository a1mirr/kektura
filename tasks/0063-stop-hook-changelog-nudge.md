# 0063: The Stop hook also asks about the changelog

Status: Open
Specs: [0034](../specs/0034-specs-and-tasks.md) (an AC is added when this is built)

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

- [ ] The decision (which changed paths are "visible to users", and whether `src/content/changelog.ts` is among the changed ones) is a pure function in a module the hook imports, with a unit test (user-visible files without and with the changelog; tests and `.types.ts` ignored)
- [ ] The hook asks once per turn end, together with the existing nudge
- [ ] A `manual` row in spec 0034: change a message file only, finish a turn, and the hook asks once
- [ ] The requirements are written into spec 0034 as an AC, with its coverage row (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- It is a nudge, not a gate: a reply of one line ("no, internal") is enough, as with the spec nudge.
