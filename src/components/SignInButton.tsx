"use client";

import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function SignInButton() {
  const t = useTranslations("home");
  const locale = useLocale();

  async function signIn() {
    await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?locale=${locale}`,
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
