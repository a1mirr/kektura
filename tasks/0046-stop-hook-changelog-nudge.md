# 0046: The Stop hook also asks about the changelog

Status: Open
Specs: [0034](../specs/0034-specs-and-tasks.md) AC-12 (added)

## Goal

A user-visible change without a changelog entry is only caught by the fresh review, at the end. The Stop hook
already nudges once when app code changed without a spec; do the same for the changelog, at the moment the author
still has the change in mind.

## Done when

- [ ] The decision (which changed paths are "visible to users", and whether `src/content/changelog.ts` is among the changed ones) is a pure function in a module the hook imports, with a unit test
- [ ] The hook asks once per turn end, together with the existing nudge and without a second round trip
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Filled in when built.

## Notes

- It is a nudge, not a gate: a reply of one line ("no, internal") is enough, as with the spec nudge.
