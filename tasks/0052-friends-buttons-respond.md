# 0052: Friends page buttons respond

Status: Open
Specs: [0024](../specs/0024-friends-sharing.md) AC-3 (the "request sent" message joins a family of messages), AC-14 (the actions' feedback; their rules are unchanged)

## Goal

Fix the Friends page buttons that work but do not respond: a pending state, no double press, a message for what happened, and a
confirmation for the two actions that cannot be undone from the page.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The cause is confirmed: the missing pending state, or also an action that sometimes does not apply (then a separate defect
      with the failing case)
- [ ] `?sent=1` becomes `?ok=sent`: its producer (`friends/invite/[token]/page.tsx`), the `friends/page.tsx` branch, the message key `friends.requestSent` and `e2e/friends.spec.ts` change together
- [ ] The buttons are built as small client components over the existing server actions, with the tests under "Tests to write"
- [ ] They still work without JavaScript; checked at 320 and 375 px; the changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0051 and 0052 (R-1 to R-17).

### Buttons that respond

Every button on `/friends` (save name, regenerate link, approve, ignore, remove, start and stop sharing) is a plain form
whose server action ends with a redirect, so between the click and the reload nothing shows that it worked.

- [ ] **R-11**: Pressing any of these buttons changes its look at once, before the server answers: it is disabled, its label
  is replaced by or joined with a spinner or "…", and it keeps its size so the layout does not jump. The pressed button
  shows this, not the whole page.
- [ ] **R-12**: While a request runs, a second press of the same button sends nothing more, and the other buttons that act on
  the same row (approve and ignore of one request) are disabled too. The buttons of a row share one pending state (one
  client wrapper per row), because `useFormStatus` only knows its own form.
- [ ] **R-13**: When the request is done the page says what happened: a success message that names it ("Friend request
  approved", "Link regenerated", "Name saved", "Sharing stopped", "Removed"), announced to screen readers
  (`role="status"`, `aria-live="polite"`), through the same mechanism as the existing "request sent" message (`?sent=1`):
  one whitelisted query value family, never shown raw (`?sent=1` becomes `?ok=sent`, so there is one mechanism); a failure shows the existing error text with `role="alert"`. A message goes away
  on the next action.
- [ ] **R-14**: Remove-friend and regenerate-link ask for confirmation first, in the page (not `window.confirm`), and the
  regenerate step says that the old link stops working. The confirmation is itself a plain form (a `<details>` that reveals
  a confirming button), so it also works without JavaScript and nothing destructive runs on the first press; Cancel
  closes it, and Escape does too with JavaScript.
- [ ] **R-15**: The buttons keep working without JavaScript and before hydration (they stay plain forms posting to the page):
  the pending state is an enhancement. With JavaScript off, behaviour is that of spec 0024 (a reload, `?error=` on
  failure).
- [ ] **R-16**: Touch targets are at least 44 x 44 px at 375 px and 320 px, and buttons wrap onto a second line instead of
  overflowing; approve and ignore are told apart by words, not colour alone.
- [ ] **R-17**: The actions still never throw and the rules of spec 0024 (RLS, validation, rate limits) are unchanged: only
  how the page reacts changes.

## Out of scope

Comparing with more than one friend at once; a leaderboard; who walked what first (it would need to share dates); sending
a message or a challenge; the friend's extra stamps unless spec 0024 already shares them; exporting the comparison; live
updates when another user changes something; optimistic updates of the list.

## Open questions

- **The cause of "buttons work but do not respond".** The first guess is the missing pending state above. If an action
  also sometimes fails to apply (the data does not change on reload), that is a separate defect and needs the failing
  case.
- **Mechanism.** The pending state needs `useFormStatus` or `useActionState`, which are client-only. This draft wraps each
  button in a small client component and keeps the server actions and the Server Component page; the alternative moves the
  whole list to a client component.
- **Where the success message shows.** At the top of the page, announced and scrolled into view on mobile (this draft), or
  next to the row.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-11, R-12 | planned: `src/components/FriendActionButton.test.tsx` (pending disables, keeps size, ignores a second press; the other button of the row is disabled while one runs) |
| R-13, R-14 | planned: `e2e/friends.spec.ts` (success message per action in three languages; confirmation steps) |
| R-15 | planned: `e2e/friends.spec.ts` (JavaScript off: the buttons still act) |
| R-16 | planned: `e2e/friends.spec.ts` (375 and 320 px: target size, no overflow) |
| R-17 | existing: `src/app/[locale]/(pages)/friends/actions.test.ts` stays green |

## Spec changes

Filled in when the task is built.

## Notes

Reported by the owner on 2026-10-04: the buttons in the "friends" menu are working but not responding. The page is a Server
Component whose buttons are plain `<form action>` forms ending in `redirect()`; the guess at the cause comes from reading it,
not from reproducing it.

- `useFormStatus` reports only for the `<form>` it sits in. The page's `done()` helper ends every action with a redirect: a
  success needs an `?ok=<code>` value (a whitelist like `ERRORS` there, never shown raw) so the message survives it.
  Confirmation can be a `<dialog>` or an inline "Are you sure? Yes / No" whose second step is a submit.

Code the work touches: `src/lib/compare.ts` (new, pure functions), `src/app/[locale]/(pages)/friends/page.tsx`, `src/app/[locale]/(pages)/friends/[id]/page.tsx`, `src/components/FriendActionButton.tsx` (new), `src/components/TrailMap.tsx` / `src/components/trail-map/*`, `src/lib/friends.ts`
