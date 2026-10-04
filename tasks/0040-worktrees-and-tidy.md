# 0040: Work only in worktrees from a fresh origin/main, and tidy after a merge

Status: Done
Specs: [0021](../specs/0021-pull-requests-only.md) AC-7, AC-8, AC-9 (added)

## Goal

Several Claude sessions share one checkout, and a review of the harness found three things that follow from it: a
session can edit files in the shared checkout or on `main`, a session can start from a local `main` that is days
behind (the shared checkout sat on a stale draft branch and its `main` was 62 commits behind `origin/main`, which
made the first review of the harness wrong), and merged worktrees and branches pile up (17 worktrees and 45
branches were found). Make the right way the only way that works, and clean up after every merge.

## Done when

- [x] A `PreToolUse` hook refuses file edits and mutating git commands in the primary checkout and on `main`
- [x] The same hook refuses a new branch that does not start from an `origin/main` equal to GitHub's `main`
- [x] `npm run tidy` removes merged worktrees and branches (and moves a stale local `main` up), dry run by default
- [x] `CLAUDE.md` says to work in a worktree from a fresh `origin/main`, to run `npm run tidy` after a merge, and what to do when the auto-mode classifier denies a call
- [x] The first clean-up was done by hand: 8 clean merged worktrees and 14 merged local branches removed; left alone: worktrees with uncommitted work or commits `origin/main` lacks, the shared checkout, other tools' worktrees, and the remote branch `origin/deploy-gh-retry` (the classifier denied deleting it)
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Spec 0021: AC-7 (the hook), AC-8 (`tidy`) and AC-9 (a fresh `origin/main` as the base) added, with their coverage
rows and owner code; the Goal says that where the work is done and the clean-up are part of the area. Status stays
`Done`: every AC holds and has a test, and the one check that needs a live Claude Code session is a `manual` row.

## Notes

- A hook can refuse, not move the session: the refusal text says how to make a worktree. The hook is a guard
  against the usual mistake, not a sandbox (a shell redirect or `sed -i` is not recognised); the pre-push guard,
  CI and the review stand behind it.
- The fresh review found, and this task fixed: Git Bash paths (`/c/...`) and `FOO=1 git` slipping past the hook,
  `tidy` treating a new branch with no commit as merged (it now asks for a merge commit), a branch deleted although
  its worktree could not be removed, and an unproven claim for spec 0007 AC-10. Left as documented limits: a
  `git switch -c` inside a worktree is not checked against `origin/main`, and the numbers 0040 to 0047 collide
  with drafts that sit on other unmerged local branches (see the pull request).
- The hook takes effect in a checkout once this change is merged and the checkout has the new `.claude/settings.json`.
- `git branch -d` tests "merged into HEAD", so `tidy` tests "merged into origin/main" itself and deletes the ref at the
  sha it checked (never `-D`).
- GitHub's setting "Automatically delete head branches" would remove the remote half of the clean-up for good. It is a
  repository setting for the owner to switch on: `gh api -X PATCH repos/a1mirr/kektura -f delete_branch_on_merge=true`.
