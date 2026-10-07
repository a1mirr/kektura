import { describe, expect, it } from "vitest";
import { isRecentlyMoved, MOVED_NOTE_DAYS, movedNote, recentlyMovedVariant, todayIso, type MovedText } from "./stamp-moves";

const text: MovedText = {
  on: (date) => `Moved on ${date}`,
  now: (description) => `Now: ${description}`,
  check: "Check the new place.",
};
const format = (iso: string) => `<${iso}>`;

describe("spec 0001: a stamp that moved", () => {
  it("AC-29: the note is shown for 180 days from the day of the move: the day itself and the 179 after it", () => {
    expect(MOVED_NOTE_DAYS).toBe(180);
    expect(isRecentlyMoved("2026-04-01", "2026-04-01")).toBe(true);
    expect(isRecentlyMoved("2026-04-01", "2026-09-26")).toBe(true); // 178 days
    expect(isRecentlyMoved("2026-04-01", "2026-09-27")).toBe(true); // 179 days: the last day
    expect(isRecentlyMoved("2026-04-01", "2026-09-28")).toBe(false); // 180 days
    expect(isRecentlyMoved("2026-04-01", "2027-04-01")).toBe(false);
  });

  it("AC-29: the window counts calendar days, across a month, a year and a leap day, whatever the time zone", () => {
    expect(isRecentlyMoved("2025-12-31", "2026-01-01")).toBe(true);
    expect(isRecentlyMoved("2024-03-01", "2024-08-27")).toBe(true); // 179 days over a leap day
    expect(isRecentlyMoved("2024-03-01", "2024-08-28")).toBe(false);
    expect(todayIso(new Date("2026-10-07T23:59:59Z"))).toBe("2026-10-07");
    expect(todayIso(new Date("2026-10-08T00:00:00Z"))).toBe("2026-10-08");
  });

  it("AC-29: a stamp without a move, and a move dated in the future, show nothing", () => {
    expect(isRecentlyMoved(null, "2026-10-07")).toBe(false);
    expect(isRecentlyMoved(undefined, "2026-10-07")).toBe(false);
    expect(isRecentlyMoved("", "2026-10-07")).toBe(false);
    expect(isRecentlyMoved("2026-10-08", "2026-10-07")).toBe(false);
  });

  it("AC-29: the note is the day, the data's own description and the advice, nothing about how far or which way", () => {
    expect(movedNote("2026-09-30", "A kilátó mellett (OKTPH_X)", text, format)).toBe(
      "Moved on <2026-09-30>. Now: A kilátó mellett (OKTPH_X). Check the new place.",
    );
    expect(movedNote("2026-09-30", "A kilátó mellett", text, format)).not.toMatch(/\b(km|m|metres?|north|south|east|west)\b/i);
  });

  it("AC-29: every part is a sentence, and a date that ends in a full stop (Hungarian, Russian) is not followed by a second", () => {
    expect(movedNote("2026-10-04", "Az elágazásnál.", text, () => "2026. október 4.")).toBe("Moved on 2026. október 4. Now: Az elágazásnál. Check the new place.");
    expect(movedNote("2026-10-04", "Az elágazásnál", text, () => "4 октября 2026 г.")).toBe("Moved on 4 октября 2026 г. Now: Az elágazásnál. Check the new place.");
  });

  it("AC-29: a stamp without a description still gets the day and the advice", () => {
    expect(movedNote("2026-09-30", null, text, format)).toBe("Moved on <2026-09-30>. Check the new place.");
    expect(movedNote("2026-09-30", "  ", text, format)).toBe("Moved on <2026-09-30>. Check the new place.");
  });

  it("AC-29: of a place's variants the one that moved most recently within the window speaks for the place", () => {
    const variants = [
      { code: "A_1", moved_on: null },
      { code: "A_2", moved_on: "2026-08-01" },
      { code: "A_3", moved_on: "2026-09-01" },
      { code: "A_4", moved_on: "2020-01-01" }, // long ago
    ];
    expect(recentlyMovedVariant(variants, "2026-10-07")?.code).toBe("A_3");
    expect(recentlyMovedVariant(variants, "2027-05-01")).toBeUndefined();
    expect(recentlyMovedVariant([], "2026-10-07")).toBeUndefined();
  });
});
