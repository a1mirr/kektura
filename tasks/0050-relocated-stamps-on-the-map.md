# 0050: Relocated stamps: the latest location on the map, with a note

Status: Open
Specs: [0042](../specs/0042-stamp-lifecycle.md) AC-28 to AC-35 (added), [0004](../specs/0004-trail-data.md) (the regeneration
recipe), [0003](../specs/0003-map-route-planner.md) (popups and markers), [0017](../specs/0017-feedback.md) (the report link: the form accepts a prefilled stamp code)

## Goal

Make sure the map always shows a stamp where it is now and that anyone relying on it can tell how fresh the data is: the moved
note, the ring on recently moved stamps, a distance-to-route check, the freshness line, a report link, and one written routine
from a new MTSZ file to a live site.

## Done when

- [ ] Task 0048 is done first: this task uses its dates file (spec 0042 AC-2, AC-3, AC-31)
- [ ] The part of spec 0042 for moved stamps is settled in the spec (it stays `Draft` until it is built: `tests/specs.test.ts` requires every file an Accepted or Done spec names to exist, so `Accepted` and `Done` are set when those files do) (the 180 days and the 100 m threshold are settled)
- [ ] `moved_on` entries come from official publications; the migration `0050_stamp_moved_on.sql` (if the column is needed) is
      applied locally first
- [ ] The note, the ring, the route-distance test, the freshness line and the report link are built with the tests of the
      coverage table
- [ ] The routine is written into spec 0004's regeneration steps and `deploy/README.md`, and followed once on production with the
      read-only check
- [ ] The changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04: support the latest location of relocated stamps on the map so a person who relies on the
site's map finds the stamps. Temporary warnings are deliberately not tracked (the MTSZ's warnings page does that). A watcher that
notices MTSZ changes is an open question in the spec, not part of this task.
