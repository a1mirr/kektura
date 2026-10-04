# 0071: The comparison map leads to the list and names places with their number

Status: Done
Specs: [0003](../specs/0003-map-route-planner.md) AC-20 (the comparison map's hover and click)

## Goal

On a friend's page the comparison map names a place with only its name and its state, and a click on a place does
nothing. Let a place be named with its number in the trail (the "17.1" of the list), and let a click on it bring its row
in the list below into view, as "Show in list" does on the dashboard's map.

## Done when

- [x] The open questions below are settled with the owner before any code is written (nothing was open: the owner asked for both)
- [x] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [x] No changelog entry: friends are behind `FF_FRIENDS` (spec 0024 AC-16)
- [x] The specs listed above mirror the code as built (spec 0034 AC-6)
- [x] Fresh-context review done (reviewed commit f94d1ca)

## Requirements

What the product must do when this is built, as the owner asked for it (2026-10-04, looking at a friend's page: "click
to go to list doesn't work here; also I'd like to see something like 17.1 (stage number) in the hover title"). They are
written into the owning specs as the behaviour is built; until then they live here.

- [x] **R-1**: Hovering a place on the comparison map names it with its number in the trail, then its name, then its state:
  for example "4.2 Lokó-pihenő · Only them". The number is the one the list shows for the place.
- [x] **R-2**: Clicking (or tapping) a place on the comparison map brings that place's row in the stage list of the page
  into view and flashes it, opening its stage first if it is collapsed: the "Show in list" of the dashboard's map
  (spec 0003 AC-12), with no popup in between. Nothing opens a menu and nothing can be stamped from here.

## Out of scope

A popup on the comparison map; stamping or routing from it; the dashboard's map.

## Spec changes

Spec 0003: AC-20 now says what hovering and clicking a place on the comparison map do (number, name and state; a click goes to the
row in the list, as AC-12); the coverage row and the manual checklist line follow. Nothing renumbered.

## Notes

The list rows of a friend's page already carry the ids and stage numbers the dashboard's "Show in list" looks for
(`place-<key>`, `data-stage`), so `revealInList` (`src/lib/map-reveal.ts`) works there unchanged.

Code the work touches: `src/components/CompareMap.tsx`, `src/lib/compare-map.ts`, `src/lib/friends.ts`
