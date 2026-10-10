"use client";

import { useTranslations } from "next-intl";
import { setPlacesStamped } from "@/app/[locale]/dashboard/actions";
import { newStampDate } from "@/lib/stamp-date";
import ActionButton from "./ActionButton";

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
    <ActionButton
      action={() => setPlacesStamped(done ? unstampKeys : stampKeys, !done, done ? undefined : newStampDate())}
      done={done}
      doneLabel={t("unstampStage")}
      todoLabel={t("stampStage")}
    />
  );
}
