// Stamps that moved (spec 0001 AC-29, spec 0003 AC-26): for 180 days after the MTSZ moved a stamp the page tells you so, because a
// map or booklet printed before still shows the old place. Pure functions; the day itself comes from the database (`moved_on`,
// filled by the seed from scripts/data/okt-stamp-dates.json).

// How long the note is shown: from the day of the move, 180 days (the last day shown is 179 days after it).
export const MOVED_NOTE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);

// Today as a calendar day. UTC, like every date of the app (a day is not a moment: no time zone moves it).
export const todayIso = (now: Date = new Date()) => now.toISOString().slice(0, 10);

// Moved within the last 180 days. A day in the future is not a move that happened: it shows nothing yet.
export function isRecentlyMoved(movedOn: string | null | undefined, today: string): boolean {
  if (!movedOn) return false;
  const days = dayNumber(today) - dayNumber(movedOn);
  return days >= 0 && days < MOVED_NOTE_DAYS;
}

export type MovedText = {
  on: (date: string) => string; // "Moved on 30 September 2026"
  now: (description: string) => string; // "Where it is now: ..."
  check: string; // "If you use an older map or booklet, check the new place."
};

// The note of a stamp that moved recently, in the page's language: the day, the data's own description of where it is now
// (nothing when there is none) and the advice. It says nothing about how far or in which direction (spec 0001 AC-29).
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

// Of the rows of one place, the one that moved most recently within the window (a place with two variants can have one that moved).
export function recentlyMovedVariant<T extends { moved_on: string | null }>(variants: readonly T[], today: string): T | undefined {
  return variants
    .filter((v) => isRecentlyMoved(v.moved_on, today))
    .sort((a, b) => b.moved_on!.localeCompare(a.moved_on!))[0];
}
