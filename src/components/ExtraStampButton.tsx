"use client";

import { useTranslations } from "next-intl";
import { setExtraStamped } from "@/app/[locale]/dashboard/actions";
import ActionButton from "./ActionButton";

export default function ExtraStampButton({ extraId, stamped }: { extraId: number; stamped: boolean }) {
  const t = useTranslations("dashboard");

  return (
    <ActionButton action={() => setExtraStamped(extraId, !stamped)} done={stamped} accent="amber">
      {stamped ? t("unstamp") : t("stamp")}
    </ActionButton>
  );
}
