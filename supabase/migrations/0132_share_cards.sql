-- Share cards (task #132, spec 0039): a frozen snapshot of a user's progress behind an unguessable public link.
-- Nothing reads or writes the table directly except the owner's own select: creating and deleting a card and the
-- public read by token are security definer functions.

create table public.share_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex') check (token ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now(),
  -- Null = anonymous. A copy of the profile's display name at the moment of creating, so a later rename changes nothing.
  display_name text check (display_name is null or (length(trim(display_name)) between 1 and 40 and display_name !~ '[[:cntrl:]]')),
  stamps_done integer not null check (stamps_done >= 0),
  stamps_total integer not null check (stamps_total > 0),
  percent integer not null check (percent between 0 and 100),
  km_done numeric(7, 1) not null check (km_done >= 0),
  km_left numeric(7, 1) not null check (km_left >= 0),
  stages_done integer not null check (stages_done >= 0),
  stages_total integer not null check (stages_total > 0),
  -- The walked stretches as [from_km, to_km] pairs: enough to draw the map, no stamp and no date.
  ranges jsonb not null check (jsonb_typeof(ranges) = 'array' and jsonb_array_length(ranges) <= 200),
  check (stamps_done <= stamps_total and stages_done <= stages_total)
);

create index share_cards_user_id_idx on public.share_cards (user_id);

alter table public.share_cards enable row level security;
revoke all on public.share_cards from anon, authenticated;
grant select on public.share_cards to authenticated;

create policy select_own_share_cards on public.share_cards for select to authenticated using (
  user_id = (select auth.uid())
);

-- A user keeps at most this many cards (the app shows the number; the database enforces it).
-- Returns 'ok', 'unauthorized', 'invalid' (numbers or ranges that make no sense) or 'limit'.
create function public.create_share_card(
  p_show_name boolean,
  p_stamps_done integer,
  p_stamps_total integer,
  p_percent integer,
  p_km_done numeric,
  p_km_left numeric,
  p_stages_done integer,
  p_stages_total integer,
  p_ranges jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
begin
  if v_uid is null then return 'unauthorized'; end if;

  if p_ranges is null or jsonb_typeof(p_ranges) <> 'array' or jsonb_array_length(p_ranges) > 200 then return 'invalid'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_ranges) e
    where case
      when jsonb_typeof(e) <> 'array' then true
      when jsonb_array_length(e) <> 2 then true
      when jsonb_typeof(e -> 0) <> 'number' or jsonb_typeof(e -> 1) <> 'number' then true
      else not ((e ->> 0)::numeric >= 0 and (e ->> 1)::numeric <= 2000 and (e ->> 0)::numeric < (e ->> 1)::numeric)
    end
  ) then return 'invalid'; end if;

  -- Serialises one user's creations until the end of the transaction, so parallel calls cannot all count 19 and insert.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.share_cards where user_id = v_uid) >= 20 then return 'limit'; end if;

  if coalesce(p_show_name, false) then
    select display_name into v_name from public.profiles where id = v_uid;
  end if;

  begin
    insert into public.share_cards (user_id, display_name, stamps_done, stamps_total, percent, km_done, km_left, stages_done, stages_total, ranges)
    values (v_uid, v_name, p_stamps_done, p_stamps_total, p_percent, p_km_done, p_km_left, p_stages_done, p_stages_total, p_ranges);
  exception when check_violation or numeric_value_out_of_range then
    return 'invalid';
  end;
  return 'ok';
end;
$$;
revoke execute on function public.create_share_card(boolean, integer, integer, integer, numeric, numeric, integer, integer, jsonb) from public, anon;
grant execute on function public.create_share_card(boolean, integer, integer, integer, numeric, numeric, integer, integer, jsonb) to authenticated;

create function public.delete_share_card(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.share_cards where id = p_id and user_id = (select auth.uid());
end;
$$;
revoke execute on function public.delete_share_card(uuid) from public, anon;
grant execute on function public.delete_share_card(uuid) to authenticated;

-- The public read: one card by its token, and nothing that says whose it is (no user id, no row id).
create function public.get_share_card(p_token text)
returns table (
  created_at timestamptz,
  display_name text,
  stamps_done integer,
  stamps_total integer,
  percent integer,
  km_done numeric,
  km_left numeric,
  stages_done integer,
  stages_total integer,
  ranges jsonb
)
language sql stable security definer set search_path = '' as $$
  select c.created_at, c.display_name, c.stamps_done, c.stamps_total, c.percent, c.km_done, c.km_left, c.stages_done, c.stages_total, c.ranges
  from public.share_cards c
  where c.token = p_token;
$$;
revoke execute on function public.get_share_card(text) from public;
grant execute on function public.get_share_card(text) to anon, authenticated;

-- The feature flag (spec 0035): off until it is switched on from the Telegram bot.
insert into public.feature_flags (key, mode) values ('share', 'off') on conflict (key) do nothing;
