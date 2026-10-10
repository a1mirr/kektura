"use client";

import { useTranslations } from "next-intl";
import { setStageOpen } from "@/lib/stage-events";
import RetiredToggle from "./RetiredToggle";

export default function StageControls({ withRetired = false }: { withRetired?: boolean }) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {withRetired && <RetiredToggle />}
      <button type="button" onClick={() => setStageOpen("all", true)} className="text-blue-700 hover:underline">
        {t("expandAll")}
      </button>
      <button type="button" onClick={() => setStageOpen("all", false)} className="text-blue-700 hover:underline">
        {t("collapseAll")}
      </button>
    </div>
  );
}
