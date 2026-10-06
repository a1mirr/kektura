// Spec 0002 (row level security under the stamp actions), spec 0016 AC-17 and AC-18 (set_stamp_dates) and spec 0006 AC-1 (what the seeds leave in the test
// database), against the real local database (`npm run testdb:start`). The tests skip themselves when it isn't
// running, and fail where CI requires it (`REQUIRE_LOCAL_DB`, spec 0007 AC-12); CI's end-to-end job runs them. They talk to PostgREST the way a browser could, as signed-in users and
// as an anonymous visitor, so they prove what a malicious client can and cannot do.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { databaseDecision, localSupabase, psql, requireDatabase } from "../e2e/local-db";
import type { Database } from "@/lib/supabase/database.types";

type Person = { client: SupabaseClient<Database>; id: string };

const RELATIONS = ["public.checkpoints", "public.user_stamps", "public.user_extra_stamps"];
let local: { url: string; anonKey: string } | undefined;
let ana: Person;
let bob: Person;

const connect = () => createClient<Database>(local!.url, local!.anonKey, { auth: { persistSession: false } });

async function signUp(): Promise<Person> {
  const client = connect();
  const { data, error } = await client.auth.signUp({ email: `rls-${randomUUID()}@kektura.test`, password: "test-password-123" });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { client, id: data.user.id };
}

beforeAll(async () => {
  if (databaseDecision(RELATIONS).action !== "run") return; // the tests skip or fail, whichever the environment asks for
  local = localSupabase();
  [ana, bob] = [await signUp(), await signUp()];
}, 60_000);

const rows = (sql: string) => psql(sql);

describe("spec 0002: row level security of the stamp tables", () => {
  it("every policy is for authenticated users only and compares the row's user_id with (select auth.uid())", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const policies = rows(
      "select tablename || '|' || cmd || '|' || roles::text || '|' || coalesce(qual, with_check) from pg_policies where schemaname = 'public' and tablename in ('user_stamps', 'user_extra_stamps') order by 1",
    ).split("\n");
    expect(policies.length).toBe(8); // select, insert, update, delete on both tables
    for (const policy of policies) {
      expect(policy).toMatch(/\|\{authenticated\}\|\(\( SELECT auth\.uid\(\) AS uid\) = user_id\)$/);
    }
    expect(rows("select count(*) from pg_class where oid in ('public.user_stamps'::regclass, 'public.user_extra_stamps'::regclass) and relrowsecurity")).toBe("2");
  });

  it("AC-3, AC-4, AC-8: a user reads, writes, updates and deletes only their own stamps", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const stamp = await ana.client.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 1 });
    const extra = await ana.client.from("user_extra_stamps").insert({ user_id: ana.id, extra_id: 1 });
    expect([stamp.error, extra.error]).toEqual([null, null]);

    // Bob sees nothing of Ana's, and cannot forge a stamp in her name.
    expect((await bob.client.from("user_stamps").select("*")).data).toEqual([]);
    expect((await bob.client.from("user_extra_stamps").select("*")).data).toEqual([]);
    expect((await bob.client.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 2 })).error).not.toBeNull();
    expect((await bob.client.from("user_extra_stamps").insert({ user_id: ana.id, extra_id: 2 })).error).not.toBeNull();

    // Updates and deletes of her rows affect nothing (the rows are invisible to him).
    await bob.client.from("user_stamps").update({ stamped_on: "2000-01-01" }).eq("user_id", ana.id);
    await bob.client.from("user_extra_stamps").update({ stamped_on: "2000-01-01" }).eq("user_id", ana.id);
    await bob.client.from("user_stamps").delete().eq("user_id", ana.id);
    await bob.client.from("user_extra_stamps").delete().eq("user_id", ana.id);
    expect(rows(`select count(*) from user_stamps where user_id = '${ana.id}' and stamped_on <> '2000-01-01'`)).toBe("1");
    expect(rows(`select count(*) from user_extra_stamps where user_id = '${ana.id}' and stamped_on <> '2000-01-01'`)).toBe("1");

    // She can still change and remove her own.
    expect((await ana.client.from("user_stamps").update({ stamped_on: "2026-01-02" }).eq("checkpoint_id", 1).select()).data).toHaveLength(1);
    expect((await ana.client.from("user_stamps").delete().eq("checkpoint_id", 1).select()).data).toHaveLength(1);
    expect((await ana.client.from("user_extra_stamps").delete().eq("extra_id", 1).select()).data).toHaveLength(1);
  });

  it("an anonymous visitor cannot read or write stamps", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const anon = connect();
    const read = await anon.from("user_stamps").select("*");
    expect(read.error !== null || read.data?.length === 0).toBe(true);
    expect((await anon.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 3 })).error).not.toBeNull();
    expect((await anon.from("user_extra_stamps").insert({ user_id: ana.id, extra_id: 3 })).error).not.toBeNull();
  });
});

describe("spec 0016: set_stamp_dates (many dates in one transaction)", { timeout: 30_000 }, () => {
  const RETIRED = "OKT_RETIRED_NYIRJESI"; // retired on 2014-11-21
  const dates = (person: Person) =>
    rows(
      `select coalesce(string_agg(k || '=' || d, ',' order by k), '') from (
         select c.place_key || '#' || c.id as k, s.stamped_on::text as d from user_stamps s join checkpoints c on c.id = s.checkpoint_id where s.user_id = '${person.id}'
         union all select 'extra#' || extra_id, stamped_on::text from user_extra_stamps where user_id = '${person.id}') t`,
    );
  // Stamps written the way the database sees them, not through the function under test.
  const stamp = (person: Person, placeKeys: string[], extraIds: number[], date: string) => {
    const keys = placeKeys.map((k) => `'${k}'`).join(",") || "null";
    rows(
      `insert into user_stamps (user_id, checkpoint_id, stamped_on) select '${person.id}', id, '${date}' from checkpoints where place_key in (${keys});
       insert into user_extra_stamps (user_id, extra_id, stamped_on) select '${person.id}', e.id, '${date}' from extra_stamps e where e.id = any (array[${extraIds.join(",") || "null"}]::int[]);`,
    );
  };
  const call = (person: Person, placeKeys: string[], extraIds: number[], date: string | null) =>
    person.client.rpc("set_stamp_dates", { place_keys: placeKeys, extra_ids: extraIds, new_date: date as string });

  it("AC-17: changes every variant of the places and the extra stamps of the caller, and nothing of anybody else's", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const [cleo, dan] = [await signUp(), await signUp()];
    stamp(cleo, ["OKTPH_03", "OKTPH_07", "OKTPH_09"], [1, 2], "2025-01-01");
    stamp(dan, ["OKTPH_03", "OKTPH_07"], [1], "2020-01-01");
    const danBefore = dates(dan);
    const { data, error } = await call(cleo, ["OKTPH_03", "OKTPH_07"], [1], "2026-03-04");
    expect([data, error]).toEqual([true, null]);
    const after = dates(cleo).split(",");
    expect(after.filter((e) => e.endsWith("=2026-03-04")).map((e) => e.split("#")[0]).sort()).toEqual(["OKTPH_03", "OKTPH_03", "OKTPH_07", "OKTPH_07", "extra"]); // both variants of each place
    expect(after.filter((e) => e.endsWith("=2025-01-01")).map((e) => e.split("#")[0]).sort()).toEqual(["OKTPH_09", "OKTPH_09", "extra"]); // the others keep their date
    expect(dates(dan)).toBe(danBefore);
  });

  it("AC-17: a place or an extra stamp the caller has not stamped fails the whole request and creates nothing (a stamp of somebody else's does not count)", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const [cleo, dan] = [await signUp(), await signUp()];
    stamp(cleo, ["OKTPH_03", "OKTPH_07"], [1], "2025-01-01");
    stamp(dan, ["OKTPH_09"], [2], "2025-01-01");
    const before = dates(cleo);
    for (const [places, extras] of [
      [["OKTPH_03", "OKTPH_09"], [1]], // a place that is not stamped
      [["OKTPH_03"], [1, 2]], // an extra stamp that is not collected
      [["OKTPH_03", "NO_SUCH_PLACE"], []], // a place that does not exist
      [["OKTPH_09"], []], // somebody else's stamp
    ] as [string[], number[]][]) {
      const { data, error } = await call(cleo, places, extras, "2026-03-04");
      expect([data, error], JSON.stringify([places, extras])).toEqual([false, null]);
      expect(dates(cleo)).toBe(before);
    }
    expect(dates(dan)).toBe(dates(dan).replaceAll("2026-03-04", "2025-01-01")); // nobody got a new date
  });

  it("AC-18: a retired stamp may only get a date before the day it retired; a request with one that is too late changes nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp();
    stamp(cleo, ["OKTPH_03", RETIRED], [1], "2014-01-01");
    const before = dates(cleo);
    for (const late of ["2014-11-21", "2026-03-04"]) {
      expect((await call(cleo, ["OKTPH_03", RETIRED], [1], late)).data, late).toBe(false);
      expect(dates(cleo)).toBe(before);
    }
    expect((await call(cleo, ["OKTPH_03", RETIRED], [1], "2014-11-20")).data).toBe(true);
    expect(dates(cleo).split(",").every((e) => e.endsWith("=2014-11-20"))).toBe(true);
    expect((await call(cleo, ["OKTPH_03"], [], "2026-03-04")).data).toBe(true); // without the retired stamp any date goes
  });

  it("AC-17: nothing, more than 500, or no date is refused, and so is a caller who is not signed in", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp();
    stamp(cleo, ["OKTPH_03"], [], "2025-01-01");
    const before = dates(cleo);
    const many = Array.from({ length: 501 }, (_, i) => `K${i}`);
    expect((await call(cleo, [], [], "2026-03-04")).data).toBe(false);
    expect((await call(cleo, ["OKTPH_03", ...many], [], "2026-03-04")).data).toBe(false);
    expect((await call(cleo, ["OKTPH_03"], [], null)).data).toBe(false);
    expect(dates(cleo)).toBe(before);
    const anon = await connect().rpc("set_stamp_dates", { place_keys: ["OKTPH_03"], extra_ids: [], new_date: "2026-03-04" });
    expect(anon.error).not.toBeNull();
    expect(rows("select has_function_privilege('anon', 'public.set_stamp_dates(text[], integer[], date)', 'execute') || ',' || has_function_privilege('authenticated', 'public.set_stamp_dates(text[], integer[], date)', 'execute')")).toBe("false,true");
    expect(rows("select prosecdef from pg_proc where proname = 'set_stamp_dates'")).toBe("f"); // security invoker: row level security applies
  });
});

describe("spec 0006: the test database", () => {
  it("AC-1: the migrations and both seeds leave 220 checkpoints (161 places), one retired stamp and 72 extra stamps", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(
      rows(
        "select count(*) filter (where retired_on is null) || ',' || count(distinct place_key) filter (where retired_on is null) || ',' || count(*) filter (where retired_on is not null) from checkpoints",
      ),
    ).toBe("220,161,1");
    expect(rows("select count(*) from extra_stamps")).toBe("72");
  });
});
