import { progressSummary, walkedRanges, type KmRange, type Place, type Stage } from "./progress";

export type Who = "both" | "me" | "them" | "neither";
export const WHO: readonly Who[] = ["both", "me", "them", "neither"];

export type StageState = "both" | "me" | "them" | "neither" | "partly";

export type StageComparison = { stage: number; me: number; them: number; total: number; state: StageState };

export type ComparisonRanges = Record<Who, KmRange[]> & { mine: KmRange[]; theirs: KmRange[] };

export type Comparison = {
  places: Record<Who, number>;
  placeWho: Map<string, Who>;
  km: Record<Who, number> & { total: number };
  ranges: ComparisonRanges;
  stages: StageComparison[];
};

type Stamped = { has: (key: string) => boolean };

const round1 = (km: number) => Math.round(km * 10) / 10;
const lengthOf = (ranges: KmRange[]) => ranges.reduce((sum, [from, to]) => sum + (to - from), 0);

function merge(ranges: KmRange[]): KmRange[] {
  const merged: KmRange[] = [];
  for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

export function intersectRanges(a: KmRange[], b: KmRange[]): KmRange[] {
  const x = merge(a);
  const y = merge(b);
  const result: KmRange[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const from = Math.max(x[i][0], y[j][0]);
    const to = Math.min(x[i][1], y[j][1]);
    if (from < to) result.push([from, to]);
    if (x[i][1] < y[j][1]) i++;
    else j++;
  }
  return result;
}

export function subtractRanges(a: KmRange[], b: KmRange[]): KmRange[] {
  const cut = merge(b);
  const result: KmRange[] = [];
  for (const [start, end] of merge(a)) {
    let from = start;
    for (const [cutFrom, cutTo] of cut) {
      if (cutTo <= from || cutFrom >= end) continue;
      if (cutFrom > from) result.push([from, cutFrom]);
      from = Math.max(from, cutTo);
    }
    if (from < end) result.push([from, end]);
  }
  return result;
}

export const complementRanges = (ranges: KmRange[], from: number, to: number) => subtractRanges([[from, to]], ranges);

// Three figures rounded, the fourth the total minus them. Rounding three figures up can leave a "neither" of
// -0.1 when nothing is left: then the biggest of the three gives it back, so the sum still holds.
function kmFigures(parts: Pick<Record<Who, number>, "both" | "me" | "them">, total: number): Comparison["km"] {
  const km = { both: round1(parts.both), me: round1(parts.me), them: round1(parts.them), neither: 0, total };
  km.neither = round1(total - km.both - km.me - km.them);
  if (km.neither < 0) {
    const biggest = (["both", "me", "them"] as const).reduce((a, b) => (km[a] >= km[b] ? a : b));
    km[biggest] = round1(km[biggest] + km.neither);
    km.neither = 0;
  }
  return km;
}

// The order matters: a stage with one place that only I stamped is "me", not "partly".
export function stageState(me: number, them: number, total: number): StageState {
  if (me === total && them === total) return "both";
  if (me === total) return "me";
  if (them === total) return "them";
  if (me === 0 && them === 0) return "neither";
  return "partly";
}

export function compareProgress(
  places: Place[],
  mine: Stamped,
  theirs: Stamped,
  stages: Stage[],
  waived: { mine?: Stamped; theirs?: Stamped } = {},
): Comparison {
  const mineWaived = waived.mine ?? { has: () => false };
  const theirsWaived = waived.theirs ?? { has: () => false };
  const placeWho = new Map<string, Who>();
  const counts: Record<Who, number> = { both: 0, me: 0, them: 0, neither: 0 };
  for (const p of places) {
    const a = mine.has(p.key);
    const b = theirs.has(p.key);
    const who: Who = a && b ? "both" : a ? "me" : b ? "them" : "neither";
    placeWho.set(p.key, who);
    counts[who]++;
  }

  const myRanges = walkedRanges(places, mine, mineWaived);
  const theirRanges = walkedRanges(places, theirs, theirsWaived);
  const both = intersectRanges(myRanges, theirRanges);
  const me = subtractRanges(myRanges, theirRanges);
  const them = subtractRanges(theirRanges, myRanges);
  const kms = places.map((p) => p.km);
  const [first, last] = kms.length ? [Math.min(...kms), Math.max(...kms)] : [0, 0];
  const neither = complementRanges(merge([...myRanges, ...theirRanges]), first, last);

  return {
    places: counts,
    placeWho,
    km: kmFigures(
      { both: lengthOf(both), me: lengthOf(me), them: lengthOf(them) },
      progressSummary(places, []).totalKm,
    ),
    ranges: { both, me, them, neither, mine: myRanges, theirs: theirRanges },
    stages: stages.map((s) => {
      const a = s.places.filter((p) => mine.has(p.key) || mineWaived.has(p.key)).length;
      const b = s.places.filter((p) => theirs.has(p.key) || theirsWaived.has(p.key)).length;
      return { stage: s.stage, me: a, them: b, total: s.places.length, state: stageState(a, b, s.places.length) };
    }),
  };
}
