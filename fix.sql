drop function if exists public.get_friend_stamps;

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
