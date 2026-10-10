import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadDashboardData } from "@/lib/dashboard-data";
import { flagOn } from "@/lib/feature-flags-server";
import { monthLines, monthlyProgress } from "@/lib/month-stats";
import { originFromHeaders } from "@/lib/origin";
import { buildPlaces, buildStages, countDone, progressSummary, stampedPlaceKeys, waivedPlaceKeys, walkedRanges } from "@/lib/progress";
import { shareUrl, telegramShareUrl } from "@/lib/share-card";
import { loadOwnShareCards } from "@/lib/share-card-server";
import { createClient } from "@/lib/supabase/server";
import MonthChart from "@/components/MonthChart";
import PageShell from "@/components/PageShell";
import SharePanel, { type ShareItem } from "@/components/SharePanel";
import stagesData from "../../../../scripts/data/okt-stages.json";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "stats" });
  return { title: t("title") };
}

export default async function StatsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("stats");
  const dashboardT = await getTranslations("dashboard");
  const format = await getFormatter();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  // The same reads as the dashboard: reference data from the shared cache, the user's own rows under RLS.
  const [showShare, { checkpoints, extras, stamps, extraStamps }] = await Promise.all([flagOn("share"), loadDashboardData(supabase)]);

  // The figures come from the functions the dashboard uses, so the two pages say the same.
  const places = buildPlaces(checkpoints);
  const stages = buildStages(places, stagesData.stages);
  const stamped = stampedPlaceKeys(places, stamps);
  const waived = waivedPlaceKeys(places, stamped);
  const summary = progressSummary(places, walkedRanges(places, stamped, waived));
  const completeStages = stages.filter((st) => countDone(st.places, stamped, waived) === st.places.length).length;

  const cards = [
    { label: dashboardT("stamps"), value: `${stamped.size} / ${places.length}` },
    { label: dashboardT("km"), value: format.number(summary.doneKm) },
    { label: dashboardT("remaining"), value: format.number(summary.remainingKm) },
    { label: t("stages"), value: `${completeStages} / ${stages.length}` },
  ];

  const words = {
    stamps: (count: number) => t("tipStamps", { count }),
    extraStamps: (count: number) => t("tipExtra", { count }),
    none: t("tipNone"),
    km: (km: number) => t("tipKm", { km: format.number(km, { maximumFractionDigits: 1 }) }),
    stage: (list: string) => t("tipStage", { list }),
    stages: (list: string) => t("tipStages", { list }),
  };
  // Month names as the language writes them: a stamp date is a day, not an instant, so no time zone is applied (UTC keeps the
  // calendar month of the date as written).
  const at = (month: string) => new Date(`${month}-01T00:00:00Z`);
  const months = monthlyProgress({ places, stamps, stages, extras, extraStamps }).map((m, i) => {
    const lines = monthLines(m, words);
    const title = format.dateTime(at(m.month), { year: "numeric", month: "long", timeZone: "UTC" });
    return {
      key: m.month,
      short: format.dateTime(at(m.month), { month: "short", timeZone: "UTC" }),
      year: i === 0 || m.month.endsWith("-01") ? format.dateTime(at(m.month), { year: "numeric", timeZone: "UTC" }) : null,
      stamps: m.stamps,
      title,
      lines,
      label: `${title}: ${lines.join(", ")}`,
    };
  });

  // The user's share cards, under RLS: only their own rows come back.
  let shareItems: ShareItem[] = [];
  if (showShare) {
    const shareT = await getTranslations("share");
    const origin = originFromHeaders(await headers(), "http://localhost");
    shareItems = (await loadOwnShareCards(supabase)).map((card) => {
      const url = shareUrl(origin, locale, card.token);
      const text = shareT("telegramText", { percent: card.percent, done: card.stamps_done, total: card.stamps_total });
      return {
        id: card.id,
        url,
        telegramUrl: telegramShareUrl(url, text),
        line: shareT("cardLine", { percent: card.percent, done: card.stamps_done, total: card.stamps_total }),
        created: shareT("created", { date: format.dateTime(new Date(card.created_at), { dateStyle: "long", timeZone: "Europe/Budapest" }) }),
        named: card.display_name !== null,
      };
    });
  }

  return (
    <PageShell spaced>
      <header>
        <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
            <dt className="text-sm text-stone-500">{c.label}</dt>
            <dd className="text-2xl font-semibold">{c.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 id="stats-per-month" className="mb-2 font-semibold">
          {t("perMonth")}
        </h2>
        {months.length === 0 ? <p className="text-stone-500">{t("empty")}</p> : <MonthChart months={months} labelledBy="stats-per-month" />}
      </section>

      {showShare && <SharePanel items={shareItems} />}
    </PageShell>
  );
}
