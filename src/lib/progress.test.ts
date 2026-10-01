import { describe, expect, it } from "vitest";
import {
  buildPlaces,
  buildStages,
  progressSummary,
  stageStampKeys,
  stampedPlaceKeys,
  stampsPerMonth,
  walkedRanges,
  type Checkpoint,
  type StageMeta,
} from "./progress";

let nextId = 1;
// One checkpoint row; variants of a place share `key`.
function cp(key: string, km: number, over: Partial<Checkpoint> = {}): Checkpoint {
  const id = nextId++;
  return {
    id,
    seq: id,
    stage: 1,
    stage_seq: 1,
    code: `${key}_${id}`,
    place_key: key,
    name: key,
    description: null,
    lat: 47,
    lng: 16,
    km_from_start: km,
    ...over,
  };
}

// Four places A..D, 10 km apart, in trail order.
function line() {
  return buildPlaces([cp("A", 0), cp("B", 10), cp("C", 20), cp("D", 30)]);
}

describe("spec 0001: places", () => {
  it("AC-1: alternative stamps sharing a place_key form one place at the km of the furthest variant", () => {
    const places = buildPlaces([cp("A", 0), cp("K", 12.6), cp("K", 13.0), cp("B", 20)]);
    expect(places.map((p) => p.key)).toEqual(["A", "K", "B"]);
    const k = places[1];
    expect(k.variants).toHaveLength(2);
    expect(k.km).toBe(13);
  });

  it("AC-1: the label is <stage>.<stage_seq>, falling back to the trail order", () => {
    const [a, b] = buildPlaces([
      cp("A", 0, { stage: 3, stage_seq: 4 }),
      cp("B", 1, { stage: null, stage_seq: null, seq: 42 }),
    ]);
    expect(a.label).toBe("3.4");
    expect(b.label).toBe("42");
  });

  it("AC-1: the place key falls back to the code, then the id", () => {
    const [a, b] = buildPlaces([
      cp("x", 0, { place_key: null, code: "OKTPH_99" }),
      cp("y", 1, { id: 777, place_key: null, code: null }),
    ]);
    expect(a.key).toBe("OKTPH_99");
    expect(b.key).toBe("777");
  });

  it("AC-2: a place is stamped when any of its variants is", () => {
    const places = buildPlaces([cp("A", 0), cp("K", 5), cp("K", 6)]);
    const second = places[1].variants[1].id;
    expect(stampedPlaceKeys(places, [second])).toEqual(new Set(["K"]));
    expect(stampedPlaceKeys(places, [])).toEqual(new Set());
  });
});

describe("spec 0001: walked stretches", () => {
  it("AC-3: a stretch counts only when both neighbouring places are stamped", () => {
    const places = line();
    expect(walkedRanges(places, new Set(["A"]))).toEqual([]);
    expect(walkedRanges(places, new Set(["A", "C"]))).toEqual([]);
    expect(walkedRanges(places, new Set(["A", "B"]))).toEqual([[0, 10]]);
    expect(walkedRanges(places, new Set(["A", "B", "D"]))).toEqual([[0, 10]]);
  });

  it("AC-3: stamps can be collected in any order; touching stretches merge", () => {
    const places = line();
    expect(walkedRanges(places, new Set(["C", "B", "A"]))).toEqual([[0, 20]]);
    expect(walkedRanges(places, new Set(["A", "B", "C", "D"]))).toEqual([[0, 30]]);
  });

  it("AC-3: neighbours are taken in km order, not row order", () => {
    // B's row comes first but it lies after A on the trail.
    const places = buildPlaces([cp("B", 10, { seq: 1 }), cp("A", 0, { seq: 2 }), cp("C", 20, { seq: 3 })]);
    expect(walkedRanges(places, new Set(["A", "B"]))).toEqual([[0, 10]]);
    expect(walkedRanges(places, new Set(["A", "C"]))).toEqual([]);
  });

  it("AC-4: totals, walked km, remaining km and percent", () => {
    const places = line();
    expect(progressSummary(places, walkedRanges(places, new Set(["A", "B"])))).toEqual({
      totalKm: 30,
      doneKm: 10,
      remainingKm: 20,
      percent: 33,
    });
    expect(progressSummary([], [])).toEqual({ totalKm: 0, doneKm: 0, remainingKm: 0, percent: 0 });
  });

  it("AC-4: kilometres are rounded to 0.1 (no floating-point noise)", () => {
    const places = buildPlaces([cp("A", 8.1), cp("B", 13.0), cp("C", 28.7)]);
    const s = progressSummary(places, walkedRanges(places, new Set(["A", "B"])));
    expect(s.doneKm).toBe(4.9);
    expect(s.remainingKm).toBe(15.7);
  });
});

describe("spec 0001: stamps per month", () => {
  it("AC-5: counts places (not variant rows) in the month of their earliest stamp", () => {
    const places = buildPlaces([cp("A", 0), cp("K", 5), cp("K", 6), cp("B", 9)]);
    const [a, k1, k2, b] = places.flatMap((p) => p.variants.map((v) => v.id));
    const data = stampsPerMonth(
      [
        { checkpoint_id: k2, stamped_on: "2026-09-03" },
        { checkpoint_id: k1, stamped_on: "2026-08-20" },
        { checkpoint_id: a, stamped_on: "2026-09-01" },
        { checkpoint_id: b, stamped_on: "2025-12-31" },
        { checkpoint_id: 999_999, stamped_on: "2026-01-01" }, // unknown checkpoint: ignored
      ],
      places,
    );
    expect(data).toEqual([
      { month: "2025-12", count: 1 },
      { month: "2026-08", count: 1 },
      { month: "2026-09", count: 1 },
    ]);
  });
});

describe("spec 0001: stages", () => {
  const meta: StageMeta[] = [
    { stage: 1, start: "A", end: "B", km: 10 },
    { stage: 2, start: "B", end: "C", km: 10 },
    { stage: 3, start: "D", end: "E", km: 10 }, // doesn't join stage 2 (ferry)
  ];
  const places = buildPlaces([
    cp("A", 0, { stage: 1 }),
    cp("B", 10, { stage: 1 }),
    cp("C", 20, { stage: 2 }),
    cp("D", 21, { stage: 3 }),
    cp("E", 30, { stage: 3 }),
  ]);

  it("AC-6: places are grouped by stage, in stage order", () => {
    const stages = buildStages([...places].reverse(), meta);
    expect(stages.map((s) => s.stage)).toEqual([1, 2, 3]);
    expect(stages[2].meta?.start).toBe("D");
  });

  it("AC-6: a stage starts at the previous stage's last place, except where they don't join", () => {
    const [s1, s2, s3] = buildStages(places, meta);
    expect(s1.startKey).toBeNull();
    expect(s2.startKey).toBe("B");
    expect(s3.startKey).toBeNull();
  });

  it("AC-7: marking a stage adds its starting point; unmarking removes only its own places", () => {
    const [s1, s2, s3] = buildStages(places, meta);
    expect(stageStampKeys(s1)).toEqual({ stamp: ["A", "B"], unstamp: ["A", "B"] });
    expect(stageStampKeys(s2)).toEqual({ stamp: ["B", "C"], unstamp: ["C"] });
    expect(stageStampKeys(s3)).toEqual({ stamp: ["D", "E"], unstamp: ["D", "E"] });
  });
});
