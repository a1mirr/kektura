// Spec 0039 AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-12 against the real local database (`npm run testdb:start`).
// The tests skip themselves when it isn't running, and fail where CI requires it (`REQUIRE_LOCAL_DB`, spec 0007 AC-12). They talk to PostgREST the way a browser could, as
// signed-in users and as an anonymous visitor, so they prove what a malicious client can and cannot do.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { databaseDecision, localSupabase, psql, requireDatabase } from "../e2e/local-db";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Person = { client: Client; id: string };

const RELATIONS = ["public.share_cards"];
let local: { url: string; anonKey: string } | undefined;

const connect = (): Client => createClient<Database>(local!.url, local!.anonKey, { auth: { persistSession: false } });

async function signUp(fullName?: string): Promise<Person> {
  const client = connect();
  const { data, error } = await client.auth.signUp({
    email: `share-${randomUUID()}@kektura.test`,
    password: "test-password-123",
    options: { data: fullName === undefined ? {} : { full_name: fullName } },
  });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { client, id: data.user.id };
}

// A valid card's arguments; `over` changes some.
const args = (over: Record<string, unknown> = {}) => ({
  p_show_name: false,
  p_stamps_done: 87,
  p_stamps_total: 161,
  p_percent: 54,
  p_km_done: 636.2,
  p_km_left: 541,
  p_stages_done: 14,
  p_stages_total: 27,
  p_ranges: [[0, 12.5], [20, 30]],
  ...over,
});

const create = async (who: Person, over: Record<string, unknown> = {}) =>
  (await who.client.rpc("create_share_card", args(over) as never)).data as unknown as string;

const tokenOf = (who: Person) => psql(`select token from public.share_cards where user_id = '${who.id}' order by created_at desc limit 1`);
const cardsOf = (who: Person) => Number(psql(`select count(*) from public.share_cards where user_id = '${who.id}'`));

let ana: Person;
let bob: Person;

beforeAll(async () => {
  if (databaseDecision(RELATIONS).action !== "run") return; // the tests skip or fail, whichever the environment asks for
  local = localSupabase();
  [ana, bob] = [await signUp("Ana Maria Kovacs"), await signUp()];
}, 60_000);

describe("spec 0039: share cards database rules", { timeout: 30_000 }, () => {
  it("AC-1: the flag `share` has a row and is declared (its mode is the tests' business, not this file's)", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(psql("select count(*) from public.feature_flags where key = 'share'")).toBe("1");
  });

  it("AC-2: a signed-in user creates a card, which holds numbers and walked ranges and nothing else", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(await create(ana)).toBe("ok");
    const columns = psql("select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'share_cards'");
    expect(columns).toBe("id,user_id,token,created_at,display_name,stamps_done,stamps_total,percent,km_done,km_left,stages_done,stages_total,ranges");
    expect(psql(`select percent || '|' || km_done || '|' || ranges::text from public.share_cards where user_id = '${ana.id}'`)).toBe("54|636.2|[[0, 12.5], [20, 30]]");
  });

  it("AC-3: the display name is copied from the profile only when asked for, and stays anonymous otherwise", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp("Cleo Cat");
    await create(cleo);
    expect(psql(`select coalesce(display_name, 'NULL') from public.share_cards where user_id = '${cleo.id}'`)).toBe("NULL");
    await create(cleo, { p_show_name: true });
    expect(psql(`select display_name from public.share_cards where user_id = '${cleo.id}' and display_name is not null`)).toBe("Cleo");
    // A later rename changes nothing on the card.
    await cleo.client.rpc("set_display_name", { name: "Renamed" });
    expect(psql(`select display_name from public.share_cards where user_id = '${cleo.id}' and display_name is not null`)).toBe("Cleo");
  });

  it("AC-4: the token is 128 random bits as hex and unique", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await create(ana);
    expect(tokenOf(ana)).toMatch(/^[0-9a-f]{32}$/);
    expect(psql("select count(*) from (select token from public.share_cards group by token having count(*) > 1) d")).toBe("0");
    expect(psql(`select count(*) from public.share_cards where token !~ '^[0-9a-f]{32}$'`)).toBe("0");
  });

  it("AC-4, AC-7: anyone, signed in or not, reads one card by its token, and the answer says nothing about whose it is", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await create(ana, { p_percent: 61 });
    const token = tokenOf(ana);
    for (const reader of [connect(), bob.client]) {
      const { data, error } = await reader.rpc("get_share_card", { p_token: token });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(Object.keys(data![0]).sort()).toEqual(
        ["created_at", "display_name", "km_done", "km_left", "percent", "ranges", "stages_done", "stages_total", "stamps_done", "stamps_total"],
      );
      expect(data![0].percent).toBe(61);
    }
    expect((await connect().rpc("get_share_card", { p_token: "0".repeat(32) })).data).toEqual([]);
    expect((await connect().rpc("get_share_card", { p_token: "' or true --" })).data).toEqual([]);
  });

  it("AC-7: the table cannot be listed or read by a visitor, and a user sees only their own cards", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    await create(ana);
    const anon = await connect().from("share_cards").select("*");
    expect(anon.error !== null || anon.data?.length === 0).toBe(true);
    expect((await bob.client.from("share_cards").select("*")).data).toEqual([]);
    const own = await ana.client.from("share_cards").select("id, token");
    expect(own.data!.length).toBe(cardsOf(ana));
  });

  it("AC-7: nobody writes the table directly, and nobody forges a card in another user's name", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const row = { user_id: ana.id, stamps_done: 1, stamps_total: 161, percent: 1, km_done: 1, km_left: 1, stages_done: 0, stages_total: 27, ranges: [] };
    expect((await bob.client.from("share_cards").insert(row)).error).not.toBeNull();
    expect((await ana.client.from("share_cards").insert(row)).error).not.toBeNull();
    expect((await connect().from("share_cards").insert(row)).error).not.toBeNull();
    const before = cardsOf(ana);
    await ana.client.from("share_cards").update({ percent: 100 }).eq("user_id", ana.id);
    await ana.client.from("share_cards").delete().eq("user_id", ana.id);
    expect(cardsOf(ana)).toBe(before);
    expect(psql(`select count(*) from public.share_cards where percent = 100 and user_id = '${ana.id}'`)).toBe("0");
  });

  it("AC-7: creating needs a session; deleting removes only the caller's own card", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect((await connect().rpc("create_share_card", args() as never)).error).not.toBeNull();
    await create(ana);
    const id = psql(`select id from public.share_cards where user_id = '${ana.id}' limit 1`);
    const before = cardsOf(ana);
    await bob.client.rpc("delete_share_card", { p_id: id });
    expect(cardsOf(ana)).toBe(before);
    expect((await connect().rpc("delete_share_card", { p_id: id })).error).not.toBeNull();
    expect(cardsOf(ana)).toBe(before);
    expect((await ana.client.rpc("delete_share_card", { p_id: id })).error).toBeNull();
    expect(cardsOf(ana)).toBe(before - 1);
  });

  it("AC-6: a deleted card's token answers nothing at once", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const dee = await signUp();
    await create(dee);
    const token = tokenOf(dee);
    const id = psql(`select id from public.share_cards where user_id = '${dee.id}'`);
    expect((await connect().rpc("get_share_card", { p_token: token })).data).toHaveLength(1);
    await dee.client.rpc("delete_share_card", { p_id: id });
    expect((await connect().rpc("get_share_card", { p_token: token })).data).toEqual([]);
  });

  it("AC-12: numbers and ranges that make no sense are refused and nothing is stored", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const eve = await signUp();
    const bad: Record<string, unknown>[] = [
      { p_percent: 101 },
      { p_percent: -1 },
      { p_stamps_done: 200 }, // more than the total
      { p_stamps_total: 0 },
      { p_km_done: -5 },
      { p_stages_done: 28 },
      { p_ranges: "nope" },
      { p_ranges: { a: 1 } },
      { p_ranges: [[5, 4]] },
      { p_ranges: [[1]] },
      { p_ranges: [["a", "b"]] },
      { p_ranges: [[0, 99999]] },
      { p_ranges: [1, 2] },
      { p_ranges: Array.from({ length: 201 }, (_, i) => [i, i + 0.5]) },
    ];
    for (const over of bad) expect(await create(eve, over), JSON.stringify(over)).toBe("invalid");
    expect(cardsOf(eve)).toBe(0);
  });

  it("AC-12: a user keeps at most 20 cards", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const fay = await signUp();
    for (let i = 0; i < 20; i++) expect(await create(fay)).toBe("ok");
    expect(await create(fay)).toBe("limit");
    expect(cardsOf(fay)).toBe(20);
    // Parallel calls do not get past it either: each would count the same rows without the lock.
    const hal = await signUp();
    const answers = await Promise.all(Array.from({ length: 30 }, () => create(hal)));
    expect(answers.filter((a) => a === "ok")).toHaveLength(20);
    expect(answers.filter((a) => a === "limit")).toHaveLength(10);
    expect(cardsOf(hal)).toBe(20);
    // Another user is not held back by it.
    expect(await create(bob)).toBe("ok");
  });

  it("AC-8: deleting the account deletes the user's cards", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const gus = await signUp();
    await create(gus);
    await create(gus);
    expect(cardsOf(gus)).toBe(2);
    const token = tokenOf(gus);
    psql(`delete from auth.users where id = '${gus.id}'`);
    expect(cardsOf(gus)).toBe(0);
    expect((await connect().rpc("get_share_card", { p_token: token })).data).toEqual([]);
  });

  it("AC-7: the functions are executable by the right roles only", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const grants = psql(
      `select p.proname || ':' || has_function_privilege('anon', p.oid, 'execute') || ':' || has_function_privilege('authenticated', p.oid, 'execute')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('create_share_card', 'delete_share_card', 'get_share_card') order by 1`,
    );
    expect(grants.split("\n")).toEqual(["create_share_card:false:true", "delete_share_card:false:true", "get_share_card:true:true"]);
    expect(psql("select count(*) from pg_class where oid = 'public.share_cards'::regclass and relrowsecurity")).toBe("1");
    expect(psql("select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '%share_card' and not prosecdef")).toBe("0");
    expect(psql("select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '%share_card' and (p.proconfig is null or not 'search_path=\"\"' = any(p.proconfig))")).toBe("0");
  });
});
