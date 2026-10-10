import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import PageShell from "@/components/PageShell";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "./DeleteAccountButton";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  return (
    <PageShell spaced>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>
        <SignOutButton />
      </header>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold text-red-600">{t("dangerZone")}</h2>
        <p className="mb-4 max-w-prose text-sm text-stone-600">{t("dangerZoneDesc")}</p>
        <DeleteAccountButton />
      </section>
    </PageShell>
  );
}
