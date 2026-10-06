"use client";

import { useTranslations } from "next-intl";
import PageShell from "@/components/PageShell";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("error");

  return (
    <PageShell variant="hero">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >
        {t("retry")}
      </button>
    </PageShell>
  );
}
