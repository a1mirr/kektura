import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { CHANGELOG, type Localized } from "./changelog";

const texts = (): { where: string; text: Localized }[] =>
  CHANGELOG.flatMap((entry) => [
    { where: `${entry.date} title`, text: entry.title },
    ...entry.changes.map((change, i) => ({ where: `${entry.date} change ${i + 1}`, text: change.text })),
  ]);

const isRealDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

describe("spec 0018: changelog data", () => {
  it("AC-3: every title and change is written in every language, and in no other", () => {
    for (const { where, text } of texts()) {
      expect(Object.keys(text).sort(), where).toEqual([...routing.locales].sort());
      for (const locale of routing.locales) {
        expect(text[locale].trim(), `${where} (${locale})`).not.toBe("");
        expect(text[locale], `${where} (${locale})`).not.toMatch(/todo|tbd|lorem/i);
      }
    }
  });

  it("AC-3: translations are really translated (the three languages differ)", () => {
    for (const { where, text } of texts()) {
      expect(new Set(Object.values(text)).size, where).toBe(routing.locales.length);
    }
  });

  it("AC-4: dates are real calendar dates", () => {
    for (const entry of CHANGELOG) expect(isRealDate(entry.date), entry.date).toBe(true);
  });

  it("AC-4: newest first, strictly (so no two entries share a date), none in the future", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(new Set(dates).size).toBe(dates.length);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const date of dates) expect(date <= tomorrow, date).toBe(true);
  });

  it("AC-4: every entry lists at least one change, each of a known kind", () => {
    for (const entry of CHANGELOG) {
      expect(entry.changes.length, entry.date).toBeGreaterThan(0);
      for (const change of entry.changes) expect(["new", "improved", "fixed"]).toContain(change.kind);
    }
  });

  it("AC-6: the history so far is three entries, from the first version on", () => {
    expect(CHANGELOG.map((e) => e.date)).toEqual(["2026-10-02", "2026-10-01", "2026-09-29"]);
    expect(CHANGELOG.at(-1)!.title.en).toBe("First version");
  });
});
