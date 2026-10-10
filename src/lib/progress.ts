import type { Tables } from "@/lib/supabase/database.types";

export type Checkpoint = Pick<
  Tables<"checkpoints">,
  "id" | "seq" | "stage" | "stage_seq" | "code" | "place_key" | "name" | "description" | "lat" | "lng" | "km_from_start" | "required_from" | "retired_on" | "replaced_by" | "after_place_key" | "position_approximate" | "moved_on"
>;

export type StampRow = Pick<Tables<"user_stamps">, "checkpoint_id" | "stamped_on">;

export type Place = {
  key: string;
  seq: number;
  stage: number;
  label: string;
  name: string;
  km: number;
  // The first day the place's stamp is required (the MTSZ's date for a new stamp); null: from the beginning.
  requiredFrom: string | null;
  variants: Checkpoint[];
};

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

// `afterKey` is the current place it followed, which gives it its position in the stage list.
export type RetiredStamp = Place & {
  retiredOn: string;
  replacedBy: string | null;
  afterKey: string | null;
  approximate: boolean;
};

export function buildPlaces(checkpoints: Checkpoint[]): Place[] {
  const places = new Map<string, Place>();
  for (const c of checkpoints) {
    if (c.retired_on != null) continue;
    const key = placeKeyOf(c);
    const km = Number(c.km_from_start);
    const p = places.get(key);
    if (p) {
      p.variants.push(c);
      // A place sits at its furthest-along variant: the MTSZ table lengths measure to it.
      p.km = Math.max(p.km, km);
      // The earliest of the variants' dates; a variant without one means "from the beginning".
      if (c.required_from == null) p.requiredFrom = null;
      else if (p.requiredFrom !== null && c.required_from < p.requiredFrom) p.requiredFrom = c.required_from;
    } else {
      const label = c.stage != null && c.stage_seq != null ? `${c.stage}.${c.stage_seq}` : String(c.seq);
      places.set(key, { key, seq: c.seq, stage: c.stage ?? 0, label, name: c.name, km, requiredFrom: c.required_from ?? null, variants: [c] });
    }
  }
  return [...places.values()];
}

export function buildRetired(checkpoints: Checkpoint[]): RetiredStamp[] {
  return checkpoints
    .filter((c) => c.retired_on != null)
    .map((c) => ({
      key: placeKeyOf(c),
      seq: c.seq,
      stage: c.stage ?? 0,
      label: "",
      name: c.name,
      km: Number(c.km_from_start),
      requiredFrom: null,
      variants: [c],
      retiredOn: c.retired_on!,
      replacedBy: c.replaced_by,
      afterKey: c.after_place_key,
      approximate: c.position_approximate,
    }));
}

export function retiredVisibleKeys(
  retired: RetiredStamp[],
  places: Place[],
  stampedOn: ReadonlyMap<string, string>,
  retiredStampedOn: ReadonlyMap<string, string>,
): Set<string> {
  const ordered = [...places].sort(byTrailOrder);
  const visible = new Set<string>();
  for (const r of retired) {
    if (retiredStampedOn.has(r.key)) {
      visible.add(r.key);
      continue;
    }
    const at = ordered.findIndex((p) => p.key === r.afterKey);
    if (at < 0) continue;
    const near = (indices: number[]) => indices.map((i) => stampedOn.get(ordered[i].key)).find((d) => d !== undefined);
    const down = near(Array.from({ length: at + 1 }, (_, k) => at - k));
    const up = near(Array.from({ length: ordered.length - at - 1 }, (_, k) => at + 1 + k));
    const earliest = [down, up].filter((d): d is string => d !== undefined).sort()[0];
    if (earliest !== undefined && earliest < r.retiredOn) visible.add(r.key);
  }
  return visible;
}

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

const byTrailOrder = (a: Place, b: Place) => a.km - b.km || a.seq - b.seq;

export function waivedPlaceKeys(places: Place[], stampedOn: ReadonlyMap<string, string>): Set<string> {
  const ordered = [...places].sort(byTrailOrder);
  const before: (string | null)[] = [];
  let last: string | null = null;
  for (const p of ordered) {
    before.push(last);
    last = stampedOn.get(p.key) ?? last;
  }
  const waived = new Set<string>();
  last = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const p = ordered[i];
    const walkedOn = [before[i], last].filter((d): d is string => d !== null).sort().at(-1);
    if (p.requiredFrom !== null && !stampedOn.has(p.key) && walkedOn !== undefined && walkedOn < p.requiredFrom) {
      waived.add(p.key);
    }
    last = stampedOn.get(p.key) ?? last;
  }
  return waived;
}

export function walkedRanges(
  places: Place[],
  stamped: { has: (key: string) => boolean },
  waived: { has: (key: string) => boolean } = { has: () => false },
): KmRange[] {
  const ordered = places.filter((p) => !waived.has(p.key)).sort(byTrailOrder);
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

export const countDone = (places: Place[], stamped: { has: (key: string) => boolean }, waived: { has: (key: string) => boolean }) =>
  places.filter((p) => stamped.has(p.key) || waived.has(p.key)).length;

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

export function stageStampKeys(stage: Stage): { stamp: string[]; unstamp: string[] } {
  const own = stage.places.map((p) => p.key);
  return { stamp: stage.startKey ? [stage.startKey, ...own] : own, unstamp: own };
}

// The bounds are [startKm, endKm) where startKm is the km of the stage's startKey (or first place), and endKm is the
// km of its last place. For the final stage, endKm is inclusive.
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
