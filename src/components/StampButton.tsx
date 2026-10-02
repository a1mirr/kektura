"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setPlacesStamped } from "@/app/[locale]/dashboard/actions";
import ActionButton from "./ActionButton";
import { useStampAction } from "@/lib/use-stamp-action";

export default function StampButton({
  placeKey,
  stamped,
  date,
}: {
  placeKey: string;
  stamped: boolean;
  date?: string;
}) {
  const t = useTranslations("dashboard");
  const { pending, failed, run } = useStampAction();
  const [prevDate, setPrevDate] = useState(date);
  const [localDate, setLocalDate] = useState(date ?? "");

  if (date !== prevDate) {
    setPrevDate(date);
    setLocalDate(date ?? "");
  }

  return (
    <div className="flex items-center gap-2">
      {failed && (
        <span role="alert" className="text-xs text-red-600">
          {t("actionFailed")}
        </span>
      )}
      {stamped && (
        <input
          type="date"
          value={localDate}
          disabled={pending}
          onChange={(e) => {
            const val = e.target.value;
            setLocalDate(val);
            run(() => setPlacesStamped([placeKey], true, val));
          }}
          className="rounded border border-stone-300 px-2 py-0.5 text-sm disabled:opacity-50"
        />
      )}
      <ActionButton action={() => setPlacesStamped([placeKey], !stamped)} done={stamped}>
        {stamped ? t("unstamp") : t("stamp")}
      </ActionButton>
    </div>
  );
}
