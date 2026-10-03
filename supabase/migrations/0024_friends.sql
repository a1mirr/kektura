-- Friends (spec 0024). Everything on these tables goes through security definer functions: the tables
-- themselves only allow a signed-in user to read the rows that concern them.

-- First name of the Google account, or a fallback when it is missing or empty after cleaning. Only the
-- trigger and the backfill call it, so a bad name can never make a sign-up fail.
create function public.default_display_name(meta jsonb, uid uuid) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    nullif(substr(split_part(trim(regexp_replace(coalesce(meta->>'full_name', ''), '[[:cntrl:]]', ' ', 'g')), ' ', 1), 1, 40), ''),
    'Hiker ' || substr(uid::text, 1, 6)
  );
$$;
revoke execute on function public.default_display_name(jsonb, uuid) from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40 and display_name !~ '[[:cntrl:]]'),
  invite_token text not null unique default encode(gen_random_bytes(16), 'hex') check (invite_token ~ '^[0-9a-f]{32}$')
);

alter table public.profiles enable row level security;

-- The invite token is secret: friends and pending requesters can read a profile, but not that column, and
-- nobody writes the table directly (display name and token go through the functions below).
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.default_display_name(new.raw_user_meta_data, new.id));
  return new;
end;
$$;

-- A trigger fires without the caller having EXECUTE on its function; nobody should call it through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill existing users
insert into public.profiles (id, display_name)
select id, public.default_display_name(raw_user_meta_data, id)
from auth.users
on conflict (id) do nothing;

create table public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  user_is_sharing boolean not null default true,
  friend_is_sharing boolean not null default true,
  primary key (user_id, friend_id),
  check (user_id != friend_id)
);

create index friendships_friend_id_idx on public.friendships(friend_id);
-- One friendship per pair, whichever side asked first.
create unique index friendships_pair_idx on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy select_friendships on public.friendships for select to authenticated using (
  user_id = (select auth.uid()) or friend_id = (select auth.uid())
);

create policy select_profiles on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (select 1 from public.friendships f where f.user_id = public.profiles.id and f.friend_id = (select auth.uid()))
  or exists (select 1 from public.friendships f where f.friend_id = public.profiles.id and f.user_id = (select auth.uid()))
);

-- The signed-in user's own invite token (the column is not readable through the table).
create function public.get_my_invite_token() returns text
language sql stable security definer set search_path = '' as $$
  select invite_token from public.profiles where id = (select auth.uid());
$$;
revoke execute on function public.get_my_invite_token() from public, anon;
grant execute on function public.get_my_invite_token() to authenticated;

create function public.regenerate_invite() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set invite_token = encode(extensions.gen_random_bytes(16), 'hex') where id = (select auth.uid());
end;
$$;
revoke execute on function public.regenerate_invite() from public, anon;
grant execute on function public.regenerate_invite() to authenticated;

create function public.set_display_name(name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set display_name = trim(name) where id = (select auth.uid());
end;
$$;
revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

create function public.send_request(token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_inviter_id uuid;
  v_uid uuid := (select auth.uid());
  v_existing public.friendships;
begin
  if v_uid is null then return 'unauthorized'; end if;

  select id into v_inviter_id from public.profiles where invite_token = token;
  if v_inviter_id is null then return 'invalid_token'; end if;
  if v_inviter_id = v_uid then return 'own_token'; end if;

  select * into v_existing from public.friendships
  where (user_id = v_inviter_id and friend_id = v_uid) or (user_id = v_uid and friend_id = v_inviter_id);

  if v_existing.status = 'accepted' then return 'already_friends'; end if;
  -- Pending: either I asked already, or the inviter asked me first and I only have to approve.
  if v_existing.status = 'pending' then
    return case when v_existing.user_id = v_uid then 'already_pending' else 'incoming_pending' end;
  end if;

  insert into public.friendships (user_id, friend_id, status)
  values (v_uid, v_inviter_id, 'pending');
  return 'ok';
end;
$$;
revoke execute on function public.send_request(text) from public, anon;
grant execute on function public.send_request(text) to authenticated;

create function public.approve_request(requester_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships
  set status = 'accepted'
  where user_id = requester_id and friend_id = (select auth.uid()) and status = 'pending';
end;
$$;
revoke execute on function public.approve_request(uuid) from public, anon;
grant execute on function public.approve_request(uuid) to authenticated;

create function public.ignore_request(requester_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
  where user_id = requester_id and friend_id = (select auth.uid()) and status = 'pending';
end;
$$;
revoke execute on function public.ignore_request(uuid) from public, anon;
grant execute on function public.ignore_request(uuid) to authenticated;

create function public.remove_friend(other_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
  where ((user_id = (select auth.uid()) and friend_id = other_id) or
         (user_id = other_id and friend_id = (select auth.uid())))
    and status = 'accepted';
end;
$$;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

create function public.get_friend_stamps() returns table(friend_id uuid, checkpoint_id integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return; end if;

  return query
    select s.user_id, s.checkpoint_id
    from public.user_stamps s
    join public.friendships f on (
      (f.user_id = v_uid and f.friend_id = s.user_id and f.friend_is_sharing = true)
      or
      (f.friend_id = v_uid and f.user_id = s.user_id and f.user_is_sharing = true)
    )
    where f.status = 'accepted';
end;
$$;
revoke execute on function public.get_friend_stamps() from public, anon;
grant execute on function public.get_friend_stamps() to authenticated;

create function public.set_sharing(other_id uuid, sharing boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships
  set user_is_sharing = case when user_id = (select auth.uid()) then sharing else user_is_sharing end,
      friend_is_sharing = case when friend_id = (select auth.uid()) then sharing else friend_is_sharing end
  where ((user_id = (select auth.uid()) and friend_id = other_id) or
         (user_id = other_id and friend_id = (select auth.uid())))
    and status = 'accepted';
end;
$$;
revoke execute on function public.set_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_sharing(uuid, boolean) to authenticated;

-- Resolves an invite link for a signed-in visitor: the inviter's name and whether it is their own link.
-- Signed-out visitors get nothing (they are sent through sign-in first), and no user id is returned.
create function public.get_inviter_info(token text) returns table(display_name text, is_own boolean)
language sql stable security definer set search_path = '' as $$
  select p.display_name, p.id = (select auth.uid())
  from public.profiles p
  where p.invite_token = token and (select auth.uid()) is not null;
$$;
revoke execute on function public.get_inviter_info(text) from public, anon;
grant execute on function public.get_inviter_info(text) to authenticated;
