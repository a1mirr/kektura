# 0065: Claude Code's own worktrees start from the remote's default branch

Status: Done
Specs: [0021](../specs/0021-pull-requests-only.md) AC-9 (one sentence added), Notes (rewritten)

## Goal

Task 0057 left `worktree.baseRef` in `.claude/settings.json` at `head` as the owner's call: a worktree made by Claude
Code's own tool started from the checkout's HEAD, which in the shared checkout can be a stale branch. The owner
decided in chat to switch it, so that every way of starting work begins at the real `origin/main`.

## Done when

- [x] `.claude/settings.json` sets `worktree.baseRef` to `fresh` (a valid value; the other is `head`; checked in Claude Code's documentation)
- [x] The wiring test asserts the setting
- [x] Spec 0021 AC-9 and Notes say so, including that the base can be up to 24 hours old, and a `manual` row says how to check the tool
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)

## Spec changes

Spec 0021: AC-9 gained a sentence on the setting and a pointer to the Notes; the Notes paragraph about
`EnterWorktree` now describes `fresh` and its 24-hour limit instead of the `head` gap; a `manual` coverage row for the
tool's behaviour; the coverage row of AC-9 mentions the setting test.

## Notes

- Claude Code only fetches the default branch itself when the last fetch is older than 24 hours (capped at 5
  seconds), so `git fetch origin` followed by `git worktree add ... origin/main` (checked by the hook) stays the way
  that is exact.
