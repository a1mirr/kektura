-- Kektura tracker: checkpoints (static) + user stamps (per user, protected by RLS)

create table public.checkpoints (
  id            serial primary key,
  seq           int not null unique,          -- order along the trail, west -> east
  stage         int,                          -- official stage number
  name          text not null,                -- Hungarian original
  lat           double precision,
  lng           double precision,
  km_from_start numeric(6,1) not null default 0
);

create table public.user_stamps (
  user_id       uuid not null references auth.users on delete cascade,
  checkpoint_id int  not null references public.checkpoints on delete cascade,
  stamped_on    date not null default current_date,
  note          text,
  primary key (user_id, checkpoint_id)
);

alter table public.checkpoints enable row level security;
alter table public.user_stamps enable row level security;

create policy "checkpoints readable by everyone"
  on public.checkpoints for select using (true);

create policy "own stamps: select" on public.user_stamps
  for select using (auth.uid() = user_id);
create policy "own stamps: insert" on public.user_stamps
  for insert with check (auth.uid() = user_id);
create policy "own stamps: update" on public.user_stamps
  for update using (auth.uid() = user_id);
create policy "own stamps: delete" on public.user_stamps
  for delete using (auth.uid() = user_id);
