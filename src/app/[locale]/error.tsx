"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("error");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >
        {t("retry")}
      </button>
    </main>
  );
}
