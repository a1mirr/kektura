-- Task #80 (spec 0016 AC-14 to AC-16): one date for many stamps, all or nothing. Two client updates (places and extra
-- stamps) cannot be one transaction, a function can. Additive: nothing the running code uses changes.
--
-- security invoker: it runs as the caller, so row level security still decides which rows exist for them, and every
-- statement also filters on the caller's own user id. It updates only; it never inserts. It answers false, and
-- changes nothing, when
--   - there is no signed-in user, no date, no place or extra stamp, or more than 500 of them together;
--   - a place has no stamp of the caller, or an extra stamp is not collected (a row removed in another tab);
--   - a retired stamp (spec 0001 AC-22) would get a date on or after the day it retired (spec 0016 AC-13).
-- The checks come before the writes, so "nothing" needs no rollback.
create or replace function public.set_stamp_dates(place_keys text[], extra_ids integer[], new_date date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_keys text[];
  v_extras integer[];
begin
  if v_uid is null or new_date is null then return false; end if;

  select coalesce(array_agg(distinct k), '{}') into v_keys from unnest(coalesce(place_keys, '{}')) as k;
  select coalesce(array_agg(distinct e), '{}') into v_extras from unnest(coalesce(extra_ids, '{}')) as e;
  if cardinality(v_keys) + cardinality(v_extras) not between 1 and 500 then return false; end if;

  if (
    select count(distinct c.place_key)
    from public.user_stamps s
    join public.checkpoints c on c.id = s.checkpoint_id
    where s.user_id = v_uid and c.place_key = any (v_keys)
  ) <> cardinality(v_keys) then
    return false;
  end if;

  if exists (
    select 1 from public.checkpoints c
    where c.place_key = any (v_keys) and c.retired_on is not null and new_date >= c.retired_on
  ) then
    return false;
  end if;

  if (
    select count(*) from public.user_extra_stamps x where x.user_id = v_uid and x.extra_id = any (v_extras)
  ) <> cardinality(v_extras) then
    return false;
  end if;

  update public.user_stamps s
    set stamped_on = new_date
    from public.checkpoints c
    where c.id = s.checkpoint_id and s.user_id = v_uid and c.place_key = any (v_keys);
  update public.user_extra_stamps x
    set stamped_on = new_date
    where x.user_id = v_uid and x.extra_id = any (v_extras);
  return true;
end;
$$;

revoke execute on function public.set_stamp_dates(text[], integer[], date) from public, anon;
grant execute on function public.set_stamp_dates(text[], integer[], date) to authenticated;
