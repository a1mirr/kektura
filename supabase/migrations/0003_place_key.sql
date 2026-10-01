-- Alternative stamps at the same place (OKTPH_03_1 / OKTPH_03_2, ...) share a place_key,
-- so marking one of them marks the whole place. Mirrors scripts/build-data.mjs.
alter table public.checkpoints add column if not exists place_key text;

update public.checkpoints
set place_key = regexp_replace(code, '^(OKTPH_[0-9]+(?:_[BC])?(?:_DDKPH_[0-9]+)?)(?:_[0-9]+)?$', '\1')
where code is not null;

create index if not exists checkpoints_place_key_idx on public.checkpoints (place_key);
