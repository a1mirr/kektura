"use client";

import { useTranslations } from "next-intl";
import { useBulk } from "./BulkDatesProvider";

// On a stage's header, in the mode only (spec 0016 AC-15): "Select stage" adds every row of the stage to the choice, stamped or not.
// Outside the mode the stage has no such button; the way in is the toolbar's button (AC-14). The mode needs JavaScript, so this is
// never in the server's HTML.
export default function BulkStageButton({ stage }: { stage: number }) {
  const t = useTranslations("dashboard");
  const bulk = useBulk();
  if (!bulk?.active) return null;
  const ids = bulk.items.filter((i) => i.kind === "place" && i.stage === stage).map((i) => i.id);
  if (ids.length === 0) return null;
  return (
    <button
      type="button"
      aria-label={`${t("bulkSelectStage")}: ${t("stageTitle", { n: stage })}`}
      onClick={() => bulk.selectMany(ids)}
      className="inline-flex min-h-6 items-center text-xs text-blue-700 hover:underline"
    >
      {t("bulkSelectStage")}
    </button>
  );
}
