# 0037: Regenerate the seeds with the current generator

Status: Open
Specs: [0004](../specs/0004-trail-data.md) AC-9, and its "Known gap" note

## Goal

`scripts/build-data.mjs` writes each seed as one transaction that also removes rows the source no longer has and
moves users' stamps to the remaining variants (0004 AC-9), but the committed `supabase/seed.sql` and
`seed_extra.sql` were generated before that and carry the old header without it. Regenerate them so the files in
the repository are what the generator produces. This needs the three source files (stamps GPX, full route GPX,
heyjoe's `okt_pecsetek.gpx`), which are downloaded by hand and are not in the repository.

## Done when

- [ ] The source files are downloaded (the same dates the current seeds were built from, so the data does not change: `git diff` of `public/data` and of the seed rows is empty apart from the header and the cleanup block)
- [ ] `node scripts/build-data.mjs <stamps.gpx> <route.gpx> <okt_pecsetek.gpx>` has been run and the output committed
- [ ] `npm test`, `npm run testdb:reset` and `npm run e2e` pass
- [ ] The seeds are applied to production by hand and the reference-data cache is cleared (`deploy/README.md`, "After the seeds change"); the deploy workflow does not apply seeds
- [ ] Spec 0004's "Known gap" paragraph is deleted

## Spec changes

None expected beyond deleting the "Known gap" paragraph.

## Notes

- If the sources have changed since, regenerating also changes data: then follow the whole "Regenerating" list in
  spec 0004, including translating new stamps (spec 0033 AC-3).
