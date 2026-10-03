// Compile-time test: the assertions are `@ts-expect-error` lines, which `npm run typecheck` turns
// into errors if the next-intl typing (src/i18n/global.ts) ever stops working. The functions below
// are never called (the hooks need a React tree), they only have to type-check.
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { describe, expect, it } from "vitest";
import { routing } from "./routing";

// Named like hooks so the rules-of-hooks lint accepts the hook calls.
function useTypedHooks() {
  const t = useTranslations("dashboard");
  t("stamp");
  // @ts-expect-error unknown key
  t("stampp");

  // @ts-expect-error unknown namespace
  useTranslations("dashbord");

  const root = useTranslations();
  root("dashboard.stamp");
  // @ts-expect-error unknown nested key
  root("dashboard.stampp");

  // `useLocale` returns the routing locales, not a plain string.
  const locale: "ru" | "en" | "hu" = useLocale();
  return locale;
}

async function typedServerApi() {
  const t = await getTranslations("home");
  t("headline");
  // @ts-expect-error unknown key
  t("headlin");

  const withLocale = await getTranslations({ locale: "en", namespace: "app" });
  withLocale("title");
  // @ts-expect-error unknown key
  withLocale("titel");

  // @ts-expect-error unknown namespace
  await getTranslations({ locale: "en", namespace: "dashbord" });
  // @ts-expect-error a plain string is not a locale
  await getTranslations({ locale: "de" as string, namespace: "app" });
}

function typedLocale() {
  const supported: Locale = "hu";
  // @ts-expect-error not one of the routing locales
  const unsupported: Locale = "de";
  return [supported, unsupported];
}

describe("spec 0005: typed translations", () => {
  it("AC-7: unknown keys and namespaces fail the typecheck", () => {
    // The assertions are the @ts-expect-error comments above: tsc fails if one becomes unnecessary.
    expect(typeof useTypedHooks).toBe("function");
    expect(typeof typedServerApi).toBe("function");
  });

  it("AC-8: the locale type is the routing locales", () => {
    const locales: Locale[] = [...routing.locales];
    expect(locales).toEqual(["ru", "en", "hu"]);
    expect(typeof typedLocale).toBe("function");
  });
});
