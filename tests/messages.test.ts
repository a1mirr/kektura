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

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

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
