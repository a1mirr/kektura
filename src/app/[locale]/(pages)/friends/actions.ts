"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/action-result";
import { flagOn } from "@/lib/feature-flags-server";
import { isUuid, isValidDisplayName, REQUEST_REFUSALS, type RequestRefusal } from "@/lib/friends-input";
import { logFriendsError } from "@/lib/log";
import { createRateLimiter } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Spec 0024 AC-14: like the stamp actions these never throw, a thrown error reaches the client as an opaque
// message. Every one checks the flag first (AC-15), then the session.

type Failure = Extract<ActionResult, { ok: false }>;
export type SendRequestResult = ActionResult | { ok: false; reason: RequestRefusal };

// Spec 0024 AC-13: one hourly budget per user for invites, requests and approvals.
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

async function run<T>(name: string, limited: boolean, work: (supabase: SupabaseClient<Database>) => Promise<T>): Promise<T | Failure> {
  if (!(await flagOn("friends"))) return { ok: false, reason: "disabled" };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { ok: false, reason: "unauthorized" };
    if (limited && !limiter.allow(data.user.id)) return { ok: false, reason: "failed" };
    return await work(supabase);
  } catch (error) {
    logFriendsError(name, error);
    return { ok: false, reason: "failed" };
  }
}

// Turns the outcome of a database call into an ActionResult, logging a failure. The page that called the action
// reloads itself with a redirect (see `done` in page.tsx), so nothing is revalidated here.
function finish(name: string, error: unknown): ActionResult {
  if (!error) return { ok: true };
  logFriendsError(name, error);
  return { ok: false, reason: "failed" };
}

const BAD_INPUT: Failure = { ok: false, reason: "failed" };

export async function sendRequest(token: string): Promise<SendRequestResult> {
  return run("sendRequest", true, async (supabase): Promise<SendRequestResult> => {
    const { data, error } = await supabase.rpc("send_request", { token });
    if (error || data === "ok") return finish("sendRequest", error);
    return { ok: false, reason: REQUEST_REFUSALS.find((r) => r === data) ?? "failed" };
  });
}

export async function approveRequest(requesterId: string): Promise<ActionResult> {
  return run("approveRequest", true, async (supabase) => {
    if (!isUuid(requesterId)) return BAD_INPUT;
    return finish("approveRequest", (await supabase.rpc("approve_request", { requester_id: requesterId })).error);
  });
}

export async function ignoreRequest(requesterId: string): Promise<ActionResult> {
  return run("ignoreRequest", true, async (supabase) => {
    if (!isUuid(requesterId)) return BAD_INPUT;
    return finish("ignoreRequest", (await supabase.rpc("ignore_request", { requester_id: requesterId })).error);
  });
}

export async function removeFriend(friendId: string): Promise<ActionResult> {
  return run("removeFriend", false, async (supabase) => {
    if (!isUuid(friendId)) return BAD_INPUT;
    return finish("removeFriend", (await supabase.rpc("remove_friend", { other_id: friendId })).error);
  });
}

export async function setSharing(friendId: string, isSharing: boolean): Promise<ActionResult> {
  return run("setSharing", false, async (supabase) => {
    if (!isUuid(friendId)) return BAD_INPUT;
    return finish("setSharing", (await supabase.rpc("set_sharing", { other_id: friendId, sharing: isSharing })).error);
  });
}

// The database generates the new token (at least 128 random bits), the old one stops working at once.
export async function regenerateInvite(): Promise<ActionResult> {
  return run("regenerateInvite", true, async (supabase) => finish("regenerateInvite", (await supabase.rpc("regenerate_invite")).error));
}

export async function setDisplayName(name: string): Promise<ActionResult> {
  return run("setDisplayName", false, async (supabase) => {
    if (!isValidDisplayName(name)) return BAD_INPUT;
    return finish("setDisplayName", (await supabase.rpc("set_display_name", { name })).error);
  });
}
