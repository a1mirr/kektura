"use client";

import { useTranslations } from "next-intl";
import { setPlacesStamped, setStampDate } from "@/app/[locale]/dashboard/actions";
import { newStampDate } from "@/lib/stamp-date";
import ActionButton from "./ActionButton";
import StampDateInput from "./StampDateInput";

export default function StampButton({
  placeKey,
  stamped,
  date,
  maxDate,
}: {
  placeKey: string;
  stamped: boolean;
  date?: string;
  maxDate: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {stamped && date && <StampDateInput value={date} max={maxDate} onSave={(d) => setStampDate([placeKey], d)} />}
      <ActionButton
        action={() => setPlacesStamped([placeKey], !stamped, stamped ? undefined : newStampDate())}
        done={stamped}
        doneLabel={t("unstamp")}
        todoLabel={t("stamp")}
      />
    </div>
  );
}
