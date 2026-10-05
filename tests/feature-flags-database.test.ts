// Spec 0035 AC-7, AC-8, AC-12, AC-13 against the real local database (`npm run testdb:start`). The tests skip
// themselves when it isn't running; CI's end-to-end job runs them. They talk to PostgREST the way a browser could,
// as a signed-in user and as an anonymous visitor, so they prove what a malicious client can and cannot do. Each test
// works on flags of its own (`dbtest-...`), never on the declared ones that the E2E tests switch.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localSupabase, psql } from "../e2e/local-db";
import { FLAG_KEYS } from "@/lib/feature-flags";
import type { Database } from "@/lib/supabase/database.types";

type Person = { client: SupabaseClient<Database>; id: string };

let local: { url: string; anonKey: string } | undefined;
let ana: Person;
let bob: Person;
let anon: SupabaseClient<Database>;
const prefix = `dbtest-${randomUUID().slice(0, 8)}`;
const flag = (suffix: string) => `${prefix}-${suffix}`;

const connect = () => createClient<Database>(local!.url, local!.anonKey, { auth: { persistSession: false } });

async function signUp(): Promise<Person> {
  const client = connect();
  const { data, error } = await client.auth.signUp({ email: `flags-${randomUUID()}@kektura.test`, password: "test-password-123" });
  if (error || !data.user) throw new Error(`sign-up failed: ${error?.message}`);
  return { client, id: data.user.id };
}

// What a viewer is told about the flags of this test.
async function seenBy(client: SupabaseClient<Database>) {
  const { data, error } = await client.rpc("feature_flags_for_me");
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.filter((r) => r.key.startsWith(prefix)).map((r) => [r.key.slice(prefix.length + 1), r]));
}

beforeAll(async () => {
  try {
    local = localSupabase();
  } catch {
    return; // no local Supabase: the tests skip
  }
  [ana, bob] = [await signUp(), await signUp()];
  anon = connect();
  psql(
    `insert into public.feature_flags (key, mode) values ('${flag("off")}', 'off'), ('${flag("list")}', 'allowlist'), ('${flag("on")}', 'on');` +
      `insert into public.feature_flag_users (key, user_id) values ('${flag("list")}', '${ana.id}'), ('${flag("off")}', '${ana.id}')`,
  );
}, 60_000);

afterAll(() => {
  if (local) psql(`delete from public.feature_flags where key like '${prefix}-%'`);
});

describe("spec 0035: the flag tables", () => {
  it("AC-7: both tables have row level security and no policy, and neither role may touch them", async (ctx) => {
    if (!local) return ctx.skip();
    expect(
      psql(
        "select count(*) from pg_class where oid in ('public.feature_flags'::regclass, 'public.feature_flag_users'::regclass) and relrowsecurity",
      ),
    ).toBe("2");
    expect(psql("select count(*) from pg_policies where schemaname = 'public' and tablename like 'feature_flag%'")).toBe("0");
    for (const client of [ana.client, anon]) {
      expect((await client.from("feature_flags").select("*")).error?.code, "read flags").toBe("42501");
      expect((await client.from("feature_flag_users").select("*")).error?.code, "read allowlist").toBe("42501");
      expect((await client.from("feature_flags").insert({ key: flag("x"), mode: "on" })).error?.code, "insert flag").toBe("42501");
      expect((await client.from("feature_flag_users").insert({ key: flag("on"), user_id: ana.id })).error?.code, "insert user").toBe("42501");
      expect((await client.from("feature_flags").update({ key: flag("y") }).eq("key", flag("on"))).error?.code, "update flag").toBe("42501");
      expect((await client.from("feature_flag_users").update({ key: flag("y") }).eq("key", flag("on"))).error?.code, "update user").toBe("42501");
      expect((await client.from("feature_flags").delete().eq("key", flag("on"))).error?.code, "delete flag").toBe("42501");
      expect((await client.from("feature_flag_users").delete().eq("key", flag("on"))).error?.code, "delete user").toBe("42501");
    }
    expect(psql(`select count(*) from public.feature_flags where key in ('${flag("x")}', '${flag("y")}')`)).toBe("0");
  });

  it("AC-7: a flag has a kebab-case key and one of three modes", () => {
    if (!local) return;
    expect(() => psql("insert into public.feature_flags (key, mode) values ('x', 'sometimes')")).toThrow();
    expect(() => psql("insert into public.feature_flags (key, mode) values ('Not_Kebab', 'on')")).toThrow();
  });

  it("AC-12: deleting the account removes its allowlist entries", async (ctx) => {
    if (!local) return ctx.skip();
    const leaver = await signUp();
    psql(`insert into public.feature_flag_users (key, user_id) values ('${flag("list")}', '${leaver.id}')`);
    expect(psql(`select count(*) from public.feature_flag_users where user_id = '${leaver.id}'`)).toBe("1");
    psql(`delete from auth.users where id = '${leaver.id}'`);
    expect(psql(`select count(*) from public.feature_flag_users where user_id = '${leaver.id}'`)).toBe("0");
  });

  it("AC-13: every declared flag has a row, so its allowlist can be filled", (ctx) => {
    if (!local) return ctx.skip();
    const stored = psql("select key from public.feature_flags").split("\n");
    for (const key of FLAG_KEYS) expect(stored, key).toContain(key);
  });
});

describe("spec 0035: feature_flags_for_me()", () => {
  it("AC-8: a signed-in user sees each flag's mode and whether they are on its allowlist", async (ctx) => {
    if (!local) return ctx.skip();
    expect(await seenBy(ana.client)).toEqual({
      off: { key: flag("off"), mode: "off", listed: true },
      list: { key: flag("list"), mode: "allowlist", listed: true },
      on: { key: flag("on"), mode: "on", listed: false },
    });
    expect((await seenBy(bob.client)).list).toEqual({ key: flag("list"), mode: "allowlist", listed: false });
  });

  it("AC-8: a signed-out visitor is on no allowlist, and never learns anyone's id", async (ctx) => {
    if (!local) return ctx.skip();
    const seen = await seenBy(anon);
    expect(seen.list).toEqual({ key: flag("list"), mode: "allowlist", listed: false });
    expect(seen.on?.mode).toBe("on");
    expect(JSON.stringify(seen)).not.toContain(ana.id);
    expect(Object.keys(seen.on!).sort()).toEqual(["key", "listed", "mode"]);
  });

  it("AC-8: it is a security definer function with an empty search_path, granted to anon and authenticated only", (ctx) => {
    if (!local) return ctx.skip();
    expect(
      psql("select prosecdef || '|' || proconfig::text from pg_proc where proname = 'feature_flags_for_me' and pronamespace = 'public'::regnamespace"),
    ).toBe('true|{"search_path=\\"\\""}');
    const can = (role: string) => psql(`select has_function_privilege('${role}', 'public.feature_flags_for_me()', 'execute')`);
    expect([can("anon"), can("authenticated")]).toEqual(["t", "t"]);
    expect(psql("select count(*) from information_schema.routine_privileges where routine_name = 'feature_flags_for_me' and grantee = 'PUBLIC'")).toBe("0");
  });
});
