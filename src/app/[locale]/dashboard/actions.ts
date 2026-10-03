"use server";

import type { User } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { logStampActionError, logStampActionInvalidInput, type StampAction, type StampStage } from "@/lib/log";
import { isCalendarDate, isValidStampDate } from "@/lib/stamp-date";

// See specs/0002-stamping.md; failures are logged per specs/0008-action-logging.md; dates per
// specs/0016-stamp-dates.md.
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
    // refresh() re-renders the page in this response. Not revalidatePath: it would also expire the
    // dashboard's cached reference data, which is the point of spec 0009 AC-1.
    if (result.ok) refresh();
    return result;
  } catch (error) {
    logStampActionError(action, "exception", error, userId);
    return failed;
  }
}

const validPlaceKeys = (keys: unknown): keys is string[] =>
  Array.isArray(keys) &&
  keys.length > 0 &&
  keys.length <= MAX_PLACES &&
  keys.every((k) => typeof k === "string" && k.length <= 64);

// The `stamped_on` for rows that are created now. Optional: without one the database default (the
// server's day) applies. A real date outside the valid range is ignored rather than refused: a client
// can't know how far its clock is off, and stamping must not stop working because of it (0016 AC-3).
const dateForNewRows = (date: string | undefined) => (date !== undefined && isValidStampDate(date) ? date : undefined);

// Stamps (or unstamps) places, e.g. one place or a whole stage. Alternative stamps at the same place
// share a place_key, so stamping one stamps them all. `date` is the stamp date of rows that are created.
export async function setPlacesStamped(placeKeys: string[], stamped: boolean, date?: string): Promise<ActionResult> {
  if (
    !validPlaceKeys(placeKeys) ||
    typeof stamped !== "boolean" ||
    (date !== undefined && !isCalendarDate(date))
  ) {
    logStampActionInvalidInput("setPlacesStamped");
    return failed;
  }
  const stampedOn = dateForNewRows(date);
  return asUser("setPlacesStamped", async ({ supabase, user, fail }) => {
    const { data: rows, error } = await supabase.from("checkpoints").select("id").in("place_key", placeKeys);
    if (error) return fail("read", error);
    if (!rows?.length) return failed;
    const ids = rows.map((r) => r.id);

    // ignoreDuplicates (ON CONFLICT DO NOTHING): re-stamping keeps the original stamped_on date.
    const { error: writeError } = stamped
      ? await supabase
          .from("user_stamps")
          .upsert(
            ids.map((id) => ({ user_id: user.id, checkpoint_id: id, ...(stampedOn ? { stamped_on: stampedOn } : {}) })),
            { ignoreDuplicates: true },
          )
      : await supabase.from("user_stamps").delete().eq("user_id", user.id).in("checkpoint_id", ids);
    return writeError ? fail("write", writeError) : ok;
  });
}

// Changes the date of places the user has already stamped (every variant of each place). Update only:
// it never creates a stamp, and it fails when there was nothing to update (0016 AC-4).
export async function setStampDate(placeKeys: string[], date: string): Promise<ActionResult> {
  if (!validPlaceKeys(placeKeys) || !isValidStampDate(date)) {
    logStampActionInvalidInput("setStampDate");
    return failed;
  }
  return asUser("setStampDate", async ({ supabase, user, fail }) => {
    const { data: rows, error } = await supabase.from("checkpoints").select("id").in("place_key", placeKeys);
    if (error) return fail("read", error);
    if (!rows?.length) return failed;

    const { data: updated, error: writeError } = await supabase
      .from("user_stamps")
      .update({ stamped_on: date })
      .eq("user_id", user.id)
      .in("checkpoint_id", rows.map((r) => r.id))
      .select("checkpoint_id");
    if (writeError) return fail("write", writeError);
    return updated?.length ? ok : failed; // not stamped: nothing to date
  });
}

// Extra (non-official) stamps are tracked separately from the official 161 places.
export async function setExtraStamped(extraId: number, stamped: boolean, date?: string): Promise<ActionResult> {
  if (!Number.isInteger(extraId) || typeof stamped !== "boolean" || (date !== undefined && !isCalendarDate(date))) {
    logStampActionInvalidInput("setExtraStamped");
    return failed;
  }
  const stampedOn = dateForNewRows(date);
  return asUser("setExtraStamped", async ({ supabase, user, fail }) => {
    // ignoreDuplicates (ON CONFLICT DO NOTHING): stamping again keeps the original date.
    const { error } = stamped
      ? await supabase
          .from("user_extra_stamps")
          .upsert(
            { user_id: user.id, extra_id: extraId, ...(stampedOn ? { stamped_on: stampedOn } : {}) },
            { ignoreDuplicates: true },
          )
      : await supabase.from("user_extra_stamps").delete().eq("user_id", user.id).eq("extra_id", extraId);
    return error ? fail("write", error) : ok;
  });
}

// Changes the date of an extra stamp the user has already collected. Update only (0016 AC-4); needs the
// UPDATE policy of migration 0007.
export async function setExtraStampDate(extraId: number, date: string): Promise<ActionResult> {
  if (!Number.isInteger(extraId) || !isValidStampDate(date)) {
    logStampActionInvalidInput("setExtraStampDate");
    return failed;
  }
  return asUser("setExtraStampDate", async ({ supabase, user, fail }) => {
    const { data: updated, error } = await supabase
      .from("user_extra_stamps")
      .update({ stamped_on: date })
      .eq("user_id", user.id)
      .eq("extra_id", extraId)
      .select("extra_id");
    if (error) return fail("write", error);
    return updated?.length ? ok : failed;
  });
}
