-- Feature flags (task #60, spec 0035). Which flags exist is declared in code (src/lib/feature-flags.ts); these
-- tables hold how each one is switched. Nothing here is reachable through the public API: the app reads the
-- state through feature_flags_for_me() only, and the developer changes it in the dashboard or in a migration.

create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  mode text not null check (mode in ('off', 'allowlist', 'on'))
);

-- The users a flag in `allowlist` mode is on for. Deleting the account removes its rows.
create table public.feature_flag_users (
  key text not null references public.feature_flags(key) on update cascade on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (key, user_id)
);

create index feature_flag_users_user_id_idx on public.feature_flag_users(user_id);

-- Row level security on and no policy: neither anon nor authenticated can read or write the tables.
alter table public.feature_flags enable row level security;
alter table public.feature_flag_users enable row level security;
revoke all on public.feature_flags from anon, authenticated;
revoke all on public.feature_flag_users from anon, authenticated;

-- What the app needs to decide every flag for the caller: each stored flag with its mode and whether the caller
-- (auth.uid(), null when signed out) is on its allowlist. Other users' ids never leave the database.
create function public.feature_flags_for_me() returns table (key text, mode text, listed boolean)
language sql stable security definer set search_path = '' as $$
  select f.key, f.mode,
    exists (
      select 1 from public.feature_flag_users u
      where u.key = f.key and u.user_id = (select auth.uid())
    )
  from public.feature_flags f;
$$;

revoke execute on function public.feature_flags_for_me() from public;
grant execute on function public.feature_flags_for_me() to anon, authenticated;

-- Friends (spec 0024) is on in production, where it was switched on by an environment variable until now.
insert into public.feature_flags (key, mode) values ('friends', 'on');
