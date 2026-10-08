import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { testLoginEnabled } from "@/lib/test-login";
import PageShell from "@/components/PageShell";
import Screenshots from "@/components/Screenshots";
import SignInButton from "@/components/SignInButton";
import TestLoginForm from "@/components/TestLoginForm";

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Signed-in users go straight to their dashboard. Same check as the dashboard's own guard
  // (getUser, not getClaims): a revoked but unexpired token must not bounce between the two pages.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return redirect({ href: "/dashboard", locale });

  const t = await getTranslations("home");

  return (
    <PageShell variant="hero" below={<Screenshots />}>
      <h1 className="text-4xl font-bold text-blue-700">{t("headline")}</h1>
      <p className="text-lg text-stone-600">{t("subtitle")}</p>
      {error && <p className="text-red-600">{t("authError")}</p>}
      <SignInButton />
      {testLoginEnabled() && <TestLoginForm locale={locale} />}
    </PageShell>
  );
}
