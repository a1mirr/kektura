# 0022: A fresh-context review before every merge

Status: Done
Owner code: `.claude/agents/fresh-reviewer.md`, `.github/pull_request_template.md`, `CLAUDE.md` (Workflow),
`specs/README.md` (Workflow)

## Goal

The spec, the tests and the regression gate check that the code does what its author *meant*. Nothing
checks that what the author meant is complete, or that the author did not just read their own work the way
they wrote it. The owner wants every change reviewed, before it is merged, by an agent that has none of the
author's context, and wants that to be part of how work is done here, not something to remember each time.

## Behaviour

- **AC-1**: `CLAUDE.md` (Workflow) states the rule: before a pull request is merged, an agent with no
  context of the work reviews it; every valid finding is fixed and the rest answered in the pull request;
  a pull request is not handed over as ready to merge before that. It names the agent (`fresh-reviewer`),
  says what the author tells it (the spec number and the base branch, nothing else), and that a review of an
  earlier state doesn't count after substantial fixes.
- **AC-2**: `specs/README.md` has the review as the last step of the workflow, after the spec is closed.
- **AC-3**: The `fresh-reviewer` agent is defined in `.claude/agents/fresh-reviewer.md`:
  - it is read-only (no `Edit`, `Write` or `NotebookEdit` in its tools) and reviews the diff of the current
    branch against the base it is given;
  - it starts from `CLAUDE.md` and the spec it is given, and does not trust the spec's status or its
    coverage table: it checks each AC against the code and the tests;
  - it looks for: ACs not implemented or built twice, ACs without a test that really asserts them, behaviour
    that no AC describes, leftovers of what was renamed or moved (code, messages in all three languages,
    docs, specs, links), the gotchas listed in `CLAUDE.md`, regressions for signed-out visitors, other
    locales, small screens and the no-JS paths, and security and privacy (authorization, secrets in logs,
    redirects);
  - it runs `npm run check` and reports the result;
  - it reports findings most severe first, each with `file:line`, what is wrong and a concrete failing
    scenario, then what it checked and found fine; "no findings" is a valid answer.
- **AC-4**: `.github/pull_request_template.md` gives every pull request the checklist (spec first, checks and
  E2E run, fresh-context review done) and a section to record the review's findings and what was done about
  each.

## Out of scope

- Enforcing it mechanically. GitHub can't tell whether an agent ran, so the gate is the written rule, the
  agent definition that makes the review one command and the checklist in every pull request. The owner's
  own look at a pull request stays the final gate.
- `/code-review ultra` (a billed, multi-agent cloud review the owner starts by hand) and
  `/code-review`: they can be used as well, but they don't replace this step, which is free to run on every
  change and reads the project's own rules.
- Dependabot pull requests: the rule is for changes a person or Claude writes; CI judges Dependabot's.
  Everything else is reviewed, documentation-only changes included.

## Notes

- Why "no context": a reviewer that is told what the change is for, and why it was done this way, tends to
  confirm it. The author passes only the spec number and the base branch; the agent works out the rest from
  the spec and the diff. If the spec can't explain the change to a stranger, that is itself a finding.
- Project agents are loaded when a Claude Code session starts. In the session that creates or edits
  `.claude/agents/fresh-reviewer.md`, spawn a general-purpose agent and give it the same brief (the body of
  that file); every later session has `fresh-reviewer`.
- The agent reads and runs commands but never edits: the author applies the fixes, so the author's
  context and the reviewer's never mix.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4 | `tests/review-process.test.ts` (the rule is in `CLAUDE.md` and `specs/README.md`; the agent file exists, is read-only and names what it checks; the pull request template has the checklist and the findings section) |
| AC-3 (quality of the reviews) | manual: the owner reads the findings in each pull request |
