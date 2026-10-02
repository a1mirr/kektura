"use server";

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { logStampActionError, logStampActionInvalidInput, type StampAction, type StampStage } from "@/lib/log";

// See specs/0002-stamping.md; failures are logged per specs/0008-action-logging.md.
const MAX_PLACES = 200;
const ok: ActionResult = { ok: true };
const unauthorized: ActionResult = { ok: false, reason: "unauthorized" };
const failed: ActionResult = { ok: false, reason: "failed" };

type Session = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  // Logs a database error and gives the client its plain `failed`.
  fail: (stage: Exclude<StampStage, "exception">, error: unknown) => ActionResult;
};

// Runs `write` for the signed-in user and refreshes the dashboard after a successful write. Never
// throws: a thrown error reaches the client as an opaque message, so it is logged here instead.
// Everything runs under the user's RLS policies, so only their own stamps can ever be touched.
async function asUser(action: StampAction, write: (session: Session) => Promise<ActionResult>): Promise<ActionResult> {
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized;
    userId = user.id;
    const fail: Session["fail"] = (stage, error) => {
      logStampActionError(action, stage, error, user.id);
      return failed;
    };
    const result = await write({ supabase, user, fail });
    if (result.ok) revalidatePath("/[locale]/dashboard", "page");
    return result;
  } catch (error) {
    logStampActionError(action, "exception", error, userId);
    return failed;
  }
}

// Stamps (or unstamps) places, e.g. one place or a whole stage. Alternative stamps at the same place
// share a place_key, so stamping one stamps them all.
export async function setPlacesStamped(placeKeys: string[], stamped: boolean, date?: string): Promise<ActionResult> {
  if (
    !Array.isArray(placeKeys) ||
    placeKeys.length === 0 ||
    placeKeys.length > MAX_PLACES ||
    placeKeys.some((k) => typeof k !== "string" || k.length > 64) ||
    typeof stamped !== "boolean" ||
    (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date))
  ) {
    logStampActionInvalidInput("setPlacesStamped");
    return failed;
  }
  return asUser("setPlacesStamped", async ({ supabase, user, fail }) => {
    const { data: rows, error } = await supabase.from("checkpoints").select("id").in("place_key", placeKeys);
    if (error) return fail("read", error);
    if (!rows?.length) return failed;
    const ids = rows.map((r) => r.id);

    // ignoreDuplicates (ON CONFLICT DO NOTHING): re-stamping without a date keeps the original stamped_on date.
    // If a date is provided, we use onConflict to overwrite stamped_on.
    const { error: writeError } = stamped
      ? await supabase
          .from("user_stamps")
          .upsert(
            ids.map((id) => ({ user_id: user.id, checkpoint_id: id, ...(date ? { stamped_on: date } : {}) })),
            date ? { onConflict: "user_id, checkpoint_id" } : { ignoreDuplicates: true }
          )
      : await supabase.from("user_stamps").delete().eq("user_id", user.id).in("checkpoint_id", ids);
    return writeError ? fail("write", writeError) : ok;
  });
}

// Extra (non-official) stamps are tracked separately from the official 161 places.
export async function setExtraStamped(extraId: number, stamped: boolean, date?: string): Promise<ActionResult> {
  if (
    !Number.isInteger(extraId) ||
    typeof stamped !== "boolean" ||
    (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date))
  ) {
    logStampActionInvalidInput("setExtraStamped");
    return failed;
  }
  return asUser("setExtraStamped", async ({ supabase, user, fail }) => {
    // ignoreDuplicates (ON CONFLICT DO NOTHING): an already-stamped row must not need an UPDATE policy if no date is set.
    // If a date is provided, we use onConflict to overwrite stamped_on, which uses the UPDATE policy in 0007_edit_dates.sql.
    const { error } = stamped
      ? await supabase
          .from("user_extra_stamps")
          .upsert(
            { user_id: user.id, extra_id: extraId, ...(date ? { stamped_on: date } : {}) },
            date ? { onConflict: "user_id, extra_id" } : { ignoreDuplicates: true }
          )
      : await supabase.from("user_extra_stamps").delete().eq("user_id", user.id).eq("extra_id", extraId);
    return error ? fail("write", error) : ok;
  });
}
