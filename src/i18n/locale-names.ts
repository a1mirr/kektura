import type { Locale } from "next-intl";

// Each language is named in itself, so a visitor who can't read the current page still finds theirs.
export const LOCALE_NAMES: Record<Locale, string> = {
  hu: "Magyar",
  en: "English",
  de: "Deutsch",
  ru: "Русский",
};
