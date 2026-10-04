# 0048: New stamps are required only from their official date

Status: Open
Specs: [0042](../specs/0042-stamp-lifecycle.md) AC-1 to AC-17 (added), [0001](../specs/0001-progress.md) AC-3 (changed: waived
places), [0004](../specs/0004-trail-data.md) (the dates file and the recipe for adding a stamp), [0024](../specs/0024-friends-sharing.md)
AC-7, AC-8, AC-12 (changed or relied on: a friend's figures equal the owner's, and the friend functions return more)

## Goal

Make the walked-stretch rule aware of when a stamp was introduced, using only the MTSZ's published dates, so a hiker who
walked before a stamp existed is not shown as missing it, and so an added stamp can never renumber, drop or devalue anybody's
progress.

## Done when

- [ ] The open questions of spec 0042 for new stamps are settled (which neighbour date, honest dates, the tolerance, friends'
      waivers) and the part of the spec is `Accepted`
- [ ] `scripts/data/okt-stamp-dates.json` holds the fifteen codes (fourteen places) of spec 0042's notes, each re-checked against
      its source and entered under the seed's current code (Lokó-pihenő is `OKTPH_84_B` there), and the migration `0048_checkpoint_required_from.sql` is applied
      locally first
- [ ] The rule, the numbering safeguards (ids kept, labels display-only, counts from data) and the interface (date, hint, waived
      state) are built with the tests of the coverage table
- [ ] A friend's figures equal their dashboard, through a server function that shares only the waived place keys
- [ ] `npm run types:gen`; `npm run e2e`; the changelog entry in all three languages
- [ ] The specs listed above mirror the code as built (spec 0034 AC-6); fresh-context review done

## Spec changes

Filled in when the task is built.

## Notes

Requested by the owner on 2026-10-04. The rule as the owner put it: a hiker who passes a stage after a stamp was introduced
must have the stamp in the book, or it is not verified. The dates come from the MTSZ's posts of 2014 to 2026 (see the
spec's notes); the numbering behaviour was checked in `supabase/seed.sql` and `scripts/data/okt-stages.json`.
