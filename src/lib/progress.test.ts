import { describe, expect, it } from "vitest";
import {
  buildPlaces,
  buildStages,
  progressSummary,
  stageStampKeys,
  countDone,
  waivedPlaceKeys,
  buildRetired,
  retiredVisibleKeys,
  stampedPlaceKeys,
  walkedRanges,
  findStageForKm,
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
    required_from: null,
    retired_on: null,
    replaced_by: null,
    after_place_key: null,
    position_approximate: false,
    moved_on: null,
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
    expect(stampedPlaceKeys(places, [{ checkpoint_id: second, stamped_on: "2023-10-01" }])).toEqual(
      new Map([["K", "2023-10-01"]])
    );
    expect(stampedPlaceKeys(places, [])).toEqual(new Map());
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

  it("AC-12, AC-15: findStageForKm maps an extra stamp to a stage based on km bounds, or to none", () => {
    const [s1, s2, s3] = buildStages(places, meta);
    const placeKm = new Map(places.map(p => [p.key, p.km]));
    const stages = [s1, s2, s3];

    // s1: [0, 10)
    // s2: [10, 20) (starts at B's km=10)
    // s3: [21, 30] (final stage, inclusive of end)
    expect(findStageForKm(0, stages, placeKm)).toBe(1);
    expect(findStageForKm(5, stages, placeKm)).toBe(1);
    expect(findStageForKm(10, stages, placeKm)).toBe(2);
    expect(findStageForKm(19.9, stages, placeKm)).toBe(2);
    expect(findStageForKm(20, stages, placeKm)).toBeNull(); // s2 ends at 20, s3 starts at 21
    expect(findStageForKm(21, stages, placeKm)).toBe(3);
    expect(findStageForKm(30, stages, placeKm)).toBe(3); // inclusive
    expect(findStageForKm(31, stages, placeKm)).toBeNull();
  });
});

// A place that gets a stamp only on `from`: "N" sits at 15 km between B (10) and C (20).
function lineWithNew(from: string | null) {
  return buildPlaces([cp("A", 0), cp("B", 10), cp("N", 15, { required_from: from }), cp("C", 20), cp("D", 30)]);
}
const on = (...pairs: [string, string][]) => new Map(pairs);

describe("spec 0001: stamps required from a date", () => {
  it("AC-16: a place is required from the earliest of its variants' dates, and from the beginning when one has none", () => {
    const dated = (from: string | null) => cp("K", 12, { required_from: from });
    expect(buildPlaces([cp("A", 0), dated("2025-05-08"), dated("2022-05-01")])[1].requiredFrom).toBe("2022-05-01");
    expect(buildPlaces([cp("A", 0), dated("2025-05-08"), dated(null)])[1].requiredFrom).toBeNull();
    expect(buildPlaces([cp("A", 0), dated(null), dated("2025-05-08")])[1].requiredFrom).toBeNull();
    expect(buildPlaces([cp("A", 0), dated("2025-05-08")])[1].requiredFrom).toBe("2025-05-08");
  });

  it("AC-17: a place nobody stamped is waived when the stretch was walked before its date, read from the later neighbour", () => {
    const places = lineWithNew("2025-05-08");
    expect([...waivedPlaceKeys(places, on(["B", "2025-01-01"], ["C", "2025-05-07"]))]).toEqual(["N"]);
    // Walked on the date itself, or with the later neighbour on or after it: required.
    expect(waivedPlaceKeys(places, on(["B", "2025-01-01"], ["C", "2025-05-08"])).size).toBe(0);
    expect(waivedPlaceKeys(places, on(["B", "2025-01-01"], ["C", "2026-01-01"])).size).toBe(0);
    // The earlier neighbour alone doesn't decide: B before the date, C after.
    expect(waivedPlaceKeys(places, on(["B", "2025-05-07"], ["C", "2025-05-09"])).size).toBe(0);
  });

  it("AC-17: the nearest stamped places count, however far; one neighbour is enough, none waives nothing", () => {
    const places = lineWithNew("2025-05-08");
    expect(waivedPlaceKeys(places, on(["A", "2024-06-01"], ["D", "2024-06-02"])).has("N")).toBe(true); // B and C unstamped
    expect(waivedPlaceKeys(places, on(["B", "2024-06-01"])).has("N")).toBe(true); // only a neighbour before
    expect(waivedPlaceKeys(places, on(["D", "2024-06-01"])).has("N")).toBe(true); // only one after
    expect(waivedPlaceKeys(places, on(["B", "2026-06-01"])).has("N")).toBe(false);
    expect(waivedPlaceKeys(places, on()).size).toBe(0);
  });

  it("AC-17: a stamped place is never waived, nor one without a date; a later stamp (any date) takes the waiver away", () => {
    const stamps = on(["B", "2024-01-01"], ["C", "2024-01-02"]);
    expect(waivedPlaceKeys(lineWithNew(null), stamps).size).toBe(0);
    expect(waivedPlaceKeys(lineWithNew("2025-05-08"), on(...stamps, ["N", "2026-01-01"])).size).toBe(0);
  });

  it("AC-18: the stretch runs across a waived place, so the km, percent and ranges don't change when the stamp is added (R-8)", () => {
    const stamps = on(["B", "2024-01-01"], ["C", "2024-01-02"]);
    const without = lineWithNew(null);
    // Before the place existed: B-C was one stretch of 10 km.
    expect(walkedRanges(buildPlaces([cp("A", 0), cp("B", 10), cp("C", 20), cp("D", 30)]), new Set(["B", "C"]))).toEqual([[10, 20]]);
    // With the new place and its stamp missing, but walked before it was required: still 10 km.
    const places = lineWithNew("2025-05-08");
    const waived = waivedPlaceKeys(places, stamps);
    const ranges = walkedRanges(places, new Set(stamps.keys()), waived);
    expect(ranges).toEqual([[10, 20]]);
    expect(progressSummary(places, ranges).doneKm).toBe(10);
    // Without a date the place is required from the beginning and the stretch is lost: B-N and N-C both need N.
    expect(walkedRanges(without, new Set(stamps.keys()))).toEqual([]);
  });

  it("AC-18: the opposite case: both neighbours stamped after the date and the place missing is not walked", () => {
    const places = lineWithNew("2025-05-08");
    const stamps = on(["B", "2025-06-01"], ["C", "2025-06-02"]);
    const waived = waivedPlaceKeys(places, stamps);
    expect(waived.size).toBe(0);
    expect(walkedRanges(places, new Set(stamps.keys()), waived)).toEqual([]);
  });

  it("AC-18: a waived place adds no walked km of its own beyond the stamped places on either side", () => {
    const places = lineWithNew("2025-05-08");
    const stamps = on(["A", "2024-01-01"], ["B", "2024-01-01"], ["C", "2024-01-01"], ["D", "2024-01-01"]);
    const ranges = walkedRanges(places, new Set(stamps.keys()), waivedPlaceKeys(places, stamps));
    expect(ranges).toEqual([[0, 30]]);
  });

  it("AC-20: a waived place is done for its stage but is not a stamp", () => {
    const places = lineWithNew("2025-05-08");
    const stamped = new Set(["B", "C"]);
    expect(countDone(places, stamped, new Set())).toBe(2);
    expect(countDone(places, stamped, new Set(["N"]))).toBe(3);
    expect(countDone(places, stamped, new Set(["N"])) - stamped.size).toBe(1);
  });
});

// A retired stamp that followed B (10 km) on the line A..D; it retired on 2014-11-21.
const retiredRow = (over: Partial<Checkpoint> = {}) =>
  cp("R", 10, { stage_seq: null, retired_on: "2014-11-21", replaced_by: "C", after_place_key: "B", position_approximate: true, ...over });
const lineWithRetired = () => [cp("A", 0), cp("B", 10), cp("C", 20), cp("D", 30), retiredRow()];

describe("spec 0001: retired stamps", () => {
  it("AC-22: a retired row is no place: it does not change the places, their km, the count or the stages", () => {
    const rows = lineWithRetired();
    const places = buildPlaces(rows);
    expect(places.map((p) => p.key)).toEqual(["A", "B", "C", "D"]);
    expect(progressSummary(places, [])).toEqual(progressSummary(buildPlaces(rows.slice(0, 4)), []));
    expect(buildStages(places, []).flatMap((s) => s.places.map((p) => p.key))).toEqual(["A", "B", "C", "D"]);
    // and it is never a neighbour of a stretch
    expect(walkedRanges(places, new Set(["A", "B", "C", "D"]))).toEqual([[0, 30]]);
  });

  it("AC-22: buildRetired reads the row: its own key, where it sat, when it retired, what replaced it", () => {
    const [r] = buildRetired(lineWithRetired());
    expect(r).toMatchObject({ key: "R", name: "R", afterKey: "B", retiredOn: "2014-11-21", replacedBy: "C", approximate: true });
    expect(buildRetired([cp("A", 0)])).toEqual([]);
  });

  const retired = () => buildRetired(lineWithRetired());
  const places = () => buildPlaces(lineWithRetired());
  const visible = (stamped: [string, string][], own: [string, string][] = []) =>
    [...retiredVisibleKeys(retired(), places(), new Map(stamped), new Map(own))];

  it("AC-23: a stamp the user holds is always listed, whatever their dates", () => {
    expect(visible([], [["R", "2026-01-01"]])).toEqual(["R"]);
  });

  it("AC-23: it is listed when the user walked past before it retired: the earlier neighbour's date decides", () => {
    expect(visible([["B", "2014-06-01"], ["C", "2015-06-01"]])).toEqual(["R"]); // earlier is before: collectable
    expect(visible([["B", "2015-06-01"], ["C", "2014-06-01"]])).toEqual(["R"]);
    expect(visible([["B", "2015-06-01"], ["C", "2016-06-01"]])).toEqual([]); // both after
    expect(visible([["B", "2014-11-21"], ["C", "2014-11-21"]])).toEqual([]); // on the day: no longer valid
    expect(visible([["B", "2014-11-20"]])).toEqual(["R"]); // one neighbour is enough
    expect(visible([["C", "2013-01-01"]])).toEqual(["R"]);
  });

  it("AC-23: the place it followed counts as before it, and the nearest stamped place on each side is read, however far", () => {
    expect(visible([["B", "2014-01-01"]])).toEqual(["R"]);
    expect(visible([["A", "2014-01-01"], ["D", "2020-01-01"]])).toEqual(["R"]); // B and C unstamped: A and D
    expect(visible([["A", "2013-01-01"], ["B", "2020-01-01"]])).toEqual([]); // B is the nearest before: A is not read
  });

  it("AC-23: with no stamped neighbour and no stamp of its own it is not listed", () => {
    expect(visible([])).toEqual([]);
    expect(retiredVisibleKeys([{ ...retired()[0], afterKey: null }], places(), new Map([["B", "2014-01-01"]]), new Map())).toEqual(new Set());
  });
});
