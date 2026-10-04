// Progress domain logic for the dashboard: places, stages, walked stretches, statistics.
// Pure functions (no I/O) so the rules are unit-tested; see spec 0001.
import type { Tables } from "@/lib/supabase/database.types";

export type Checkpoint = Pick<
  Tables<"checkpoints">,
  "id" | "seq" | "stage" | "stage_seq" | "code" | "place_key" | "name" | "description" | "lat" | "lng" | "km_from_start"
>;

export type StampRow = Pick<Tables<"user_stamps">, "checkpoint_id" | "stamped_on">;

// A "place" groups alternative stamps at the same spot (161 places on the official trail).
export type Place = {
  key: string;
  seq: number;
  stage: number;
  label: string;
  name: string;
  km: number;
  variants: Checkpoint[];
};

// [fromKm, toKm] along the trail.
export type KmRange = [number, number];

export type StageMeta = { stage: number; start: string; end: string; km: number };

export type Stage = {
  stage: number;
  meta: StageMeta | undefined;
  places: Place[];
  // Place stamped together with the stage so its first stretch counts as walked (null: none).
  startKey: string | null;
};

export const placeKeyOf = (c: Pick<Checkpoint, "place_key" | "code" | "id">) =>
  c.place_key ?? c.code ?? String(c.id);

// Places in the order of their first variant (`checkpoints` sorted by seq).
export function buildPlaces(checkpoints: Checkpoint[]): Place[] {
  const places = new Map<string, Place>();
  for (const c of checkpoints) {
    const key = placeKeyOf(c);
    const km = Number(c.km_from_start);
    const p = places.get(key);
    if (p) {
      p.variants.push(c);
      // A place sits at its furthest-along variant: the MTSZ table lengths measure to it.
      p.km = Math.max(p.km, km);
    } else {
      // "<stage>.<n>" per the official 27 sections; falls back to the trail order if unset.
      const label = c.stage != null && c.stage_seq != null ? `${c.stage}.${c.stage_seq}` : String(c.seq);
      places.set(key, { key, seq: c.seq, stage: c.stage ?? 0, label, name: c.name, km, variants: [c] });
    }
  }
  return [...places.values()];
}

// A place is stamped when any of its variants is.
export function stampedPlaceKeys(places: Place[], stamps: StampRow[]): Map<string, string> {
  const stampDates = new Map<number, string>(stamps.map((s) => [s.checkpoint_id, s.stamped_on]));
  const result = new Map<string, string>();
  for (const p of places) {
    const dates = p.variants
      .map((v) => stampDates.get(v.id))
      .filter((d): d is string => d !== undefined)
      .sort();
    if (dates.length > 0) result.set(p.key, dates[0]);
  }
  return result;
}

// Stamps can be collected in any order. A stretch counts as walked only when BOTH of its neighbouring
// places (in trail order) are stamped; touching stretches merge into one range.
export function walkedRanges(places: Place[], stamped: { has: (key: string) => boolean }): KmRange[] {
  const ordered = [...places].sort((a, b) => a.km - b.km || a.seq - b.seq);
  const ranges: KmRange[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (!stamped.has(a.key) || !stamped.has(b.key) || b.km <= a.km) continue;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === a.km) last[1] = b.km;
    else ranges.push([a.km, b.km]);
  }
  return ranges;
}

const round1 = (km: number) => Math.round(km * 10) / 10;

export function progressSummary(places: Place[], ranges: KmRange[]) {
  const kms = places.map((p) => p.km);
  const totalKm = kms.length ? round1(Math.max(...kms) - Math.min(...kms)) : 0;
  const doneKm = round1(ranges.reduce((sum, [from, to]) => sum + (to - from), 0));
  return {
    totalKm,
    doneKm,
    remainingKm: round1(Math.max(0, totalKm - doneKm)),
    percent: totalKm ? Math.round((doneKm / totalKm) * 100) : 0,
  };
}

// Places (not rows: a stamped place has a row per variant) first stamped in each month, oldest first.
export function stampsPerMonth(stamps: StampRow[], places: Place[]): { month: string; count: number }[] {
  const placeOf = new Map(places.flatMap((p) => p.variants.map((v) => [v.id, p.key] as const)));
  const monthOfPlace = new Map<string, string>();
  for (const s of stamps) {
    const place = placeOf.get(s.checkpoint_id);
    const month = s.stamped_on.slice(0, 7);
    const seen = place && monthOfPlace.get(place);
    if (place && (!seen || month < seen)) monthOfPlace.set(place, month);
  }
  const byMonth = new Map<string, number>();
  for (const month of monthOfPlace.values()) byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

// Places grouped by official stage (1..27), in stage order. A stage's starting point is the previous
// stage's last place (same stamp), except where they don't join (Visegrád -> Nagymaros, a ferry).
export function buildStages(places: Place[], stagesMeta: StageMeta[]): Stage[] {
  const meta = new Map(stagesMeta.map((st) => [st.stage, st]));
  const byStage = new Map<number, Place[]>();
  for (const p of places) {
    const list = byStage.get(p.stage);
    if (list) list.push(p);
    else byStage.set(p.stage, [p]);
  }
  const nums = [...byStage.keys()].sort((a, b) => a - b);
  return nums.map((stage, i) => {
    const prev = nums[i - 1];
    const joins = prev !== undefined && meta.get(stage)?.start === meta.get(prev)?.end;
    return {
      stage,
      meta: meta.get(stage),
      places: byStage.get(stage)!,
      startKey: joins ? byStage.get(prev)!.at(-1)!.key : null,
    };
  });
}

// Place keys for the per-stage button: marking adds the stage's own places plus its starting point
// (so the first stretch counts as walked); unmarking removes only the stage's own places.
export function stageStampKeys(stage: Stage): { stamp: string[]; unstamp: string[] } {
  const own = stage.places.map((p) => p.key);
  return { stamp: stage.startKey ? [stage.startKey, ...own] : own, unstamp: own };
}

// Maps a km_from_start value (e.g. from an extra stamp) to a stage number based on the stage's km bounds.
// The bounds are [startKm, endKm) where startKm is the km of the stage's startKey (or first place),
// and endKm is the km of its last place. For the final stage, endKm is inclusive.
export function findStageForKm(km: number, stages: Stage[], placeKm: Map<string, number>): number | null {
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage.places.length === 0) continue;
    
    const startKm = stage.startKey !== null ? (placeKm.get(stage.startKey) ?? stage.places[0].km) : stage.places[0].km;
    const endKm = stage.places.at(-1)!.km;
    
    const isLastStage = i === stages.length - 1;
    if (km >= startKm && (isLastStage ? km <= endKm : km < endKm)) {
      return stage.stage;
    }
  }
  return null;
}
