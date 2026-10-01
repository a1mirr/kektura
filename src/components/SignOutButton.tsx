"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const t = useTranslations("dashboard");
  const router = useRouter();

  return (
    <button
      className="text-sm text-stone-600 hover:underline"
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/");
      }}
    >
      {t("signOut")}
    </button>
  );
}
