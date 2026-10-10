"use client";

import { useTranslations } from "next-intl";
import { useHydrated } from "@/lib/use-hydrated";
import { useBulk } from "./BulkDatesProvider";

export default function BulkStageButton({ stage }: { stage: number }) {
  const t = useTranslations("dashboard");
  const bulk = useBulk();
  const hydrated = useHydrated();
  if (!bulk || !hydrated) return null;
  const ids = bulk.items.filter((i) => i.kind === "place" && i.stage === stage).map((i) => i.id);
  if (ids.length === 0) return null;
  const label = bulk.active ? t("bulkSelectStage") : t("bulkStageDate");
  return (
    <button
      type="button"
      aria-label={`${label}: ${t("stageTitle", { n: stage })}`}
      onClick={() => (bulk.active ? bulk.selectMany(ids) : bulk.enter(ids))}
      className="inline-flex min-h-6 items-center text-xs text-blue-700 hover:underline"
    >
      {label}
    </button>
  );
}
