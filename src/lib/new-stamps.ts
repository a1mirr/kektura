import type { Place } from "./progress";
import stampDates from "../../scripts/data/okt-stamp-dates.json";

const WITH_TOLERANCE = new Set(
  (stampDates.stamps as { code: string; tolerance_note?: boolean }[]).filter((e) => e.tolerance_note === true).map((e) => e.code),
);

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
