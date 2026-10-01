"use client";

import { useTranslations } from "next-intl";
import { setPlacesStamped } from "@/app/[locale]/dashboard/actions";
import ActionButton from "./ActionButton";

export default function StampButton({ placeKey, stamped }: { placeKey: string; stamped: boolean }) {
  const t = useTranslations("dashboard");

  return (
    <ActionButton action={() => setPlacesStamped([placeKey], !stamped)} done={stamped}>
      {stamped ? t("unstamp") : t("stamp")}
    </ActionButton>
  );
}
