-- Task #77 (spec 0001 AC-29, spec 0003 AC-26, spec 0004 AC-16 and AC-19): the day a current stamp moved to a new place (a change of its
-- coordinates of more than 100 m between two MTSZ files). `moved_on` is filled by the seed from the `moves` of
-- scripts/data/okt-stamp-dates.json; null: the stamp has not moved, or the entry was removed. Additive for the code that is
-- running while this is applied: one nullable column that nothing reads yet (the cached reference data is keyed by the shape
-- of the rows, src/lib/dashboard-data.ts). A retired row never carries it.
alter table public.checkpoints add column if not exists moved_on date;

alter table public.checkpoints add constraint checkpoints_moved_on_current check (moved_on is null or retired_on is null);
