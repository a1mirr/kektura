// What the page needs to know about new stamps beyond the database (spec 0001 AC-19): whether the MTSZ announced a
// one-month tolerance with a stamp's date. That flag lives only in scripts/data/okt-stamp-dates.json.
import type { Place } from "./progress";
import stampDates from "../../scripts/data/okt-stamp-dates.json";

const WITH_TOLERANCE = new Set(
  (stampDates.stamps as { code: string; tolerance_note?: boolean }[]).filter((e) => e.tolerance_note === true).map((e) => e.code),
);

export const hasToleranceNote = (place: Pick<Place, "variants">, withTolerance: ReadonlySet<string> = WITH_TOLERANCE) =>
  place.variants.some((v) => v.code !== null && withTolerance.has(v.code));
