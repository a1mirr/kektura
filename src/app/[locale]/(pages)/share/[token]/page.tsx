import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import PageShell from "@/components/PageShell";
import ShareMap from "@/components/ShareMap";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { flagOn } from "@/lib/feature-flags-server";
import { originFromHeaders } from "@/lib/origin";
import { shareUrl } from "@/lib/share-card";
import { loadShareCard } from "@/lib/share-card-server";

// See spec 0039. A public page: no sign-in is asked for, and nothing on it says whose card it is unless the owner
// chose to show their name.

type Props = { params: Promise<{ locale: string; token: string }> };

const imageUrl = (origin: string, token: string) => `${origin}/api/share/${token}/image`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale) || !(await flagOn("share"))) return {};
  const card = await loadShareCard(token);
  if (!card) return {};
  const t = await getTranslations({ locale, namespace: "share" });
  const format = await getFormatter({ locale });
  const origin = originFromHeaders(await headers(), "http://localhost");
  const title = card.name ? t("pageTitleNamed", { name: card.name }) : t("pageTitle");
  const description = t("description", { done: card.stampsDone, total: card.stampsTotal, km: format.number(card.kmDone) });
  const images = [{ url: imageUrl(origin, token), width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    // A card is for the people it was sent to, not for a search engine (AC-4).
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", url: shareUrl(origin, locale, token), images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function SharePage({ params }: Props) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  if (!(await flagOn("share"))) notFound();
  const card = await loadShareCard(token);
  if (!card) notFound();

  const t = await getTranslations("share");
  const dashboardT = await getTranslations("dashboard");
  const statsT = await getTranslations("stats");
  const format = await getFormatter();

  const figures = [
    { label: dashboardT("stamps"), value: `${card.stampsDone} / ${card.stampsTotal}` },
    { label: dashboardT("km"), value: format.number(card.kmDone) },
    { label: dashboardT("remaining"), value: format.number(card.kmLeft) },
    { label: statsT("stages"), value: `${card.stagesDone} / ${card.stagesTotal}` },
  ];

  return (
    <PageShell variant="reading" spaced>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-blue-700 [overflow-wrap:anywhere]">
          {card.name ? t("pageTitleNamed", { name: card.name }) : t("pageTitle")}
        </h1>
        <p className="text-sm text-stone-500">{t("asOf", { date: format.dateTime(new Date(card.createdAt), { dateStyle: "long", timeZone: "Europe/Budapest" }) })}</p>
      </header>

      <section className="rounded-lg bg-white p-6 text-center shadow-sm">
        <p className="text-6xl font-bold text-blue-700">{card.percent}%</p>
        <p className="text-sm text-stone-500">{dashboardT("percent")}</p>
        <div
          role="progressbar"
          aria-label={dashboardT("percent")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={card.percent}
          className="mt-4 h-3 overflow-hidden rounded-full bg-stone-200"
        >
          <div className="h-full bg-blue-600" style={{ width: `${card.percent}%` }} />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-4">
        {figures.map((f) => (
          <div key={f.label} className="rounded-lg bg-white p-4 shadow-sm">
            <dt className="text-sm text-stone-500">{f.label}</dt>
            <dd className="text-2xl font-semibold">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <ShareMap ranges={card.ranges} label={t("mapLabel")} />
      </section>

      <p className="text-center">
        <Link href="/" className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          {t("cta")}
        </Link>
      </p>
    </PageShell>
  );
}
