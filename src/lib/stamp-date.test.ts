import { describe, expect, it } from "vitest";
import { isCalendarDate, isValidStampDate, localToday, maxStampDate, MIN_STAMP_DATE, newStampDate } from "./stamp-date";

// 2026-10-02 12:00 UTC; "tomorrow" is 2026-10-03.
const NOW = new Date("2026-10-02T12:00:00Z");

describe("spec 0016: valid stamp dates", () => {
  it.each(["2026-10-02", "2026-10-03", "2024-02-29", "1938-01-01", "2000-12-31"])("AC-2: %s is valid", (date) => {
    expect(isValidStampDate(date, NOW)).toBe(true);
  });

  it.each([
    ["2026-02-30", "a day that doesn't exist (it would roll over to March)"],
    ["2023-02-29", "a leap day in a common year"],
    ["2026-13-01", "month 13"],
    ["2026-00-10", "month 0"],
    ["2026-10-00", "day 0"],
    ["2026-9-5", "not zero padded"],
    ["02/10/2026", "another format"],
    ["2026-10-02T00:00:00Z", "a timestamp"],
    [" 2026-10-02", "whitespace"],
    ["", "empty"],
    ["1937-12-31", "before the trail existed"],
    ["0002-10-02", "what typing the year digit by digit passes through"],
    ["0000-01-01", "year zero"],
    ["2026-10-04", "the day after tomorrow"],
    ["2999-01-01", "far in the future"],
  ])("AC-2: %s is refused (%s)", (date) => {
    expect(isValidStampDate(date, NOW)).toBe(false);
  });

  it.each([[undefined], [null], [20261002], [{}], [["2026-10-02"]], [new Date(NOW)]])("AC-2: %j is not a string, so refused", (value) => {
    expect(isValidStampDate(value, NOW)).toBe(false);
  });

  it("AC-2: the limits are 1938-01-01 and tomorrow in UTC", () => {
    expect(MIN_STAMP_DATE).toBe("1938-01-01");
    expect(maxStampDate(NOW)).toBe("2026-10-03");
    expect(maxStampDate(new Date("2026-12-31T23:59:59Z"))).toBe("2027-01-01");
    expect(isValidStampDate("2027-01-01", new Date("2026-12-31T23:59:59Z"))).toBe(true);
  });
});

describe("spec 0016: calendar dates", () => {
  it("AC-3: any real YYYY-MM-DD is a calendar date, in any year; nothing else is", () => {
    expect(isCalendarDate("2999-01-01")).toBe(true);
    expect(isCalendarDate("0002-10-02")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-9-5", "", "x", " 2026-10-02", 5, null, undefined]) {
      expect(isCalendarDate(bad), String(bad)).toBe(false);
    }
  });
});

describe("spec 0016: the user's own day", () => {
  it("AC-1: localToday reads the clock's local calendar day, zero padded", () => {
    expect(localToday(new Date(2026, 9, 2, 23, 59))).toBe("2026-10-02"); // local time, whatever the zone
    expect(localToday(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
    expect(localToday(new Date(2024, 1, 29, 12))).toBe("2024-02-29");
  });

  it("AC-1: a new stamp carries today's date, valid by construction", () => {
    expect(newStampDate(new Date(2026, 9, 2, 12))).toBe(localToday(new Date(2026, 9, 2, 12)));
  });

  it("AC-1: a clock set before the trail existed sends no date, so the server's default applies", () => {
    expect(newStampDate(new Date(1920, 5, 1))).toBeUndefined();
  });

  it("AC-1: a clock set far ahead can't be noticed by the client (the server ignores such a date)", () => {
    expect(newStampDate(new Date(2999, 0, 1))).toBe("2999-01-01");
    expect(isValidStampDate("2999-01-01", NOW)).toBe(false); // what the server decides, by its own clock
  });
});
