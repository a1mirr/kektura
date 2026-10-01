"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";

// See specs/0002-stamping.md.
const MAX_PLACES = 200;
const ok: ActionResult = { ok: true };
const unauthorized: ActionResult = { ok: false, reason: "unauthorized" };
const failed: ActionResult = { ok: false, reason: "failed" };

type Session = { supabase: Awaited<ReturnType<typeof createClient>>; user: User };

// Runs `write` for the signed-in user and refreshes the dashboard after a successful write. Never
// throws: a thrown error reaches the client as an opaque message. Everything runs under the user's
// RLS policies, so only their own stamps can ever be touched.
async function asUser(write: (session: Session) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized;
    const result = await write({ supabase, user });
    if (result.ok) revalidatePath("/[locale]/dashboard", "page");
    return result;
  } catch {
    return failed;
  }
}

// Stamps (or unstamps) places, e.g. one place or a whole stage. Alternative stamps at the same place
// share a place_key, so stamping one stamps them all.
export async function setPlacesStamped(placeKeys: string[], stamped: boolean): Promise<ActionResult> {
  if (
    !Array.isArray(placeKeys) ||
    placeKeys.length === 0 ||
    placeKeys.length > MAX_PLACES ||
    placeKeys.some((k) => typeof k !== "string" || k.length > 64) ||
    typeof stamped !== "boolean"
  ) {
    return failed;
  }
  return asUser(async ({ supabase, user }) => {
    const { data: rows, error } = await supabase.from("checkpoints").select("id").in("place_key", placeKeys);
    if (error || !rows?.length) return failed;
    const ids = rows.map((r) => r.id);

    // ignoreDuplicates (ON CONFLICT DO NOTHING): re-stamping keeps the original stamped_on date.
    const { error: writeError } = stamped
      ? await supabase
          .from("user_stamps")
          .upsert(ids.map((id) => ({ user_id: user.id, checkpoint_id: id })), { ignoreDuplicates: true })
      : await supabase.from("user_stamps").delete().eq("user_id", user.id).in("checkpoint_id", ids);
    return writeError ? failed : ok;
  });
}

// Extra (non-official) stamps are tracked separately from the official 161 places.
export async function setExtraStamped(extraId: number, stamped: boolean): Promise<ActionResult> {
  if (!Number.isInteger(extraId) || typeof stamped !== "boolean") return failed;
  return asUser(async ({ supabase, user }) => {
    // ignoreDuplicates (ON CONFLICT DO NOTHING): an already-stamped row must not need an UPDATE
    // policy, which user_extra_stamps doesn't have.
    const { error } = stamped
      ? await supabase
          .from("user_extra_stamps")
          .upsert({ user_id: user.id, extra_id: extraId }, { ignoreDuplicates: true })
      : await supabase.from("user_extra_stamps").delete().eq("user_id", user.id).eq("extra_id", extraId);
    return error ? failed : ok;
  });
}
