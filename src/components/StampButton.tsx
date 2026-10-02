"use client";

import { useTranslations } from "next-intl";
import { setPlacesStamped, setStampDate } from "@/app/[locale]/dashboard/actions";
import { newStampDate } from "@/lib/stamp-date";
import ActionButton from "./ActionButton";
import StampDateInput from "./StampDateInput";

// Stamp / unstamp one place, and edit the date of a stamp (specs 0002, 0016). A new stamp gets the
// user's own day.
export default function StampButton({
  placeKey,
  stamped,
  date,
  maxDate,
}: {
  placeKey: string;
  stamped: boolean;
  date?: string; // the stamp's date, when stamped
  maxDate: string; // the latest date the server accepts
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex items-center gap-2">
      {stamped && date && <StampDateInput value={date} max={maxDate} onSave={(d) => setStampDate([placeKey], d)} />}
      <ActionButton action={() => setPlacesStamped([placeKey], !stamped, stamped ? undefined : newStampDate())} done={stamped}>
        {stamped ? t("unstamp") : t("stamp")}
      </ActionButton>
    </div>
  );
}
