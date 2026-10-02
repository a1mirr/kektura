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
- **AC-2**: Pushing any other branch, or a tag, to GitHub is not affected.
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
  `gh pr merge <n> --merge --match-head-commit <full-sha>` (the full sha of the reviewed head). Merging happens
  only when the user asked for it or the task said so, CI is green and the fresh-context review (spec 0022) is
  done; never `--admin`; branches are not deleted and nothing is deployed unless asked. It also gives where `gh`
  is installed (per user, on the user's PATH).

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
| AC-1, AC-2, AC-3 | `tests/git-hooks.test.ts` (`checkPush` for the three URL forms, every spelling of a push to `main`, topic branches, tags, the deploy remote, a look-alike host; the guard run as a process: exit codes and message) |
| AC-4 | `tests/git-hooks.test.ts` (hook script calls the guard, `hooks:install` sets `core.hooksPath`, no `prepare`/`postinstall`/`preinstall` script); by hand: with the hook installed, `git push origin HEAD:main --dry-run` is refused |
| AC-5 | `tests/git-hooks.test.ts` (CLAUDE.md mentions the rule and `hooks:install`) |
| AC-6 | `tests/git-hooks.test.ts` (CLAUDE.md names the three commands with the options that make them work without a terminal, the conditions for merging and the install path, and has no control characters) |
