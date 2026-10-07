import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import PageShell from "@/components/PageShell";
import { findStamp } from "@/lib/stamp-lookup";
import FeedbackForm from "./FeedbackForm";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ stamp?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "feedback" });
  return { title: t("title"), description: t("description") };
}

export default async function FeedbackPage({ params, searchParams }: Props) {
  const { locale } = await params;
  // `?stamp=<code>` (spec 0017 AC-11): only a code of the seed counts, and the name shown is the seed's, never the address's.
  const { stamp: rawStamp } = await searchParams;
  // A seed that cannot be read gives the plain form: the page never fails for a link.
  const stamp = typeof rawStamp === "string" ? await findStamp(rawStamp).catch(() => null) : null;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("feedback");

  return (
    <PageShell variant="reading">
      <h1 className="mb-4 text-2xl font-bold text-blue-700">{t("title")}</h1>
      <p className="text-stone-700">{t("description")}</p>
      <FeedbackForm stamp={stamp} />
    </PageShell>
  );
}
