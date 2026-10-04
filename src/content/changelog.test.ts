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

  it("AC-3: translations are really translated (the languages differ)", () => {
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

  it("AC-6: the three oldest entries are the history up to 2026-10-02, from the first version on (newer ones go on top)", () => {
    expect(CHANGELOG.map((e) => e.date).slice(-3)).toEqual(["2026-10-02", "2026-10-01", "2026-09-29"]);
    expect(CHANGELOG.at(-1)!.title.en).toBe("First version");
  });
});

describe("spec 0018: the account page in the changelog", () => {
  const entry = CHANGELOG.find((e) => e.date === "2026-10-02")!;

  it("AC-7: the 2026-10-02 entry says Sign out moved to the Account page and Settings is now Account, in every language", () => {
    const words: Record<string, string[]> = {
      en: ["Sign out", "Account", "Settings"],
      ru: ["Выйти", "Аккаунт", "Настройки"],
      hu: ["Kijelentkezés", "Fiók", "Beállítások"],
      de: ["Abmelden", "Konto", "Einstellungen"],
    };
    for (const locale of routing.locales) {
      const said = entry.changes.some((c) => words[locale].every((w) => c.text[locale].includes(w)));
      expect(said, locale).toBe(true);
    }
  });

  it("AC-7: it also says, in every language, that the page exists and that the chart moved there, and none of its items calls the page 'Account settings' any more", () => {
    const claims: Record<string, RegExp[]> = {
      en: [/An Account page/, /chart moved to the Account page/],
      ru: [/Страница «Аккаунт»/, /График.*на страницу «Аккаунт»/],
      hu: [/Fiók oldal, ahol/, /diagram átkerült a Fiók oldalra/],
      de: [/Eine Seite „Konto“/, /Diagramm „Stempel pro Monat“ ist auf die Seite „Konto“ umgezogen/],
    };
    for (const locale of routing.locales) {
      for (const claim of claims[locale]) {
        expect(entry.changes.some((c) => claim.test(c.text[locale])), `${locale}: ${claim}`).toBe(true);
      }
    }
    for (const [i, change] of entry.changes.entries()) {
      for (const locale of routing.locales) {
        expect(change.text[locale], `change ${i + 1} (${locale})`).not.toMatch(/Account settings|Настройки аккаунта|fiókbeállítás|Kontoeinstellungen/i);
      }
    }
  });
});
