-- Non-official stamps near the trail (castles, museums, other hiking movements).
-- Tracked separately so they never affect the 161-place official counter.
create table public.extra_stamps (
  id            serial primary key,
  code          text not null unique,           -- "lat,lng:name" from the source GPX
  name          text not null,
  description   text,
  lat           double precision not null,
  lng           double precision not null,
  km_from_start numeric(6,1) not null default 0,
  off_trail_m   int not null default 0          -- distance from the OKT track
);

create table public.user_extra_stamps (
  user_id    uuid not null references auth.users on delete cascade,
  extra_id   int  not null references public.extra_stamps on delete cascade,
  stamped_on date not null default current_date,
  primary key (user_id, extra_id)
);

alter table public.extra_stamps enable row level security;
alter table public.user_extra_stamps enable row level security;

create policy "extra stamps readable by everyone"
  on public.extra_stamps for select using (true);

create policy "own extra stamps: select" on public.user_extra_stamps
  for select using (auth.uid() = user_id);
create policy "own extra stamps: insert" on public.user_extra_stamps
  for insert with check (auth.uid() = user_id);
create policy "own extra stamps: delete" on public.user_extra_stamps
  for delete using (auth.uid() = user_id);
