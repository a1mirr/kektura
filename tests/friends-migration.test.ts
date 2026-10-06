// Spec 0024 AC-1, AC-2, AC-4 to AC-6, AC-9, AC-10, AC-12 against the real local database (`npm run testdb:start`).
// The tests skip themselves when it isn't running, and fail where CI requires it (`REQUIRE_LOCAL_DB`, spec 0007 AC-12). They talk to PostgREST the way a browser could, as
// signed-in users, so they prove what a malicious client can and cannot do.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { databaseDecision, localSupabase, psql, requireDatabase } from "../e2e/local-db";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Person = { client: Client; id: string };

const RELATIONS = ["public.profiles", "public.friendships"];
let local: { url: string; anonKey: string } | undefined;

const connect = (): Client => createClient<Database>(local!.url, local!.anonKey, { auth: { persistSession: false } });

async function signUp(fullName?: string): Promise<Person> {
  const client = connect();
  const { data, error } = await client.auth.signUp({
    email: `friends-${randomUUID()}@kektura.test`,
    password: "test-password-123",
    options: { data: fullName === undefined ? {} : { full_name: fullName } },
  });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { client, id: data.user.id };
}

const rpc = async (who: Person, name: string, args: Record<string, unknown> = {}) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (who.client.rpc as any)(name, args) as Promise<{ data: any; error: { message: string } | null }>;

const tokenOf = async (who: Person) => (await rpc(who, "get_my_invite_token")).data as string;
const stampsSeenBy = async (who: Person) =>
  ((await rpc(who, "get_friend_stamps")).data as { friend_id: string; checkpoint_id: number }[]).map(
    (s) => `${s.friend_id}:${s.checkpoint_id}`,
  );

let ana: Person;
let bob: Person;
let cleo: Person;

beforeAll(async () => {
  if (databaseDecision(RELATIONS).action !== "run") return; // the tests skip or fail, whichever the environment asks for
  local = localSupabase();
  [ana, bob, cleo] = [await signUp("Ana Maria Kovacs"), await signUp(), await signUp("Cleo")];
}, 60_000); // `supabase status` and three sign-ups, while the whole suite runs in parallel

describe("spec 0024: friends database rules", () => {
  it("AC-1: the display name defaults to the first name, with a fallback, and stays 1 to 40 characters", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const names = async (who: Person) =>
      (await who.client.from("profiles").select("display_name").eq("id", who.id).single()).data?.display_name;
    expect(await names(ana)).toBe("Ana");
    expect(await names(bob)).toMatch(/^Hiker [0-9a-f]{6}$/);
    // A name that is empty after cleaning must not break sign-up: the fallback is used.
    const odd = await signUp("\t \u0007 ");
    expect(await names(odd)).toMatch(/^Hiker /);

    expect((await rpc(ana, "set_display_name", { name: "  Anna  " })).error).toBeNull();
    expect(await names(ana)).toBe("Anna");
    for (const bad of ["", "   ", "x".repeat(41), "bad\nname"]) {
      expect((await rpc(ana, "set_display_name", { name: bad })).error, JSON.stringify(bad)).not.toBeNull();
    }
    expect(await names(ana)).toBe("Anna");
  });

  it("AC-12: nobody can write profiles or friendships directly", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    // The attack: make yourself an accepted friend of someone else without their approval.
    const forged = await bob.client.from("friendships").insert({ user_id: bob.id, friend_id: ana.id, status: "accepted" });
    expect(forged.error).not.toBeNull();
    const reversed = await bob.client.from("friendships").insert({ user_id: ana.id, friend_id: bob.id, status: "accepted" });
    expect(reversed.error).not.toBeNull();
    expect(await stampsSeenBy(bob)).toEqual([]);

    expect((await bob.client.from("profiles").update({ display_name: "Hacked" }).eq("id", bob.id)).error).not.toBeNull();
    expect((await bob.client.from("profiles").update({ invite_token: "0".repeat(32) }).eq("id", bob.id)).error).not.toBeNull();
    expect((await bob.client.from("friendships").delete().eq("user_id", bob.id)).error).not.toBeNull();
  });

  it("AC-12: the invite token cannot be read through the table, only by its owner through a function", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect((await ana.client.from("profiles").select("invite_token").eq("id", ana.id)).error).not.toBeNull();
    expect((await ana.client.from("profiles").select("*").eq("id", ana.id)).error).not.toBeNull();
    expect(await tokenOf(ana)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("AC-12: anonymous callers cannot use any friends function", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const anon = { client: connect(), id: "" };
    const zero = "00000000-0000-0000-0000-000000000000";
    const calls: [string, Record<string, unknown>][] = [
      ["send_request", { token: "abc" }],
      ["approve_request", { requester_id: zero }],
      ["ignore_request", { requester_id: zero }],
      ["remove_friend", { other_id: zero }],
      ["set_sharing", { other_id: zero, sharing: true }],
      ["get_friend_stamps", {}],
      ["get_my_invite_token", {}],
      ["regenerate_invite", {}],
      ["set_display_name", { name: "x" }],
      ["get_inviter_info", { token: await tokenOf(ana) }],
    ];
    for (const [name, args] of calls) expect((await rpc(anon, name, args)).error, name).not.toBeNull();
    expect((await anon.client.from("profiles").select("id")).error ?? null).not.toBeNull();
  });

  it("AC-12: nobody but the database itself may execute the sign-up trigger function", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    // PostgREST hides trigger functions whatever their grants, so the privilege itself is what is checked.
    for (const role of ["anon", "authenticated"]) {
      expect(psql(`select has_function_privilege('${role}', 'public.handle_new_user()', 'execute')`), role).toBe("f");
    }
  });

  it("AC-3: an invite link resolves to the inviter's name and whether it is yours; unknown tokens to nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const token = await tokenOf(ana);
    expect((await rpc(bob, "get_inviter_info", { token })).data).toEqual([{ display_name: "Anna", is_own: false }]);
    expect((await rpc(ana, "get_inviter_info", { token })).data).toEqual([{ display_name: "Anna", is_own: true }]);
    expect((await rpc(bob, "get_inviter_info", { token: "0".repeat(32) })).data).toEqual([]);
    expect((await rpc(bob, "send_request", { token: "0".repeat(32) })).data).toBe("invalid_token");
    expect((await rpc(ana, "send_request", { token })).data).toBe("own_token");
  });

  it("AC-4, AC-5, AC-9, AC-10: request, approval, sharing switch and removal", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect((await ana.client.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 1 })).error).toBeNull();
    expect((await bob.client.from("user_stamps").insert({ user_id: bob.id, checkpoint_id: 2 })).error).toBeNull();

    // A request alone shares nothing, in either direction, and only the inviter has anything to approve.
    expect((await rpc(bob, "send_request", { token: await tokenOf(ana) })).data).toBe("ok");
    expect((await rpc(bob, "send_request", { token: await tokenOf(ana) })).data).toBe("already_pending");
    expect((await rpc(ana, "send_request", { token: await tokenOf(bob) })).data).toBe("incoming_pending");
    expect(await stampsSeenBy(bob)).toEqual([]);
    expect(await stampsSeenBy(ana)).toEqual([]);
    // The requester cannot approve their own request.
    await rpc(bob, "approve_request", { requester_id: bob.id });
    await rpc(bob, "approve_request", { requester_id: ana.id });
    expect(await stampsSeenBy(ana)).toEqual([]);

    // Someone else's approval or ignore changes nothing.
    await rpc(cleo, "approve_request", { requester_id: bob.id });
    expect(await stampsSeenBy(ana)).toEqual([]);

    await rpc(ana, "approve_request", { requester_id: bob.id });
    expect(await stampsSeenBy(bob)).toEqual([`${ana.id}:1`]);
    expect(await stampsSeenBy(ana)).toEqual([`${bob.id}:2`]);
    expect((await rpc(cleo, "send_request", { token: await tokenOf(ana) })).data).toBe("ok");
    expect(await stampsSeenBy(cleo)).toEqual([]);
    expect((await rpc(bob, "send_request", { token: await tokenOf(ana) })).data).toBe("already_friends");

    // AC-9: the switch is per side. Ana stops sharing: Bob sees nothing of her, she still sees him.
    await rpc(ana, "set_sharing", { other_id: bob.id, sharing: false });
    expect(await stampsSeenBy(bob)).toEqual([]);
    expect(await stampsSeenBy(ana)).toEqual([`${bob.id}:2`]);
    // Bob cannot turn Ana's switch back on.
    await rpc(bob, "set_sharing", { other_id: ana.id, sharing: true });
    expect(await stampsSeenBy(bob)).toEqual([]);
    await rpc(ana, "set_sharing", { other_id: bob.id, sharing: true });
    expect(await stampsSeenBy(bob)).toEqual([`${ana.id}:1`]);

    // AC-10: either side can remove; access ends in both directions, a new request needs a new approval.
    await rpc(bob, "remove_friend", { other_id: ana.id });
    expect(await stampsSeenBy(bob)).toEqual([]);
    expect(await stampsSeenBy(ana)).toEqual([]);
    expect((await rpc(bob, "send_request", { token: await tokenOf(ana) })).data).toBe("ok");
    expect(await stampsSeenBy(bob)).toEqual([]);
  });

  it("AC-2, AC-6: regenerating the link invalidates the old one; friends never see the new one", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const old = await tokenOf(ana);
    expect((await rpc(ana, "regenerate_invite")).error).toBeNull();
    const fresh = await tokenOf(ana);
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh).not.toBe(old);
    expect((await rpc(cleo, "get_inviter_info", { token: old })).data).toEqual([]);
    // Bob has a pending request with Ana: he may see her name, not her token.
    expect((await bob.client.from("profiles").select("display_name").eq("id", ana.id)).data).toEqual([{ display_name: "Anna" }]);
    expect((await bob.client.from("profiles").select("invite_token").eq("id", ana.id)).error).not.toBeNull();
    // Strangers see no profile at all.
    const dan = await signUp("Dan");
    expect((await dan.client.from("profiles").select("id").eq("id", ana.id)).data).toEqual([]);
  });
});
