import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/public";

// Spec 0009: what the dashboard reads from the database, split by who may share it.
//  - Reference data (checkpoints, extra stamps) is the same for everybody and only changes when the
//    seeds are regenerated: read through a cookie-less client and cached on the server (AC-1).
//  - A user's own stamps are read per request through the cookie-based client, under RLS, and are
//    never cached (AC-2).

export const REFERENCE_DATA_TAG = "reference-data"; // `revalidateTag(REFERENCE_DATA_TAG, "max")` expires it on demand
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

export const getReferenceData = unstable_cache(fetchReferenceData, ["dashboard-reference-data"], {
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
