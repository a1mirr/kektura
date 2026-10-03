-- Spec 0024: handle_new_user() is a trigger function, so calling it through the API only ever fails, but the
-- Supabase advisor flags a security definer function that anon and signed-in users may execute. A trigger
-- fires without any caller having EXECUTE on it. Applied to production separately, as this file.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
