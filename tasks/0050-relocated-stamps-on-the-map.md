# 0050: Relocated stamps: the latest location on the map, with a note

Status: Open
Specs: [0003](../specs/0003-map-route-planner.md) (popups and markers), [0004](../specs/0004-trail-data.md) (the regeneration steps), [0015](../specs/0015-about-page.md) (the freshness line), [0017](../specs/0017-feedback.md) (the report link: the form accepts a stamp code)

## Goal

Make sure the map always shows a stamp where it is now and that anyone relying on it can tell how fresh the data is: the moved
note, the ring on recently moved stamps, a distance-to-route check, the freshness line, a report link, and one written routine
from a new MTSZ file to a live site.

## Done when

- [ ] The open questions below are settled with the owner before any code is written
- [ ] Every requirement below holds and has a test (or, where no test can, a `manual (reason)` row in the owning spec); the owning specs are edited as the behaviour is built
- [ ] Task 0048 is done first: this task uses its dates file (task 0048 R-2, R-3; task 0050 R-31)
- [ ] The 180 days and the 100 m threshold are settled (the owner agreed both on 2026-10-04)
- [ ] `moved_on` entries come from official publications; the migration `0050_stamp_moved_on.sql` (if the column is needed) is
      applied locally first
- [ ] The note, the ring, the route-distance test, the freshness line and the report link are built with the tests under
      "Tests to write"
- [ ] The routine is written into spec 0004's regeneration steps and `deploy/README.md`, and followed once on production with the
      read-only check
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Requirements

What the product must do when this is built, as the owner asked for it. They are written into the owning specs as the behaviour is built; until then they live here. The R-numbers run across tasks 0048, 0049 and 0050 (R-1 to R-35): they were one piece of planning, and the three tasks refer to each other's numbers.

### Moved stamps

A stamp that moved keeps its code and its place; only where it is changes. The map must show where it is **now**, so
that anyone who relies on the site's map finds it.

- [ ] **R-28**: A moved stamp keeps its code, place and database id (R-9); its coordinates, description and, if they
  changed, km and stage position change. The map (the dashboard's, the popups, the route planner, a friend's) and the
  stage list show only the current location; the old one is not drawn anywhere. A move is not a retirement plus a new
  stamp: users' stamps stay with their dates and no `required_from` applies. A move that comes with a new code is a
  replacement and follows the retired and new rules above.
- [ ] **R-29**: A stamp's popup and row show the MTSZ's current description of where exactly it is, as the data holds it,
  and the coordinates are those of the same data; the marker, the popup and the "locate me" distance (spec 0003) use
  them.
- [ ] **R-30**: Where a move changes the route, the route line, the km of the places after it and the stage table follow
  the same MTSZ publication. A stamp is never shown at a place the drawn line does not pass: a test checks every place's
  distance to the line against a limit written in the test (spec 0004 only prints places over 500 m away today).
- [ ] **R-31**: A stamp that moved (a change of its coordinates of more than 100 m between two MTSZ files; a smaller shift
  just replaces the coordinates) in the last 180 days has a `moved_on` date, an entry in the dates file of R-2 (the date,
  the official publication's URL), and `build-data.mjs` fails when the coordinates of a code differ by more than 100 m from
  the previous seed without such an entry. For those 180 days its row and popup show a short note: "Moved on 30 Sep 2026: the stamp
  is now by the lookout. If you use an older map or booklet, check the new place." It says only what the data holds
  (the date and the new description), not how far or which way. Its marker on the map has a ring (not colour alone).
- [ ] **R-32**: A move reaches the site as one routine: the new MTSZ file, `node scripts/build-data.mjs ...`, the checks,
  the seed applied to production, the reference-data cache expired (spec 0002 AC-15: otherwise the old place is served for
  up to 24 hours) and the deploy, ending with a read-only check that production serves the new coordinates for the moved
  code. This is the recipe of R-13.
- [ ] **R-33**: The site says how fresh its trail data is: "Trail data: MTSZ file of 15 Apr 2026" (the date of the GPX
  file used, written into the generated data by `build-data.mjs`), on the About page and under the map.
- [ ] **R-34**: A stamp's popup has a "Report a wrong location" link to the feedback form (spec 0017), `?stamp=<code>`: only a
  stamp code travels in the URL, it is checked against the seed, and the stamp's name is looked up on the server; the link
  carries no free text, so nobody can craft a link that puts words into a visitor's form. The form uses its existing rate
  limit and honeypot.
- [ ] **R-35**: The notes, ring and link work on the dashboard map and, where a friend's map exists (tasks 0051 and 0052), on it, at
  320 and 375 px and on desktop; the link has a touch target of at least 44 x 44 px.

## Out of scope

Temporary warnings, detours, closures and construction notices (the MTSZ's own warnings page covers them);
automatic detection of changes (see Open questions); counting or drawing the old route of a retired stamp; stamps of
the Alföldi and Dél-dunántúli trails; stamps retired before 2014; the history of a stamp's earlier locations;
letting a user declare their own waivers.

## Open questions

- **Detecting changes.** Nothing notices a change on the MTSZ site; the dates, the files and the seed are entered by hand.
  A scheduled check of the MTSZ news and GPX file that opens an issue would close the gap. Wanted, as a task of its own?

## Tests to write

| Requirement | Test |
| --- | --- |
| R-28, R-29, R-30 | planned: `tests/trail-data.test.ts` and a database test beside `tests/seed-cleanup.test.ts` (a moved coordinate keeps ids and stamps; the distance to the line within the limit; the JSON and the seed agree on every stamp's coordinates), `src/lib/map-popups.test.ts` |
| R-31 | planned: `src/lib/stamp-moves.test.ts` (the 100 m threshold, the 180-day window), `src/lib/map-layers.test.ts` (the ring) |
| R-32 | manual (a real deploy and production data): follow the checklist of spec 0004 and run the read-only query on production. Last checked: never recorded. |
| R-33 | planned: `tests/trail-data.test.ts` (the generated data carries the file date), `e2e/about.spec.ts` |
| R-34, R-35 | planned: `e2e/map.spec.ts` (the link; 375 px), `src/lib/feedback.test.ts` (only a known stamp code is accepted, nothing else from the URL reaches the form) |

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: support the latest location of relocated stamps on the map so a person who relies on the
site's map finds the stamps. Temporary warnings are deliberately not tracked (the MTSZ's warnings page does that). A watcher that
notices MTSZ changes is an open question below, not part of this task.

- Other changes the MTSZ makes, seen on its pages: stamps with two locations at one place (Encs, 2022: `_1` and
  `_2`, handled by spec 0004; whether Encs was a new place or an older one is to be verified), a new imprint (Bodó-rét), and "stamp in a new place" notices on the
  [warnings page](https://www.kektura.hu/figyelmeztetesek) (2026-09-30 Virágos-nyereg, 2026-09-24 Nyírkarász; which trail
  each belongs to is not checked). The Zalakomár (2019) and Jakab-hegy (2022) replacements are on the Dél-dunántúli trail.
- Today a move already reaches users once the seed is regenerated: `build-data.mjs` upserts by `code` and rewrites
  `lat`, `lng`, `description` and `km_from_start`. What is missing is the routine (R-32), the freshness (R-33), the
  note (R-31) and the report link (R-34). The map data is the generated JSON in `public/data/` plus the database rows,
  both from one run of the build script; a test that they agree on every stamp's coordinates is planned (R-29).

Code the work touches: `scripts/data/okt-stamp-dates.json` (new), `scripts/data/okt-retired-stamps.json` (new), `scripts/build-data.mjs`, `src/lib/progress.ts`, `src/lib/map-popups.ts`, `src/components/trail-map/*`, `src/components/StageSection.tsx`, `src/app/[locale]/dashboard/actions.ts`, `supabase/migrations/` (one per task)
