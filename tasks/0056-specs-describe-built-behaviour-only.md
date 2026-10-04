# 0056: Specs describe only behaviour that is built

Status: Open
Specs: [0034](../specs/0034-specs-and-tasks.md) AC-2, AC-3, AC-4, AC-6, AC-8 (changed), [0022](../specs/0022-fresh-context-review.md) AC-4 (the pull request checklist)

## Goal

Make the process say what the owner decided on 2026-10-04: `specs/` shows the behaviour the product has now, and nothing
else. The requirements for planned work live in the task while it is open, and the owning spec is edited when the task is
built, in the same change as the code and its tests. Today spec 0034 says the opposite for new work (draft the owning spec
first, with `Draft` and `Accepted` statuses for behaviour that is not built), which is how six unbuilt specs and five older
ones ended up in `specs/`. Those eleven specs are already tasks (0023, 0027, 0028, 0029, 0031 and 0046 to 0055); this task
changes the rules and the files that state them.

## Done when

- [ ] Spec 0034 is amended: a spec describes built behaviour only and its status is `Done` (`Draft` and `Accepted` go);
      a task holds the requirements of the planned work as a checklist of outcomes (no numbered acceptance criteria) and
      its open questions; a feature starts as a task, the owning spec is edited while the behaviour is built (so tests can
      cite its ACs) and reread before the review; where it said "draft the owning spec first", it says "open a task first"
- [ ] `specs/README.md` (the introduction, workflow steps 1 to 3, the status rule), `tasks/README.md` (what a task holds),
      both templates (`specs/_template.md` loses the status choice and the "decisions still needed before `Accepted`"
      section; `tasks/_template.md` gains "Requirements" and "Open questions"), `CLAUDE.md` (workflow steps 1 and 2),
      `.github/pull_request_template.md` and the `fresh-reviewer` brief (it checks that every requirement of the task
      holds, and that no spec describes unbuilt behaviour) say the same
- [ ] `tests/specs.test.ts` and `tests/review-process.test.ts` pin the new wording instead of the old: the status check
      for specs accepts only `Done`, the step titles and phrases that name "spec first" and "Accepted" change
- [ ] The Stop hook's question ("app code changed without a spec change") still reads right, and nothing else in the
      repository tells the author to draft a spec before the code
- [ ] The changes are made after the open pull request that edits the same files (spec 0034, both READMEs, `CLAUDE.md`,
      spec 0022, the pull request template and `tests/review-process.test.ts`) has merged, so they are made once, on top of it
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Decided by the owner on 2026-10-04 after pull request 35 added six Draft specs: "why are we creating new specs instead of
updating existing ones after task completed? specs should show actual behaviour". That pull request was merged as it was
and reworked afterwards: the eleven unbuilt specs became tasks, with their requirements as `R-n` checklist items and their
open questions kept. The rules were left for this task because the files that state them were being edited elsewhere.

Until this task is done, spec 0034 and the READMEs still describe the old way (Draft specs for planned work). The tasks
that were converted follow the new way: they carry a "Requirements" section and list the existing specs they will edit.
