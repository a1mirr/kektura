"use client";

import { useTranslations } from "next-intl";
import { setPlacesStamped } from "@/app/[locale]/dashboard/actions";
import ActionButton from "./ActionButton";

// Stamps a whole stage at once. Marking adds the stage's own places plus its starting point (so the
// first stretch counts as walked too); unmarking removes only the stage's own places.
export default function StageStampButton({
  stampKeys,
  unstampKeys,
  done,
}: {
  stampKeys: string[];
  unstampKeys: string[];
  done: boolean;
}) {
  const t = useTranslations("dashboard");

  return (
    <ActionButton action={() => setPlacesStamped(done ? unstampKeys : stampKeys, !done)} done={done}>
      {done ? t("unstampStage") : t("stampStage")}
    </ActionButton>
  );
}
