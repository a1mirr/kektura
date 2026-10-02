"use server";

import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(message: string): Promise<{ ok: boolean }> {
  if (!message || message.trim().length === 0) {
    return { ok: false };
  }
  
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;

  const { error } = await supabase.from("user_feedback").insert({
    user_id: userId || null,
    message: message.trim(),
  });

  return { ok: !error };
}
