// Spec 0004 AC-15 (a stamp that becomes retired keeps every user's stamp), spec 0024 AC-26 (a friend's page counts no retired
// stamp) and the rules of the retired columns, against the real local database (`npm run testdb:start`). Skips itself when it
// isn't running (it fails where CI requires one, `REQUIRE_LOCAL_DB`, spec 0007 AC-12); CI's end-to-end job runs it. Every drill is one transaction that is rolled back.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { databaseDecision, requireDatabase } from "../e2e/local-db";

const seed = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

// Runs a script in one psql session; throws on the first error.
function run(sql: string): string[] {
  return execFileSync("docker", ["exec", "-i", "supabase_db_kektura", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
  })
    .trim()
    .split("\n");
}

const RELATIONS = ["public.checkpoints", "public.user_stamps"];
// `supabase status` (the probe of requireDatabase) takes a while: ask once before the first test, which has 5 s.
beforeAll(() => {
  databaseDecision(RELATIONS);
}, 60_000);

const user = (n: number) => `00000000-0000-4000-8000-0000000000f${n}`;
const createUser = (n: number) =>
  `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values ('${user(n)}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retired-drill-${n}@kektura.test', '{}');`;
const inner = (text: string) => text.replace(/^begin;$/m, "-- begin").replace(/commit;\s*$/, "-- commit");

describe("spec 0004: a stamp that becomes retired", () => {
  it("AC-15: keeps every user's stamp on it, with its date and id, and does not move them to another variant of the place", async (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const { retiredStampsSql } = (await import("../scripts/lib/retired-stamps.mjs")) as { retiredStampsSql: (entries: unknown[]) => string };
    // The new source no longer lists OKTPH_03_1 (a variant of Kőszeg, which keeps OKTPH_03_2) and the retired file now does.
    const block = retiredStampsSql([
      { code: "OKTPH_03_1", name: "Kőszeg (old)", after_place_key: "OKTPH_02", retired_on: "2020-01-01", replaced_by: "OKTPH_03", assumed: [] },
    ]);
    const start = seed.indexOf("-- Retired stamps (scripts/data/okt-retired-stamps.json)");
    const end = seed.indexOf("-- Rows this file no longer has");
    const without = seed
      .slice(0, start)
      .split("\n")
      .filter((line) => !(line.startsWith("  (") && line.includes("'OKTPH_03_1'")))
      .join("\n");
    const regenerated = without + block + "\n" + seed.slice(end);
    const lines = run(
      [
        "begin;",
        createUser(1),
        `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select '${user(1)}', id, '2019-05-01' from public.checkpoints where code = 'OKTPH_03_1';`,
        "select 'id_before:' || id from public.checkpoints where code = 'OKTPH_03_1';",
        inner(regenerated),
        "select 'id_after:' || id || ',' || retired_on || ',' || place_key from public.checkpoints where code = 'OKTPH_03_1';",
        `select 'stamps:' || string_agg(c.code || '@' || s.stamped_on, ',') from public.user_stamps s join public.checkpoints c on c.id = s.checkpoint_id where s.user_id = '${user(1)}';`,
        "select 'places:' || count(*) from public.checkpoints where retired_on is null;",
        "rollback;",
      ].join("\n"),
    );
    const get = (name: string) => lines.find((l) => l.startsWith(`${name}:`))!.slice(name.length + 1);
    expect(get("id_after")).toBe(`${get("id_before")},2020-01-01,OKTPH_03_1`); // the same row, now retired, its own key
    expect(get("stamps")).toBe("OKTPH_03_1@2019-05-01"); // the stamp stayed, and was not moved to OKTPH_03_2
    expect(get("places")).toBe("219"); // 220 current rows minus the one that retired
  });

  it("AC-14: running the seed again changes nothing about the retired row, and never deletes it", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const lines = run(
      [
        "begin;",
        "select 'before:' || md5(string_agg(c::text, '|' order by code)) from public.checkpoints c where retired_on is not null;",
        inner(seed),
        "select 'after:' || md5(string_agg(c::text, '|' order by code)) from public.checkpoints c where retired_on is not null;",
        "select 'retired:' || count(*) from public.checkpoints where retired_on is not null;",
        "rollback;",
      ].join("\n"),
    );
    const get = (name: string) => lines.find((l) => l.startsWith(`${name}:`))!.slice(name.length + 1);
    expect(get("after")).toBe(get("before"));
    expect(get("retired")).toBe("1");
  });
});

describe("spec 0004: the retired columns", () => {
  it("AC-14: the retired row sits outside the trail order: above every current seq, no number in its stage, the km of the place it followed, its own key", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const [line] = run(
      `select (r.seq > (select max(seq) from public.checkpoints where retired_on is null)) || ',' || (r.stage_seq is null) || ',' || (r.km_from_start = (select max(km_from_start) from public.checkpoints where place_key = r.after_place_key and retired_on is null)) || ',' || (r.place_key = r.code) || ',' || (r.stage = (select max(stage) from public.checkpoints where place_key = r.after_place_key and retired_on is null)) from public.checkpoints r where r.retired_on is not null;`,
    );
    expect(line).toBe("true,true,true,true,true");
  });

  it("AC-14: a current stamp cannot carry retired details, and no two retired rows share a key", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    expect(() =>
      run("begin; update public.checkpoints set replaced_by = 'OKTPH_103' where code = 'OKTPH_102_1'; rollback;"),
    ).toThrow();
    expect(() =>
      run(
        "begin; insert into public.checkpoints (seq, code, place_key, name, retired_on, km_from_start) values (9001, 'X_1', 'OKT_RETIRED_NYIRJESI', 'X', '2014-01-01', 1); rollback;",
      ),
    ).toThrow();
  });
});

describe("spec 0024: what a friend sees of retired stamps", () => {
  it("AC-26: the friend functions leave a retired stamp out: not in their stamps, not in what they were waived", (ctx) => {
    requireDatabase(ctx, RELATIONS);
    const lines = run(
      [
        "begin;",
        createUser(1),
        createUser(2),
        `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${user(1)}', '${user(2)}', 'accepted', true, true);`,
        // the friend collected the retired stamp (before it retired) and one current stamp
        `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select '${user(2)}', id, '2014-06-01' from public.checkpoints where code in ('OKT_RETIRED_NYIRJESI', 'OKTPH_102_1');`,
        `select set_config('request.jwt.claims', '{"sub":"${user(1)}","role":"authenticated"}', true);`,
        "select 'stamps:' || coalesce(string_agg(c.code, ',' order by c.code), '') from public.get_friend_stamps() f join public.checkpoints c on c.id = f.checkpoint_id;",
        "select 'waived:' || coalesce(string_agg(place_key, ',' order by place_key), '') from public.get_friend_waived_places();",
        "rollback;",
      ].join("\n"),
    );
    const get = (name: string) => lines.find((l) => l.startsWith(`${name}:`))!.slice(name.length + 1);
    expect(get("stamps")).toBe("OKTPH_102_1"); // never the retired one
    expect(get("waived")).not.toContain("RETIRED");
  });
});
