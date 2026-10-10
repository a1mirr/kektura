// The logic of "Set dates" (spec 0016 AC-14 to AC-21): which rows can be chosen, in which order, what a shift-click
// selects, and what a request holds. Pure, so the components and the server action stay thin.
import { isValidStampDate } from "./stamp-date";

// The most stamps one request may change: more than the 161 places and the extra stamps together, so "select all" always fits.
export const MAX_BULK_STAMPS = 500;

// A row the mode lists, stamped or not yet. `id` is what the selection stores; the list's order is the page's order
// (the stages in trail order with the retired stamps where they stand, then the extra stamps).
export type BulkItem =
  | { id: string; kind: "place"; placeKey: string; stage: number; name: string; stamped: boolean; retiredOn?: string }
  | { id: string; kind: "extra"; extraId: number; name: string; stamped: boolean };

export const placeItemId = (placeKey: string) => `p:${placeKey}`;
export const extraItemId = (extraId: number) => `e:${extraId}`;

type StageRows = {
  stage: number;
  places: { key: string; name: string }[];
  retired: { key: string; name: string; afterKey: string | null; retiredOn: string }[];
};

// The rows of the page that can be chosen, in the order they are shown: a retired stamp stands after the place it followed, and a
// retired stamp whose place is not in its stage closes the stage's list (as the page lists them). Every place and extra stamp is
// here, stamped or not; a retired stamp only once it is stamped (an unstamped one is collected on its own, spec 0016 AC-13).
export function buildBulkItems(input: {
  stages: StageRows[];
  isStamped: (placeKey: string) => boolean;
  extras: { id: number; name: string }[];
  isExtraStamped: (extraId: number) => boolean;
}): BulkItem[] {
  const items: BulkItem[] = [];
  for (const { stage, places, retired } of input.stages) {
    const keys = new Set(places.map((p) => p.key));
    const add = (key: string, name: string, retiredOn?: string) => {
      const stamped = input.isStamped(key);
      if (stamped || !retiredOn) items.push({ id: placeItemId(key), kind: "place", placeKey: key, stage, name, stamped, ...(retiredOn ? { retiredOn } : {}) });
    };
    for (const p of places) {
      add(p.key, p.name);
      for (const r of retired.filter((r) => r.afterKey === p.key)) add(r.key, r.name, r.retiredOn);
    }
    for (const r of retired.filter((r) => !r.afterKey || !keys.has(r.afterKey))) add(r.key, r.name, r.retiredOn);
  }
  for (const e of input.extras) {
    items.push({ id: extraItemId(e.id), kind: "extra", extraId: e.id, name: e.name, stamped: input.isExtraStamped(e.id) });
  }
  return items;
}

// The ids from `from` to `to` in the list's order, both included, whichever comes first. Nothing when either is not in the list.
export function rangeIds(items: readonly BulkItem[], from: string, to: string): string[] {
  const a = items.findIndex((i) => i.id === from);
  const b = items.findIndex((i) => i.id === to);
  if (a < 0 || b < 0) return [];
  return items.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.id);
}

// What a click on a row's checkbox does to the selection (spec 0016 AC-15): a plain click flips the row; a shift-click
// gives the whole range from the last chosen row to this one the state this row is getting. The clicked row becomes the
// anchor of the next range.
export function clickRow(
  items: readonly BulkItem[],
  selected: ReadonlySet<string>,
  anchor: string | null,
  id: string,
  shift: boolean,
): { selected: Set<string>; anchor: string } {
  const next = new Set(selected);
  const on = !selected.has(id);
  const ids = shift && anchor !== null ? rangeIds(items, anchor, id) : [];
  for (const target of ids.length > 0 ? ids : [id]) {
    if (on) next.add(target);
    else next.delete(target);
  }
  return { selected: next, anchor: id };
}

// The selection as the items it still names, in the list's order: a stamp that was removed meanwhile (here or in another tab) drops out.
export const selectedItems = (items: readonly BulkItem[], selected: ReadonlySet<string>): BulkItem[] => items.filter((i) => selected.has(i.id));

// How many of the chosen rows Apply will stamp for the first time (spec 0016 AC-16).
export const notStampedCount = (chosen: readonly BulkItem[]): number => chosen.filter((i) => !i.stamped).length;

// What the server action takes.
export function requestOf(chosen: readonly BulkItem[]): { placeKeys: string[]; extraIds: number[] } {
  return {
    placeKeys: chosen.flatMap((i) => (i.kind === "place" ? [i.placeKey] : [])),
    extraIds: chosen.flatMap((i) => (i.kind === "extra" ? [i.extraId] : [])),
  };
}

// The retired stamps among the chosen ones that cannot have `date`: it is on or after the day they retired (spec 0016 AC-13).
export function retiredConflicts(chosen: readonly BulkItem[], date: string): Extract<BulkItem, { kind: "place" }>[] {
  if (!isValidStampDate(date)) return [];
  return chosen.flatMap((i) => (i.kind === "place" && i.retiredOn !== undefined && date >= i.retiredOn ? [i] : []));
}

// Apply is possible for one valid date and a chosen stamp that no retired stamp stands in the way of (spec 0016 AC-16).
export function canApply(chosen: readonly BulkItem[], date: string, now?: Date): boolean {
  return (
    chosen.length > 0 &&
    chosen.length <= MAX_BULK_STAMPS &&
    isValidStampDate(date, now) &&
    retiredConflicts(chosen, date).length === 0
  );
}
