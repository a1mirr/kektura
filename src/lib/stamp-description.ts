// Translated stamp descriptions (spec 0032): MTSZ and heyjoe.hu publish where to find each stamp only in
// Hungarian; `src/content/stamp-descriptions.json` holds our `ru` and `en` versions, keyed by stamp code.
import type { Locale } from "next-intl";
import translations from "@/content/stamp-descriptions.json";

export type DescriptionTranslations = Record<string, Partial<Record<Locale, string>>>;

// The description of a stamp in the language of the page (AC-1): the translation for `ru` and `en`, the
// Hungarian original from the database for `hu`, and also for a stamp without a translation (AC-2).
export function localizedDescription(
  code: string | null,
  original: string | null,
  locale: Locale,
  table: DescriptionTranslations = translations,
): string | null {
  if (locale === "hu" || code === null) return original;
  return table[code]?.[locale] || original;
}
