// Every UI string exists in all three locales with the same ICU placeholders (CLAUDE.md: "Add every
// new string to all three files").
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import hu from "../messages/hu.json";
import ru from "../messages/ru.json";

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  return new Map(
    Object.entries(messages).flatMap(([k, v]) =>
      typeof v === "string" ? [[prefix + k, v] as const] : [...flatten(v, `${prefix}${k}.`)],
    ),
  );
}

// ICU arguments ({km}) and rich-text tags (<account>...</account>) must survive translation.
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)|<(\w+)>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort();

const reference = flatten(en);
const locales = { ru: flatten(ru), hu: flatten(hu) };

describe("spec 0005: translations", () => {
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
  // The repository is private and the app has no manifest or service worker, so neither claim is
  // true. Whoever makes one true edits spec 0015 AC-6 and this test.
  const claims = /open[- ]source|progressive|\bPWA\b|открыт[а-яё]* исходн|nyílt forrás/i; // (\w doesn't match Cyrillic)

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
