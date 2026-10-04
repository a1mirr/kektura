# 0037: Regenerate the seeds with the current generator

Status: Done
Specs: [0004](../specs/0004-trail-data.md) AC-9, and its "Known gap" note

## Goal

`scripts/build-data.mjs` writes each seed as one transaction that also removes rows the source no longer has and
moves users' stamps to the remaining variants (0004 AC-9), but the committed `supabase/seed.sql` and
`seed_extra.sql` were generated before that and carry the old header without it. Regenerate them so the files in
the repository are what the generator produces. This needs the three source files (stamps GPX, full route GPX,
heyjoe's `okt_pecsetek.gpx`), which are downloaded by hand and are not in the repository.

## Done when

- [x] The source files are downloaded (the same dates the current seeds were built from, so the data does not change: `git diff` of `public/data` and of the seed rows is empty apart from the header and the cleanup block)
- [x] `node scripts/build-data.mjs <stamps.gpx> <route.gpx> <okt_pecsetek.gpx>` has been run and the output committed
- [x] `npm test`, `npm run testdb:reset` and `npm run e2e` pass
- [x] The seeds are applied to production by hand and the reference-data cache is cleared (`deploy/README.md`, "After the seeds change"); the deploy workflow does not apply seeds: not needed, see Progress
- [x] Spec 0004's "Known gap" paragraph is deleted

## Progress

- The three source files were still in the scratchpad of the session that downloaded them (2026-09-29: `okt_bh_20260924.gpx`, `okt_teljes_bh_20260924.gpx`, heyjoe's `okt_pecsetek.gpx`). The generator's output for `public/data` is identical to what is committed; the seeds differ only in the new `begin`/`commit` and the cleanup block.
- Production was compared with the regenerated seeds, row by row (all columns of `checkpoints` and `extra_stamps`, hashed on both sides): identical. The cleanup therefore removes nothing there, so the seeds were not applied and the cache was not cleared; the next real source change applies them as the spec says.
- AC-9 had only a hand check; `tests/seed-cleanup.test.ts` now runs the drills (a dropped code, a moved extra stamp, a vanished place, a placeholder row) against the local database, and CI runs it.

## Spec changes

Spec 0004: the "Known gap" paragraph is deleted and AC-9's coverage is the new test plus a manual row for a real source file (dated). Spec 0007 AC-2 lists the new test among the database tests.

## Notes

- If the sources have changed since, regenerating also changes data: then follow the whole "Regenerating" list in
  spec 0004, including translating new stamps (spec 0033 AC-3).
