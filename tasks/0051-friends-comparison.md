# 0051: Compare progress with a friend

Status: Done
Specs: [0003](../specs/0003-map-route-planner.md) (the map gains a four-state line and a friend's map), [0024](../specs/0024-friends-sharing.md) AC-7, AC-8 (the friend's page gains the comparison)

## Goal

Let a user compare their progress with one friend who shares: both maps, the places and km each has, and the gaps, on desktop
and on a phone.

## Done when

- [x] The open questions below are settled with the owner before any code is written (2026-10-04, answers under each)
- [x] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [x] The pure comparison functions, the "Compare" section and the map's four states are built with the tests under "Tests to write"
- [x] `npm run e2e` (the whole suite, locally, before the pull request); checked at 320 and 375 px in every language (e2e)
- [x] No changelog entry: friends are behind `FF_FRIENDS` and spec 0024 AC-16 holds the entry back until the flag goes on for everyone
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)
- [ ] Fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0051 and 0052 (R-1 to R-18).

### Comparing with a friend

- [x] **R-1**: From the user's stamped places and a friend's, with the trail's places in order, the comparison yields:
  places stamped by both, only by me, only by the friend, by neither; and, using the walked stretches of spec 0001 AC-3,
  the km walked by both (the intersection of the two sets of ranges), only by me, only by the friend, and by neither. The
  four km figures add up to the total km exactly: three are rounded to 0.1 as in spec 0001 AC-4 and the fourth is the total
  minus those three.
- [x] **R-2**: The "gaps" are the places and stretches that exactly one of the two lacks. For each stage the comparison
  lists the number of places each has, and classifies it, in this order, from my count `a`, the friend's `b` and the stage's
  total `n` (a place waived under tasks 0048 to 0050 counts as done, as in its R-16, and so does `completedStages` in `summarizeFriend`):
  "both complete" (`a = n` and `b = n`), "only me" (`a = n`, `b < n`), "only them" (`b = n`, `a < n`), "neither
  started" (`a = 0` and `b = 0`), otherwise "partly". The five states are exhaustive and exclusive.
- [x] **R-3**: A stretch counts as walked by a person only by the rule of spec 0001 AC-3 (and, once tasks 0048 to 0050 is built, its
  waivers), so the comparison never disagrees with either person's own dashboard.
- [x] **R-4**: The functions are pure (no database, no `Date`) and cover: both empty, identical stamps, disjoint stamps,
  one person with everything, a place with several variants (counted once, spec 0001 AC-1).
- [x] **R-5**: A friend's page (`/friends/<id>`, behind the flag, only for an accepted friend who shares, spec 0024) has a
  "Compare" section above the stage list: the figures of R-1 as cards (both, only me, only them, neither: km and
  stamps), and a list of the stages with how each stands (R-2), each linking to its stage section below.
- [x] **R-6**: The section has a shared map, using the existing trail map: the line coloured by who walked the stretch (both,
  only me, only them, nobody) with a legend, and the places marked the same way. The states differ in more than hue (line
  styles solid, dashed, dotted) for colour-blind users.
- [x] **R-7**: A toggle switches the map between "both" (default) and each person's own map (mine, theirs); "mine" and
  "theirs" show the view the owner sees on their dashboard (the blue walked line, spec 0003).
- [x] **R-8**: Nothing the friend did not already share is shown: which places they stamped, never dates (friends do not see
  each other's dates). The page adds no database read of the friend's data beyond `getFriendProgress` and, once tasks 0048 to 0050
  is built, the waivers function of its R-12.
- [x] **R-9**: A friend who is not sharing, a pending friend or an unknown id still ends on the 404 of spec 0024; no
  comparison is computed.
- [x] **R-10**: The section works at 375 px and 320 px (cards in two columns, the map full width at a usable height, the
  stage list stacked, no horizontal scroll) and on desktop (cards in a row, the map beside or above the stage list, as the
  page width of task 0046 allows).

## Out of scope

Comparing with more than one friend at once; a leaderboard; who walked what first (it would need to share dates); sending
a message or a challenge; the friend's extra stamps unless spec 0024 already shares them; exporting the comparison; live
updates when another user changes something.

## Open questions

- **Waivers and dates** (*settled 2026-10-04:* tasks 0048 to 0050 are still Open, so the comparison is built without waivers; they are added when those land). Once tasks 0048 to 0050 is built, which places are waived for a friend tells the other side that they walked there
  before a date (tasks 0048 to 0050's open question). Then R-8's "never dates" is only true in the strict sense: settle that
  question first.
- **Dates** (*settled 2026-10-04:* left out). "Who got there first" or a monthly race needs dates, which friends do not share. Leave them out (this task)
  or add an opt-in later?
- **Where the comparison lives** (*settled 2026-10-04:* a section on the friend's page). A section on the friend's page (this task) or a page of its own,
  `/friends/<id>/compare`?
- **Wording** (*settled 2026-10-04:* neutral: both / only me / only them / neither). Is "only me / only them" right, or "I'm ahead / they're ahead" (a value judgement on what may be a shared
  hike)?
- **Extra stamps** (*settled 2026-10-04:* no, official places only). Do they count in the gaps? This task says no: the official places only.

## Tests to write

| Requirement | Test |
| --- | --- |
| R-1, R-3, R-4 | `src/lib/compare.test.ts` (spec 0024 AC-23) |
| R-2 | `src/lib/compare.test.ts` (spec 0024 AC-24) |
| R-5, R-9, R-10 | `e2e/friends-compare.spec.ts` (two users, one shares: figures and stage list; not sharing, pending and unknown give 404; 375 and 320 px in three languages) |
| R-6, R-7 | `src/lib/map-layers.test.ts` (the layers for the four states), `src/lib/compare-map.test.ts` (the lines and points of each view), `e2e/friends-compare.spec.ts` (the switch and the legend); the pixels on the canvas: `manual` row of spec 0003, not yet checked |
| R-8 | `src/lib/friends-compare.test.ts` (what the page asks of the database is the user's own stamps besides the friend's shared ones; the points carry no dates) |

## Spec changes

Spec 0024: new section "Comparing with a friend" with AC-22 (the Compare section of the friend's page: cards, map, stage list, 404s, what is read, 375 and 320 px), AC-23
(the places and km by who has them, summing exactly to the total) and AC-24 (how a stage stands); Out of scope no longer lists the friend's map, but
still lists the friend's dates and extra stamps and comparing with several friends; Owner code and coverage updated. Spec 0003: new section
"Comparison map" with AC-18 (four states drawn by style and colour, with a legend), AC-19 (the switch both / mine / theirs) and AC-20 (read-only, hover shows
name and state); a `manual` row and checklist lines for the canvas, "Last checked: never recorded" (the Browser pane here does not draw the WebGL map, so
nobody has looked at the pixels). Nothing renumbered.

## Notes

Requested by the owner on 2026-10-04: a better comparison with friends (compare maps, find gaps). Friends see no dates today, so
the comparison cannot say who walked what first.

- `getFriendProgress` returns the friend's `stampedKeys`, `places`, `stages`; the owner's dashboard computes the same for
  the user; `summarizeFriend` is the template for the pure part. The map needs a third line style and two sets of ranges:
  look at `src/lib/map-layers.ts` (spec 0003) before deciding between extending the layers and a second component.

- Built without waivers (tasks 0048 to 0050 are not built): when they land, `compareProgress` takes the waived places as stamped, as `summarizeFriend` will.
- The comparison map is a second component (`CompareMap`) over the same building blocks as the dashboard's (`createTrailMap`, `watchDetailRoute`, the route geometry, the layer module):
  the dashboard's map carries stamp menus, the route planner and restaurants that a friend's page must not have.
- Found on the way: at 320 px in Hungarian the dashboard's stage header (an unbreakable word of the route) pushed the page 1 px sideways; its route text now breaks anywhere
  (`StageSection`), and the friend page's stat cards use `minmax(0, 1fr)` tracks. The dashboard's own stat cards were not touched.
- Not done: a changelog entry (friends are behind `FF_FRIENDS`, spec 0024 AC-16).

Code the work touches: `src/lib/compare.ts` (new, pure functions), `src/app/[locale]/(pages)/friends/[id]/page.tsx`, `src/components/TrailMap.tsx` and `src/components/trail-map/*`, `src/lib/friends.ts`, `src/lib/compare-map.ts`, `src/lib/map-layers.ts`, `src/components/CompareMap.tsx`, `CompareSection.tsx`, `CompareSwatch.tsx`, `trail-map/createMap.ts`
