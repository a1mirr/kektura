# 0034: Specs and tasks: how work is written down

Status: Done
Owner code: `specs/README.md`, `specs/_template.md`, `tasks/README.md`, `tasks/_template.md`, `CLAUDE.md` (Workflow),
`.claude/agents/fresh-reviewer.md`, `.claude/hooks/stop-check.mjs`, `.claude/hooks/stop-nudges.mjs`,
`.github/pull_request_template.md`, `tests/specs.test.ts`, `tests/review-process.test.ts`, `tests/stop-nudges.test.ts`

## Goal

Reading the specs should say what the product does today, and the record of the work should not get in the way.
Two kinds of file with two lifecycles do that: a **spec** says what is true now and is kept true; a **task** says
what is being done, holds the requirements of work that is planned, and stays as history. Behaviour that is
planned but not built does not belong in a spec: it would describe something that is not true, and an area's
behaviour would be spread over files that disagree with the code.

## Behaviour

### Two folders

- **AC-1**: `specs/` holds specs and `tasks/` holds tasks. Files are `NNNN-slug.md`, written in English. Both
  folders share one number sequence: the next number is the highest in either folder plus one, so a number
  names exactly one file. Numbers are never reused or changed.
- **AC-2**: A spec is the contract of one area (a part of the product, or of how the project is run) as it
  behaves now. Its Goal and Notes describe the area, not a change to it; history lives in tasks and in git. Its
  acceptance criteria are numbered and never renumbered or deleted: a dropped one is marked `Removed`. Its status
  is `Done`: every AC holds in the code and has a test, or a `manual` row (AC-11). A spec describes behaviour
  that is built and nothing else: there is no `Draft` or `Accepted` spec, and planned behaviour lives in a
  task (AC-3).
- **AC-3**: A task is one piece of work. It has a status (`Open`, `In progress`, `Done`, `Dropped`), a goal, the
  specs it adds or changes (with the ACs) or `none`, its steps or "done when", its requirements when it plans
  behaviour (a checklist of outcomes the product must have once the task is built, not numbered acceptance
  criteria), its open questions, and, once it is built, a section recording what changed in the specs. A task
  never describes how the product behaves now: that belongs in a spec, and the requirements of a planned change
  are written into the owning spec as the behaviour is built. A finished task is kept as history and is not
  updated when behaviour changes.

### Which one

- **AC-4**: Behaviour that users or operators can rely on belongs in a spec; one change belongs in a task. A new
  feature or a behaviour change starts as a task (its requirements, and its open questions settled with the owner
  before coding) if it is more than a trivial change. The owning spec is edited, or created for a new area, while
  the behaviour is built, so that the tests can cite its ACs, and it is reread against the code before the
  review (AC-6). A refactor, rename, CI or deploy change,
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
  spec disagree, the author decides which of the two is right and fixes that one. Every requirement of the task
  is built, or struck with the reason. The task's "Spec changes" section says what was changed.
- **AC-7**: A spec found to disagree with the code at any other time is corrected at once when that is small,
  otherwise recorded as a task. A spec that is not true is a defect, like a failing test.
- **AC-8**: The fresh-context reviewer is told only a task number (a spec number for a change that is only a
  spec, `none` for a small change that has neither) and the base branch. It checks that every
  requirement of the task holds, and the specs in both directions, not only the diff: the ACs of the touched
  specs against the code, the behaviour of the touched areas that no AC states, and any spec that describes
  behaviour that is not built. It also re-checks the `manual` rows of the areas it touches (AC-11): it does
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
  once with the status written in the file, that statuses are valid for the kind (a spec's is `Done`), that no number is used twice
  across both folders, and that both folders are written in English. It also checks that a test title citing an AC
  (under `describe("spec NNNN …")` or as `NNNN AC-n`) cites one that exists, and that the repository files named
  in backticks by a spec exist, and that every coverage row of a spec that
  says `manual` has a reason and a `Last checked` (the way to check it is for the reviewer, AC-8).
- **AC-10**: The Stop hook watches `tasks/` as well as `specs/`, and once the checks pass it asks, once per turn
  end, when app code changed and no spec did: has behaviour changed (then the spec and its tests are updated), or
  not (then say so in one line). The question is not asked again for the same state of the branch (AC-12).
- **AC-12**: In the same turn-end nudge as AC-10, once the checks pass, when a file that users can see changed,
  in the working tree or in a commit the branch has made since it left `origin/main`
  (`messages/*.json`, a `page.tsx` or `layout.tsx` under `src/app`, a `.ts` or `.tsx` file under `src/components`
  that is not a test or a `.types.ts` file) and `src/content/changelog.ts` did not, the hook asks whether the change
  belongs in the changelog (then the entry is added in every language, spec 0018 AC-7) or not (then say so in one
  line). Both questions come in one message, so there is no second round trip, and the message is not repeated for
  the same commit, working tree and files (a new commit or other files ask again). The decision is a pure function of
  the changed paths (`.claude/hooks/stop-nudges.mjs`).

## Out of scope

Enforcing that a spec is true: only a person or the reviewer can tell. Moving tasks to GitHub issues: they stay
in the repository so the reviewer and the hook see them.

## Notes

- Planned behaviour goes in a task's requirements, never in a new spec. When the work is built its requirements
  become ACs of the area's spec, with tests that cite them.
- The test for the split: "will this sentence still be true in a year if nobody touches it?" Yes: a spec. No: a
  task.
- Spec 0022 (the fresh-context review) owns the reviewer; its ACs name what the reviewer is told, which AC-8
  restates.
- Numbers are stable ids: tests, code comments and migrations cite them.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-9 | `tests/specs.test.ts` (file names, indexes, statuses, unique numbers, English, test titles that cite an AC that does not exist, files named by a spec that do not exist) |
| AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | `tests/specs.test.ts` (the rules are written in `specs/README.md`, `tasks/README.md`, `CLAUDE.md`; the templates have the sections, and a spec has no status but `Done`) and `tests/review-process.test.ts` |
| AC-8 | `tests/review-process.test.ts` (reviewer brief, `CLAUDE.md`, pull request template) and `tests/specs.test.ts` (the reviewer re-checks the hand-checked rows of what it touches) |
| AC-10 | `tests/specs.test.ts` (the hook source watches `tasks/` and nudges on a missing spec change); manual (it runs a Claude Code hook): change a file under `src/` only, finish a turn, and the hook asks once; change a file under `tasks/` and the hook runs the checks. Last checked: never recorded. |
| AC-10 (the decision), AC-12 | `tests/stop-nudges.test.ts` (the same message is not asked twice; which changed paths are app code and which users can see, with and without a spec or the changelog; tests and `.types.ts` ignored; one message for both questions) |
| AC-12 (the hook asks) | manual (it runs a Claude Code hook): commit a change of a message text on a topic branch, leave the working tree clean and finish a turn: the hook asks once about the changelog, and not again for the same files; change the text of an existing message in `messages/` only (same keys in every file: a missing key fails the unit tests first), finish a turn, and the hook asks once about the changelog; change it again with `src/content/changelog.ts` edited and the hook does not ask. Last checked: never recorded. |
| AC-11 | `tests/specs.test.ts` (every hand-checked row of a spec has a reason and a `Last checked` of a date, `never recorded` or `every pull request`; the rule is written in `CLAUDE.md`, `specs/README.md` and the reviewer's brief) |
