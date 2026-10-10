"use server";

import type { User } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { logStampActionError, logStampActionInvalidInput, logStampActionRefused, type StampAction, type StampStage } from "@/lib/log";
import { MAX_BULK_STAMPS } from "@/lib/bulk-dates";
import { isCalendarDate, isValidStampDate } from "@/lib/stamp-date";

const MAX_PLACES = 200;
const ok: ActionResult = { ok: true };
const unauthorized: ActionResult = { ok: false, reason: "unauthorized" };
const failed: ActionResult = { ok: false, reason: "failed" };

type Session = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  fail: (stage: Exclude<StampStage, "exception">, error: unknown) => ActionResult;
};

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
    // refresh() re-renders the page in this response. Not revalidatePath: it would also expire the dashboard's cached
    // reference data.
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

// The `stamped_on` for rows that are created now. Optional: without one the database default (the server's day)
// applies. A real date outside the valid range is ignored rather than refused: a client can't know how far its clock
// is off, and stamping must not stop working because of it.
const dateForNewRows = (date: string | undefined) => (date !== undefined && isValidStampDate(date) ? date : undefined);

const retiredDateRefused = (rows: { retired_on: string | null }[], date: string | undefined): boolean => {
  const retiredOn = rows.map((r) => r.retired_on).filter((d): d is string => d != null);
  if (retiredOn.length === 0) return false;
  if (retiredOn.length !== rows.length) return true;
  return date === undefined || !isValidStampDate(date) || retiredOn.some((on) => date >= on);
};

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
    const { data: rows, error } = await supabase.from("checkpoints").select("id, retired_on").in("place_key", placeKeys);
    if (error) return fail("read", error);
    if (!rows?.length) return failed;
    if (stamped && retiredDateRefused(rows, date)) {
      logStampActionInvalidInput("setPlacesStamped");
      return failed;
    }
    const ids = rows.map((r) => r.id);

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

export async function setStampDate(placeKeys: string[], date: string): Promise<ActionResult> {
  if (!validPlaceKeys(placeKeys) || !isValidStampDate(date)) {
    logStampActionInvalidInput("setStampDate");
    return failed;
  }
  return asUser("setStampDate", async ({ supabase, user, fail }) => {
    const { data: rows, error } = await supabase.from("checkpoints").select("id, retired_on").in("place_key", placeKeys);
    if (error) return fail("read", error);
    if (!rows?.length) return failed;
    if (retiredDateRefused(rows, date)) {
      logStampActionInvalidInput("setStampDate");
      return failed;
    }

    const { data: updated, error: writeError } = await supabase
      .from("user_stamps")
      .update({ stamped_on: date })
      .eq("user_id", user.id)
      .in("checkpoint_id", rows.map((r) => r.id))
      .select("checkpoint_id");
    if (writeError) return fail("write", writeError);
    return updated?.length ? ok : failed;
  });
}

// A stamped row is re-dated, one that is not stamped yet is stamped with the date. One database function does it in
// one transaction (migrations 0080 and 0137); it answers false, and changes nothing, when a place or extra stamp does
// not exist or a retired stamp would get a date from its retirement day on.
export async function setStampDates(placeKeys: string[], extraIds: number[], date: string): Promise<ActionResult> {
  if (
    !Array.isArray(placeKeys) ||
    !Array.isArray(extraIds) ||
    placeKeys.length + extraIds.length < 1 ||
    placeKeys.length + extraIds.length > MAX_BULK_STAMPS ||
    !placeKeys.every((k) => typeof k === "string" && k.length <= 64) ||
    !extraIds.every((id) => Number.isInteger(id)) ||
    !isValidStampDate(date)
  ) {
    logStampActionInvalidInput("setStampDates");
    return failed;
  }
  return asUser("setStampDates", async ({ supabase, fail }) => {
    const { data, error } = await supabase.rpc("set_stamp_dates", { place_keys: placeKeys, extra_ids: extraIds, new_date: date });
    if (error) return fail("write", error);
    if (data !== true) {
      logStampActionRefused("setStampDates");
      return failed;
    }
    return ok;
  });
}

export async function setExtraStamped(extraId: number, stamped: boolean, date?: string): Promise<ActionResult> {
  if (!Number.isInteger(extraId) || typeof stamped !== "boolean" || (date !== undefined && !isCalendarDate(date))) {
    logStampActionInvalidInput("setExtraStamped");
    return failed;
  }
  const stampedOn = dateForNewRows(date);
  return asUser("setExtraStamped", async ({ supabase, user, fail }) => {
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

// Update only; needs the UPDATE policy of migration 0007.
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
