import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Because it carries nothing of the request, what it fetches may be cached across requests and users. Never use it
// for user data.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
