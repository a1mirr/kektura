import {
  findStageForKm,
  stampedPlaceKeys,
  waivedPlaceKeys,
  type Place,
  type Stage,
  type StampRow,
} from "@/lib/progress";

// `month` is "YYYY-MM": the calendar month of a stamp date as written (a day, not an instant: no time zone is involved).
export type MonthStats = {
  month: string;
  stamps: number;
  extraStamps: number;
  stages: number[];
  km: number; // kilometres that became walked in the month, unrounded
};

export type ExtraStampRow = { extra_id: number; stamped_on: string };

const monthOf = (date: string) => date.slice(0, 7);

export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let year = Number(first.slice(0, 4));
  let month = Number(first.slice(5, 7));
  const lastYear = Number(last.slice(0, 4));
  const lastMonth = Number(last.slice(5, 7));
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function monthlyProgress(input: {
  places: Place[];
  stamps: StampRow[];
  stages: Stage[];
  extras: { id: number; km_from_start: number | string }[];
  extraStamps: ExtraStampRow[];
}): MonthStats[] {
  const { places, stamps, stages, extras, extraStamps } = input;
  const stampedOn = stampedPlaceKeys(places, stamps);
  const placeKm = new Map(places.map((p) => [p.key, p.km]));
  const extraKm = new Map(extras.map((e) => [e.id, Number(e.km_from_start)]));

  const dates = [...stampedOn.values(), ...extraStamps.map((s) => s.stamped_on)].sort();
  if (dates.length === 0) return [];
  const byMonth = new Map<string, MonthStats>(
    monthsBetween(monthOf(dates[0]), monthOf(dates[dates.length - 1])).map((month) => [
      month,
      { month, stamps: 0, extraStamps: 0, stages: [], km: 0 },
    ]),
  );
  const stageSets = new Map<string, Set<number>>([...byMonth.keys()].map((month) => [month, new Set<number>()]));

  for (const place of places) {
    const date = stampedOn.get(place.key);
    if (date === undefined) continue;
    const month = byMonth.get(monthOf(date))!;
    month.stamps += 1;
    if (place.stage > 0) stageSets.get(month.month)!.add(place.stage);
  }

  for (const s of extraStamps) {
    const month = byMonth.get(monthOf(s.stamped_on))!;
    month.extraStamps += 1;
    const km = extraKm.get(s.extra_id);
    const stage = km === undefined ? null : findStageForKm(km, stages, placeKm);
    if (stage !== null) stageSets.get(month.month)!.add(stage);
  }

  const waived = waivedPlaceKeys(places, stampedOn);
  const ordered = places.filter((p) => !waived.has(p.key)).sort((a, b) => a.km - b.km || a.seq - b.seq);
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const dateA = stampedOn.get(a.key);
    const dateB = stampedOn.get(b.key);
    if (dateA === undefined || dateB === undefined || b.km <= a.km) continue;
    byMonth.get(monthOf(dateA > dateB ? dateA : dateB))!.km += b.km - a.km;
  }

  return [...byMonth.values()].map((m) => ({ ...m, stages: [...stageSets.get(m.month)!].sort((x, y) => x - y) }));
}

export function stageList(stages: number[]): string {
  const sorted = [...new Set(stages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let end = i;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    if (end - i + 1 >= 4) parts.push(`${sorted[i]}-${sorted[end]}`);
    else for (let k = i; k <= end; k++) parts.push(String(sorted[k]));
    i = end + 1;
  }
  return parts.join(", ");
}

const round1 = (km: number) => Math.round(km * 10) / 10;

export type MonthWords = {
  stamps: (count: number) => string;
  extraStamps: (count: number) => string;
  none: string;
  km: (km: number) => string;
  stage: (list: string) => string;
  stages: (list: string) => string;
};

// Kilometres appear only with places (a stretch is walked when a place is stamped).
export function monthLines(m: MonthStats, words: MonthWords): string[] {
  const lines: string[] = [];
  if (m.stamps > 0) lines.push(words.stamps(m.stamps), words.km(round1(m.km)));
  if (m.extraStamps > 0) lines.push(words.extraStamps(m.extraStamps));
  if (m.stamps === 0 && m.extraStamps === 0) lines.push(words.none);
  if (m.stages.length > 0) lines.push((m.stages.length === 1 ? words.stage : words.stages)(stageList(m.stages)));
  return lines;
}
