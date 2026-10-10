"use client";

import { useTranslations } from "next-intl";
import { useBulk } from "./BulkDatesProvider";

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
