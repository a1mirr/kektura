"use client";

import { useTranslations } from "next-intl";
import { setExtraStamped } from "@/app/[locale]/dashboard/actions";
import ActionButton from "./ActionButton";
import { useStampAction } from "@/lib/use-stamp-action";

export default function ExtraStampButton({
  extraId,
  stamped,
  date,
}: {
  extraId: number;
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
          onChange={(e) => run(() => setExtraStamped(extraId, true, e.target.value))}
          className="rounded border border-stone-300 px-2 py-0.5 text-sm disabled:opacity-50"
        />
      )}
      <ActionButton action={() => setExtraStamped(extraId, !stamped)} done={stamped} accent="amber">
        {stamped ? t("unstamp") : t("stamp")}
      </ActionButton>
    </div>
  );
}
