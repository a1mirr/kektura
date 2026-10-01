# 0004: Generated trail data and seeds

Status: Done
Owner code: `scripts/build-data.mjs`, `scripts/lib/geo.mjs`, `scripts/data/okt-stages.json`; generated
`supabase/seed.sql`, `supabase/seed_extra.sql`, `public/data/okt-*.json`

## Goal

Keep the stamping places, stages, hops and route geometry consistent with the official MTSZ data,
and safe to regenerate whenever MTSZ (or heyjoe.hu) publishes a new file.

## Behaviour

- **AC-1**: Every `seed.sql` row parses; codes are unique; `seq` runs 1..n in trail order.
- **AC-2**: The seed's places are exactly the places of the MTSZ stage table (161 today); every
  place name in the table exists in the seed.
- **AC-3**: Variants of a place share its `<stage>.<stage_seq>`; no two places share a label.
- **AC-4**: The hops form one continuous chain from Írott-kő through every place.
- **AC-5**: Only ferry hops (where consecutive stages don't join) lack walking times.
- **AC-6**: Walking hops add up to each stage's km in the MTSZ table, and to the table total
  (1183.1 km today).
- **AC-7**: Both route files start at km 0, never go backwards, end at the same km, and reach the
  last stamping place.
- **AC-8**: Extra stamp codes are unique.
- **AC-9**: Re-running a regenerated seed removes rows the new source no longer has (a code MTSZ
  dropped, e.g. a stamp split into `_1`/`_2`; an extra stamp that moved). Users' stamps on a dropped
  row move to the remaining variants of the same place (extra stamps: same name) first; a place that
  is gone entirely takes its stamps with it. Each seed runs in one transaction.

## Out of scope

Downloading the source files (done by hand from kektura.hu / heyjoe.hu); stamp artwork.

## Coverage

| AC | Test |
| --- | --- |
| AC-1 ... AC-8 | `tests/trail-data.test.ts` |
| AC-9 | manual: after regenerating, check the seed's cleanup with a read-only query first (codes not in the new list, stamps that would move). Verified 2026-10-02 against the live DB: 0 stale rows today; a simulated drop of `OKTPH_03_1` moves its stamp to `OKTPH_03_2` |
