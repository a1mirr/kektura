-- Task #76 (spec 0001 AC-22 to AC-27, spec 0002 AC-17, spec 0004 AC-14 and AC-15, spec 0016 AC-13, spec 0024 AC-26): a stamp that no longer exists stays in
-- `checkpoints` as a retired row, so the people who collected it keep it. Additive for the code that is running while this
-- is applied: nullable columns and two friend functions that only drop retired rows. The retired row itself comes with the
-- seed (scripts/data/okt-retired-stamps.json), applied after the new code is live: the old code would read it as a place.
alter table public.checkpoints
  add column if not exists retired_on date,            -- the first day the stamp is no longer valid; null: a current stamp
  add column if not exists replaced_by text,           -- the place_key of the stamp that replaced it
  add column if not exists after_place_key text,       -- the current place it followed in trail order (its position in its stage)
  add column if not exists position_approximate boolean not null default false; -- the position is not from an official source

alter table public.checkpoints add constraint checkpoints_retired_columns check (
  retired_on is not null or (replaced_by is null and after_place_key is null and not position_approximate)
);
-- A retired row's key is its own code: stamping by key works, and no two retired rows share one.
create unique index if not exists checkpoints_retired_place_key_idx on public.checkpoints (place_key) where retired_on is not null;

-- A friend's page lists no retired stamp and counts none (spec 0024 AC-26): the functions leave them out.
create or replace function public.get_friend_stamps() returns table(friend_id uuid, checkpoint_id integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return; end if;

  return query
    select s.user_id, s.checkpoint_id
    from public.user_stamps s
    join public.checkpoints c on c.id = s.checkpoint_id and c.retired_on is null
    join public.friendships f on (
      (f.user_id = v_uid and f.friend_id = s.user_id and f.friend_is_sharing = true)
      or
      (f.friend_id = v_uid and f.user_id = s.user_id and f.user_is_sharing = true)
    )
    where f.status = 'accepted';
end;
$$;

create or replace function public.get_friend_waived_places() returns table(friend_id uuid, place_key text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return; end if;

  return query
    with friends as (
      select case when f.user_id = v_uid then f.friend_id else f.user_id end as fid
      from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = v_uid and f.friend_is_sharing) or (f.friend_id = v_uid and f.user_is_sharing))
    ),
    -- A place sits at its furthest-along variant, in the order of its first one (src/lib/progress.ts).
    places as (
      -- the earliest date of the variants; one variant without a date means "from the beginning"
      select c.place_key as pkey, max(c.km_from_start) as km, min(c.seq) as seq,
             case when bool_or(c.required_from is null) then null else min(c.required_from) end as required_from
      from public.checkpoints c
      where c.retired_on is null
      group by c.place_key
    ),
    stamped as (
      select fr.fid, c.place_key as pkey, min(s.stamped_on) as stamped_on
      from friends fr
      join public.user_stamps s on s.user_id = fr.fid
      join public.checkpoints c on c.id = s.checkpoint_id and c.retired_on is null
      group by fr.fid, c.place_key
    )
    select fr.fid, p.pkey
    from friends fr
    cross join places p
    where p.required_from is not null
      and not exists (select 1 from stamped st where st.fid = fr.fid and st.pkey = p.pkey)
      and greatest(
        (select st.stamped_on from stamped st join places q on q.pkey = st.pkey
          where st.fid = fr.fid and (q.km, q.seq) < (p.km, p.seq) order by q.km desc, q.seq desc limit 1),
        (select st.stamped_on from stamped st join places q on q.pkey = st.pkey
          where st.fid = fr.fid and (q.km, q.seq) > (p.km, p.seq) order by q.km asc, q.seq asc limit 1)
      ) < p.required_from;
end;
$$;
