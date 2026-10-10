"use server";

import type { ActionResult } from "@/lib/action-result";
import { logAccountDeletionError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// Like the stamp actions it never throws: a thrown error reaches the client as an opaque message.
export async function deleteAccountAction(): Promise<ActionResult> {
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "unauthorized" };
    userId = user.id;

    // The database function deletes auth.users where id = auth.uid(); the stamps follow by cascade.
    const { error } = await supabase.rpc("delete_user_account");
    if (error) {
      logAccountDeletionError("rpc", error, user.id);
      return { ok: false, reason: "failed" };
    }

    // The account is gone. Clear the session cookies; the Auth server answers a 401/403 now (the
    // session no longer exists), which supabase-js ignores while still removing the local session.
    // Whatever happens here, the deletion itself has succeeded.
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logAccountDeletionError("exception", error, user.id);
    }
    return { ok: true };
  } catch (error) {
    logAccountDeletionError("exception", error, userId);
    return { ok: false, reason: "failed" };
  }
}
