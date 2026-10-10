export const MOVED_NOTE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);

export const todayIso = (now: Date = new Date()) => now.toISOString().slice(0, 10);

export function isRecentlyMoved(movedOn: string | null | undefined, today: string): boolean {
  if (!movedOn) return false;
  const days = dayNumber(today) - dayNumber(movedOn);
  return days >= 0 && days < MOVED_NOTE_DAYS;
}

export type MovedText = {
  on: (date: string) => string;
  now: (description: string) => string;
  check: string;
};

export function movedNote(
  movedOn: string,
  description: string | null,
  text: MovedText,
  formatDate: (iso: string) => string,
): string {
  const where = description?.trim();
  // Each part is a sentence: one that does not end in a stop (a date, a description in brackets) gets one, so a date that ends in a full stop
  // (Hungarian, Russian) is not followed by a second.
  const sentence = (part: string) => (/[.!?]$/.test(part) ? part : `${part}.`);
  return [text.on(formatDate(movedOn)), where ? text.now(where) : null, text.check].filter((p): p is string => !!p).map(sentence).join(" ");
}

export function recentlyMovedVariant<T extends { moved_on: string | null }>(variants: readonly T[], today: string): T | undefined {
  return variants
    .filter((v) => isRecentlyMoved(v.moved_on, today))
    .sort((a, b) => b.moved_on!.localeCompare(a.moved_on!))[0];
}
