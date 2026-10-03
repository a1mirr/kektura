# 0034: Specs and tasks: how work is written down

Status: Done
Owner code: `specs/README.md`, `specs/_template.md`, `tasks/README.md`, `tasks/_template.md`, `CLAUDE.md` (Workflow),
`.claude/agents/fresh-reviewer.md`, `.claude/hooks/stop-check.mjs`, `.github/pull_request_template.md`,
`tests/specs.test.ts`, `tests/review-process.test.ts`

## Goal

Reading the specs should say what the product does today, and the record of the work should not get in the way.
Two kinds of file with two lifecycles do that: a **spec** says what is true now and is kept true; a **task** says
what is being done and stays as history. Work that is written as a spec describes a change, stops being useful
once it is made, and scatters one area's behaviour over several files.

## Behaviour

### Two folders

- **AC-1**: `specs/` holds specs and `tasks/` holds tasks. Files are `NNNN-slug.md`, written in English. Both
  folders share one number sequence: the next number is the highest in either folder plus one, so a number
  names exactly one file. Numbers are never reused or changed.
- **AC-2**: A spec is the contract of one area (a part of the product, or of how the project is run) as it
  behaves now. Its Goal and Notes describe the area, not a change to it; history lives in tasks and in git. Its
  acceptance criteria are numbered and never renumbered or deleted: a dropped one is marked `Removed`. Its status
  is `Draft` (proposed), `Accepted` (agreed, not built yet or only partly) or `Done` (built: every AC holds in
  the code and has a test, or a `manual` row, AC-11).
- **AC-3**: A task is one piece of work. It has a status (`Open`, `In progress`, `Done`, `Dropped`), a goal, the
  specs it adds or changes (with the ACs) or `none`, its steps or "done when", and, once it is built, a section
  recording what changed in the specs. A task has no acceptance criteria and never describes how the product
  behaves: that belongs in a spec. A finished task is kept as history and is not updated when behaviour changes.

### Which one

- **AC-4**: Behaviour that users or operators can rely on belongs in a spec; one change belongs in a task. A new
  feature or a behaviour change edits or drafts the owning spec first (the ACs, and the open questions settled
  with the owner), then gets a task if it is more than a trivial change. A refactor, rename, CI or deploy change,
  data regeneration or a schema-only change is a task and changes no spec, unless it changes a rule that a spec
  states. A trivial fix needs neither. Tests cite specs (`describe("spec NNNN: …")`, `it("AC-n: …")`), never
  tasks.
- **AC-5**: A migration is named after the number of the task that adds it (`NNNN_slug.sql`), so a task owns one
  migration file: it is edited until it is applied to production, and a later schema change is a task of its
  own. (Migrations 0001-0008 predate the rule and 0024 carries the number of its spec.)

### Specs stay true

- **AC-6**: After a task is built and before it is reviewed, the author rereads every spec it touches against the
  code as built and edits the spec to mirror it: an AC for behaviour that exists and no AC states, `Removed`
  for an AC that was dropped, the status, the coverage table, and the index in `specs/README.md`. When code and
  spec disagree, the author decides which of the two is right and fixes that one. The task's "Spec changes"
  section says what was changed.
- **AC-7**: A spec found to disagree with the code at any other time is corrected at once when that is small,
  otherwise recorded as a task. A spec that is not true is a defect, like a failing test.
- **AC-8**: The fresh-context reviewer is told only a task number (a spec number for a change that is only a
  spec, `none` for a small change that has neither) and the base branch. It checks the specs in both
  directions, not only the diff: the ACs of the touched specs against the code, and the behaviour of the
  touched areas that no AC states. It also re-checks the `manual` rows of the areas it touches (AC-11): it does
  the check where it can, and names the rows that have no date or whose check the change may have invalidated. A
  spec that tells the story of a change instead of describing the area, a task whose "Spec changes" section is
  empty or untrue, and indexes or statuses that are not true are findings.

### Manual checks

- **AC-11**: An AC that cannot be automated is covered by a `manual` row in the spec's coverage table, and a manual
  row is the exception: where a test would do, there is a test. A manual row says why it cannot be automated
  (`manual (reason)`: a real Google sign-in, native browser UI, WebGL pixels, a real deploy), how to check it, and
  when it was last checked: `Last checked: YYYY-MM-DD`, `never recorded` for a check nobody has written down (or nobody has done), or
  `every pull request` for a judgement the owner or the reviewer makes each time. The date is written only by
  whoever did the check.

### Checked mechanically

- **AC-9**: `tests/specs.test.ts` checks that `specs/README.md` and `tasks/README.md` list every spec and task
  once with the status written in the file, that statuses are valid for the kind, that no number is used twice
  across both folders, and that both folders are written in English. It also checks that a test title citing an AC
  (under `describe("spec NNNN …")` or as `NNNN AC-n`) cites one that exists, and that the repository files named
  in backticks by a `Done` or `Accepted` spec exist, and that every coverage row of a `Done` or `Accepted` spec that
  says `manual` has a reason and a `Last checked` (the way to check it is for the reviewer, AC-8).
- **AC-10**: The Stop hook watches `tasks/` as well as `specs/`, and once the checks pass it asks, once per turn
  end, when app code changed and no spec did: has behaviour changed (then the spec and its tests are updated), or
  not (then say so in one line).

## Out of scope

Enforcing that a spec is true: only a person or the reviewer can tell. Moving tasks to GitHub issues: they stay
in the repository so the reviewer and the hook see them.

## Notes

- The test for the split: "will this sentence still be true in a year if nobody touches it?" Yes: a spec. No: a
  task.
- Spec 0022 (the fresh-context review) owns the reviewer; its ACs name what the reviewer is told, which AC-8
  restates.
- Numbers are stable ids: tests, code comments and migrations cite them.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-9 | `tests/specs.test.ts` (file names, indexes, statuses, unique numbers, English, test titles that cite an AC that does not exist, files named by a spec that do not exist) |
| AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | `tests/specs.test.ts` (the rules are written in `specs/README.md`, `tasks/README.md`, `CLAUDE.md`; the templates have the sections) and `tests/review-process.test.ts` |
| AC-8 | `tests/review-process.test.ts` (reviewer brief, `CLAUDE.md`, pull request template) and `tests/specs.test.ts` (the reviewer re-checks the hand-checked rows of what it touches) |
| AC-10 | `tests/specs.test.ts` (the hook source watches `tasks/` and nudges on a missing spec change); manual (it runs a Claude Code hook): change a file under `src/` only, finish a turn, and the hook asks once; change a file under `tasks/` and the hook runs the checks. Last checked: never recorded. |
| AC-11 | `tests/specs.test.ts` (every hand-checked row of a Done or Accepted spec has a reason and a `Last checked` of a date, `never recorded` or `every pull request`; the rule is written in `CLAUDE.md`, `specs/README.md` and the reviewer's brief) |
