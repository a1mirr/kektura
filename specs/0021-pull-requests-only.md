# 0021: `main` only changes through pull requests (enforced on our side)

Status: Done
Owner code: `.githooks/pre-push`, `.githooks/guard.mjs`, `package.json` (`hooks:install`), `CLAUDE.md`

## Goal

`main` is GitHub's default branch and the one that gets deployed. The owner keeps GitHub's own branch
policy as it is (no protection rule), but wants every change to reach `main` through a pull request, so CI
has run before it lands. Enforce that where the pushes start: a git hook that refuses a push to `main`
on GitHub, for everybody who works in a clone of this repository, Claude Code included.

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
  given: a shell without a terminal can't answer gh's prompts), `gh pr checks <n> --watch`,
  `gh pr merge <n> --merge --match-head-commit <full-sha>` (the full sha of the pull request's current head: the
  reviewed commit plus, at most, wording fixes). The body file starts from a copy of
  `.github/pull_request_template.md`, which `gh` doesn't apply to `--body-file`. Merging happens on the owner's
  standing permission (given in chat on 2026-10-03, revocable) for pull requests the author wrote, once CI is green
  and the fresh-context review (spec 0022) is done; a merge deploys by itself (spec 0026); never `--admin`. After the merge the pull request's branch is deleted, remote and local, once it is
  verified (after a `git fetch`) to be contained in `main`, and never with `-D`; an open pull request based on
  the branch is retargeted to `main` first. Only branches of pull requests the author merged, or was asked to clean
  up, are deleted; the remote branch always goes, but a local branch another session has checked out is left to
  that session (and the user is told). A push to `production` by hand is only for a rollback or a broken deploy workflow (spec 0026), and only when asked. It also gives where `gh` is installed
  (machine-wide, on the system PATH).

## Out of scope

- GitHub-side enforcement (a branch protection rule or ruleset). The owner chose not to turn it on here;
  on a private repository it also needs a paid GitHub plan. This hook protects only clones that installed it.
- `git push --no-verify` skips every git hook. That stays available as the owner's escape hatch.
- Opening the pull request is not part of the hook; `gh` does it (AC-6), and `git push -u origin <topic>` also
  prints GitHub's link for it.

## Notes

- The check works on what git feeds a `pre-push` hook: the remote's URL as the second argument, and one line
  per ref on stdin (`<local ref> <local sha> <remote ref> <remote sha>`). The decision is a pure function,
  `checkPush(remoteUrl, stdinText)`, in `.githooks/guard.mjs`, tested directly; the CLI wrapper is tested by
  running it as a process.
- A push that changes nothing (`git push origin main` when up to date) doesn't reach the check or doesn't need
  to: nothing is sent.
- Merging a pull request on GitHub is not a push from this clone and is unaffected. After a merge:
  `git switch main && git pull`.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3 | `tests/git-hooks.test.ts` (`checkPush` for the three URL forms, every spelling of a push to `main`, topic branches, deleting a topic branch, tags, the deploy remote, a look-alike host; the guard run as a process: exit codes and message) |
| AC-4 | `tests/git-hooks.test.ts` (hook script calls the guard, `hooks:install` sets `core.hooksPath`, no `prepare`/`postinstall`/`preinstall` script) |
| AC-4 (the refusal in a clone) | manual (it needs a clone with the hook installed and a GitHub remote): `git push origin HEAD:main --dry-run` is refused. Last checked: never recorded. |
| AC-5 | `tests/git-hooks.test.ts` (CLAUDE.md mentions the rule and `hooks:install`) |
| AC-6 | `tests/git-hooks.test.ts` (CLAUDE.md names the three commands with the options that make them work without a terminal, the conditions for merging, the deletion of the merged branch and its check, and the install path, and has no control characters) |
| AC-6 (the deletion recipe works) | manual (it needs a real GitHub branch), after any change to the recipe: on a throwaway branch, push it, merge it, then run the recipe from a detached `origin/main` and confirm that `git branch -d` succeeds and that a branch with a commit added after the merge is refused. Last checked: 2026-10-04 (only the deletion: it worked for two merges). |
