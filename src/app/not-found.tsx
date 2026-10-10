import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PageShell from "@/components/PageShell";
import SiteLogo from "@/components/SiteLogo";
import { routing } from "@/i18n/routing";

export default async function NotFound() {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "notFound" });

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
        <SiteLogo locale={locale} />
        <PageShell variant="hero">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Link href="/" className="text-blue-700 hover:underline">
            {t("back")}
          </Link>
        </PageShell>
      </body>
    </html>
  );
}
