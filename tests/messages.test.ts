import { describe, expect, it } from "vitest";
import { routing } from "../src/i18n/routing";
import { messageFiles as byLocale } from "./message-files";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  return new Map(
    Object.entries(messages).flatMap(([k, v]) =>
      typeof v === "string" ? [[prefix + k, v] as const] : [...flatten(v, `${prefix}${k}.`)],
    ),
  );
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort();

const reference = flatten(byLocale.en);
const locales = Object.fromEntries(
  Object.entries(byLocale)
    .filter(([locale]) => locale !== "en")
    .map(([locale, m]) => [locale, flatten(m)]),
);

describe("spec 0005: translations", () => {
  it("AC-5: there is one message file per language of the routing, and no other", () => {
    expect(Object.keys(byLocale).sort()).toEqual([...routing.locales].sort());
  });

  it.each(Object.entries(locales))("AC-5: %s has exactly the English keys", (_, messages) => {
    expect([...messages.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it.each(Object.entries(locales))("AC-5: %s uses the same placeholders as English", (_, messages) => {
    for (const [key, text] of reference) {
      expect(placeholders(messages.get(key) ?? ""), key).toEqual(placeholders(text));
    }
  });

  it.each(Object.entries({ en: reference, ...locales }))("AC-5: %s has no empty strings", (_, messages) => {
    for (const [key, text] of messages) expect(text.trim(), key).not.toBe("");
  });
});

describe("spec 0015: about page text", () => {
  const claims = /open[- ]source|progressive|\bPWA\b|открыт[а-яё]* исходн|nyílt forrás|quelloffen/i; // (\w doesn't match Cyrillic)

  it.each(Object.entries({ en: reference, ...locales }))("AC-6: %s makes no open-source or PWA claim", (_, messages) => {
    for (const [key, text] of messages) {
      if (key.startsWith("about.")) expect(text, key).not.toMatch(claims);
    }
  });

  it.each(Object.entries(locales))("AC-7: %s has every about.* key of English", (_, messages) => {
    const keys = (m: Map<string, string>) => [...m.keys()].filter((k) => k.startsWith("about.")).sort();
    expect(keys(messages)).toEqual(keys(reference));
    expect(keys(reference).length).toBeGreaterThan(10);
  });
});

describe("spec 0014: the settings page has one name in every language", () => {
  const settings = { en: "Settings", ru: "Настройки", hu: "Beállítások", de: "Einstellungen" };
  const account = { en: "Account", ru: "Аккаунт", hu: "Fiók", de: "Konto" };

  it("AC-18: the names are given for every language, so a new language fails here until it has them", () => {
    expect(Object.keys(settings).sort()).toEqual([...routing.locales].sort());
    expect(Object.keys(account).sort()).toEqual([...routing.locales].sort());
  });

  it.each(Object.entries(settings))("AC-18: %s: the menu entry, the page title and the About page's link text say %s", (locale, name) => {
    const messages = byLocale[locale] as typeof import("../messages/en.json");
    expect(messages.accountMenu.settings).toBe(name);
    expect(messages.account.title).toBe(name);
    expect(messages.about.data3).toContain(`<account>${name}</account>`);
  });

  it.each(Object.entries(account))("AC-20: %s: the menu's button says %s, the name of the account, not the name of the page", (locale, name) => {
    const messages = byLocale[locale] as typeof import("../messages/en.json");
    expect(messages.accountMenu.label).toBe(name);
    expect(messages.accountMenu.label).not.toBe(messages.accountMenu.settings);
  });

  it.each(Object.entries(settings))("AC-18: %s: no old header-link keys are left, and Sign out is in the menu and on the page, in the same words", (locale) => {
    const messages = byLocale[locale] as typeof import("../messages/en.json");
    expect(Object.keys(messages.dashboard)).not.toContain("account");
    expect(Object.keys(messages.dashboard)).not.toContain("stats");
    expect(messages.accountMenu.signOut).toBe(messages.account.signOut);
  });
});

describe("spec 0037: the stats page has one name in every language", () => {
  const expected = { en: "My stats", ru: "Моя статистика", hu: "Statisztikáim", de: "Meine Statistik" };

  it("AC-2: the name is given for every language, so a new language fails here until it has one", () => {
    expect(Object.keys(expected).sort()).toEqual([...routing.locales].sort());
  });

  it.each(Object.entries(expected))("AC-2: %s: the menu entry and the page title say %s", (locale, name) => {
    const messages = byLocale[locale] as typeof import("../messages/en.json");
    expect(messages.accountMenu.stats).toBe(name);
    expect(messages.stats.title).toBe(name);
  });

  it.each(Object.entries(locales))("AC-14: %s has the plural forms of the tooltip's counts (an ICU plural with the language's categories)", (locale, messages) => {
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories.filter((c) => c !== "zero").sort();
    for (const key of ["stats.tipStamps", "stats.tipExtra"]) {
      const text = messages.get(key) ?? "";
      const given = [...text.matchAll(/(one|few|many|other) {/g)].map((m) => m[1]).sort();
      expect(given, key).toEqual(categories);
    }
  });
});
