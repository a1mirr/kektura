import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// The client reads as the `anon` role, which is all the public reference tables (checkpoints, extra_stamps) need.
// Because it carries nothing of the request, what it fetches may be cached across requests and users. Never use it
// for user data.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
