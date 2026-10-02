-- Add UPDATE policy for user_extra_stamps so users can edit the stamp date.
create policy "own extra stamps: update" on public.user_extra_stamps
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
