-- Task #75 (spec 0001 AC-16, AC-17, spec 0024 AC-25): a new stamp is required only from the date the MTSZ
-- published. `required_from` is filled by the seed from scripts/data/okt-stamp-dates.json; null means "from the
-- beginning". Additive: the code running while this is applied never reads the column.
alter table public.checkpoints add column if not exists required_from date;

-- The dates known today, so the deploy sets them without a hand-applied seed. Later dates come with the regenerated seed
-- (scripts/build-data.mjs writes the same block from scripts/data/okt-stamp-dates.json); on an empty table (a fresh
-- reset runs the migrations before the seed) it updates nothing.
-- Dates from which a new stamp is required (scripts/data/okt-stamp-dates.json).
update public.checkpoints set required_from = null where required_from is not null and code <> all (array['OKTPH_103', 'OKTPH_126_B', 'OKTPH_128_B', 'OKTPH_132_B_1', 'OKTPH_132_B_2', 'OKTPH_142', 'OKTPH_147_B', 'OKTPH_30_B', 'OKTPH_31_B', 'OKTPH_63_C', 'OKTPH_80_B', 'OKTPH_83_B', 'OKTPH_84_B', 'OKTPH_86_B', 'OKTPH_97_B']);
update public.checkpoints c set required_from = d.required_from::date
from (values ('OKTPH_103', '2014-11-21'), ('OKTPH_126_B', '2026-06-11'), ('OKTPH_128_B', '2025-05-08'), ('OKTPH_132_B_1', '2022-05-01'), ('OKTPH_132_B_2', '2022-05-01'), ('OKTPH_142', '2017-06-11'), ('OKTPH_147_B', '2025-05-08'), ('OKTPH_30_B', '2025-05-08'), ('OKTPH_31_B', '2017-10-27'), ('OKTPH_63_C', '2025-05-08'), ('OKTPH_80_B', '2025-05-08'), ('OKTPH_83_B', '2025-05-08'), ('OKTPH_84_B', '2017-05-26'), ('OKTPH_86_B', '2025-05-08'), ('OKTPH_97_B', '2026-06-11')) as d(code, required_from)
where c.code = d.code and c.required_from is distinct from d.required_from::date;

-- The places of the trail a friend did not stamp but was not missing, because they walked past before the stamp was
-- required (spec 0001 AC-17): the same rule as `waivedPlaceKeys` in src/lib/progress.ts, decided here from the friend's
-- own stamp dates so that only the place keys leave the database, never a date (spec 0024 AC-12). Only for accepted
-- friends who share with the caller, like get_friend_stamps.
create function public.get_friend_waived_places() returns table(friend_id uuid, place_key text)
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
      group by c.place_key
    ),
    stamped as (
      select fr.fid, c.place_key as pkey, min(s.stamped_on) as stamped_on
      from friends fr
      join public.user_stamps s on s.user_id = fr.fid
      join public.checkpoints c on c.id = s.checkpoint_id
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
revoke execute on function public.get_friend_waived_places() from public, anon;
grant execute on function public.get_friend_waived_places() to authenticated;
