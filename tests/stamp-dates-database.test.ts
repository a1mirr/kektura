// Spec 0004 AC-12 (adding a stamp keeps what users have) and spec 0024 AC-25 (the waived places a friend shares) against
// the real local database (`npm run testdb:start`). Skips itself when it isn't running; CI's end-to-end job runs it.
// Every drill is one transaction that is rolled back, so the reference data other tests read is never changed.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPlaces, stampedPlaceKeys, waivedPlaceKeys, type Checkpoint } from "@/lib/progress";

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

const hasDatabase = () => {
  try {
    return run("select 1;")[0] === "1";
  } catch {
    return false;
  }
};

const user = (n: number) => `00000000-0000-4000-8000-0000000000e${n}`;
const createUser = (n: number) =>
  `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values ('${user(n)}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dates-drill-${n}@kektura.test', '{}');`;

// The seed's own transaction is inside the drill's: its begin and commit are commented out, the drill rolls back.
const inner = (text: string) => text.replace(/^begin;$/m, "-- begin").replace(/commit;\s*$/, "-- commit");

// The seed as the generator would write it after a new place was put in the middle of a stage: the new row takes the
// seq of the row it goes before, and every row from there on moves one place down the trail.
function seedWithInsertedPlace(beforeCode: string) {
  const lines = seed.split("\n");
  const at = lines.findIndex((l) => l.startsWith("  (") && l.includes(`'${beforeCode}'`));
  const seq = Number(lines[at].match(/^ {2}\((\d+),/)![1]);
  const moved = lines.map((l) => (l.startsWith("  (") ? l.replace(/^ {2}\((\d+),/, (_, n) => `  (${Number(n) >= seq ? Number(n) + 1 : n},`) : l));
  const [, stage, km] = lines[at].match(/^ {2}\(\d+, '[^']+', '[^']+', (\d+), \d+, .*, ([\d.]+)\),?$/)!;
  const row = `  (${seq}, 'OKTPH_TEST_NEW', 'OKTPH_TEST_NEW', ${stage}, 99, 'Test place', 'Test - nowhere. (OKTPH_TEST_NEW)', 47.5, 18.5, 100, ${km}),`;
  moved.splice(at, 0, row);
  return moved.join("\n").replace("array['", "array['OKTPH_TEST_NEW', '");
}

describe("spec 0004: adding a stamp to the seed", () => {
  it("AC-12: every existing code keeps its id and every user's stamp keeps pointing at it, while the places after it move down the trail", (ctx) => {
    if (!hasDatabase()) return ctx.skip();
    const regenerated = seedWithInsertedPlace("OKTPH_50_1");
    expect(regenerated).toContain("'OKTPH_TEST_NEW'");
    const snapshot = "select string_agg(code || '=' || id, ',' order by code) from public.checkpoints where code is not null and code <> 'OKTPH_TEST_NEW'";
    const stamps =
      "select string_agg(c.code || '@' || s.stamped_on, ',' order by c.code) from public.user_stamps s join public.checkpoints c on c.id = s.checkpoint_id where s.user_id = '" + user(1) + "'";
    const lines = run(
      [
        "begin;",
        createUser(1),
        `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select '${user(1)}', id, '2026-07-01' from public.checkpoints where seq between 60 and 70 or seq between 150 and 155;`,
        `select 'ids_before:' || (${snapshot});`,
        `select 'stamps_before:' || (${stamps});`,
        "select 'seq_before:' || seq from public.checkpoints where code = 'OKTPH_50_1';",
        inner(regenerated),
        `select 'ids_after:' || (${snapshot});`,
        `select 'stamps_after:' || (${stamps});`,
        "select 'seq_after:' || seq from public.checkpoints where code = 'OKTPH_50_1';",
        "select 'new:' || count(*) from public.checkpoints where code = 'OKTPH_TEST_NEW';",
        "select 'total:' || count(*) from public.checkpoints where retired_on is null;",
        "rollback;",
      ].join("\n"),
    );
    const get = (name: string) => lines.find((l) => l.startsWith(`${name}:`))!.slice(name.length + 1);
    expect(get("ids_after")).toBe(get("ids_before"));
    expect(get("stamps_after")).toBe(get("stamps_before"));
    expect(get("stamps_before").split(",")).toHaveLength(17);
    expect(Number(get("seq_after"))).toBe(Number(get("seq_before")) + 1); // the trail order shifted, the id did not
    expect(get("new")).toBe("1");
    expect(get("total")).toBe("221");
  });
});

type Row = Checkpoint & { id: number };

// A friend's stamps (place -> date) in a transaction; what get_friend_waived_places answers to their friend.
function waivedAccordingToDatabase(
  stampDates: Map<number, string>,
  friendship: { status: string; sharing: boolean } = { status: "accepted", sharing: true },
  setup = "",
): string[] {
  const values = [...stampDates].map(([id, date]) => `(${id}, '${date}')`).join(", ");
  const lines = run(
    [
      "begin;",
      setup,
      createUser(1),
      createUser(2),
      `insert into public.friendships (user_id, friend_id, status, user_is_sharing, friend_is_sharing) values ('${user(1)}', '${user(2)}', '${friendship.status}', true, ${friendship.sharing});`,
      `insert into public.user_stamps (user_id, checkpoint_id, stamped_on) select '${user(2)}', v.id, v.d::date from (values ${values}) as v(id, d);`,
      `select set_config('request.jwt.claims', '{"sub":"${user(1)}","role":"authenticated"}', true);`,
      `select 'waived:' || coalesce(string_agg(friend_id || '/' || place_key, ',' order by place_key), '') from public.get_friend_waived_places();`,
      "rollback;",
    ].join("\n"),
  );
  const answer = lines.find((l) => l.startsWith("waived:"))!.slice("waived:".length);
  return answer === "" ? [] : answer.split(",").map((pair) => pair.split("/")[1]);
}

describe("spec 0024: a friend's waived places", () => {
  const loadCheckpoints = (): Row[] =>
    JSON.parse(
      run(
        "select jsonb_agg(c order by seq) from (select id, seq, stage, stage_seq, code, place_key, name, description, lat, lng, km_from_start::float8 as km_from_start, required_from from public.checkpoints) c;",
      )[0],
    );

  // Each place gets a date from `dateOf`, none for the places `skip` names: the places the friend stamped, with the days.
  function scenario(checkpoints: Row[], dateOf: (index: number, key: string) => string | null) {
    const places = buildPlaces(checkpoints);
    const firstVariant = new Map(places.map((p) => [p.key, p.variants[0].id]));
    const stampDates = new Map<number, string>();
    places.forEach((p, i) => {
      const date = dateOf(i, p.key);
      if (date) stampDates.set(firstVariant.get(p.key)!, date);
    });
    const stamps = [...stampDates].map(([checkpoint_id, stamped_on]) => ({ checkpoint_id, stamped_on }));
    const expected = [...waivedPlaceKeys(places, stampedPlaceKeys(places, stamps))].sort();
    return { stampDates, expected };
  }

  it("AC-25: is the rule of progress.ts: for friends' stamps along the whole trail the database and waivedPlaceKeys agree", (ctx) => {
    if (!hasDatabase()) return ctx.skip();
    const checkpoints = loadCheckpoints();
    const dated = new Set(checkpoints.filter((c) => c.required_from !== null).map((c) => c.place_key));
    expect(dated.size).toBeGreaterThan(5);
    const days = (i: number) => new Date(Date.UTC(2013, 0, 1) + i * 24 * 3600 * 1000 * 19).toISOString().slice(0, 10); // 2013 .. 2018
    const scenarios = {
      "everything but the new stamps, in 2013": scenario(checkpoints, (_, key) => (dated.has(key) ? null : "2013-01-01")),
      "everything but the new stamps, in 2026": scenario(checkpoints, (_, key) => (dated.has(key) ? null : "2026-01-01")),
      "everything but the new stamps, after all dates": scenario(checkpoints, (_, key) => (dated.has(key) ? null : "2026-12-31")),
      "dates growing along the trail": scenario(checkpoints, (i, key) => (dated.has(key) ? null : days(i))),
      "every third place only": scenario(checkpoints, (i, key) => (dated.has(key) || i % 3 ? null : days(i * 2))),
    };
    for (const [name, { stampDates, expected }] of Object.entries(scenarios)) {
      expect(waivedAccordingToDatabase(stampDates), name).toEqual(expected);
    }
    expect(scenarios["everything but the new stamps, in 2013"].expected.length).toBe(dated.size); // all of them, in this one
    expect(scenarios["everything but the new stamps, after all dates"].expected).toEqual([]);
  }, 60_000);

  it("AC-25: a stamped new place is not waived, and only an accepted friend who shares is asked about", (ctx) => {
    if (!hasDatabase()) return ctx.skip();
    const checkpoints = loadCheckpoints();
    const stamped = scenario(checkpoints, () => "2013-01-01"); // every place, the new ones too
    expect(waivedAccordingToDatabase(stamped.stampDates)).toEqual([]);
    const dated = new Set(checkpoints.filter((c) => c.required_from !== null).map((c) => c.place_key));
    const walked = scenario(checkpoints, (_, key) => (dated.has(key) ? null : "2013-01-01"));
    expect(waivedAccordingToDatabase(walked.stampDates).length).toBe(dated.size);
    expect(waivedAccordingToDatabase(walked.stampDates, { status: "accepted", sharing: false })).toEqual([]);
    expect(waivedAccordingToDatabase(walked.stampDates, { status: "pending", sharing: true })).toEqual([]);
  }, 60_000);

  it("AC-25: a place is required from the earliest date of its variants, and from the beginning when one variant has none", (ctx) => {
    if (!hasDatabase()) return ctx.skip();
    const checkpoints = loadCheckpoints();
    const variants = checkpoints.filter((c) => c.place_key === "OKTPH_132_B"); // Encs: two variants, both dated 2022-05-01
    expect(variants).toHaveLength(2);
    const dated = new Set(checkpoints.filter((c) => c.required_from !== null).map((c) => c.place_key));
    const scene = (setup: string, edit: (c: Row) => Row) => {
      const edited = checkpoints.map(edit);
      return { setup, ...scenario(edited, (_, key) => (dated.has(key) ? null : "2013-01-01")) };
    };
    const undated = scene(
      `update public.checkpoints set required_from = null where id = ${variants[0].id};`,
      (c) => (c.id === variants[0].id ? { ...c, required_from: null } : c),
    );
    const later = scene(
      `update public.checkpoints set required_from = '2030-01-01' where id = ${variants[0].id};`,
      (c) => (c.id === variants[0].id ? { ...c, required_from: "2030-01-01" } : c),
    );
    for (const { setup, stampDates, expected } of [undated, later]) {
      expect(waivedAccordingToDatabase(stampDates, undefined, setup)).toEqual(expected);
    }
    expect(undated.expected).not.toContain("OKTPH_132_B"); // one variant without a date: required from the beginning
    expect(later.expected).toContain("OKTPH_132_B"); // the earlier of 2022-05-01 and 2030-01-01 counts, so it is waived in 2013
  }, 60_000);

  it("AC-25: only a signed-in user may call it", (ctx) => {
    if (!hasDatabase()) return ctx.skip();
    const [line] = run(
      "select has_function_privilege('anon', 'public.get_friend_waived_places()', 'execute') || ',' || has_function_privilege('authenticated', 'public.get_friend_waived_places()', 'execute');",
    );
    expect(line).toBe("false,true");
  });
});
