"use client";

import { useTranslations } from "next-intl";
import { setExtraStampDate, setExtraStamped } from "@/app/[locale]/dashboard/actions";
import { newStampDate } from "@/lib/stamp-date";
import ActionButton from "./ActionButton";
import StampDateInput from "./StampDateInput";

export default function ExtraStampButton({
  extraId,
  stamped,
  date,
  maxDate,
}: {
  extraId: number;
  stamped: boolean;
  date?: string;
  maxDate: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
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
