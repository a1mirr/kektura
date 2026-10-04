# 0022: A fresh-context review before every merge

Status: Done
Owner code: `.claude/agents/fresh-reviewer.md`, `.github/pull_request_template.md`, `CLAUDE.md` (Workflow),
`specs/README.md` (Workflow), and for AC-5 `scripts/check-review-recorded.mjs` and the `review` job of `.github/workflows/ci.yml`

## Goal

The spec, the tests and the regression gate check that the code does what its author *meant*. Nothing
checks that what the author meant is complete, or that the author did not just read their own work the way
they wrote it. The owner wants every change reviewed, before it is merged, by an agent that has none of the
author's context, and wants that to be part of how work is done here, not something to remember each time.

## Behaviour

- **AC-1**: `CLAUDE.md` (Workflow) states the rule: before a pull request is merged, an agent with no
  context of the work reviews the committed change; every valid finding is fixed and the rest answered in
  the pull request, with the commit that was reviewed; a pull request is not handed over as ready to merge
  before that. It names the agent (`fresh-reviewer`), says what the author tells it (the task number, the spec
  number for a change that is only a spec, or `none` for a small change with neither, and the base branch,
  nothing else), that fixes which change
  code, tests or behaviour get another fresh review (a review of an earlier state doesn't count) and
  wording-only fixes don't, that documentation changes are reviewed too, and that Dependabot's pull
  requests are not. `CLAUDE.md` lists the spec among "Where the rules live".
- **AC-2**: `specs/README.md` has the review as the last step of the workflow, after the specs are made true.
- **AC-3**: The `fresh-reviewer` agent is defined in `.claude/agents/fresh-reviewer.md`:
  - its tools are exactly `Read`, `Grep`, `Glob` and `Bash`: no `Edit`, `Write` or `NotebookEdit`. `Bash`
    could still write, so the brief forbids it;
  - it reviews the diff of the current branch against the base it is given (by default `origin/main`, which it
    fetches first: a local `main` can be stale; fetching is the one write it makes, to remote-tracking refs), plus
    anything not committed yet,
    and starts its report with the commit it reviewed and whether the working tree was clean, so a review of
    uncommitted work can't pass for a review of the final state;
  - it starts from `CLAUDE.md`, `specs/0034-specs-and-tasks.md` and the task it is given and the specs that
    task lists (with a spec number, that spec; with `none`, the specs that own the behaviour the diff touches,
    saying whether the change needed a spec or a task of its own), and does not trust the spec's status or its
    coverage table: it checks each AC of the touched specs against the code and the tests, and the behaviour of
    the touched area against the ACs, so a spec that has drifted from the code is a finding even where the
    diff did not touch it (spec 0034 AC-8);
  - it looks for: requirements of the task that do not hold, ACs not implemented or built twice, ACs without a test that really asserts them, behaviour
    that no AC describes, specs that describe behaviour that is not built, changes users can see that are missing from the changelog or described untruly
    there (spec 0018 AC-7), leftovers of what was renamed or moved (code, messages in every language,
    docs, specs, links), the gotchas listed in `CLAUDE.md`, regressions for signed-out visitors, other
    locales, small screens and the no-JS paths, and security and privacy (authorization, secrets in logs,
    redirects);
  - it re-checks the `manual` coverage rows of the areas the change touches (spec 0034 AC-11): a row without a
    reason, a way to check it or a `Last checked` is a finding, so is one a test could replace, and it does the
    check itself where it can;
  - it checks every migration in the diff against spec 0026 AC-5 (could the code that is running live with it while
    it is applied; two merges for a drop or a rename), the migration's name and the regenerated types, because a merge
    deploys by itself;
  - it also checks spec hygiene (ACs renumbered or deleted instead of marked `Removed`, the owning spec of
    changed behaviour not updated, the index in `specs/README.md`, status and coverage not true), and reads
    the E2E specs instead of running them (they need Docker), saying whether they would catch a regression;
  - it runs `npm run check` and reports the result, ignoring the ignored build artefacts that rewrites
    (`tsconfig.tsbuildinfo`); just before reporting it checks the tree and the commit again and says if
    either changed while it worked;
  - it reports findings most severe first, each with `file:line`, what is wrong and a concrete failing
    scenario, then what it checked and found fine; "no findings" is a valid answer.
- **AC-4**: `.github/pull_request_template.md` gives every pull request the checklist (the task came first and its requirements hold, or a small
  change that needs no task; the touched specs mirror the code as built and describe nothing unbuilt; `npm run check` green and CI's end-to-end job passing (spec 0007 AC-8); everything users can see is in the changelog; fresh-context
  review done at the commit named in the pull
  request, with only wording fixes after it) and a section to record the reviewed commit, the review's
  findings and what was done about each. The checklist line and the section's comment name the "Review recorded" job (AC-5).
- **AC-5**: Every pull request shows, as a CI result, whether a review was recorded at the commit it is about to merge.
  A job named "Review recorded" (`review` in `.github/workflows/ci.yml`; pull requests only, skipped for pull requests
  opened by Dependabot) runs `scripts/check-review-recorded.mjs` on a full clone and fails unless the description of the pull
  request has a `Reviewed commit:` line (the last one counts; lines inside an HTML comment don't) with a sha of 7 to 40
  hex digits that exists, is the head of the pull request or an ancestor of it, and, when it is an ancestor, nothing
  but Markdown (`*.md`) changed after it: what counts is what the pull request's own commits changed (a conflict resolved by hand in a merge commit included), so files that arrive by merging the base branch into it do not need a new review. Any other changed file (wording fixes in code or messages included) needs a
  new review and a new sha in the description. The job reads the description through the API when it runs, so
  after editing it the job is re-run by hand (`gh run rerun <run-id> --job <job-id>`, of the newest run: an older run
  checks the head it started with); a push runs it again by itself.
  `CLAUDE.md` step 7 names it among the jobs that must be green before a merge. It is a tripwire: it shows that a review
  was recorded at a commit, not that it was good or that the sha was ever reviewed (a pull request that changes only
  Markdown can name any older commit, one already on `main` included).

## Out of scope

- Enforcing that the review was done and was good. GitHub can't tell whether an agent ran, so beyond the tripwire of
  AC-5 the gate is the written rule, the agent definition that makes the review one command and the checklist in
  every pull request. The owner's own look at a pull request stays the final gate, and the job is a visible red mark,
  not a required check (branch protection is off, spec 0021).
- `/code-review ultra` (a billed, multi-agent cloud review the owner starts by hand) and
  `/code-review`: they can be used as well, but they don't replace this step, which is free to run on every
  change and reads the project's own rules.
- Dependabot pull requests: the rule is for changes a person or Claude writes; CI judges Dependabot's.
  Everything else is reviewed, documentation-only changes included.

## Notes

- Why "no context": a reviewer that is told what the change is for, and why it was done this way, tends to
  confirm it. The author passes only the task number and the base branch; the agent works out the rest from
  the task, the specs and the diff. If the specs can't explain the change to a stranger, that is itself a finding.
- Project agents are loaded when a Claude Code session starts. In the session that creates or edits
  `.claude/agents/fresh-reviewer.md`, spawn a general-purpose agent and give it the same brief (the body of
  that file); every later session has `fresh-reviewer`.
- The agent reads and runs commands but never edits: the author applies the fixes, so the author's
  context and the reviewer's never mix. For the real `fresh-reviewer` agent that is enforced for files by
  its tool list and, for `Bash`, only by the brief. The fallback (a general-purpose agent, see above) has
  every tool, so there only the brief's "write nothing" holds: check `git status` after it ran.
- "Wording-only" is the author's call, and so is whether a fix needs another review. The pull request shows
  the reviewed commit next to the head, so the owner can see what came after it.
- The Stop hook doesn't watch `CLAUDE.md`, `.claude/` or `.github/`, so editing only those files doesn't run
  `tests/review-process.test.ts` at the end of a turn. `npm run check` and CI run it (CI on every pull
  request update). Adding the three paths to `WATCHED` in `.claude/hooks/stop-check.mjs` would close the gap; that
  hook is the owner's, so it is left as it is.
- A small change with no spec (CLAUDE.md allows that for trivial fixes) is reviewed too: the author passes
  `none` and the reviewer works out which specs own the behaviour touched.
- The author commits before asking for the review. The reviewer can see uncommitted files, but it says when
  it did, and the pull request records the commit that was reviewed.
- The author leaves the tree alone while the review runs. This happened once while this spec was reviewed:
  a second Claude session sharing the checkout wrote files into it. The reviewer noticed (its final check)
  and reviewed the commit it started from; a session that shares a checkout should use its own
  `git worktree`, and the author should stage only their own paths (never `git add -A` in a shared tree).

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4 | `tests/review-process.test.ts` (AC-4's wording about the end-to-end job is asserted under spec 0007 AC-8 in the same file; the rule is in `CLAUDE.md` and `specs/README.md`; the agent file exists, is read-only and names what it checks; the pull request template has the checklist and the findings section) |
| AC-5 | `tests/review-recorded.test.ts` (reading the description; updating a branch from its base: files that arrive by a merge, including one that both sides edited in different places, do not count, code written after it does, and so does a conflict the author resolved; every decision: no line, unknown sha, head, ancestor with only Markdown or nothing after it, ancestor with code after it; the git side against a real temporary repository; the job's name, trigger, Dependabot skip and permissions; the job named in `CLAUDE.md` and the template) |
| AC-5 (the job itself, on GitHub) | manual (only a real pull request exercises the `pull_request` event, the full clone and `gh api`): read the job's result on a pull request with and without a recorded review. Last checked: never recorded (the pull request that adds it is its first run; whoever checks it replaces this with the date) |
| AC-3 (quality of the reviews) | manual (judgement): the owner reads the findings in each pull request. Last checked: every pull request. |
