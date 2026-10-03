"use client";

import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// `next` is the path (without locale) to land on after sign-in: the dashboard unless a page asks otherwise.
export default function SignInButton({ next = "/dashboard" }: { next?: string }) {
  const t = useTranslations("home");
  const locale = useLocale();

  async function signIn() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?locale=${locale}&next=${encodeURIComponent(next)}`,
      },
    });
  }

  return (
    <button
      onClick={signIn}
      className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
    >
      {t("signIn")}
    </button>
  );
}
