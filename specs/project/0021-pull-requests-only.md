# 0021: `main` only changes through pull requests

Status: Done
Owner code: `.githooks/pre-push`, `.githooks/guard.mjs`, `.claude/hooks/worktree-guard.mjs`, `scripts/tidy.mjs`,
`package.json` (`hooks:install`, `tidy`), `.claude/settings.json` (wires the hook), `CLAUDE.md`, `.github/rulesets/protect-main.json`

## Goal

`main` is GitHub's default branch and the one that gets deployed. Every change reaches `main` through a pull request, so CI
has run before it lands. GitHub enforces that (AC-11), and the pushes are also refused where they start: a git hook
that refuses a push to `main` on GitHub, for everybody who works in a clone of this repository, Claude Code included. The same goes for where
the work is done: in a worktree of its own on a topic branch, not in the checkout every session shares, and the
leftovers of a merged change are cleaned up.

## Behaviour

- **AC-1**: A push that updates or deletes `main` on a GitHub remote (`https://github.com/…`,
  `git@github.com:…`, `ssh://git@github.com/…`) is refused by the `pre-push` hook before anything is sent,
  whichever way it is spelled (`git push origin main`, `HEAD:main`, `+main`, `:main`). The message says to
  push a topic branch and open a pull request instead.
- **AC-2**: Pushing any other branch, or a tag, to GitHub is not affected; deleting a topic branch is not either
  (that is how a merged branch is cleaned up).
- **AC-3**: Other remotes are not affected: the deploy push (`git push production main`) works as before.
- **AC-4**: The hook is versioned in `.githooks/` (a small `pre-push` shell script that runs `guard.mjs`).
  `npm run hooks:install` points a clone at it (`git config core.hooksPath .githooks`); that is done once per
  clone. There is deliberately no `prepare`/`postinstall` script that would do it automatically: `npm ci` also
  runs on the production server, inside the deploy hook, where `git config` could write into the bare
  repository and switch off its own `post-receive` hook.
- **AC-5**: `CLAUDE.md` states the rule and the install step, so a new clone (or a new Claude Code session)
  knows both.
- **AC-6**: `CLAUDE.md` says how a pull request is opened and merged with `gh`:
  `gh pr create --base main --head <topic> --title "<title>" --body-file <file>` (title and body are always
  given: a shell without a terminal can't answer gh's prompts), `gh pr checks <n>` (one look, never `--watch` or a sleep loop: a
  wait blocks all other work; if the run is still going, do other work and look once more later; the same goes for a deploy run),
  `gh pr merge <n> --merge --match-head-commit <full-sha>` (the full sha of the pull request's current head: the
  reviewed commit plus, at most, wording fixes). The body file starts from a copy of
  `.github/pull_request_template.md`, which `gh` doesn't apply to `--body-file`. Merging happens on the owner's
  standing permission (given in chat on 2026-10-03, revocable) for pull requests the author wrote, once CI is green
  and the fresh-context review (spec 0022) is done (GitHub refuses to merge a branch that is behind `main`, AC-11: a branch that is behind gets `origin/main` merged in, `npm run check`, a push and a new CI run first, without a new review for what arrives from `main`); a merge deploys by itself (spec 0026); never `--admin`. After the merge the pull request's branch is deleted, remote and local, once it is
  verified (after a `git fetch`) to be contained in `main`, and never with `-D`; an open pull request based on
  the branch is retargeted to `main` first. Only branches of pull requests the author merged, or was asked to clean
  up, are deleted; the remote branch always goes, but a local branch another session has checked out is left to
  that session (and the user is told). A push to `production` by hand is only for a rollback or a broken deploy workflow (spec 0026), and only when asked. It also gives where `gh` is installed
  (machine-wide, on the system PATH).

- **AC-7**: Claude Code does not change files in the primary checkout of this repository, nor in any checkout that is
  on `main`: changes are made in a linked worktree on a topic branch (`git worktree add .claude/worktrees/<name> -b
  <topic> origin/main`). A `PreToolUse` hook (`.claude/hooks/worktree-guard.mjs`, wired in `.claude/settings.json` for
  `Edit`, `Write`, `NotebookEdit`, `Bash` and `PowerShell`) refuses, with exit code 2:
  - `Edit`, `Write` and `NotebookEdit` on a file inside such a checkout, unless git ignores the file (build output,
    `.env.local`);
  - a `Bash` command that runs a git command that changes a working tree, the index or a branch (`add`, `am`,
    `apply`, `checkout`, `cherry-pick`, `clean`, `commit`, `merge`, `mv`, `pull`, `rebase`, `reset`, `restore`,
    `revert`, `rm`, `stash`, `switch`) there; `git -C <dir>` and a leading `cd <dir> &&` say which checkout is meant.

  Reading (`status`, `log`, `diff`, `fetch`, `stash list`, `stash show`), `git worktree` (except creating a branch from a stale or wrong
  base, AC-9), `git branch -r`, pushing (the pre-push guard owns that) and a forward-only update of a checkout that
  is on `main` (`git merge --ff-only`, `git pull --ff-only`: upkeep, not work) are never refused. The refusal tells
  Claude how to make a worktree. `FOO=1 git ...`, `command git ...`, `git.exe`, and Git Bash or WSL paths in `cd` and
  `git -C` (`/c/Personal/x`, `/mnt/c/x`, `~/x`) are read as the command and directory they mean. A path outside the
  repository, a different repository, a payload the hook cannot read and a directory that is not a git checkout are
  let through. It stops the usual mistake; it is not a sandbox (a shell redirect, `sed -i` or a script that writes
  files is not recognised, nor are git commands behind a subshell, a brace group, `if`, `for`, `$(...)`, `sudo`, `env`, `time` or the PowerShell call operator `&`; and when `git` cannot be run at all, the guard lets everything through).
- **AC-8**: `npm run tidy` (`scripts/tidy.mjs`) lists what a merge leaves behind and, with `--apply`, removes it:
  worktrees under `.claude/worktrees` and local branches whose work a pull request has merged: "merged" means a
  merge commit of `origin/main` brought the branch's tip in, so a new branch that has no commit of its own yet, which
  is an ancestor of `origin/main` too, is never taken for finished work (another session may be about to use it). It
  keeps, and says why: the primary checkout, the worktree it runs in (so a worktree is removed by a run from another
  checkout, for instance the next session's), a worktree with a modified or untracked file, a branch, or a worktree
  on a branch, that no merge commit contains (a detached worktree has no branch to protect: it only has to point at
  something that is in `origin/main`, which is what the clean-up recipe of `CLAUDE.md` step 7 leaves behind; so a clean detached worktree that was made a
  moment ago and has no commit yet is removed too), a branch checked out in a kept worktree, `main`, and worktrees outside `.claude/worktrees`
  (another tool's). Before it removes a worktree it unlinks a `node_modules` junction, so the real one is never
  reached; a branch whose worktree could not be removed (locked, say) is kept; a branch is deleted only at the sha it
  has just checked against `origin/main`, never with `-D`. `--remote` also deletes merged branches on `origin`, with a lease on the sha it checked, so a commit
  pushed since is not thrown away.
  Without `--apply` nothing changes. The author runs it after every merge (`CLAUDE.md`, workflow step 7). It
  judges only by "merged", so it is wider than the per-branch limits of AC-6, which cover the branch of a pull
  request the author merged: it removes a clean, merged worktree whoever made it, so a session that is idling in
  one has its directory taken away (run it when no other session is mid-work in a merged worktree), a merged local
  branch is deleted even when another tool made it (its worktree outside `.claude/worktrees` is kept), and
  `--remote` does not check for an open pull request based on the branch (CLAUDE.md step 7 retargets it first).
- **AC-9**: New work starts from the real `origin/main`, never from a stale local `main` or another branch (checked
  to the minute only where the hook sees the command, see Notes). The
  `worktree-guard` hook enforces it for the way work is started (`git worktree add`, with `-b`/`-B` or with a path
  alone, which makes a branch from HEAD; `--detach` and an existing branch are left alone); a branch made later inside a
  worktree (`git switch -c`) is not recognised. The hook refuses a `git worktree add` that creates a branch (`-b` or `-B`) unless its base is
  exactly `origin/main` and the `origin/main` of the checkout is the commit GitHub reports for `main` right now
  (`git ls-remote`): the message says to `git fetch origin` first. The fetch has to be its own call, because the
  command is judged before it runs. Checking out an existing branch (no `-b`) is not a new branch and is left
  alone; with no reachable origin there is nothing to compare, so the base rule alone applies. `npm run tidy
  --apply` also moves a local `main` that is only behind up to `origin/main` (forward only, at the sha it checked),
  unless a worktree has `main` checked out (it says to update that one with `git merge --ff-only origin/main`, which
  the hook allows): a stale local `main` is brought up when `tidy` runs (after a merge), not at every moment, and the
  hook does not look at `git switch main`. Stacking a branch on another unmerged branch is not a case this workflow
  has: the hook refuses it, and the owner makes such a worktree by hand if it is wanted. `.claude/settings.json` sets
  `worktree.baseRef` to `fresh`, so a worktree made by Claude Code's own tool starts from the remote's default branch
  and not from the checkout's HEAD (see Notes for how fresh that is).
- **AC-11**: GitHub enforces the rule on `main` with the ruleset "Protect main", whose definition is `.github/rulesets/protect-main.json` (the
  owner applies it with `gh api`, see Notes): `main` cannot be deleted or force-pushed; a change reaches it only by a pull request,
  merged with a merge commit; the checks "Typecheck, lint, unit tests", "End-to-end tests" and "Review recorded" (the job names of
  `.github/workflows/ci.yml`) must have passed, a skipped one counting as passed (spec 0007 AC-10, spec 0022 AC-5); and the branch
  must be up to date with `main`, so two pull requests that are each green cannot break `main` together. No one can bypass it, and
  no approval is required (one owner).
- **AC-10**: `CLAUDE.md` says what to do when the auto-mode classifier denies a tool call: do not retry, split or
  route around it, and do not stop; say so in one line, carry on with every step that does not depend on it, and
  hand the denied command to the user at the end; commands that delete or change shared state run as a call of
  their own, so a denial cannot swallow the rest. (A rule for the author, checked as text.)

## Out of scope

- The hook protects only clones that installed it; the ruleset (AC-11) is what binds everybody.
- `git push --no-verify` skips every git hook. That stays available as the owner's escape hatch.
- Opening the pull request is not part of the hook; `gh` does it (AC-6), and `git push -u origin <topic>` also
  prints GitHub's link for it.

## Notes

- The ruleset is applied once, and again after a change to the file, with `gh api -X POST repos/a1mirr/kektura/rulesets --input
  .github/rulesets/protect-main.json` (a new one) or `gh api -X PUT repos/a1mirr/kektura/rulesets/<id> --input ...` (an existing one;
  `gh api repos/a1mirr/kektura/rulesets` lists the ids). It needs a public repository (or a paid plan). When a job is renamed in
  `ci.yml`, the file and the live ruleset change with it, or the pull requests wait for a check that never comes.
- The check works on what git feeds a `pre-push` hook: the remote's URL as the second argument, and one line
  per ref on stdin (`<local ref> <local sha> <remote ref> <remote sha>`). The decision is a pure function,
  `checkPush(remoteUrl, stdinText)`, in `.githooks/guard.mjs`, tested directly; the CLI wrapper is tested by
  running it as a process.
- A push that changes nothing (`git push origin main` when up to date) doesn't reach the check or doesn't need
  to: nothing is sent.
- Merging a pull request on GitHub is not a push from this clone and is unaffected. After a merge, `npm run tidy
  -- --apply` (AC-8, AC-9) removes the leftovers and brings a stale local `main` up to `origin/main`; a checkout that
  is on `main` is updated with `git merge --ff-only origin/main`.
- A worktree made by Claude Code's own `EnterWorktree` tool is not made by a command the hook sees, so the hook's part
  of AC-9 does not cover it: that tool takes its base from the setting `worktree.baseRef` in `.claude/settings.json`,
  which is `fresh` (the remote's default branch; Claude Code fetches it first when the last fetch is older than 24
  hours, so the base can still be up to a day old; Claude Code's documentation, "Customize worktree creation" at
  code.claude.com/docs/en/worktrees, "Choose the base branch", read on 2026-10-04). The other value, `head`, would start from the checkout's HEAD, which
  in the shared checkout can be a stale branch. Making worktrees with `git worktree add` (the hook's refusal text shows
  how) is the way that is enforced to the minute.

## Coverage

| AC | Test |
| --- | --- |
| AC-7 | `tests/worktree-guard.test.ts` (`decide` against a real primary checkout and linked worktrees: every file tool, a new file in a new directory, a worktree on `main`, ignored files, other repositories, `git -C` and `cd` (also Git Bash paths), `FOO=1 git`, `command git`, `git.exe`, forward-only updates of `main`, mutating and reading git commands, the settings wiring, the hook run as a process: exit codes and message) |
| AC-9 (the tool's worktree) | manual (it needs a Claude Code session, and the tool's behaviour is the tool's): from a checkout whose HEAD is a stale branch, enter a worktree with Claude Code's own tool and check that `git log -1 --oneline` there is `origin/main`. Last checked: never recorded. |
| AC-7 (the hook inside Claude Code) | manual (it needs a Claude Code session): in the primary checkout ask Claude to edit a tracked file and see the refusal with the `git worktree add` line. Last checked: never recorded. |
| AC-9 | `tests/worktree-guard.test.ts` (the setting `worktree.baseRef` is `fresh`; against a bare origin and a clone: `origin/main` as base allowed, a local main, another branch or no base refused, a stale `origin/main` refused until fetched, an existing branch allowed, a chained fetch refused, no origin allowed); `tests/tidy.test.ts` (a stale local main is fast-forwarded and left alone when a worktree has it) |
| AC-8 (the step in the workflow), AC-10 | `tests/worktree-guard.test.ts` (`CLAUDE.md` names `npm run tidy`, the hook, `git fetch origin` as a call of its own, and the classifier rule) |
| AC-8 | `tests/tidy.test.ts` (`planTidy` for every keep and remove reason, the junction left alone, the script against a bare origin and a clone: dry run, `--apply`, a new branch with no commit kept, a locked worktree keeps its branch, unknown argument) |
| AC-1, AC-2, AC-3 | `tests/git-hooks.test.ts` (`checkPush` for the three URL forms, every spelling of a push to `main`, topic branches, deleting a topic branch, tags, the deploy remote, a look-alike host; the guard run as a process: exit codes and message) |
| AC-4 | `tests/git-hooks.test.ts` (hook script calls the guard, `hooks:install` sets `core.hooksPath`, no `prepare`/`postinstall`/`preinstall` script) |
| AC-4 (the refusal in a clone) | manual (it needs a clone with the hook installed and a GitHub remote): `git push origin HEAD:main --dry-run` is refused. Last checked: never recorded. |
| AC-5 | `tests/git-hooks.test.ts` (CLAUDE.md mentions the rule and `hooks:install`) |
| AC-6 | `tests/git-hooks.test.ts` (CLAUDE.md names the three commands with the options that make them work without a terminal, the conditions for merging, the deletion of the merged branch and its check, and the install path, and has no control characters) |
| AC-6 (the deletion recipe works) | manual (it needs a real GitHub branch), after any change to the recipe: on a throwaway branch, push it, merge it, then run the recipe from a detached `origin/main` and confirm that `git branch -d` succeeds and that a branch with a commit added after the merge is refused. Last checked: 2026-10-04 (only the deletion: it worked for two merges). |
| AC-11 | `tests/ruleset.test.ts` (the file is a ruleset on the default branch with deletion, force-push and pull-request rules, merge commits only, up-to-date branches, no bypass actor; the required checks are exactly the names of the jobs of `ci.yml` that run for a pull request and nothing else) |
| AC-11 (on GitHub) | manual (it is a repository setting): `gh api repos/a1mirr/kektura/rulesets` lists "Protect main" as active with the same checks as the file, and a pull request that is behind `main` shows "This branch is out-of-date" and cannot be merged. Last checked: never recorded. |
