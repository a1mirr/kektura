"use client";

import { useTranslations } from "next-intl";
import { setStageOpen } from "@/lib/stage-events";
import { useHydrated } from "@/lib/use-hydrated";
import { useBulk } from "./BulkDatesProvider";
import RetiredToggle from "./RetiredToggle";

export default function StageControls({ withRetired = false }: { withRetired?: boolean }) {
  const t = useTranslations("dashboard");
  const bulk = useBulk();
  const hydrated = useHydrated();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {withRetired && <RetiredToggle />}
      {bulk && hydrated && (
        <button
          type="button"
          aria-pressed={bulk.active}
          onClick={() => (bulk.active ? bulk.exit() : bulk.enter())}
          className="inline-flex min-h-6 items-center text-blue-700 hover:underline aria-pressed:font-semibold"
        >
          {t("bulkMode")}
        </button>
      )}
      <button type="button" onClick={() => setStageOpen("all", true)} className="text-blue-700 hover:underline">
        {t("expandAll")}
      </button>
      <button type="button" onClick={() => setStageOpen("all", false)} className="text-blue-700 hover:underline">
        {t("collapseAll")}
      </button>
    </div>
  );
}
