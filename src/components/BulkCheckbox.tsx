"use client";

import { useTranslations } from "next-intl";
import { useBulk } from "./BulkDatesProvider";

// The checkbox of a row in "Set dates" (spec 0016 AC-14, AC-15), stamped or not. Nothing for a row the page does not hand over, and nothing
// outside the mode. A click with Shift held selects the range up to the last chosen row; the click's event says so (a change event
// does not). The label is a 44 x 44 px target (AC-21).
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
