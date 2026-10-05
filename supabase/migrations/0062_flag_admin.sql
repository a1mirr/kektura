-- Switching feature flags from the Telegram bot (task #62, spec 0035). The webhook has no signed-in user, so it
-- calls these functions with the service role key; nobody else may call them (the flag tables stay closed to the
-- public API, migration 0060). Each is idempotent.

-- Every stored flag with the number of users on its allowlist.
create function public.admin_list_feature_flags() returns table (key text, mode text, users bigint)
language sql stable security definer set search_path = '' as $$
  select f.key, f.mode, (select count(*) from public.feature_flag_users u where u.key = f.key)
  from public.feature_flags f
  order by f.key;
$$;

-- Sets a flag's mode, creating its row when it has none. 'bad_mode' for a mode that does not exist.
create function public.admin_set_feature_flag(p_key text, p_mode text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if p_mode is null or p_mode not in ('off', 'allowlist', 'on') then
    return 'bad_mode';
  end if;
  insert into public.feature_flags (key, mode) values (p_key, p_mode)
  on conflict (key) do update set mode = excluded.mode;
  return 'ok';
end;
$$;

-- Adds a user, found by email (never stored), to a flag's allowlist or removes them. 'no_account' when no user has
-- that email, 'no_flag' when the flag has no row yet.
create function public.admin_set_feature_flag_user(p_key text, p_email text, p_allowed boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email) limit 1;
  if uid is null then
    return 'no_account';
  end if;
  if not exists (select 1 from public.feature_flags where key = p_key) then
    return 'no_flag';
  end if;
  if p_allowed then
    insert into public.feature_flag_users (key, user_id) values (p_key, uid) on conflict do nothing;
  else
    delete from public.feature_flag_users where key = p_key and user_id = uid;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.admin_list_feature_flags() from public, anon, authenticated;
revoke execute on function public.admin_set_feature_flag(text, text) from public, anon, authenticated;
revoke execute on function public.admin_set_feature_flag_user(text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_list_feature_flags() to service_role;
grant execute on function public.admin_set_feature_flag(text, text) to service_role;
grant execute on function public.admin_set_feature_flag_user(text, text, boolean) to service_role;
