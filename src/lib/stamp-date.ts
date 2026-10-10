export const MIN_STAMP_DATE = "1938-01-01"; // the trail's first year

const DAY_MS = 24 * 60 * 60 * 1000;

// Tomorrow in UTC: somebody far ahead of UTC is already living in what is still "tomorrow" for the server.
export const maxStampDate = (now: Date = new Date()): string => new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // 2026-02-30 would silently roll over to March, so compare what comes back.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidStampDate(value: unknown, now: Date = new Date()): value is string {
  return isCalendarDate(value) && value >= MIN_STAMP_DATE && value <= maxStampDate(now);
}

export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The server also ignores a real date outside its range: a client can't know how far its clock is off, and stamping
// must not stop working because of it.
export function newStampDate(now: Date = new Date()): string | undefined {
  const today = localToday(now);
  return isValidStampDate(today, now) ? today : undefined;
}

// The last day a retired stamp could still be collected.
export const dayBefore = (date: string): string => new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
