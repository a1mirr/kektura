// They assert relationships between the files rather than today's numbers, so a legitimate MTSZ update keeps them
// green.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import hopsJson from "../public/data/okt-hops.json";
import overview from "../public/data/okt-route.json";
import detail from "../public/data/okt-route-detail.json";
import stagesJson from "../scripts/data/okt-stages.json";
import { readStampMoves, stampMovesSql } from "../scripts/lib/stamp-moves.mjs";
import type { Hop } from "@/lib/route-stats";
import { TRAIL_FACTS } from "@/lib/trail-facts";

const hops = hopsJson as Hop[];
const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const round1 = (x: number) => Math.round(x * 10) / 10;

const seedRows = [...read("supabase/seed.sql").matchAll(/^ {2}\((\d+), '([^']+)', '([^']+)', (\d+), (\d+), '((?:[^']|'')*)'/gm)].map(
  (m) => ({ seq: Number(m[1]), code: m[2], placeKey: m[3], stage: Number(m[4]), stageSeq: Number(m[5]), name: m[6].replace(/''/g, "'") }),
);
const seedPlaces = new Set(seedRows.map((r) => r.placeKey));
const stagePlaceCount = stagesJson.stages.reduce((n, st) => n + st.places.length, 0);

describe("spec 0004: stamping places (seed.sql)", () => {
  it("AC-1: every row parses, codes are unique and seq runs 1..n", () => {
    expect(seedRows.length).toBe((read("supabase/seed.sql").match(/^ {2}\(/gm) ?? []).length);
    expect(new Set(seedRows.map((r) => r.code)).size).toBe(seedRows.length);
    expect(seedRows.map((r) => r.seq)).toEqual(seedRows.map((_, i) => i + 1));
  });

  it("AC-2: places match the official stage table (161 today)", () => {
    expect(seedPlaces.size).toBe(stagePlaceCount);
    const names = new Set(seedRows.map((r) => r.name));
    for (const st of stagesJson.stages) for (const name of st.places) expect(names).toContain(name);
  });

  it("spec 0015 AC-2: the about page's trail facts match the seed and the MTSZ table", () => {
    expect(TRAIL_FACTS.places).toBe(seedPlaces.size);
    expect(TRAIL_FACTS.stages).toBe(new Set(seedRows.map((r) => r.stage)).size);
    expect(TRAIL_FACTS.km).toBe(round1(stagesJson.stages.reduce((s, st) => s + st.km, 0)));
  });

  it("AC-3: variants of a place share its stage and number; <stage>.<n> labels are unique", () => {
    const byPlace = new Map<string, string>();
    for (const r of seedRows) {
      const label = `${r.stage}.${r.stageSeq}`;
      expect(byPlace.get(r.placeKey) ?? label).toBe(label);
      byPlace.set(r.placeKey, label);
    }
    expect(new Set(byPlace.values()).size).toBe(byPlace.size);
  });
});

describe("spec 0004: hops (okt-hops.json)", () => {
  it("AC-4: one continuous chain from Írott-kő through every place", () => {
    hops.forEach((h, i) => {
      if (i) expect(h.a).toBe(hops[i - 1].b);
    });
    expect(hops[0].a).toBe(seedRows[0].placeKey);
    expect(new Set([hops[0].a, ...hops.map((h) => h.b)])).toEqual(seedPlaces);
  });

  it("AC-5: only the Visegrád-Nagymaros ferry lacks walking times", () => {
    const ferries = hops.filter((h) => h.ferry);
    expect(ferries).toHaveLength(stagesJson.stages.filter((st, i) => i && stagesJson.stages[i - 1].end !== st.start).length);
    for (const h of ferries) expect([h.tf, h.tb]).toEqual([null, null]);
    for (const h of hops.filter((x) => !x.ferry)) {
      expect(typeof h.tf).toBe("number");
      expect(typeof h.tb).toBe("number");
    }
  });

  it("AC-6: walking hops add up to the MTSZ stage table, stage by stage", () => {
    for (const st of stagesJson.stages) {
      expect(round1(st.hops.reduce((s, h) => s + h.km, 0)), `stage ${st.stage}`).toBe(st.km);
    }
    const walking = hops.filter((h) => !h.ferry);
    const tableKm = round1(stagesJson.stages.reduce((s, st) => s + st.km, 0));
    expect(round1(walking.reduce((s, h) => s + h.km, 0))).toBe(tableKm);
  });
});

describe("spec 0004: route geometry (okt-route*.json)", () => {
  it.each([
    ["overview", overview],
    ["detail", detail],
  ])("AC-7: the %s route starts at km 0 and never goes backwards", (_, route) => {
    const pts = route.points as number[][];
    expect(pts[0][2]).toBe(0);
    for (let i = 1; i < pts.length; i++) expect(pts[i][2]).toBeGreaterThanOrEqual(pts[i - 1][2]);
  });

  it("AC-7: both routes end at the same km, past the last stamping place", () => {
    const end = (r: { points: number[][] }) => r.points.at(-1)![2];
    expect(end(overview)).toBe(end(detail));
    // km_from_start is the last value of each row: `..., 880, 0.0),`
    const rowKm = read("supabase/seed.sql")
      .split("\n")
      .filter((line) => line.startsWith("  ("))
      .map((line) => Number(line.match(/, ([\d.]+)\),?\r?$/)![1]));
    expect(rowKm).toHaveLength(seedRows.length);
    const lastKm = Math.max(...rowKm);
    expect(end(overview)).toBeGreaterThanOrEqual(lastKm - 0.1);
  });
});

describe("spec 0004: extra stamps (seed_extra.sql)", () => {
  it("AC-8: codes are unique", () => {
    const codes = [...read("supabase/seed_extra.sql").matchAll(/^ {2}\('((?:[^']|'')*)'/gm)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

const datesFile = JSON.parse(read("scripts/data/okt-stamp-dates.json")) as {
  stamps: { code: string; place?: string; required_from?: string; source: string; tolerance_note?: unknown }[];
};

describe("spec 0004: the dates of new stamps (okt-stamp-dates.json)", () => {
  const seedCodes = new Set(seedRows.map((r) => r.code));
  const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

  it("AC-10: every entry names a code of the seed, once", () => {
    expect(datesFile.stamps.length).toBeGreaterThan(0);
    const codes = datesFile.stamps.map((e) => e.code);
    for (const code of codes) expect(seedCodes, code).toContain(code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("AC-10: every date is a real calendar day, from the MTSZ's own site, and a tolerance flag is a boolean", () => {
    for (const e of datesFile.stamps) {
      expect(isRealDate(e.required_from ?? ""), `${e.code}: ${e.required_from}`).toBe(true);
      expect(e.source, e.code).toMatch(/^https:\/\/www\.(kektura\.hu|mtsz\.org)\//);
      if ("tolerance_note" in e) expect(typeof e.tolerance_note, e.code).toBe("boolean");
    }
  });

  it("AC-11: the seed carries exactly the file's dates, in the block the generator writes", async () => {
    const { readStampDates, stampDatesSql } = (await import("../scripts/lib/stamp-dates.mjs")) as {
      readStampDates: () => unknown[];
      stampDatesSql: (entries: unknown[]) => string;
    };
    const block = stampDatesSql(readStampDates());
    expect(read("supabase/seed.sql")).toContain(`\n${block}\n${stampMovesSql(readStampMoves())}\ncommit;`);
    const named = [...block.matchAll(/\('(OKTPH_[0-9A-Za-z_]+)', '\d{4}-\d{2}-\d{2}'\)/g)].map((m) => m[1]).sort();
    expect(named).toEqual(datesFile.stamps.map((e) => e.code).sort());
  });
});

const retiredFile = JSON.parse(read("scripts/data/okt-retired-stamps.json")) as {
  stamps: {
    code: string;
    name: string;
    after_place_key: string;
    retired_on: string;
    replaced_by?: string;
    lat?: number;
    lng?: number;
    source: string;
    assumed?: string[];
  }[];
};

describe("spec 0004: retired stamps (okt-retired-stamps.json)", () => {
  it("AC-14: every entry has a unique code of its own, a real retirement day and an MTSZ source", () => {
    expect(retiredFile.stamps.length).toBeGreaterThan(0);
    const codes = retiredFile.stamps.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const e of retiredFile.stamps) {
      expect(seedRows.map((r) => r.code), e.code).not.toContain(e.code);
      expect(e.name, e.code).toBeTruthy();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(e.retired_on) && new Date(`${e.retired_on}T00:00:00Z`).toISOString().slice(0, 10) === e.retired_on, e.code).toBe(true);
      expect(e.source, e.code).toMatch(/^https:\/\/www\.(kektura\.hu|mtsz\.org)\//);
    }
  });

  it("AC-14: what a retired stamp points at (the place it followed, the one that replaced it) is a current place", () => {
    for (const e of retiredFile.stamps) {
      expect(seedPlaces, `${e.code}: after ${e.after_place_key}`).toContain(e.after_place_key);
      if (e.replaced_by) expect(seedPlaces, `${e.code}: replaced by ${e.replaced_by}`).toContain(e.replaced_by);
    }
  });

  it("AC-14: whatever is not from an official source is said so: `assumed` names only what the app can show as approximate", () => {
    for (const e of retiredFile.stamps) {
      for (const field of e.assumed ?? []) expect(["code", "position", "coordinates"], `${e.code}: ${field}`).toContain(field);
      if (e.lat !== undefined || e.lng !== undefined) expect(e.assumed ?? [], `${e.code}: coordinates`).not.toContain("coordinates");
    }
  });

  it("AC-14: the seed carries the generator's block for the file, before the cleanup, and lists the codes the cleanup must keep", async () => {
    const { readRetiredStamps, retiredStampsSql } = (await import("../scripts/lib/retired-stamps.mjs")) as {
      readRetiredStamps: () => unknown[];
      retiredStampsSql: (entries: unknown[]) => string;
    };
    const seedText = read("supabase/seed.sql");
    const block = retiredStampsSql(readRetiredStamps());
    expect(seedText).toContain(`\n${block}\n-- Rows this file no longer has`);
    const keep = seedText.match(/select unnest\(array\[([^\]]*)\]\) as code/)![1];
    for (const e of retiredFile.stamps) expect(keep, e.code).toContain(`'${e.code}'`);
  });

  it("AC-14: the retired rows are not part of the seed's rows of places (they never count in 161)", () => {
    const retiredCodes = new Set(retiredFile.stamps.map((e) => e.code));
    for (const r of seedRows) expect(retiredCodes.has(r.code), r.code).toBe(false);
    expect(seedPlaces.size).toBe(stagePlaceCount);
  });
});

const STAMP_LIMIT_M = 1000; // the farthest an alternative stamp (a village's pub or office) may be from the line; 801 m today
const PLACE_LIMIT_M = 400; // the nearest stamp of a place: 325 m today (Ostffyasszonyfa)
const KM_AGREEMENT = 0.5; // the km written in the seed against where the line is nearest to the stamp; 0.2 km at most today

const seedCoordinates = [
  ...read("supabase/seed.sql").matchAll(/^ {2}\(\d+, '([^']+)', '([^']+)', \d+, \d+, '(?:[^']|'')*', '(?:[^']|'')*', (-?[\d.]+), (-?[\d.]+), -?\d+, ([\d.]+)\)/gm),
].map((m) => ({ code: m[1], placeKey: m[2], lat: Number(m[3]), lng: Number(m[4]), km: Number(m[5]) }));

function metersToSegment(p: { lat: number; lng: number }, a: number[], b: number[]) {
  const M = 111320;
  const cos = Math.cos((p.lat * Math.PI) / 180);
  const [ax, ay] = [(a[0] - p.lng) * cos * M, (a[1] - p.lat) * M];
  const [bx, by] = [(b[0] - p.lng) * cos * M, (b[1] - p.lat) * M];
  const [dx, dy] = [bx - ax, by - ay];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function nearestOnRoute(p: { lat: number; lng: number }) {
  const pts = detail.points as number[][];
  let m = Infinity;
  for (let i = 1; i < pts.length; i++) m = Math.min(m, metersToSegment(p, pts[i - 1], pts[i]));
  return { m };
}

describe("spec 0004: the stamps and the drawn line", () => {
  const near = seedCoordinates.map((s) => ({ ...s, ...nearestOnRoute(s) }));

  it("AC-18: the seed's rows are read completely (the checks below are not vacuous)", () => {
    expect(seedCoordinates).toHaveLength(seedRows.length);
    expect(seedCoordinates.map((s) => s.code)).toEqual(seedRows.map((r) => r.code));
  });

  it("AC-18: every stamp is within 1 km of the line, and every place has a stamp within 400 m of it", () => {
    expect(near.filter((s) => s.m > STAMP_LIMIT_M).map((s) => `${s.code} ${Math.round(s.m)} m`)).toEqual([]);
    const byPlace = new Map<string, number>();
    for (const s of near) byPlace.set(s.placeKey, Math.min(byPlace.get(s.placeKey) ?? Infinity, s.m));
    expect([...byPlace].filter(([, m]) => m > PLACE_LIMIT_M).map(([key, m]) => `${key} ${Math.round(m)} m`)).toEqual([]);
  });

  it("AC-18: the km written in the seed is where the line is nearest to the stamp's coordinates: the seed and the route agree", () => {
    const apart = near.filter((s) => Math.abs(nearestKm(s) - s.km) > KM_AGREEMENT).map((s) => `${s.code}: seed ${s.km}, route ${nearestKm(s).toFixed(1)}`);
    expect(apart).toEqual([]);
  });

  it("AC-18: a stamp put a kilometre off its place is caught (the limits are not too loose to notice a wrong move)", () => {
    const s = seedCoordinates.find((c) => c.code === "OKTPH_84_B")!;
    expect(nearestOnRoute({ lat: s.lat, lng: s.lng }).m).toBeLessThan(PLACE_LIMIT_M);
    expect(nearestOnRoute({ lat: s.lat + 0.01, lng: s.lng }).m).toBeGreaterThan(PLACE_LIMIT_M);
  });
});

function nearestKm(p: { lat: number; lng: number }) {
  const pts = detail.points as number[][];
  let best = { m: Infinity, km: 0 };
  for (const q of pts) {
    const m = Math.hypot((q[0] - p.lng) * Math.cos((p.lat * Math.PI) / 180), q[1] - p.lat) * 111320;
    if (m < best.m) best = { m, km: q[2] };
  }
  return best.km;
}
