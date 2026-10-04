# 0064: CI is the authority for the end-to-end tests

Status: Done
Specs: [0007](../specs/0007-ci.md) AC-8 (added), [0022](../specs/0022-fresh-context-review.md) AC-4 (changed)

## Goal

The workflow told the author to run `npm run e2e` before committing user-flow changes, but it needs Docker, which
crashes on the owner's machine (CLAUDE.md gotcha), and CI runs the same tests on every pull request anyway. Say
that CI decides, and keep the local run for reproducing a failure.

## Done when

- [x] `CLAUDE.md` (steps 2 and 6), `specs/README.md`, the pull request template and the Stop hook's comment say that CI's "End-to-end tests" job must be green and that a local run is for failures
- [x] Spec 0007 AC-8 states it; spec 0022 AC-4 names the changed checklist line
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Spec 0007: AC-8 added (a new subsection, "Who runs the end-to-end tests"; the spec stays `Done`). Spec 0022: AC-4's wording changed
from "checks and E2E run" to "`npm run check` green and CI's end-to-end job passing"; the template line it describes
changed with it.
