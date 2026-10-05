// What the page needs to know about new stamps beyond the database (spec 0001 AC-19): whether the MTSZ announced a
// one-month tolerance with a stamp's date. That flag lives only in scripts/data/okt-stamp-dates.json.
import type { Place } from "./progress";
import stampDates from "../../scripts/data/okt-stamp-dates.json";

const WITH_TOLERANCE = new Set(
  (stampDates.stamps as { code: string; tolerance_note?: boolean }[]).filter((e) => e.tolerance_note === true).map((e) => e.code),
);

// The line the map's popup adds for a new stamp (spec 0003 AC-22): when it is required from and, if the user walked past before then,
// that it is not required for them. Nothing for a place that was always required.
export function requiredNote(
  requiredFrom: string | null,
  waived: boolean,
  text: { requiredFrom: (date: string) => string; notRequired: string },
  formatDate: (iso: string) => string,
): string | undefined {
  if (!requiredFrom) return undefined;
  return [text.requiredFrom(formatDate(requiredFrom)), waived ? text.notRequired : null].filter(Boolean).join(" · ");
}

export const hasToleranceNote = (place: Pick<Place, "variants">, withTolerance: ReadonlySet<string> = WITH_TOLERANCE) =>
  place.variants.some((v) => v.code !== null && withTolerance.has(v.code));
