# 0035: Introduce tasks next to specs

Status: Done
Specs: [0034](../specs/0034-specs-and-tasks.md) (new, all ACs), [0022](../specs/0022-fresh-context-review.md) AC-1, AC-2, AC-3, AC-4 and Notes (reworded), [0026](../specs/0026-automatic-deploy.md) AC-6 (migrations are named after the task)

## Goal

Split the work from the contract. Specs keep describing how an area behaves and are kept true after every change;
tasks hold the work and stay as history. Update the workflow, the reviewer, the pull request template and the Stop
hook to match, and add the "make the specs true" step.

## Done when

- [x] `specs/0034-specs-and-tasks.md` states the rules; `specs/README.md`, `tasks/README.md` and both templates say the same
- [x] `CLAUDE.md` (Workflow, what the review checks, where the rules live), the reviewer agent and the pull request template follow it
- [x] `tests/specs.test.ts` checks both indexes, statuses and the shared number sequence; `tests/review-process.test.ts` follows the new wording
- [x] The Stop hook watches `tasks/` and asks when app code changed without a spec change
- [x] The specs listed above mirror the code as built

## Spec changes

- 0034 added.
- 0022 AC-1: the reviewer is told a task number (or a spec number, or `none`). AC-2: the review comes after the
  specs are made true. AC-3: the reviewer starts from 0034, the task and its specs, and checks the specs against
  the code in both directions. AC-4: the pull request template asks whether the touched specs mirror the code.
  Notes: the author passes the task number.
- 0026 AC-6: migrations are named after the task that adds them, not after a spec.

## Notes

- Why: until now every piece of work became a numbered spec. Most described a change ("spec 0014 added X, make it
  Y") and one area's behaviour was scattered over several of them (the account page is 0014 plus 0025; stamping is
  0002, 0009, 0013 and 0016).
- The existing specs keep their numbers and files for now: tests, comments, migrations and the deploy check cite
  them. Task 0036 reshapes them in steps.
