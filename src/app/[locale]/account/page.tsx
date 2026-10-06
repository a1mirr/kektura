import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { buildPlaces, stampsPerMonth } from "@/lib/progress";
import PageShell from "@/components/PageShell";
import SignOutButton from "@/components/SignOutButton";
import StampsChart from "@/components/StampsChart";
import DeleteAccountButton from "./DeleteAccountButton";

// See spec 0014 (AC-7 to AC-18).

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title") };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("account");
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

  const placeList = buildPlaces(checkpoints ?? []);
  const chartData = stampsPerMonth(stamps ?? [], placeList).map(({ month, count }) => ({
    month: format.dateTime(new Date(`${month}-01T00:00:00Z`), { year: "numeric", month: "short", timeZone: "UTC" }),
    count,
  }));

  return (
    <PageShell spaced>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>
        <SignOutButton />
      </header>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">{dashboardT("perMonth")}</h2>
        <StampsChart data={chartData} seriesName={dashboardT("stamps")} />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-red-600">{t("dangerZone")}</h2>
        <p className="mb-4 max-w-prose text-sm text-stone-600">{t("dangerZoneDesc")}</p>
        <DeleteAccountButton />
      </section>
    </PageShell>
  );
}
