# 0072: Friends in the changelog, and a hook that sees committed work

Status: Done
Specs: [0018](../specs/0018-changelog.md) AC-7 (a feature flag does not excuse a missing entry), [0034](../specs/0034-specs-and-tasks.md) AC-12 (the hook counts committed work), [0024](../specs/0024-friends-sharing.md) AC-16 (the friends entries)

## Goal

The Friends feature is on in production (a signed-out `/en/friends` answers 307, not 404) and everything done to it
(friends themselves, the comparison with a friend, the responding buttons) was missing from the changelog: the work was
treated as hidden behind `FF_FRIENDS`, a state nobody had looked up, and the Stop hook that asks about the changelog only
looked at uncommitted files, so it never fired for work that was already committed. Add the missing entries and close both
gaps.

## Done when

- [x] The changelog has the missing friends entries in every language, in the entry of the newest date
- [x] The rule says that a feature flag is no excuse while it is on in production and that the state is looked up, never assumed: `CLAUDE.md`, the pull request template and the reviewer's brief
- [x] The Stop hook's nudge counts files the branch has committed since it left `origin/main`, not only the working tree, and does not repeat the same message
- [x] Spec 0034 AC-12, spec 0018 AC-7 and spec 0024 AC-16 say so; tests cover the decision (`tests/stop-nudges.test.ts`)
- [x] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

- [x] **R-1**: The changelog tells users about friends: connecting through an invite link and seeing each other's progress, the comparison on a friend's page (figures, stages, the shared map), and the buttons that respond and confirm.
- [x] **R-2**: A visible change behind a feature flag needs a changelog entry while the flag is on in production; the production state is looked up (`curl` the page: 404 means off), never assumed.
- [x] **R-3**: The Stop hook asks about the changelog (and the spec) for committed work too, once per distinct message.

## Spec changes

Spec 0018 AC-7: the flag rule and the hook's wider reach. Spec 0034 AC-12: the nudge counts the branch's commits since `origin/main`, and is not repeated for the same message (coverage rows follow). Spec 0024 AC-16: the changelog describes the friends page like any other, every language instead of "ru, en and hu", and the coverage row points to the changelog. Nothing renumbered.

## Notes

Reported by the owner on 2026-10-04: "why I can't see update of friends page in changelog? how did we miss that user-visible update should be on the changelog page, and it's mandatory?". The causes: spec 0024 AC-16 said the entry would come "when the flag goes on for everyone" and `CLAUDE.md` said the flag was "off in production until switched on"; nobody checked, and the flag had been switched on. All three review rounds of tasks 0051, 0052 and 0071 accepted the exception because the task and the spec stated it.

- Also here: `tests/review-recorded.test.ts` and `tests/ci-changes.test.ts` raise their test and hook timeouts (30 s and 60 s): its git tests missed the default 5 s and 10 s under the load of a full run, in the reviewers' runs and in ours, while passing alone in about a second.

Code the work touches: `.claude/hooks/stop-check.mjs`, `.claude/hooks/stop-nudges.mjs`, `src/content/changelog.ts`, `CLAUDE.md`, `.claude/agents/fresh-reviewer.md`, `.github/pull_request_template.md`
