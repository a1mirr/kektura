-- RLS: evaluate auth.uid() once per statement instead of once per row (Supabase advisor
-- "auth_rls_initplan") and scope the per-user policies to signed-in users. Same rules as before.
alter policy "own stamps: select" on public.user_stamps
  to authenticated using ((select auth.uid()) = user_id);
alter policy "own stamps: insert" on public.user_stamps
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "own stamps: update" on public.user_stamps
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "own stamps: delete" on public.user_stamps
  to authenticated using ((select auth.uid()) = user_id);

alter policy "own extra stamps: select" on public.user_extra_stamps
  to authenticated using ((select auth.uid()) = user_id);
alter policy "own extra stamps: insert" on public.user_extra_stamps
  to authenticated with check ((select auth.uid()) = user_id);
alter policy "own extra stamps: delete" on public.user_extra_stamps
  to authenticated using ((select auth.uid()) = user_id);

-- Foreign-key columns (advisor "unindexed_foreign_keys"): deleting a checkpoint or extra stamp, as
-- the seeds do for points MTSZ / heyjoe.hu dropped, cascades without scanning the stamp tables.
create index if not exists user_stamps_checkpoint_id_idx on public.user_stamps (checkpoint_id);
create index if not exists user_extra_stamps_extra_id_idx on public.user_extra_stamps (extra_id);
