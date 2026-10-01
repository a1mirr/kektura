"use client";

import { useTranslations } from "next-intl";
import { setStageOpen } from "@/lib/stage-events";

export default function StageControls() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex gap-3 text-sm">
      <button type="button" onClick={() => setStageOpen("all", true)} className="text-blue-700 hover:underline">
        {t("expandAll")}
      </button>
      <button type="button" onClick={() => setStageOpen("all", false)} className="text-blue-700 hover:underline">
        {t("collapseAll")}
      </button>
    </div>
  );
}
