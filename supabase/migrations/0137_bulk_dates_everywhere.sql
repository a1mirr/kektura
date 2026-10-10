-- Task #137 (spec 0016 AC-17 and AC-18): one date for many rows, also for places and extra stamps that are not stamped yet. Replaces
-- the function of 0080_bulk_stamp_dates.sql under the same name and signature, so the generated types do not change. Compatible with
-- the code that runs while this is applied: the old call only names stamped rows and gets what it got before.
--
-- Every place gets the date: a place the caller stamped is re-dated, one they did not is stamped with it (every variant of the place,
-- like stamping a place does); the same for the extra stamps. security invoker: it runs as the caller, so row level security still
-- decides what they may write (the insert and update policies of both tables), and every row it writes carries the caller's own user id.
-- It answers false, and changes nothing, when
--   - there is no signed-in user, no date, no place or extra stamp, or more than 500 of them together;
--   - a place or extra stamp does not exist;
--   - a retired stamp (spec 0001 AC-22) would get a date on or after the day it retired (spec 0016 AC-13).
-- The checks come before the writes, and the writes are one transaction, so "nothing" needs no rollback. It never deletes.
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

  if (select count(distinct c.place_key) from public.checkpoints c where c.place_key = any (v_keys)) <> cardinality(v_keys) then
    return false;
  end if;

  if exists (
    select 1 from public.checkpoints c
    where c.place_key = any (v_keys) and c.retired_on is not null and new_date >= c.retired_on
  ) then
    return false;
  end if;

  if (select count(*) from public.extra_stamps e where e.id = any (v_extras)) <> cardinality(v_extras) then
    return false;
  end if;

  insert into public.user_stamps (user_id, checkpoint_id, stamped_on)
    select v_uid, c.id, new_date from public.checkpoints c where c.place_key = any (v_keys)
    on conflict (user_id, checkpoint_id) do update set stamped_on = excluded.stamped_on;
  insert into public.user_extra_stamps (user_id, extra_id, stamped_on)
    select v_uid, e.id, new_date from public.extra_stamps e where e.id = any (v_extras)
    on conflict (user_id, extra_id) do update set stamped_on = excluded.stamped_on;
  return true;
end;
$$;

revoke execute on function public.set_stamp_dates(text[], integer[], date) from public, anon;
grant execute on function public.set_stamp_dates(text[], integer[], date) to authenticated;
