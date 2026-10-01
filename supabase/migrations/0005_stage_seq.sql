-- Stage numbering "<stage>.<n>": `stage` (official OKT section 1..27, already in the table) plus the
-- position of the place inside its stage. Filled by supabase/seed.sql (scripts/build-data.mjs).
alter table public.checkpoints add column if not exists stage_seq int;
