import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadDashboardData } from "@/lib/dashboard-data";
import { monthLines, monthlyProgress } from "@/lib/month-stats";
import { buildPlaces, buildStages, countDone, progressSummary, stampedPlaceKeys, waivedPlaceKeys, walkedRanges } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import MonthChart from "@/components/MonthChart";
import PageShell from "@/components/PageShell";
import stagesData from "../../../../scripts/data/okt-stages.json";

// See spec 0037.

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

  // The same reads as the dashboard (spec 0002 AC-15, AC-16): reference data from the shared cache, the user's own rows under RLS.
  const { checkpoints, extras, stamps, extraStamps } = await loadDashboardData(supabase);

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
    </PageShell>
  );
}
