"use server";

import type { ActionResult } from "@/lib/action-result";
import { getReferenceData } from "@/lib/dashboard-data";
import { flagOn } from "@/lib/feature-flags-server";
import { isUuid } from "@/lib/friends-input";
import { logShareError } from "@/lib/log";
import { buildPlaces, buildStages, stampedPlaceKeys, waivedPlaceKeys } from "@/lib/progress";
import { createRateLimiter } from "@/lib/rate-limit";
import { buildShareSnapshot } from "@/lib/share-card";
import { createClient } from "@/lib/supabase/server";
import stagesData from "../../../../scripts/data/okt-stages.json";

// Spec 0039 AC-12, AC-13: like the stamp and friends actions these never throw, a thrown error reaches the client as an
// opaque message. Each checks the flag first (AC-1), then the session.
export type CreateShareResult = ActionResult | { ok: false; reason: "limit" };

// Spec 0039 AC-12: one hourly budget per user for creating cards (the database caps how many a user keeps).
const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });

// Takes the numbers from the user's own stamps on the server, never from the client: the browser only says whether
// the name is shown.
export async function createShareCard(showName: boolean): Promise<CreateShareResult> {
  if (!(await flagOn("share"))) return { ok: false, reason: "disabled" };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, reason: "unauthorized" };
    if (!limiter.allow(data.user.id)) return { ok: false, reason: "failed" };

    // The stamps are read here and not through `loadDashboardData`, which turns a failed read into "no stamps": a card made from
    // that would freeze 0 % for good (AC-10). A failed read is a failed action instead.
    const [reference, { data: stamps, error: stampsError }] = await Promise.all([
      getReferenceData(),
      supabase.from("user_stamps").select("checkpoint_id, stamped_on"),
    ]);
    if (stampsError) throw stampsError;
    const { checkpoints } = reference;
    const places = buildPlaces(checkpoints);
    const stamped = stampedPlaceKeys(places, stamps);
    const snapshot = buildShareSnapshot(places, buildStages(places, stagesData.stages), stamped, waivedPlaceKeys(places, stamped));

    const { data: outcome, error } = await supabase.rpc("create_share_card", {
      p_show_name: showName === true,
      p_stamps_done: snapshot.stampsDone,
      p_stamps_total: snapshot.stampsTotal,
      p_percent: snapshot.percent,
      p_km_done: snapshot.kmDone,
      p_km_left: snapshot.kmLeft,
      p_stages_done: snapshot.stagesDone,
      p_stages_total: snapshot.stagesTotal,
      p_ranges: snapshot.ranges,
    });
    if (error) {
      logShareError("createShareCard", error);
      return { ok: false, reason: "failed" };
    }
    if (outcome === "ok") return { ok: true };
    if (outcome === "limit") return { ok: false, reason: "limit" };
    if (outcome === "unauthorized") return { ok: false, reason: "unauthorized" };
    logShareError("createShareCard", { message: `the database answered ${String(outcome).slice(0, 20)}` });
    return { ok: false, reason: "failed" };
  } catch (error) {
    logShareError("createShareCard", error, "exception");
    return { ok: false, reason: "failed" };
  }
}

export async function deleteShareCard(id: string): Promise<ActionResult> {
  if (!(await flagOn("share"))) return { ok: false, reason: "disabled" };
  try {
    if (!isUuid(id)) return { ok: false, reason: "failed" };
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, reason: "unauthorized" };
    const { error } = await supabase.rpc("delete_share_card", { p_id: id });
    if (error) {
      logShareError("deleteShareCard", error);
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch (error) {
    logShareError("deleteShareCard", error, "exception");
    return { ok: false, reason: "failed" };
  }
}
