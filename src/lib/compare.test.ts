import { describe, expect, it } from "vitest";
import {
  compareProgress,
  complementRanges,
  intersectRanges,
  stageState,
  subtractRanges,
  WHO,
  type Comparison,
} from "./compare";
import { buildPlaces, buildStages, walkedRanges, type Checkpoint, type StageMeta } from "./progress";

let nextId = 1;
// One checkpoint row; variants of a place share `key`.
function cp(key: string, km: number, stage: number): Checkpoint {
  const id = nextId++;
  return {
    id,
    seq: id,
    stage,
    stage_seq: id,
    code: `${key}_${id}`,
    place_key: key,
    name: key,
    description: null,
    lat: 47,
    lng: 16,
    km_from_start: km,
    required_from: null,
  };
}

const meta: StageMeta[] = [
  { stage: 1, start: "A", end: "C", km: 20 },
  { stage: 2, start: "C", end: "E", km: 20.3 },
];

// Five places A..E in two stages (A, B, C | D, E): 10, 10, 10.2 and 10.1 km apart.
function trail() {
  const places = buildPlaces([cp("A", 0, 1), cp("B", 10, 1), cp("C", 20, 1), cp("D", 30.2, 2), cp("E", 40.3, 2)]);
  return { places, stages: buildStages(places, meta) };
}

const compare = (mine: readonly string[], theirs: readonly string[]) => {
  const { places, stages } = trail();
  return compareProgress(places, new Set<string>(mine), new Set<string>(theirs), stages);
};

const kmSum = (c: Comparison) => WHO.reduce((sum, who) => sum + c.km[who], 0);

describe("spec 0024: comparing two people's progress", () => {
  it("AC-23: places stamped by both, only by me, only by them, by neither", () => {
    const c = compare(["A", "B", "C"], ["B", "C", "D"]);
    expect(c.places).toEqual({ both: 2, me: 1, them: 1, neither: 1 });
    expect([...c.placeWho]).toEqual([
      ["A", "me"],
      ["B", "both"],
      ["C", "both"],
      ["D", "them"],
      ["E", "neither"],
    ]);
  });

  it("AC-23: the km walked by both is the intersection of the two sets of walked stretches", () => {
    const c = compare(["A", "B", "C"], ["B", "C", "D"]);
    expect(c.ranges.mine).toEqual([[0, 20]]);
    expect(c.ranges.theirs).toEqual([[10, 30.2]]);
    expect(c.ranges.both).toEqual([[10, 20]]);
    expect(c.ranges.me).toEqual([[0, 10]]);
    expect(c.ranges.them).toEqual([[20, 30.2]]);
    expect(c.ranges.neither).toEqual([[30.2, 40.3]]);
    expect(c.km).toEqual({ both: 10, me: 10, them: 10.2, neither: 10.1, total: 40.3 });
  });

  it("AC-23: both empty: everything is neither", () => {
    const c = compare([], []);
    expect(c.places).toEqual({ both: 0, me: 0, them: 0, neither: 5 });
    expect(c.km).toEqual({ both: 0, me: 0, them: 0, neither: 40.3, total: 40.3 });
    expect(c.ranges.both).toEqual([]);
    expect(c.stages.map((s) => s.state)).toEqual(["neither", "neither"]);
  });

  it("AC-23: identical stamps: everything is both, nothing is only one person's", () => {
    const all = ["A", "B", "C", "D", "E"];
    const c = compare(all, all);
    expect(c.places).toEqual({ both: 5, me: 0, them: 0, neither: 0 });
    expect(c.km).toEqual({ both: 40.3, me: 0, them: 0, neither: 0, total: 40.3 });
    expect(c.ranges.me).toEqual([]);
    expect(c.ranges.them).toEqual([]);
    expect(c.stages.map((s) => s.state)).toEqual(["both", "both"]);
  });

  it("AC-23: disjoint stamps that touch no common stretch: no km together", () => {
    const c = compare(["A", "B"], ["D", "E"]);
    expect(c.places).toEqual({ both: 0, me: 2, them: 2, neither: 1 });
    expect(c.ranges.both).toEqual([]);
    expect(c.km).toEqual({ both: 0, me: 10, them: 10.1, neither: 20.2, total: 40.3 });
  });

  it("AC-23: one person with everything and the other with nothing", () => {
    const c = compare(["A", "B", "C", "D", "E"], []);
    expect(c.places).toEqual({ both: 0, me: 5, them: 0, neither: 0 });
    expect(c.km).toEqual({ both: 0, me: 40.3, them: 0, neither: 0, total: 40.3 });
    expect(c.stages.map((s) => s.state)).toEqual(["me", "me"]);
    const reverse = compare([], ["A", "B", "C", "D", "E"]);
    expect(reverse.km).toEqual({ both: 0, me: 0, them: 40.3, neither: 0, total: 40.3 });
    expect(reverse.stages.map((s) => s.state)).toEqual(["them", "them"]);
  });

  it("AC-23: a place with several variants counts once, and any variant stamps it", () => {
    const places = buildPlaces([cp("A", 0, 1), cp("B", 10, 1), cp("B", 10.1, 1), cp("C", 20, 1)]);
    const stages = buildStages(places, meta);
    const c = compareProgress(places, new Set(["A", "B"]), new Set(["B", "C"]), stages);
    expect(places).toHaveLength(3);
    expect(c.places).toEqual({ both: 1, me: 1, them: 1, neither: 0 });
    expect(c.stages[0]).toMatchObject({ me: 2, them: 2, total: 3 });
  });

  it("AC-23: the four km figures add up to the total, whatever the rounding", () => {
    // Three stretches of 3.33 km: each of the three parts rounds up to 3.3 and the sum stays exact.
    const places = buildPlaces([cp("A", 0, 1), cp("B", 3.33, 1), cp("C", 6.66, 1), cp("D", 9.99, 1)]);
    const stages = buildStages(places, meta);
    for (const [mine, theirs] of [
      [["A", "B"], ["C", "D"]],
      [["A", "B", "C", "D"], ["A", "B", "C", "D"]],
      [["A", "B", "C"], ["B", "C", "D"]],
      [["A", "B"], ["B", "C"]],
      [[], ["A", "B", "C", "D"]],
    ] as const) {
      const c = compareProgress(places, new Set<string>(mine), new Set<string>(theirs), stages);
      expect(Math.round(kmSum(c) * 10) / 10, `${mine} / ${theirs}`).toBe(c.km.total);
      for (const who of WHO) expect(c.km[who], `${who} is not negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it("AC-23: nothing left over after rounding up: 'neither' never goes below zero", () => {
    // 0.05 km stretches round up to 0.1 each; the whole trail is walked, so the figures must still add up.
    const places = buildPlaces([cp("A", 0, 1), cp("B", 0.05, 1), cp("C", 0.1, 1), cp("D", 0.15, 1)]);
    const stages = buildStages(places, meta);
    const c = compareProgress(places, new Set(["A", "B"]), new Set(["B", "C", "D"]), stages);
    expect(c.km.neither).toBeGreaterThanOrEqual(0);
    expect(Math.round(kmSum(c) * 10) / 10).toBe(c.km.total);
  });

  it("AC-23: a stretch counts as walked only by the rule of spec 0001 AC-3, so no dashboard disagrees", () => {
    const { places } = trail();
    // Skipping B: neither A-B nor B-C is walked, however many places were stamped.
    const c = compare(["A", "C", "D", "E"], ["A", "B", "C"]);
    expect(c.ranges.mine).toEqual(walkedRanges(places, new Set(["A", "C", "D", "E"])));
    expect(c.ranges.theirs).toEqual(walkedRanges(places, new Set(["A", "B", "C"])));
    expect(c.ranges.both).toEqual([]);
    expect(c.km.both).toBe(0);
  });
});

describe("spec 0024: comparing with places someone was not missing", () => {
  it("AC-25: the stretch runs across a place a person was not missing, and a stage with only stamped and waived places is theirs", () => {
    const { places, stages } = trail();
    // B is a new stamp I walked past before it was required: A and C are stamped, B is waived.
    const c = compareProgress(places, new Set(["A", "C"]), new Set(["A", "B", "C"]), stages, { mine: new Set(["B"]) });
    expect(c.ranges.mine).toEqual([[0, 20]]);
    expect(c.ranges.both).toEqual([[0, 20]]);
    expect(c.places).toEqual({ both: 2, me: 0, them: 1, neither: 2 }); // B is only theirs: waived is not a stamp
    expect(c.stages[0]).toMatchObject({ stage: 1, me: 3, them: 3, state: "both" });
    // Without the waiver the same stamps do not complete the stage.
    expect(compareProgress(places, new Set(["A", "C"]), new Set(["A", "B", "C"]), stages).stages[0].state).toBe("them");
  });
});

describe("spec 0024: how a stage stands", () => {
  it("AC-24: both complete, only me, only them, neither started, otherwise partly", () => {
    expect(stageState(3, 3, 3)).toBe("both");
    expect(stageState(3, 2, 3)).toBe("me");
    expect(stageState(0, 3, 3)).toBe("them");
    expect(stageState(0, 0, 3)).toBe("neither");
    expect(stageState(1, 2, 3)).toBe("partly");
    expect(stageState(3, 0, 3)).toBe("me");
  });

  it("AC-24: the first rule that applies decides: a one-place stage that only I stamped is mine, not partly", () => {
    expect(stageState(1, 0, 1)).toBe("me");
    expect(stageState(0, 1, 1)).toBe("them");
    expect(stageState(1, 1, 1)).toBe("both");
    expect(stageState(0, 0, 1)).toBe("neither");
  });

  it("AC-24: every stage gets exactly one state and the counts of each person", () => {
    const c = compare(["A", "B", "C", "D"], ["A", "B", "C"]);
    expect(c.stages).toEqual([
      { stage: 1, me: 3, them: 3, total: 3, state: "both" },
      { stage: 2, me: 1, them: 0, total: 2, state: "partly" },
    ]);
    const states = new Set(["both", "me", "them", "neither", "partly"]);
    for (const [mine, theirs] of [[[], []], [["A"], ["E"]], [["A", "B", "C"], []]] as const) {
      for (const s of compare(mine, theirs).stages) expect(states.has(s.state)).toBe(true);
    }
  });
});

describe("spec 0024: operations on walked stretches", () => {
  it("AC-23: intersect, subtract and complement", () => {
    expect(intersectRanges([[0, 10], [20, 30]], [[5, 25]])).toEqual([[5, 10], [20, 25]]);
    expect(intersectRanges([[0, 10]], [[10, 20]])).toEqual([]); // touching is not sharing
    expect(subtractRanges([[0, 30]], [[5, 10], [20, 25]])).toEqual([[0, 5], [10, 20], [25, 30]]);
    expect(subtractRanges([[0, 10]], [[0, 10]])).toEqual([]);
    expect(subtractRanges([[0, 10]], [])).toEqual([[0, 10]]);
    expect(complementRanges([[5, 10]], 0, 20)).toEqual([[0, 5], [10, 20]]);
    expect(complementRanges([], 0, 20)).toEqual([[0, 20]]);
  });
});
