# 0052: Friends page buttons respond

Status: Open
Specs: [0043](../specs/0043-friends-comparison-and-feedback.md) AC-11 to AC-17 (added), [0024](../specs/0024-friends-sharing.md) AC-3
(changed: the "request sent" message joins one family of messages; the actions' rules, AC-14, are unchanged)

## Goal

Fix the Friends page buttons that work but do not respond: a pending state, no double press, a message for what happened, and a
confirmation for the two actions that cannot be undone from the page.

## Done when

- [ ] The cause is confirmed: the missing pending state, or also an action that sometimes does not apply (then a separate defect
      with the failing case)
- [ ] The buttons are built as small client components over the existing server actions, with the tests of the coverage table
- [ ] They still work without JavaScript; checked at 320 and 375 px; the changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Reported by the owner on 2026-10-04: the buttons in the "friends" menu are working but not responding. The page is a Server
Component whose buttons are plain `<form action>` forms ending in `redirect()`; the guess at the cause comes from reading it,
not from reproducing it.
