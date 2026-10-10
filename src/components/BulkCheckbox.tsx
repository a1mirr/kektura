"use client";

import { useTranslations } from "next-intl";
import { useBulk } from "./BulkDatesProvider";

// A click with Shift held selects the range up to the last chosen row; the click's event says so (a change event does
// not).
export default function BulkCheckbox({ id, name }: { id: string; name: string }) {
  const t = useTranslations("dashboard");
  const bulk = useBulk();
  if (!bulk?.active || !bulk.has(id)) return null;
  return (
    <label className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        className="size-5"
        aria-label={t("bulkSelect", { name })}
        checked={bulk.isSelected(id)}
        onChange={() => {}} // the click below decides: React wants a handler for a checked box
        onClick={(e) => bulk.toggle(id, e.shiftKey)}
      />
    </label>
  );
}
