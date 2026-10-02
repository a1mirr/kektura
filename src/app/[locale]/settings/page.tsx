import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { buildPlaces, stampsPerMonth } from "@/lib/progress";
import StampsChart from "@/components/StampsChart";
import DeleteAccountButton from "./DeleteAccountButton";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRequestLocale(locale as any);
  const t = await getTranslations("settings");
  const dashboardT = await getTranslations("dashboard");
  const format = await getFormatter();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  const [{ data: checkpoints }, { data: stamps }] = await Promise.all([
    supabase.from("checkpoints").select("*").order("seq"),
    supabase.from("user_stamps").select("checkpoint_id, stamped_on"),
  ]);

  const cps = checkpoints ?? [];
  const placeList = buildPlaces(cps);

  const chartData = stampsPerMonth(stamps ?? [], placeList).map(({ month, count }) => ({
    month: format.dateTime(new Date(`${month}-01T00:00:00Z`), { year: "numeric", month: "short", timeZone: "UTC" }),
    count,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">{dashboardT("perMonth")}</h2>
        <StampsChart data={chartData} seriesName={dashboardT("stamps")} />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-red-600">{t("dangerZone")}</h2>
        <p className="mb-4 text-sm text-stone-600">{t("dangerZoneDesc")}</p>
        <DeleteAccountButton />
      </section>
    </main>
  );
}
