"use client";

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
  const { pending, run } = useStampAction();

  return (
    <div className="flex items-center gap-2">
      {stamped && (
        <input
          type="date"
          value={date ?? ""}
          disabled={pending}
          onChange={(e) => run(() => setPlacesStamped([placeKey], true, e.target.value))}
          className="rounded border border-stone-300 px-2 py-0.5 text-sm disabled:opacity-50"
        />
      )}
      <ActionButton action={() => setPlacesStamped([placeKey], !stamped)} done={stamped}>
        {stamped ? t("unstamp") : t("stamp")}
      </ActionButton>
    </div>
  );
}
