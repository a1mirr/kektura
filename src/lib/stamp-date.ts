// What counts as a stamp date (spec 0016): used by the server actions, the date field and the buttons.

export const MIN_STAMP_DATE = "1938-01-01"; // the trail's first year

const DAY_MS = 24 * 60 * 60 * 1000;

// Tomorrow in UTC: somebody far ahead of UTC is already living in what is still "tomorrow" for the server.
export const maxStampDate = (now: Date = new Date()): string => new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);

// A real calendar date written YYYY-MM-DD (any year).
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // 2026-02-30 would silently roll over to March, so compare what comes back.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// A calendar date from MIN_STAMP_DATE to maxStampDate(now).
export function isValidStampDate(value: unknown, now: Date = new Date()): value is string {
  return isCalendarDate(value) && value >= MIN_STAMP_DATE && value <= maxStampDate(now);
}

// The calendar day of the user's own clock and time zone, as YYYY-MM-DD.
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The date to send along with a new stamp: today for the user, or nothing when it isn't a sane stamp
// date by their own clock. (The server also ignores a real date outside its range: a client can't
// know how far its clock is off, and stamping must not stop working because of it.)
export function newStampDate(now: Date = new Date()): string | undefined {
  const today = localToday(now);
  return isValidStampDate(today, now) ? today : undefined;
}
