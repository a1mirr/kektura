"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isValidDisplayName } from "@/lib/display-name";
import { friendsEnabled } from "@/lib/friends-flag";
import { logFriendsError } from "@/lib/log";
import { createRateLimiter } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Spec 0024 AC-14: like the stamp actions these never throw, a thrown error reaches the client as an opaque
// message. Every one checks the flag first (AC-15), then the session.

export type SendRequestResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "invalid_token" | "own_token" | "already_friends" | "already_pending" | "failed" | "disabled" };

type Failure = Extract<ActionResult, { ok: false }>;
type Session = { supabase: SupabaseClient<Database>; uid: string };

// Spec 0024 AC-13: one hourly budget per user for invites, requests and approvals.
const limiter = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

async function run<T>(name: string, limited: boolean, work: (session: Session) => Promise<T>): Promise<T | Failure> {
  if (!friendsEnabled()) return { ok: false, reason: "disabled" };
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return { ok: false, reason: "unauthorized" };
    if (limited && !limiter.allow(uid)) return { ok: false, reason: "failed" };
    return await work({ supabase, uid });
  } catch (error) {
    logFriendsError(name, error);
    return { ok: false, reason: "failed" };
  }
}

// Turns the outcome of a database call into an ActionResult; a failure is logged and revalidation skipped.
function finish(name: string, error: unknown): ActionResult {
  if (error) {
    logFriendsError(name, error);
    return { ok: false, reason: "failed" };
  }
  revalidatePath("/friends");
  return { ok: true };
}

export async function sendRequest(token: string): Promise<SendRequestResult> {
  return run("sendRequest", true, async ({ supabase }): Promise<SendRequestResult> => {
    const { data, error } = await supabase.rpc("send_request", { token });
    if (error) {
      logFriendsError("sendRequest", error);
      return { ok: false, reason: "failed" };
    }
    if (data === "ok") {
      revalidatePath("/friends");
      return { ok: true };
    }
    const known = ["unauthorized", "invalid_token", "own_token", "already_friends", "already_pending"] as const;
    const reason = known.find((r) => r === data);
    return { ok: false, reason: reason ?? "failed" };
  });
}

export async function approveRequest(requesterId: string): Promise<ActionResult> {
  return run("approveRequest", true, async ({ supabase }) => {
    const { error } = await supabase.rpc("approve_request", { requester_id: requesterId });
    return finish("approveRequest", error);
  });
}

export async function ignoreRequest(requesterId: string): Promise<ActionResult> {
  return run("ignoreRequest", true, async ({ supabase }) => {
    const { error } = await supabase.rpc("ignore_request", { requester_id: requesterId });
    return finish("ignoreRequest", error);
  });
}

export async function removeFriend(friendId: string): Promise<ActionResult> {
  return run("removeFriend", false, async ({ supabase }) => {
    const { error } = await supabase.rpc("remove_friend", { other_id: friendId });
    return finish("removeFriend", error);
  });
}

export async function setSharing(friendId: string, isSharing: boolean): Promise<ActionResult> {
  return run("setSharing", false, async ({ supabase }) => {
    const { error } = await supabase.rpc("set_sharing", { other_id: friendId, sharing: isSharing });
    return finish("setSharing", error);
  });
}

// The database generates the new token (at least 128 random bits), the old one stops working at once.
export async function regenerateInvite(): Promise<ActionResult> {
  return run("regenerateInvite", true, async ({ supabase }) => {
    const { error } = await supabase.rpc("regenerate_invite");
    return finish("regenerateInvite", error);
  });
}

export async function setDisplayName(name: string): Promise<ActionResult> {
  return run("setDisplayName", false, async ({ supabase }) => {
    if (!isValidDisplayName(name)) return { ok: false, reason: "failed" } as const;
    const { error } = await supabase.rpc("set_display_name", { name });
    return finish("setDisplayName", error);
  });
}
