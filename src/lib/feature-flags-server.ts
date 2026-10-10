import { connection } from "next/server";
import { cache } from "react";
import { resolveFlags, type FlagKey, type Flags } from "./feature-flags";
import { logFeatureFlagsError } from "./log";
import { createClient } from "./supabase/server";

// Read once per request (React `cache`) and never across requests, so a change takes effect on the next one.
// `connection()` makes every page that asks render per request, so the build never freezes an answer; it sits outside
// the `try` on purpose: the signal it raises while prerendering must reach Next, and a `catch` would swallow it and
// leave the defaults baked into the page. A failed lookup gives every flag its default and one log line.
const getFlags = cache(async (): Promise<Flags> => {
  await connection();
  try {
    const { data, error } = await (await createClient()).rpc("feature_flags_for_me");
    if (error) throw error;
    return resolveFlags(data);
  } catch (error) {
    logFeatureFlagsError(error);
    return resolveFlags(null);
  }
});

// Not exported from a "use server" file: that would make it a callable server action.
export async function flagOn(key: FlagKey): Promise<boolean> {
  return (await getFlags())[key];
}
