import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { testLoginEnabled } from "@/lib/test-login";
import TestBanner from "@/components/TestBanner";
import Footer from "@/components/Footer";
import SiteLogo from "@/components/SiteLogo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "app" });
  return { title: t("title") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
        {testLoginEnabled() && <TestBanner />}
        <SiteLogo locale={locale} />
        <NextIntlClientProvider>
          {/* A column that takes the space above the footer: full-height pages (landing, error) fill it with flex-1 instead of min-h-screen, which would push the footer below the fold. */}
          <div className="flex flex-grow flex-col">{children}</div>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
