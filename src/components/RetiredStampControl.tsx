"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setPlacesStamped, setStampDate } from "@/app/[locale]/dashboard/actions";
import { isValidStampDate } from "@/lib/stamp-date";
import { useStampAction } from "@/lib/use-stamp-action";
import ActionButton from "./ActionButton";
import StampDateInput from "./StampDateInput";

export default function RetiredStampControl({
  placeKey,
  name,
  stamped,
  date,
  latest,
  latestText,
}: {
  placeKey: string;
  name: string;
  stamped: boolean;
  date?: string;
  latest: string;
  latestText: string;
}) {
  const t = useTranslations("dashboard");
  const { pending, failed, run } = useStampAction();
  const [draft, setDraft] = useState("");
  const valid = isValidStampDate(draft) && draft <= latest;

  if (stamped) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {date && <StampDateInput value={date} max={latest} latest={latest} onSave={(d) => setStampDate([placeKey], d)} />}
        <ActionButton
          action={() => setPlacesStamped([placeKey], false)}
          done
          doneLabel={t("unstamp")}
          todoLabel={t("stamp")}
          ariaLabel={t("retiredRemove", { name })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {failed && (
        <span role="alert" className="text-xs text-red-600">
          {t("actionFailed")}
        </span>
      )}
      <input
        type="text"
        autoComplete="off"
        placeholder="yyyy-mm-dd"
        maxLength={10}
        aria-label={t("retiredDate", { date: latestText })}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-28 rounded border border-stone-300 px-2 py-0.5 text-sm tabular-nums"
      />
      <button
        type="button"
        disabled={!valid || pending}
        aria-label={t("retiredAdd", { name })}
        onClick={() => run(() => setPlacesStamped([placeKey], true, draft))}
        className="shrink-0 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {t("stamp")}
      </button>
    </div>
  );
}
