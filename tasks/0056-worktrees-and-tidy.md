# 0056: Work only in worktrees from a fresh origin/main, and tidy after a merge

Status: Done
Specs: [0021](../specs/0021-pull-requests-only.md) AC-7, AC-8, AC-9, AC-10 (added)

## Goal

Several Claude sessions share one checkout, and a review of the harness found three things that follow from it: a
session can edit files in the shared checkout or on `main`, a session can start from a local `main` that is days
behind (the shared checkout sat on a stale draft branch and its `main` was 62 commits behind `origin/main`, which
made the first review of the harness wrong), and merged worktrees and branches pile up (17 worktrees and 45
branches were found). Make the right way the only way that works, and clean up after every merge.

## Done when

- [x] A `PreToolUse` hook refuses file edits and mutating git commands (Bash and PowerShell) in the primary checkout and on `main`
- [x] The same hook refuses a new branch that does not start from an `origin/main` equal to GitHub's `main`
- [x] `npm run tidy` removes merged worktrees and branches (and moves a stale local `main` up), dry run by default
- [x] `CLAUDE.md` says to work in a worktree from a fresh `origin/main`, to run `npm run tidy` after a merge, and what to do when the auto-mode classifier denies a call
- [x] The first clean-up was done by hand: 8 clean merged worktrees and 14 merged local branches removed; left alone: worktrees with uncommitted work or commits `origin/main` lacks, the shared checkout, other tools' worktrees, and the remote branch `origin/deploy-gh-retry` (the classifier denied deleting it)
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Spec 0021: AC-7 (the hook), AC-8 (`tidy`), AC-9 (a fresh `origin/main` as the base) and AC-10 (a denied call is not
a place to stop) added, with their coverage rows and owner code; the Goal says that where the work is done and the
clean-up are part of the area. Status stays `Done`: every AC holds and has a test, and the one check that needs a
live Claude Code session is a `manual` row. Spec 0012, Notes: the "Not verified" paragraph now says
that the weekly backup was run by hand on GitHub on 2026-10-04 and succeeded (a fact found while checking task
0058's premise; no AC changed). The same pull request also carries task 0063 (spec 0007 AC-8, spec 0022
AC-4) and the open tasks 0057 to 0062, which change no spec until they are built.

## Notes

- A hook can refuse, not move the session: the refusal text says how to make a worktree. The hook is a guard
  against the usual mistake, not a sandbox (a shell redirect or `sed -i` is not recognised); the pre-push guard,
  CI and the review stand behind it.
- Four fresh reviews shaped it. Fixed: Git Bash paths (`/c/...`), `FOO=1 git`, `command git`, `git.exe` and quoted env
  values slipping past the hook; the PowerShell tool unguarded; `-bNAME`; `tidy` treating a new branch with no commit
  as merged (it asks for a merge commit now), a branch deleted although its worktree could not be removed, a
  `node_modules` unlink that threw on Linux and left no link behind when the removal failed; `--remote` without a
  lease or a test. Left as documented limits (spec 0021): a `git switch -c` inside a worktree is not checked against
  `origin/main`, stacking a branch on another one is refused, `git branch -f`, a quoted `;` inside a commit message,
  and `tidy` removing a clean merged worktree that another session idles in.
- `worktree.baseRef` in `.claude/settings.json` is `head`: a worktree made by the `EnterWorktree` tool starts from the
  shared checkout's HEAD, which can be stale. Not changed here; it is the owner's call (spec 0021 Notes).
- The hook takes effect in a checkout once this change is merged and the checkout has the new `.claude/settings.json`.
- `git branch -d` tests "merged into HEAD", so `tidy` tests "merged into origin/main" itself and deletes the ref at the
  sha it checked (never `-D`).
- GitHub's setting "Automatically delete head branches" would remove the remote half of the clean-up for good. It is a
  repository setting for the owner to switch on: `gh api -X PATCH repos/a1mirr/kektura -f delete_branch_on_merge=true`.
- The task numbers were 0040 to 0047 until `origin/main` took them for the backlog (tasks 0046 to 0055); they were
  renumbered to 0056 to 0063.
