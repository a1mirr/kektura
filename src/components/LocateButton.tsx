"use client";

import { useTranslations } from "next-intl";
import { focusOnMap, type FocusDetail } from "@/lib/map-focus";

type Props = Omit<FocusDetail, "key"> & { keyId: string };

export default function LocateButton({ keyId, ...rest }: Props) {
  const t = useTranslations("dashboard");

  return (
    <button
      type="button"
      onClick={() => focusOnMap({ ...rest, key: keyId })}
      title={t("showOnMap")}
      aria-label={t("showOnMap")}
      className="shrink-0 rounded px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 hover:text-blue-700"
    >
      📍
    </button>
  );
}
