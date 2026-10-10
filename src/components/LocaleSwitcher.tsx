"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALE_NAMES } from "@/i18n/locale-names";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(event) => router.replace(pathname, { locale: event.target.value as typeof locale })}
      className="min-h-11 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l} lang={l}>
          {LOCALE_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
