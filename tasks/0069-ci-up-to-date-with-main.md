# 0069: A pull request that is behind main is flagged by CI and never merged

Status: Done
Specs: [0007](../specs/0007-ci.md) (a new AC for the job "Up to date with main"), [0021](../specs/0021-pull-requests-only.md) AC-6 (the merge rule), [0022](../specs/0022-fresh-context-review.md) AC-5 (what counts as changed after the reviewed commit)

## Goal

GitHub's branch protection ("require branches to be up to date before merging") is not available for this private
repository on the free plan, so nothing stops a pull request from being merged while `main` has moved on. CI tests
the merge of the pull request into `main` as it was when CI started, so two pull requests that are each green
can break `main` together: on 2026-10-04 a pull request (friends buttons, 13 new English messages) was merged after
another one had added German, and `main` failed its message-parity test and skipped its deploy. This task puts the
rule into the workflow instead of the repository settings: CI flags a pull request that is behind `main`, and the
author never merges one.

## Done when

- [x] The open questions below are settled with the owner
- [x] Every requirement below holds and has a test (or a `manual` row in the owning spec); the owning specs are edited as it is built
- [x] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the workflow must do when this is built. They are written into the owning specs as it is built.

- [x] **R-1**: Every pull request shows a CI result "Up to date with main": it passes when `main` is an ancestor
  of the pull request's head, and fails otherwise, saying how many commits the branch is behind and what to do
  (merge `origin/main` into the branch, run the checks, push).
- [x] **R-2**: `CLAUDE.md` and spec 0021 AC-6 say the author never merges a pull request that is behind `main`:
  just before merging, check live (`git fetch origin`, then `main` is an ancestor of the head about to be merged);
  if it is behind, merge `origin/main` into the branch, run `npm run check`, push and wait for CI again.
- [x] **R-3**: Updating a reviewed branch from `main` does not force a new fresh-context review: "Review recorded"
  looks only at what the pull request's own commits changed after the reviewed commit (a conflict resolution in a
  merge commit counts, files that arrive from `main` do not), so the rule above stays cheap to follow.

## Out of scope

Real branch protection, merge queues or a required-checks setting (they need GitHub Pro or a public repository; if
the plan changes, enable "require branches to be up to date" and this job becomes a convenience); re-running the
job on open pull requests whenever `main` moves (the live check of R-2 is what the author relies on; the job shows
the state of the last run); a bot that updates branches.

## Open questions

None. (The owner asked for this workflow, as its own task and pull request, on 2026-10-04.)

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1 | `tests/up-to-date.test.ts` (the decision as a pure function; the git side against a real temporary repository; the workflow's job name, trigger and command), `tests/ci-workflow.test.ts` (the job list) |
| R-2 | `tests/up-to-date.test.ts` (CLAUDE.md names the job and the live check) |
| R-3 | `tests/review-recorded.test.ts` (a merge of `main` into the branch after the review passes; a code commit of the branch after the review still fails; a conflict resolution in a merge commit counts) |

## Spec changes

- Spec 0007: new AC-11 (the job "Up to date with main"), a Notes line and two coverage rows (a test row and a `manual` row for the job on GitHub, `Last checked: never recorded`); `scripts/check-up-to-date.mjs` is in Owner code.
- Spec 0021: AC-6's merge rule adds the up-to-date condition and the live check.
- Spec 0022: AC-5 says merging the base branch into a reviewed branch needs no new review (only the pull request's own commits count).
- `CLAUDE.md` step 7 names the job and the live check; `scripts/check-review-recorded.mjs` takes the base branch into account.

## Notes

- The pull request run of CI checks out the merge of the pull request into `main` as of the moment it starts, which
  is why a second pull request merged later is not seen by the first one's green result.
- `scripts/check-review-recorded.mjs` compares the reviewed commit with the head by file; a merge of `main` brings
  every file `main` changed since, which today reads as "code changed after the review".
