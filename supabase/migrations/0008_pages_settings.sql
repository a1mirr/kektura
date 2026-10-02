create table public.user_feedback (
  id         serial primary key,
  user_id    uuid references auth.users on delete set null,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;
create policy "anyone can insert feedback" on public.user_feedback
  for insert with check (true);

-- Function for a user to delete their own account.
-- It requires elevated privileges (security definer) to delete from auth.users.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  
  delete from auth.users where id = auth.uid();
end;
$$;
