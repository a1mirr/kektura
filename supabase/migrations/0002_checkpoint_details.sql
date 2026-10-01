-- Official data (MTSZ GPX): stable code per stamping point, description, elevation.
-- Some points are alternatives at the same place, so seq is ordering only, not unique.
alter table public.checkpoints drop constraint if exists checkpoints_seq_key;
alter table public.checkpoints
  add column if not exists code text unique,
  add column if not exists description text,
  add column if not exists elevation_m int;
