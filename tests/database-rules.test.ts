// Spec 0002 (row level security under the stamp actions) and spec 0006 AC-1 (what the seeds leave in the test
// database), against the real local database (`npm run testdb:start`). The tests skip themselves when it isn't
// running; CI's end-to-end job runs them. They talk to PostgREST the way a browser could, as signed-in users and
// as an anonymous visitor, so they prove what a malicious client can and cannot do.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { localSupabase, psql } from "../e2e/local-db";
import type { Database } from "@/lib/supabase/database.types";

type Person = { client: SupabaseClient<Database>; id: string };

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
  try {
    local = localSupabase();
  } catch {
    return; // no local Supabase: the tests skip
  }
  [ana, bob] = [await signUp(), await signUp()];
}, 60_000);

const rows = (sql: string) => psql(sql);

describe("spec 0002: row level security of the stamp tables", () => {
  it("every policy is for authenticated users only and compares the row's user_id with (select auth.uid())", async (ctx) => {
    if (!local) return ctx.skip();
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
    if (!local) return ctx.skip();
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
    if (!local) return ctx.skip();
    const anon = connect();
    const read = await anon.from("user_stamps").select("*");
    expect(read.error !== null || read.data?.length === 0).toBe(true);
    expect((await anon.from("user_stamps").insert({ user_id: ana.id, checkpoint_id: 3 })).error).not.toBeNull();
    expect((await anon.from("user_extra_stamps").insert({ user_id: ana.id, extra_id: 3 })).error).not.toBeNull();
  });
});

describe("spec 0006: the test database", () => {
  it("AC-1: the migrations and both seeds leave 220 checkpoints (161 places), one retired stamp and 72 extra stamps", (ctx) => {
    if (!local) return ctx.skip();
    expect(
      rows(
        "select count(*) filter (where retired_on is null) || ',' || count(distinct place_key) filter (where retired_on is null) || ',' || count(*) filter (where retired_on is not null) from checkpoints",
      ),
    ).toBe("220,161,1");
    expect(rows("select count(*) from extra_stamps")).toBe("72");
  });
});
