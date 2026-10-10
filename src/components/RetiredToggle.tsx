"use client";

import { useTranslations } from "next-intl";
import { setShowRetired, useShowRetired } from "@/lib/retired-toggle";

export default function RetiredToggle() {
  const t = useTranslations("dashboard");
  const show = useShowRetired();
  return (
    <label className="flex items-center gap-1.5 text-sm text-stone-600">
      <input type="checkbox" checked={show} onChange={(e) => setShowRetired(e.target.checked)} />
      {t("showRetired")}
    </label>
  );
}
