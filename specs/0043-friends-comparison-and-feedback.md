# 0043: Friends: comparing progress, and buttons that respond

Status: Draft
Owner code: `src/lib/compare.ts` (new, pure functions), `src/app/[locale]/(pages)/friends/page.tsx`,
`src/app/[locale]/(pages)/friends/[id]/page.tsx`, `src/components/FriendActionButton.tsx` (new),
`src/components/TrailMap.tsx` / `src/components/trail-map/*`, `src/lib/friends.ts`

Folds into [0024](0024-friends-sharing.md) (AC-7, AC-8, AC-14) when it is built.

## Goal

Two things on the friends side of the site, on desktop and on a phone. First, a user can compare their progress with
one accepted, sharing friend: where each is ahead, what both have done, which stretches neither or only one has walked,
with both maps. Second, every button on the Friends page answers at once: a pressed button shows that it is working,
cannot be pressed twice, and the page says what happened.

## Behaviour

### Comparing with a friend

- **AC-1**: From the user's stamped places and a friend's, with the trail's places in order, the comparison yields:
  places stamped by both, only by me, only by the friend, by neither; and, using the walked stretches of spec 0001 AC-3,
  the km walked by both (the intersection of the two sets of ranges), only by me, only by the friend, and by neither. The
  four km figures add up to the total km (rounded to 0.1 as in spec 0001 AC-4).
- **AC-2**: The "gaps" are the places and stretches that exactly one of the two lacks. For each stage the comparison
  lists the number of places each has, so a stage reads as "both complete", "only me", "only them", "neither started" or
  "partly".
- **AC-3**: A stretch counts as walked by a person only by the rule of spec 0001 AC-3 (and, once spec 0042 is built, its
  waivers), so the comparison never disagrees with either person's own dashboard.
- **AC-4**: The functions are pure (no database, no `Date`) and cover: both empty, identical stamps, disjoint stamps,
  one person with everything, a place with several variants (counted once, spec 0001 AC-1).
- **AC-5**: A friend's page (`/friends/<id>`, behind the flag, only for an accepted friend who shares, spec 0024) has a
  "Compare" section above the stage list: the figures of AC-1 as cards (both, only me, only them, neither: km and
  stamps), and a list of the stages with how each stands (AC-2), each linking to its stage section below.
- **AC-6**: The section has a shared map, using the existing trail map: the line coloured by who walked the stretch (both,
  only me, only them, nobody) with a legend, and the places marked the same way. The states differ in more than hue (line
  styles solid, dashed, dotted) for colour-blind users.
- **AC-7**: A toggle switches the map between "both" (default) and each person's own map (mine, theirs); "mine" and
  "theirs" show the view the owner sees on their dashboard (the blue walked line, spec 0003).
- **AC-8**: Nothing the friend did not already share is shown: which places they stamped, never dates (friends do not see
  each other's dates). The page adds no database read of the friend's data beyond `getFriendProgress`.
- **AC-9**: A friend who is not sharing, a pending friend or an unknown id still ends on the 404 of spec 0024; no
  comparison is computed.
- **AC-10**: The section works at 375 px and 320 px (cards in two columns, the map full width at a usable height, the
  stage list stacked, no horizontal scroll) and on desktop (cards in a row, the map beside or above the stage list, as the
  page width of spec 0040 allows).

### Buttons that respond

Every button on `/friends` (save name, regenerate link, approve, ignore, remove, start and stop sharing) is a plain form
whose server action ends with a redirect, so between the click and the reload nothing shows that it worked.

- **AC-11**: Pressing any of these buttons changes its look at once, before the server answers: it is disabled, its label
  is replaced by or joined with a spinner or "…", and it keeps its size so the layout does not jump. The pressed button
  shows this, not the whole page.
- **AC-12**: While a request runs, a second press of the same button sends nothing more, and the other buttons that act on
  the same row (approve and ignore of one request) are disabled too.
- **AC-13**: When the request is done the page says what happened: a success message that names it ("Friend request
  approved", "Link regenerated", "Name saved", "Sharing stopped", "Removed"), announced to screen readers
  (`role="status"`, `aria-live="polite"`); a failure shows the existing error text with `role="alert"`. A message goes away
  on the next action.
- **AC-14**: Remove-friend and regenerate-link ask for confirmation first, in the page (not `window.confirm`), and the
  regenerate step says that the old link stops working. Cancel and Escape dismiss it.
- **AC-15**: The buttons keep working without JavaScript and before hydration (they stay plain forms posting to the page):
  the pending state is an enhancement. With JavaScript off, behaviour is that of spec 0024 (a reload, `?error=` on
  failure).
- **AC-16**: Touch targets are at least 44 x 44 px at 375 px and 320 px, and buttons wrap onto a second line instead of
  overflowing; approve and ignore are told apart by words, not colour alone.
- **AC-17**: The actions still never throw and the rules of spec 0024 (RLS, validation, rate limits) are unchanged: only
  how the page reacts changes.

## Out of scope

Comparing with more than one friend at once; a leaderboard; who walked what first (it would need to share dates); sending
a message or a challenge; the friend's extra stamps unless spec 0024 already shares them; exporting the comparison; live
updates when another user changes something; optimistic updates of the list.

## Open questions

- **Dates.** "Who got there first" or a monthly race needs dates, which friends do not share. Leave them out (this draft)
  or add an opt-in later?
- **Where the comparison lives.** A section on the friend's page (this draft) or a page of its own,
  `/friends/<id>/compare`?
- **Wording.** Is "only me / only them" right, or "I'm ahead / they're ahead" (a value judgement on what may be a shared
  hike)?
- **Extra stamps.** Do they count in the gaps? This draft says no: the official places only.
- **The cause of "buttons work but do not respond".** The first guess is the missing pending state above. If an action
  also sometimes fails to apply (the data does not change on reload), that is a separate defect and needs the failing
  case.
- **Mechanism.** The pending state needs `useFormStatus` or `useActionState`, which are client-only. This draft wraps each
  button in a small client component and keeps the server actions and the Server Component page; the alternative moves the
  whole list to a client component.
- **Where the success message shows.** At the top of the page, announced and scrolled into view on mobile (this draft), or
  next to the row.

## Notes

- `getFriendProgress` returns the friend's `stampedKeys`, `places`, `stages`; the owner's dashboard computes the same for
  the user; `summarizeFriend` is the template for the pure part. The map needs a third line style and two sets of ranges:
  look at `src/lib/map-layers.ts` (spec 0003) before deciding between extending the layers and a second component.
- `useFormStatus` reports only for the `<form>` it sits in. The page's `done()` helper ends every action with a redirect: a
  success needs an `?ok=<code>` value (a whitelist like `ERRORS` there, never shown raw) so the message survives it.
  Confirmation can be a `<dialog>` or an inline "Are you sure? Yes / No" whose second step is a submit.

## Coverage

| AC | Test |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4 | planned: `src/lib/compare.test.ts` |
| AC-5, AC-9, AC-10 | planned: `e2e/friends-compare.spec.ts` (two users, one shares: figures and stage list; not sharing gives 404; 375 px) |
| AC-6, AC-7 | planned: `src/lib/map-layers.test.ts` (the layers for the four states), `e2e/friends-compare.spec.ts` (toggle) |
| AC-8 | planned: `src/lib/friends.test.ts`; review of the page's queries |
| AC-11, AC-12 | planned: `src/components/FriendActionButton.test.tsx` (pending disables, keeps size, ignores a second press) |
| AC-13, AC-14 | planned: `e2e/friends.spec.ts` (success message per action in three languages; confirmation steps) |
| AC-15 | planned: `e2e/friends.spec.ts` (JavaScript off: the buttons still act) |
| AC-16 | planned: `e2e/friends.spec.ts` (375 and 320 px: target size, no overflow) |
| AC-17 | existing: `src/app/[locale]/(pages)/friends/actions.test.ts` stays green |
