# 0054: CI runs once per change

Status: Open
Specs: [0045](../specs/0045-ci-once-per-change.md) AC-1 to AC-5 (added), [0007](../specs/0007-ci.md) AC-1 (changed: the triggers),
[0026](../specs/0026-automatic-deploy.md) AC-1 (relied on)

## Goal

Stop every commit pushed to an open pull request from running both CI jobs twice: trigger on `pull_request` and on `push` to
`main` only, cancel superseded runs of a pull request, and keep the job names.

## Done when

- [ ] `ci.yml` has the new trigger and a concurrency group, and `tests/ci-workflow.test.ts` checks them
- [ ] `CLAUDE.md` (the line saying CI runs on every push) and spec 0007 AC-1 say pull request updates and `main`
- [ ] After the first merge, a run on `main` exists (the manual row of the spec is dated)
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Proposed by the owner on 2026-10-04: run `push` only for `main` and keep a run on every pull request update, which tests the
merge result, plus a run on `main` after a merge. A branch without a pull request gets no CI run: accepted.
