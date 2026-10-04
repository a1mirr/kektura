# 0051: Compare progress with a friend

Status: Open
Specs: [0003](../specs/0003-map-route-planner.md) (the map gains a four-state line and a friend's map), [0024](../specs/0024-friends-sharing.md) AC-7, AC-8 (the friend's page gains the comparison)

## Goal

Let a user compare their progress with one friend who shares: both maps, the places and km each has, and the gaps, on desktop
and on a phone.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] The pure comparison functions, the "Compare" section and the map's four states are built with the tests under "Tests to write"
- [ ] `npm run e2e`; checked at 320 and 375 px; the changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0051 and 0052 (R-1 to R-17).

### Comparing with a friend

- [ ] **R-1**: From the user's stamped places and a friend's, with the trail's places in order, the comparison yields:
  places stamped by both, only by me, only by the friend, by neither; and, using the walked stretches of spec 0001 AC-3,
  the km walked by both (the intersection of the two sets of ranges), only by me, only by the friend, and by neither. The
  four km figures add up to the total km exactly: three are rounded to 0.1 as in spec 0001 AC-4 and the fourth is the total
  minus those three.
- [ ] **R-2**: The "gaps" are the places and stretches that exactly one of the two lacks. For each stage the comparison
  lists the number of places each has, and classifies it, in this order, from my count `a`, the friend's `b` and the stage's
  total `n` (a place waived under tasks 0048 to 0050 counts as done, as in its R-16, and so does `completedStages` in `summarizeFriend`):
  "both complete" (`a = n` and `b = n`), "only me" (`a = n`, `b < n`), "only them" (`b = n`, `a < n`), "neither
  started" (`a = 0` and `b = 0`), otherwise "partly". The five states are exhaustive and exclusive.
- [ ] **R-3**: A stretch counts as walked by a person only by the rule of spec 0001 AC-3 (and, once tasks 0048 to 0050 is built, its
  waivers), so the comparison never disagrees with either person's own dashboard.
- [ ] **R-4**: The functions are pure (no database, no `Date`) and cover: both empty, identical stamps, disjoint stamps,
  one person with everything, a place with several variants (counted once, spec 0001 AC-1).
- [ ] **R-5**: A friend's page (`/friends/<id>`, behind the flag, only for an accepted friend who shares, spec 0024) has a
  "Compare" section above the stage list: the figures of R-1 as cards (both, only me, only them, neither: km and
  stamps), and a list of the stages with how each stands (R-2), each linking to its stage section below.
- [ ] **R-6**: The section has a shared map, using the existing trail map: the line coloured by who walked the stretch (both,
  only me, only them, nobody) with a legend, and the places marked the same way. The states differ in more than hue (line
  styles solid, dashed, dotted) for colour-blind users.
- [ ] **R-7**: A toggle switches the map between "both" (default) and each person's own map (mine, theirs); "mine" and
  "theirs" show the view the owner sees on their dashboard (the blue walked line, spec 0003).
- [ ] **R-8**: Nothing the friend did not already share is shown: which places they stamped, never dates (friends do not see
  each other's dates). The page adds no database read of the friend's data beyond `getFriendProgress` and, once tasks 0048 to 0050
  is built, the waivers function of its R-12.
- [ ] **R-9**: A friend who is not sharing, a pending friend or an unknown id still ends on the 404 of spec 0024; no
  comparison is computed.
- [ ] **R-10**: The section works at 375 px and 320 px (cards in two columns, the map full width at a usable height, the
  stage list stacked, no horizontal scroll) and on desktop (cards in a row, the map beside or above the stage list, as the
  page width of task 0046 allows).

## Out of scope

Comparing with more than one friend at once; a leaderboard; who walked what first (it would need to share dates); sending
a message or a challenge; the friend's extra stamps unless spec 0024 already shares them; exporting the comparison; live
updates when another user changes something; optimistic updates of the list.

## Open questions

- **Waivers and dates.** Once tasks 0048 to 0050 is built, which places are waived for a friend tells the other side that they walked there
  before a date (tasks 0048 to 0050's open question). Then R-8's "never dates" is only true in the strict sense: settle that
  question first.
- **Dates.** "Who got there first" or a monthly race needs dates, which friends do not share. Leave them out (this draft)
  or add an opt-in later?
- **Where the comparison lives.** A section on the friend's page (this draft) or a page of its own,
  `/friends/<id>/compare`?
- **Wording.** Is "only me / only them" right, or "I'm ahead / they're ahead" (a value judgement on what may be a shared
  hike)?
- **Extra stamps.** Do they count in the gaps? This draft says no: the official places only.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-2, R-3, R-4 | planned: `src/lib/compare.test.ts` |
| R-5, R-9, R-10 | planned: `e2e/friends-compare.spec.ts` (two users, one shares: figures and stage list; not sharing gives 404; 375 px) |
| R-6, R-7 | planned: `src/lib/map-layers.test.ts` (the layers for the four states), `e2e/friends-compare.spec.ts` (toggle) |
| R-8 | planned: `src/lib/friends.test.ts` (what the page asks of the database is `getFriendProgress` and the waivers function, nothing else) |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: a better comparison with friends (compare maps, find gaps). Friends see no dates today, so
the comparison cannot say who walked what first.

- `getFriendProgress` returns the friend's `stampedKeys`, `places`, `stages`; the owner's dashboard computes the same for
  the user; `summarizeFriend` is the template for the pure part. The map needs a third line style and two sets of ranges:
  look at `src/lib/map-layers.ts` (spec 0003) before deciding between extending the layers and a second component.

Code the work touches: `src/lib/compare.ts` (new, pure functions), `src/app/[locale]/(pages)/friends/page.tsx`, `src/app/[locale]/(pages)/friends/[id]/page.tsx`, `src/components/FriendActionButton.tsx` (new), `src/components/TrailMap.tsx` / `src/components/trail-map/*`, `src/lib/friends.ts`
