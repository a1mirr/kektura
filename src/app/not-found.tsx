import Link from "next/link";
import { getTranslations } from "next-intl/server";
import SiteLogo from "@/components/SiteLogo";
import { routing } from "@/i18n/routing";

// Root 404: also reached when [locale] isn't a known locale. The root layout renders no <html>
// (each locale layout does), and this page sits outside any locale, so it brings its own document.
export default async function NotFound() {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
        <SiteLogo locale={locale} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Link href="/" className="text-blue-700 hover:underline">
            {t("back")}
          </Link>
        </main>
      </body>
    </html>
  );
}
