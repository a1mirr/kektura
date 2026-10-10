import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

// Reference data (checkpoints, extra stamps) is the same for everybody: read through a cookie-less client and cached
// on the server.
// A user's own stamps are read per request through the cookie-based client, under RLS, and never cached.

export const REFERENCE_DATA_TAG = "reference-data";
export const REFERENCE_DATA_REVALIDATE_SECONDS = 60 * 60 * 24;

async function fetchReferenceData() {
  const supabase = createPublicClient();
  const [checkpoints, extras] = await Promise.all([
    supabase.from("checkpoints").select("*").order("seq"),
    supabase.from("extra_stamps").select("*").order("km_from_start"),
  ]);
  // Throw instead of returning the error: a failed read must never be cached.
  if (checkpoints.error || extras.error) throw new Error("reference data: read failed");
  return { checkpoints: checkpoints.data, extras: extras.data };
}

// The key's second part changes when the shape of the rows changes (a new column), so rows cached before a deploy are
// never served to code that expects it.
export const getReferenceData = unstable_cache(fetchReferenceData, ["dashboard-reference-data", "v4"], {
  tags: [REFERENCE_DATA_TAG],
  revalidate: REFERENCE_DATA_REVALIDATE_SECONDS,
});

export async function loadDashboardData(supabase: SupabaseClient<Database>) {
  const [reference, { data: stamps }, { data: extraStamps }] = await Promise.all([
    getReferenceData(),
    supabase.from("user_stamps").select("checkpoint_id, stamped_on"),
    supabase.from("user_extra_stamps").select("extra_id, stamped_on"),
  ]);
  return {
    checkpoints: reference.checkpoints,
    extras: reference.extras,
    stamps: stamps ?? [],
    extraStamps: extraStamps ?? [],
  };
}
