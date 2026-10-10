// MTSZ and heyjoe.hu publish where to find each stamp only in Hungarian; `src/content/stamp-descriptions.json` holds
// our `ru`, `en` and `de` versions, keyed by stamp code.
import type { Locale } from "next-intl";
import translations from "@/content/stamp-descriptions.json";

export type DescriptionTranslations = Record<string, Partial<Record<Locale, string>>>;

export function localizedDescription(
  code: string | null,
  original: string | null,
  locale: Locale,
  table: DescriptionTranslations = translations,
): string | null {
  if (locale === "hu" || code === null) return original;
  return table[code]?.[locale] || original;
}
