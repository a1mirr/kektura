create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(trim(display_name)) between 1 and 40),
  invite_token text not null unique default gen_random_uuid()::text check (invite_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
);

alter table public.profiles enable row level security;

create policy update_profiles on public.profiles for update using (id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Hiker ' || substr(new.id::text, 1, 6)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null check(status in ('pending', 'accepted')),
  user_is_sharing boolean not null default true,
  friend_is_sharing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, friend_id),
  check (user_id != friend_id)
);

create index friendships_friend_id_idx on public.friendships(friend_id);

create policy select_profiles on public.profiles for select using (id = (select auth.uid()) or exists (select 1 from public.friendships f where f.user_id = public.profiles.id and f.friend_id = (select auth.uid())) or exists (select 1 from public.friendships f where f.friend_id = public.profiles.id and f.user_id = (select auth.uid())));





alter table public.friendships enable row level security;
create policy select_friendships on public.friendships for select using (
  user_id = (select auth.uid()) or friend_id = (select auth.uid())
);
create policy insert_friendships on public.friendships for insert with check (
  user_id = (select auth.uid())
);

create function public.send_request(token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_inviter_id uuid;
  v_uid uuid := (select auth.uid());
  v_existing_status text;
begin
  if v_uid is null then return 'unauthorized'; end if;
  
  select id into v_inviter_id from public.profiles where invite_token = token;
  if v_inviter_id is null then return 'invalid_token'; end if;
  if v_inviter_id = v_uid then return 'own_token'; end if;
  
  select status into v_existing_status from public.friendships 
  where (user_id = v_inviter_id and friend_id = v_uid) or (user_id = v_uid and friend_id = v_inviter_id);
  
  if v_existing_status = 'accepted' then return 'already_friends'; end if;
  if v_existing_status = 'pending' then return 'already_pending'; end if;
  
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
  set status = 'accepted', updated_at = now()
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
      friend_is_sharing = case when friend_id = (select auth.uid()) then sharing else friend_is_sharing end,
      updated_at = now()
  where ((user_id = (select auth.uid()) and friend_id = other_id) or
         (user_id = other_id and friend_id = (select auth.uid())))
    and status = 'accepted';
end;
$$;
revoke execute on function public.set_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_sharing(uuid, boolean) to authenticated;






create function public.get_inviter_name(token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  select display_name into v_name from public.profiles where invite_token = token;
  return v_name;
end;
$$;
revoke execute on function public.get_inviter_name(text) from public, anon;
grant execute on function public.get_inviter_name(text) to authenticated;
