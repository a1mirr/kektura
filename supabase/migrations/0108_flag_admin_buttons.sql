-- The allowlist panel of the Telegram bot (task #108, spec 0035). Like migration 0062 these are called with the service
-- role key only; the flag tables stay closed to the public API.

-- The users on a flag's allowlist, by display name (never email), at most 100.
create function public.admin_list_feature_flag_users(p_key text) returns table (user_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select u.user_id, coalesce(p.display_name, 'Unnamed')
  from public.feature_flag_users u
  left join public.profiles p on p.id = u.user_id
  where u.key = p_key
  order by 2, 1
  limit 100;
$$;

-- Removes one user from a flag's allowlist: 'ok', or 'not_listed' when they were not on it (nothing changes).
create function public.admin_remove_feature_flag_user(p_key text, p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.feature_flag_users where key = p_key and user_id = p_user_id;
  get diagnostics removed = row_count;
  return case when removed > 0 then 'ok' else 'not_listed' end;
end;
$$;

revoke execute on function public.admin_list_feature_flag_users(text) from public, anon, authenticated;
revoke execute on function public.admin_remove_feature_flag_user(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_list_feature_flag_users(text) to service_role;
grant execute on function public.admin_remove_feature_flag_user(text, uuid) to service_role;
