import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { testLoginEnabled } from "@/lib/test-login";
import LocaleSwitcher from "@/components/LocaleSwitcher";
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
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <h1 className="text-4xl font-bold text-blue-700">{t("headline")}</h1>
      <p className="text-lg text-stone-600">{t("subtitle")}</p>
      {error && <p className="text-red-600">{t("authError")}</p>}
      <SignInButton />
      {testLoginEnabled() && <TestLoginForm locale={locale} />}
    </main>
  );
}
