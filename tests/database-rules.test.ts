// They talk to PostgREST the way a browser could, as signed-in users and as an anonymous visitor, so they prove what
// a malicious client can and cannot do.
import { execFileSync, spawn } from "node:child_process";
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
  if (databaseDecision(RELATIONS).action !== "run") return;
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
    expect(policies.length).toBe(8);
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

    expect((await bob.client.from("user_stamps").select("*")).data).toEqual([]);
    expect((await bob.client.from("user_extra_stamps").select("*")).data).toEqual([]);
    expect((await bob.client.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 2 })).error).not.toBeNull();
    expect((await bob.client.from("user_extra_stamps").insert({ user_id: ana.id, extra_id: 2 })).error).not.toBeNull();

    await bob.client.from("user_stamps").update({ stamped_on: "2000-01-01" }).eq("user_id", ana.id);
    await bob.client.from("user_extra_stamps").update({ stamped_on: "2000-01-01" }).eq("user_id", ana.id);
    await bob.client.from("user_stamps").delete().eq("user_id", ana.id);
    await bob.client.from("user_extra_stamps").delete().eq("user_id", ana.id);
    expect(rows(`select count(*) from user_stamps where user_id = '${ana.id}' and stamped_on <> '2000-01-01'`)).toBe("1");
    expect(rows(`select count(*) from user_extra_stamps where user_id = '${ana.id}' and stamped_on <> '2000-01-01'`)).toBe("1");

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

describe("spec 0016: set_stamp_dates (one date for many rows, in one transaction)", { timeout: 30_000 }, () => {
  const RETIRED = "OKT_RETIRED_NYIRJESI";
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
    expect(after.filter((e) => e.endsWith("=2026-03-04")).map((e) => e.split("#")[0]).sort()).toEqual(["OKTPH_03", "OKTPH_03", "OKTPH_07", "OKTPH_07", "extra"]);
    expect(after.filter((e) => e.endsWith("=2025-01-01")).map((e) => e.split("#")[0]).sort()).toEqual(["OKTPH_09", "OKTPH_09", "extra"]);
    expect(dates(dan)).toBe(danBefore);
  });

  it("AC-17: a place or an extra stamp the caller has not stamped yet is stamped with the date (every variant), and nobody else's stamps are touched", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const [cleo, dan] = [await signUp(), await signUp()];
    stamp(cleo, ["OKTPH_03"], [1], "2025-01-01");
    stamp(dan, ["OKTPH_09"], [2], "2025-01-01");
    const danBefore = dates(dan);
    const { data, error } = await call(cleo, ["OKTPH_03", "OKTPH_09"], [1, 2], "2026-03-04");
    expect([data, error]).toEqual([true, null]);
    const after = dates(cleo).split(",");
    expect(after.every((e) => e.endsWith("=2026-03-04"))).toBe(true);
    expect(after.filter((e) => e.startsWith("OKTPH_09#")).length).toBe(2);
    expect(after.filter((e) => e.startsWith("extra#")).sort()).toEqual(["extra#1=2026-03-04", "extra#2=2026-03-04"]);
    expect(dates(dan)).toBe(danBefore);
  });

  it("AC-17: a place or an extra stamp that does not exist fails the whole request and writes nothing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp();
    stamp(cleo, ["OKTPH_03"], [1], "2025-01-01");
    const before = dates(cleo);
    for (const [places, extras] of [
      [["OKTPH_03", "NO_SUCH_PLACE"], []], // a place that does not exist
      [["OKTPH_07"], [1, 999999]], // an extra stamp that does not exist, next to a place that would be stamped
    ] as [string[], number[]][]) {
      const { data, error } = await call(cleo, places, extras, "2026-03-04");
      expect([data, error], JSON.stringify([places, extras])).toEqual([false, null]);
      expect(dates(cleo)).toBe(before);
    }
  });

  it("AC-17: a stamp that another transaction deletes while the function runs is stamped again, so the answer is true and no row is missing", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp();
    stamp(cleo, ["OKTPH_03", "OKTPH_07"], [1], "2025-01-01");
    const psqlArgs = ["exec", "-i", "supabase_db_kektura", "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1", "-q"];
    const other = spawn("docker", psqlArgs);
    const finished = new Promise<number | null>((resolve) => other.on("close", resolve));
    other.stdin.end(
      `begin; delete from user_stamps s using checkpoints c where c.id = s.checkpoint_id and s.user_id = '${cleo.id}' and c.place_key = 'OKTPH_07'; select pg_sleep(4); commit;`,
    );
    // Wait until that session is asleep inside its transaction (not a fixed pause: a slow runner would be too late).
    for (let waited = 0; rows("select count(*) from pg_stat_activity where state = 'active' and query like 'select pg_sleep(4)%' and pid <> pg_backend_pid()") !== "1"; waited += 100) {
      if (waited > 15_000) throw new Error("the first session never got to its sleep");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const answer = execFileSync("docker", psqlArgs, {
      encoding: "utf8",
      input: `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${cleo.id}","role":"authenticated"}', true);
              select 'answer:' || public.set_stamp_dates(array['OKTPH_03', 'OKTPH_07'], array[1], '2026-03-04'); commit;`,
    });
    expect(await finished).toBe(0);
    expect(answer).toContain("answer:t");
    const after = dates(cleo).split(",");
    expect(after).toHaveLength(5);
    expect(after.every((e) => e.endsWith("=2026-03-04"))).toBe(true);
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
    expect((await call(cleo, ["OKTPH_03"], [], "2026-03-04")).data).toBe(true);
  });

  it("AC-18: a retired stamp the caller has not collected can be collected through the function with a date before it retired, and not with a later one", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const cleo = await signUp();
    expect((await call(cleo, ["OKTPH_03", RETIRED], [], "2014-11-21")).data).toBe(false);
    expect(dates(cleo)).toBe("");
    expect((await call(cleo, [RETIRED], [], "2014-11-20")).data).toBe(true);
    expect(dates(cleo)).toBe(`${RETIRED}#${rows(`select id from checkpoints where place_key = '${RETIRED}'`)}=2014-11-20`);
  });

  it("AC-17: nothing, more than 500, or no date is refused (and writes nothing), and so is a caller who is not signed in", async (ctx) => {
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
