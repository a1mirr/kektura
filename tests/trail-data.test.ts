// Integrity of the generated trail data (scripts/build-data.mjs output). These catch a broken
// regeneration before it reaches the database or the map; they assert relationships between the
// files rather than today's numbers, so a legitimate MTSZ update keeps them green.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import hopsJson from "../public/data/okt-hops.json";
import overview from "../public/data/okt-route.json";
import detail from "../public/data/okt-route-detail.json";
import stagesJson from "../scripts/data/okt-stages.json";
import type { Hop } from "@/lib/route-stats";
import { TRAIL_FACTS } from "@/lib/trail-facts";

const hops = hopsJson as Hop[];
const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const round1 = (x: number) => Math.round(x * 10) / 10;

// (seq, code, place_key, stage, stage_seq, name, ...) rows of supabase/seed.sql
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
