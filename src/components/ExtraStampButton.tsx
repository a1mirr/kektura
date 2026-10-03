"use client";

import { useTranslations } from "next-intl";
import { setExtraStampDate, setExtraStamped } from "@/app/[locale]/dashboard/actions";
import { newStampDate } from "@/lib/stamp-date";
import ActionButton from "./ActionButton";
import StampDateInput from "./StampDateInput";

// Same as StampButton, for the extra (non-official) stamps.
export default function ExtraStampButton({
  extraId,
  stamped,
  date,
  maxDate,
}: {
  extraId: number;
  stamped: boolean;
  date?: string; // the stamp's date, when stamped
  maxDate: string; // the latest date the server accepts
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex items-center gap-2">
      {stamped && date && <StampDateInput value={date} max={maxDate} onSave={(d) => setExtraStampDate(extraId, d)} />}
      <ActionButton
        action={() => setExtraStamped(extraId, !stamped, stamped ? undefined : newStampDate())}
        done={stamped}
        doneLabel={t("unstamp")}
        todoLabel={t("stamp")}
        accent="amber"
      />
    </div>
  );
}
