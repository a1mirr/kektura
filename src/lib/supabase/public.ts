import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// A Supabase client with no cookies and no session: it reads as the `anon` role, which is all the
// public reference tables (checkpoints, extra_stamps) need. Because it carries nothing of the request,
// what it fetches may be cached across requests and users (spec 0009 AC-1). Never use it for user data.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
