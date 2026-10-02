-- Footer pages (specs 0014, 0017): the feedback form and "delete my account".
-- Not applied to production before this version, so it was tightened in place (see spec 0017).

create table public.user_feedback (
  id         serial primary key,
  user_id    uuid references auth.users on delete set null, -- kept, but unlinked, when the account is deleted
  message    text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- on delete set null scans this column when an account is deleted
create index user_feedback_user_id_idx on public.user_feedback (user_id);

alter table public.user_feedback enable row level security;

-- Anyone may leave feedback, signed in or not, but only as themselves (or anonymously): a user id
-- that isn't the caller's would file feedback in somebody else's name. There is no select policy, so
-- nothing can read feedback through the API; the developer reads it in the Supabase dashboard.
create policy "feedback: insert anonymously or as yourself" on public.user_feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- A user deletes their own account. Needs elevated rights (security definer) to delete from auth.users;
-- the stamps follow through their on delete cascade. The empty search_path stops a same-named object
-- in another schema from shadowing the ones used here.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Functions are executable by everyone by default: only signed-in users may call this one.
revoke execute on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;
