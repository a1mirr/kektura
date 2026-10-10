// The generator itself is run, in a copy of the repository's script folder in a temporary directory, on GPX files
// made from the committed seed, so a real run of build-data.mjs is what fails or passes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { flatMeters } from "../scripts/lib/geo.mjs";
import { MOVE_THRESHOLD_M, moveProblems, seedCoordinates, stampMovesSql, unexplainedMoves } from "../scripts/lib/stamp-moves.mjs";
import { fileDate, trailDataDate, trailMetaJson } from "../scripts/lib/trail-meta.mjs";

const root = new URL("../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");
const SOURCE = "https://www.kektura.hu/hir/uj-belyegzo";

describe("spec 0004: the moves of the dates file", () => {
  it("AC-16: the threshold is 100 m", () => {
    expect(MOVE_THRESHOLD_M).toBe(100);
  });

  it("AC-16: a real entry has a code of the stamps file, once, a real day that is not in the future, and the MTSZ's own address", () => {
    const codes = ["A", "B"];
    const fine = { code: "A", moved_on: "2026-09-30", source: SOURCE };
    expect(moveProblems([fine], codes, "2026-10-07")).toEqual([]);
    expect(moveProblems([fine, { ...fine, code: "B", moved_on: "2026-10-07", source: "https://www.mtsz.org/x" }], codes, "2026-10-07")).toEqual([]);
    const problems = (e: object, today = "2026-10-07") => moveProblems([{ ...fine, ...e }], codes, today).join(" | ");
    expect(problems({ code: "Z" })).toContain("Z: not a code of the stamps file");
    expect(moveProblems([fine, fine], codes, "2026-10-07").join()).toContain("A: listed twice");
    expect(problems({ moved_on: "2026-02-30" })).toContain("not a calendar day");
    expect(problems({ moved_on: "30 Sep 2026" })).toContain("not a calendar day");
    expect(problems({ moved_on: "2026-13-40" })).toContain("not a calendar day");
    expect(problems({ moved_on: undefined })).toContain("not a calendar day");
    expect(problems({ moved_on: "2026-10-08" })).toContain("in the future");
    expect(problems({ source: "https://example.com/news" })).toContain("source is not");
    expect(problems({ source: "http://www.kektura.hu/x" })).toContain("source is not");
    expect(problems({ source: undefined })).toContain("source is not");
  });

  it("AC-16: the committed file's entries are real", () => {
    const file = JSON.parse(read("scripts/data/okt-stamp-dates.json")) as { stamps: { code: string }[]; moves: { code: string }[] };
    expect(Array.isArray(file.moves)).toBe(true);
    const seedCodes = [...seedCoordinates(read("supabase/seed.sql")).keys()];
    expect(moveProblems(file.moves, seedCodes, new Date().toISOString().slice(0, 10))).toEqual([]);
  });

  it("AC-16: the seed is read for the coordinates it gave each code, quotes in names and descriptions included", () => {
    const seed = `begin;
insert into public.checkpoints (seq, code, place_key, stage, stage_seq, name, description, lat, lng, elevation_m, km_from_start) values
  (1, 'OKTPH_01', 'OKTPH_01', 1, 1, 'Írott-kő', 'On the ''stone'' (OKTPH_01)', 47.351331, 16.435133, 882, 0.0),
  (2, 'OKTPH_02', 'OKTPH_02', 1, 2, 'Hét-forrás', 'Spring, (x), 12 (OKTPH_02)', 47.4, -16.5, 500, 8.1);`;
    expect(seedCoordinates(seed)).toEqual(
      new Map([
        ["OKTPH_01", { lat: 47.351331, lng: 16.435133 }],
        ["OKTPH_02", { lat: 47.4, lng: -16.5 }],
      ]),
    );
    expect(seedCoordinates("")).toEqual(new Map());
  });

  // About 111.3 m per 0.001 degree of latitude.
  const at = (lat: number) => ({ lat, lng: 19 });
  const was = new Map([["A", at(47)], ["B", at(47)], ["C", at(47)]]);

  it("AC-16: a coordinate that moved by more than 100 m without an entry is reported, with the distance", () => {
    const now = new Map([["A", at(47.0015)], ["B", at(47)], ["C", at(47.0009)]]);
    const found = unexplainedMoves(was, now, []);
    expect(found.map((m) => m.code)).toEqual(["A", "C"]);
    expect(found[0].meters).toBeGreaterThan(160);
    expect(found[0].meters).toBeLessThan(175);
  });

  it("AC-16: up to 100 m is the MTSZ correcting a point: the coordinates are just replaced, no entry needed", () => {
    expect(unexplainedMoves(was, new Map([["A", at(47.0008)]]), [])).toEqual([]);
    expect(unexplainedMoves(was, new Map([["A", at(47)]]), [])).toEqual([]);
  });

  it("AC-16: an entry for the code explains the move; another code's entry does not", () => {
    const now = new Map([["A", at(47.01)]]);
    expect(unexplainedMoves(was, now, [{ code: "A" }])).toEqual([]);
    expect(unexplainedMoves(was, now, [{ code: "B" }]).map((m) => m.code)).toEqual(["A"]);
  });

  it("AC-16: a new code and a code that is gone are not moves", () => {
    expect(unexplainedMoves(was, new Map([["NEW", at(48)]]), [])).toEqual([]);
    expect(unexplainedMoves(new Map([["GONE", at(48)]]), new Map(), [])).toEqual([]);
    expect(unexplainedMoves(new Map(), new Map([["A", at(47)]]), [])).toEqual([]);
  });

  it("AC-16: the distance is measured as the app measures it (metres on the ground), east-west too", () => {
    const east = new Map([["A", { lat: 47, lng: 19 + 0.0015 }]]); // 0.0015 deg of longitude at 47 N is about 114 m
    expect(flatMeters(19, 47, [19.0015, 47])).toBeGreaterThan(110);
    expect(unexplainedMoves(was, east, []).map((m) => m.code)).toEqual(["A"]);
  });

  it("AC-16: the seed's block clears the days of the codes the file no longer has and sets the file's, in code order", () => {
    const sql = stampMovesSql([
      { code: "OKTPH_9", moved_on: "2026-09-30" },
      { code: "OKTPH_2", moved_on: "2026-05-01" },
    ]);
    expect(sql).toContain("update public.checkpoints set moved_on = null where moved_on is not null and code <> all (array['OKTPH_2', 'OKTPH_9']);");
    expect(sql).toContain("from (values ('OKTPH_2', '2026-05-01'), ('OKTPH_9', '2026-09-30')) as d(code, moved_on)");
    expect(sql).toContain("c.moved_on is distinct from d.moved_on::date");
  });

  it("AC-16: with no entry the block only clears, so a day removed from the file leaves the database", () => {
    const sql = stampMovesSql([]);
    expect(sql).toContain("update public.checkpoints set moved_on = null where moved_on is not null;");
    expect(sql).not.toContain("values");
  });

  it("AC-16: the committed seed carries exactly the generator's block for the file, as the last statements of its transaction", async () => {
    const { readStampMoves } = (await import("../scripts/lib/stamp-moves.mjs")) as { readStampMoves: () => unknown[] };
    expect(read("supabase/seed.sql")).toContain(`\n${stampMovesSql(readStampMoves())}\ncommit;`);
  });
});

describe("spec 0004: the date of the MTSZ files", () => {
  it("AC-17: the day is read from the file's name, in the MTSZ's forms", () => {
    expect(fileDate("downloads/okt_bh_20260924.gpx")).toBe("2026-09-24");
    expect(fileDate("C:\\Users\\me\\okt_teljes_bh_2026-09-24.gpx")).toBe("2026-09-24");
    expect(fileDate("okt_bh_2026_09_24.gpx")).toBe("2026-09-24");
  });

  it("AC-17: a name without a real day is refused, so a regeneration always says which file it is from", () => {
    for (const name of ["okt_bh.gpx", "stamps.gpx", "okt_bh_20261340.gpx", "okt_bh_20260230.gpx"]) {
      expect(() => fileDate(name), name).toThrow(/no date/);
    }
  });

  it("AC-17: the data is as fresh as the older of its two files", () => {
    expect(trailDataDate("okt_bh_20260924.gpx", "okt_teljes_bh_20260401.gpx")).toBe("2026-04-01");
    expect(trailDataDate("okt_bh_20260401.gpx", "okt_teljes_bh_20260924.gpx")).toBe("2026-04-01");
    expect(trailDataDate("okt_bh_20260924.gpx", "okt_teljes_bh_20260924.gpx")).toBe("2026-09-24");
  });

  it("AC-17: the generated file holds the date and nothing else", () => {
    expect(JSON.parse(trailMetaJson("2026-09-24"))).toEqual({ mtszFileDate: "2026-09-24" });
  });

  it("AC-17: the committed file is a real day, not in the future", () => {
    const { mtszFileDate } = JSON.parse(read("public/data/okt-meta.json")) as { mtszFileDate: string };
    expect(fileDate(`okt_bh_${mtszFileDate}.gpx`)).toBe(mtszFileDate);
    expect(mtszFileDate <= new Date().toISOString().slice(0, 10)).toBe(true);
  });
});

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unquote = (s: string) => s.replace(/''/g, "'");

function stampsGpx(shift: Record<string, { dLat?: number; dLng?: number }> = {}) {
  const rows = [...read("supabase/seed.sql").matchAll(/^ {2}\(\d+, '([^']+)', '[^']+', \d+, \d+, '((?:[^']|'')*)', '((?:[^']|'')*)', (-?[\d.]+), (-?[\d.]+), (-?\d+), [\d.]+\),?$/gm)];
  expect(rows.length).toBeGreaterThan(200);
  const waypoints = rows.map((m) => {
    const d = shift[m[1]] ?? {};
    const lat = Number(m[4]) + (d.dLat ?? 0);
    const lng = Number(m[5]) + (d.dLng ?? 0);
    return `<wpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${m[6]}</ele><name>${escapeXml(unquote(m[2]))}</name><desc>${escapeXml(unquote(m[3]))}</desc></wpt>`;
  });
  return `<?xml version="1.0"?><gpx>${waypoints.join("")}</gpx>`;
}

function routeGpx() {
  const { points } = JSON.parse(read("public/data/okt-route-detail.json")) as { points: number[][] };
  return `<?xml version="1.0"?><gpx><trk><trkseg>${points.map((p) => `<trkpt lat="${p[1]}" lon="${p[0]}"></trkpt>`).join("")}</trkseg></trk></gpx>`;
}

describe("spec 0004: build-data.mjs on moved stamps (the script, run for real)", () => {
  let dir: string;
  let route: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kektura-moves-"));
    fs.cpSync(fileURLToPath(new URL("scripts", root)), path.join(dir, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(dir, "supabase"));
    route = path.join(dir, "okt_teljes_bh_20260924.gpx");
    fs.writeFileSync(route, routeGpx());
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));


  function build(opts: { shift?: Record<string, { dLat?: number; dLng?: number }>; moves?: object[]; stampsName?: string } = {}) {
    fs.writeFileSync(path.join(dir, "supabase", "seed.sql"), read("supabase/seed.sql"));
    const datesFile = JSON.parse(read("scripts/data/okt-stamp-dates.json"));
    datesFile.moves = opts.moves ?? [];
    fs.writeFileSync(path.join(dir, "scripts", "data", "okt-stamp-dates.json"), JSON.stringify(datesFile));
    const stamps = path.join(dir, opts.stampsName ?? "okt_bh_20260924.gpx");
    fs.writeFileSync(stamps, stampsGpx(opts.shift));
    const run = spawnSync(process.execPath, ["scripts/build-data.mjs", stamps, route], { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return { ...run, seed: () => fs.readFileSync(path.join(dir, "supabase", "seed.sql"), "utf8"), meta: () => fs.readFileSync(path.join(dir, "public", "data", "okt-meta.json"), "utf8") };
  }

  const entry = (over: object = {}) => ({ code: "OKTPH_84_B", moved_on: "2026-09-30", source: SOURCE, ...over });
  const metres = 1 / 111_320;

  it("AC-16, AC-17: stamps where the last seed had them: it runs, writes the file's date, and the block has no day to set", () => {
    const run = build();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.meta()).toBe(trailMetaJson("2026-09-24"));
    expect(run.seed()).toContain("update public.checkpoints set moved_on = null where moved_on is not null;");
    expect(run.seed()).not.toContain("moved_on::date");
  }, 60_000);

  it("AC-16: a stamp 150 m from where it was, with no entry, stops the build and names the code and the distance", () => {
    const run = build({ shift: { OKTPH_84_B: { dLat: 150 * metres } } });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/moved by more than 100 m/);
    expect(run.stderr).toMatch(/OKTPH_84_B: 1[45]\d m/);
  }, 60_000);

  it("AC-16: a shift of 80 m only replaces the coordinates: no entry, and the new seed holds them", () => {
    const run = build({ shift: { OKTPH_84_B: { dLat: 80 * metres } } });
    expect(run.status, run.stderr).toBe(0);
    const row = run.seed().split("\n").find((l) => l.includes("'OKTPH_84_B', 'OKTPH_84_B'"))!;
    expect(row).toContain(", 47.879948, 19.035783,");
    expect(run.seed()).not.toContain("moved_on::date");
  }, 60_000);

  it("AC-16: with the entry (the day and the MTSZ's address) the same shift builds, and the seed sets the day for that code only", () => {
    const run = build({ shift: { OKTPH_84_B: { dLat: 150 * metres } }, moves: [entry()] });
    expect(run.status, run.stderr).toBe(0);
    const seed = run.seed();
    expect(seed).toContain("from (values ('OKTPH_84_B', '2026-09-30')) as d(code, moved_on)");
    expect(seed).toContain("code <> all (array['OKTPH_84_B'])");
    expect(seed.split("\n").find((l) => l.includes("'OKTPH_84_B', 'OKTPH_84_B'"))).toContain(", 47.880576, 19.035783,");
    // it is the last of the seed's statements, inside its transaction
    expect(seed).toMatch(/where c\.code = d\.code and c\.moved_on is distinct from d\.moved_on::date;\n\ncommit;\n$/);
  }, 60_000);

  it("AC-16: an entry that is not real stops the build: a future day, a code the stamps lack, a source that is not the MTSZ's", () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    expect(build({ moves: [entry({ moved_on: future })] }).stderr).toMatch(/in the future/);
    expect(build({ moves: [entry({ code: "OKTPH_NOPE" })] }).stderr).toMatch(/OKTPH_NOPE: not a code of the stamps file/);
    expect(build({ moves: [entry({ source: "https://example.com/" })] }).stderr).toMatch(/source is not/);
    expect(build({ moves: [entry(), entry()] }).stderr).toMatch(/listed twice/);
  }, 120_000);

  it("AC-17: files whose names carry no day stop the build: it must say which MTSZ file the data is from", () => {
    const run = build({ stampsName: "stamps.gpx" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/no date/);
  }, 60_000);

  it("AC-17: the date written is the older file's", () => {
    const older = build({ stampsName: "okt_bh_20260401.gpx" });
    expect(older.status, older.stderr).toBe(0);
    expect(older.meta()).toBe(trailMetaJson("2026-04-01"));
  }, 60_000);

  it("the generator and the seed it was given agree: the unmoved stamps reproduce the committed rows' coordinates", () => {
    const run = build();
    const again = seedCoordinates(run.seed());
    const before = seedCoordinates(read("supabase/seed.sql"));
    expect(again.size).toBe(before.size);
    for (const [code, c] of before) {
      expect(flatMeters(again.get(code)!.lng, again.get(code)!.lat, [c.lng, c.lat]), code).toBeLessThan(1);
    }
  }, 60_000);
});
