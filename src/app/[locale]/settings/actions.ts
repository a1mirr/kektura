"use server";

import { createClient } from "@/lib/supabase/server";

export async function deleteAccountAction(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  // Call the Postgres function we created to delete the user
  const { error } = await supabase.rpc("delete_user_account");

  if (error) {
    console.error("Failed to delete account:", error);
    return { ok: false };
  }

  // Sign out after deletion to clear session cookies
  await supabase.auth.signOut();
  return { ok: true };
}
