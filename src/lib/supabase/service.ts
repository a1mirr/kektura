import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// The client is server-only, and only for the Telegram webhook: the key is never prefixed NEXT_PUBLIC_, never logged,
// and this module is never imported by a page or a component. Null when the key is not configured.
export function createServiceClient(env: Record<string, string | undefined> = process.env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
