# 0052: Friends page buttons respond

Status: Done
Specs: [0024](../specs/0024-friends-sharing.md) AC-3 (the "request sent" message joins a family of messages), AC-14 (the actions' feedback; their rules are unchanged)

## Goal

Fix the Friends page buttons that work but do not respond: a pending state, no double press, a message for what happened, and a
confirmation for the two actions that cannot be undone from the page.

## Done when

- [x] The open questions below are settled with the owner before any code is written (2026-10-04, answers under each)
- [x] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [x] The cause is confirmed: the owner expects a hover highlight and a pressed look and sees neither (R-18); the missing
      pending state is the other half. An action that does not apply would be a separate defect with the failing case: none reported
- [x] `?sent=1` becomes `?ok=sent`: its producer (`friends/invite/[token]/page.tsx`), the `friends/page.tsx` branch, the message key `friends.requestSent` and `e2e/friends.spec.ts` change together
- [x] The buttons are built as small client components over the existing server actions, with the tests under "Tests to write"
- [x] They still work without JavaScript; checked at 320 and 375 px (e2e)
- [x] No changelog entry: friends are behind `FF_FRIENDS` and spec 0024 AC-16 holds the entry back until the flag goes on for everyone
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)
- [ ] Fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0051 and 0052 (R-1 to R-18).

### Buttons that respond

Every button on `/friends` (save name, regenerate link, approve, ignore, remove, start and stop sharing) is a plain form
whose server action ends with a redirect, so between the click and the reload nothing shows that it worked.

- [x] **R-11**: Pressing any of these buttons changes its look at once, before the server answers: it is disabled, its label
  is replaced by or joined with a spinner or "…", and it keeps its size so the layout does not jump. The pressed button
  shows this, not the whole page.
- [x] **R-12**: While a request runs, a second press of the same button sends nothing more, and the other buttons that act on
  the same row (approve and ignore of one request) are disabled too. The buttons of a row share one pending state (one
  client wrapper per row), because `useFormStatus` only knows its own form.
- [x] **R-13**: When the request is done the page says what happened: a success message that names it ("Friend request
  approved", "Link regenerated", "Name saved", "Sharing stopped", "Removed"), announced to screen readers
  (`role="status"`, `aria-live="polite"`), through the same mechanism as the existing "request sent" message (`?sent=1`):
  one whitelisted query value family, never shown raw (`?sent=1` becomes `?ok=sent`, so there is one mechanism); a failure shows the existing error text with `role="alert"`. A message goes away
  on the next action.
- [x] **R-14**: Remove-friend and regenerate-link ask for confirmation first, in the page (not `window.confirm`), and the
  regenerate step says that the old link stops working. The confirmation is itself a plain form (a `<details>` that reveals
  a confirming button), so it also works without JavaScript and nothing destructive runs on the first press; Cancel
  closes it, and Escape does too with JavaScript.
- [x] **R-15**: The buttons keep working without JavaScript and before hydration (they stay plain forms posting to the page):
  the pending state is an enhancement. With JavaScript off, behaviour is that of spec 0024 (a reload, `?error=` on
  failure).
- [x] **R-16**: Touch targets are at least 44 x 44 px at 375 px and 320 px, and buttons wrap onto a second line instead of
  overflowing; approve and ignore are told apart by words, not colour alone.
- [x] **R-17**: The actions still never throw and the rules of spec 0024 (RLS, validation, rate limits) are unchanged: only
  how the page reacts changes.
- [x] **R-18**: Every button on the page looks different while the pointer is over it and while it is pressed (a darker
  shade, and a one-pixel nudge down while pressed) and shows a visible focus ring for the keyboard; a disabled button shows
  none of these. (Reported by the owner: today a button "does nothing" under the pointer.)

## Out of scope

New friend features; live updates when another user changes something; optimistic updates of the list (the page reloads on
success, as today); messages on pages other than Friends (the stamp buttons have their own feedback, spec 0002 AC-10).

## Open questions

- **The cause of "buttons work but do not respond".** The first guess is the missing pending state above. If an action
  also sometimes fails to apply (the data does not change on reload), that is a separate defect and needs the failing
  case. *Settled 2026-10-04:* the owner expects the button to highlight under the pointer and to look pressed when clicked,
  and today it does neither: added as R-18, built together with the pending state.
- **Mechanism** (settled by the task's own choice, 2026-10-04). The pending state needs `useFormStatus` or `useActionState`, which are client-only. This task wraps each
  button in a small client component and keeps the server actions and the Server Component page; the alternative moves the
  whole list to a client component.
- **Where the success message shows** (settled the same way). At the top of the page, announced and scrolled into view on mobile (this task), or
  next to the row.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-11, R-12 | `src/components/FriendActionButton.test.tsx` (spec 0024 AC-17: pending disables, keeps size and name, ignores a second press; the other buttons of the row are disabled while one runs), `e2e/friends.spec.ts` (a slow server) |
| R-13 | `src/lib/friends.test.ts` (the path, a message per notice in three languages), `src/components/FriendActionButton.test.tsx` (status and alert), `e2e/friends.spec.ts` (every action, three languages, unknown values) |
| R-14 | `src/components/FriendActionButton.test.tsx` (closed first, Cancel, Escape), `e2e/friends.spec.ts` (remove and regenerate ask first) |
| R-15 | `e2e/friends.spec.ts` (JavaScript off: the buttons still act, the question still opens) |
| R-16 | `e2e/friends.spec.ts` (375 and 320 px, three languages: target size, no sideways scroll) |
| R-17 | `src/app/[locale]/(pages)/friends/actions.test.ts` is unchanged and green |
| R-18 | `src/components/FriendActionButton.test.tsx` (the classes: jsdom has no hover), `e2e/friends.spec.ts` (the colour changes under the pointer and while pressed) |

## Spec changes

Spec 0024 (Sharing progress with friends): new section "The Friends page responds" with AC-17 (pending state, no second press, the
row shares one busy state), AC-18 (the answer at the top: `?ok=` whitelist, status and alert, the "Request sent" of AC-3 joins it,
`?sent=1` is gone), AC-19 (remove and regenerate ask first, in the page), AC-20 (44 px targets, wrapping, hover, pressed and focus
look) and AC-21 (plain forms without JavaScript); AC-3 points to AC-18; the Owner code line and the coverage table gain the new
components and tests. No AC renumbered, no other spec touched.

## Notes

Reported by the owner on 2026-10-04: the buttons in the "friends" menu are working but not responding. The page is a Server
Component whose buttons are plain `<form action>` forms ending in `redirect()`; the guess at the cause comes from reading it,
not from reproducing it.

- `useFormStatus` reports only for the `<form>` it sits in. The page's `done()` helper ends every action with a redirect: a
  success needs an `?ok=<code>` value (a whitelist like `ERRORS` there, never shown raw) so the message survives it.
  Confirmation can be a `<dialog>` or an inline "Are you sure? Yes / No" whose second step is a submit.

- The e2e locators for the page's answer are `[role=status][aria-live=polite]` and a non-empty `alert`: the test server's banner is
  also a `status`, and Next's route announcer an empty `alert`.
- A busy button's label is made transparent, not `invisible`: `visibility: hidden` text drops out of the accessible name, and the
  button would be nameless to a screen reader while it runs (found by the E2E test).
- Turbopack production builds fail in a worktree whose `node_modules` is a junction ("points out of the filesystem root"): the E2E
  server was built with `npm run build:e2e -- --webpack` and started with `npm run start:e2e`, and Playwright reused it.
- Not done: a changelog entry (friends are behind `FF_FRIENDS`, spec 0024 AC-16).

Code the work touches: `src/app/[locale]/(pages)/friends/page.tsx`, `src/app/[locale]/(pages)/friends/actions.ts`, `src/app/[locale]/(pages)/friends/invite/[token]/page.tsx`, `src/components/FriendActionButton.tsx`, `FriendActionGroup.tsx`, `FriendConfirm.tsx`, `FlashMessage.tsx` (new), `src/lib/friends-input.ts`
