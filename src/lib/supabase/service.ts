import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createServiceClient(env: Record<string, string | undefined> = process.env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
