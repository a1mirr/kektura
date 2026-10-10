"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { setStageOpen } from "@/lib/stage-events";
import { useHydrated } from "@/lib/use-hydrated";
import { useBulk } from "./BulkDatesProvider";
import RetiredToggle from "./RetiredToggle";

export default function StageControls({ withRetired = false }: { withRetired?: boolean }) {
  const t = useTranslations("dashboard");
  const bulk = useBulk(); // only on the dashboard, where dates are set (spec 0016 AC-14)
  const hydrated = useHydrated(); // "Set dates" needs JavaScript: without it only the single date fields are offered
  const button = useRef<HTMLButtonElement>(null);
  const active = bulk?.active ?? false;
  const wasActive = useRef(false);
  useEffect(() => {
    // The mode closed (Cancel, Escape or a save): the button that opened it gets the focus back.
    if (wasActive.current && !active) button.current?.focus({ preventScroll: true });
    wasActive.current = active;
  }, [active]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {bulk && hydrated && (
        <button
          ref={button}
          type="button"
          aria-pressed={active}
          onClick={() => (active ? bulk.exit() : bulk.enter())}
          className="inline-flex min-h-9 items-center rounded bg-blue-600 px-3 font-medium text-white hover:bg-blue-700 aria-pressed:bg-blue-800 lg:min-h-8"
        >
          {t("bulkMode")}
        </button>
      )}
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
