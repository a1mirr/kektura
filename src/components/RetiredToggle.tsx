"use client";

import { useTranslations } from "next-intl";
import { setShowRetired, useShowRetired } from "@/lib/retired-toggle";

// "Show retired stamps" (spec 0001 AC-24): lists every retired stamp, also for somebody who walked the old route without
// stamping its neighbours first.
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
