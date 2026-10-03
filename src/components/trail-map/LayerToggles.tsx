import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DONE, EXTRA, RESTAURANT } from "@/lib/map-layers";
import type { LayerToggles as Toggles } from "./types";

function Toggle({
  checked,
  onChange,
  swatch,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  swatch: ReactNode;
  label: string;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {swatch}
      {label}
    </label>
  );
}

// The checkboxes under the map (spec 0003 AC-10). Extra stamps and restaurants are offered only when
// there are some (the restaurants once their data has loaded).
export default function LayerToggles({
  fullscreen,
  toggles,
  onChange,
  extraCount,
  restaurantCount,
}: {
  fullscreen: boolean;
  toggles: Toggles;
  onChange: { [K in keyof Toggles]: (on: boolean) => void };
  extraCount: number;
  restaurantCount: number;
}) {
  const t = useTranslations("dashboard");
  return (
    <div className={fullscreen ? "flex flex-wrap gap-x-6 gap-y-1" : "mt-2 flex flex-wrap gap-x-6 gap-y-1"}>
      <Toggle
        checked={toggles.showDone}
        onChange={onChange.showDone}
        swatch={<span className="inline-block h-1 w-4 rounded" style={{ backgroundColor: DONE }} />}
        label={t("showWalked")}
      />
      <Toggle
        checked={toggles.showStamps}
        onChange={onChange.showStamps}
        swatch={<span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: DONE }} />}
        label={t("showStamps")}
      />
      {extraCount > 0 && (
        <Toggle
          checked={toggles.showExtras}
          onChange={onChange.showExtras}
          swatch={<span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: EXTRA }} />}
          label={t("showExtras", { count: extraCount })}
        />
      )}
      {restaurantCount > 0 && (
        <Toggle
          checked={toggles.showRestaurants}
          onChange={onChange.showRestaurants}
          swatch={<span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: RESTAURANT }} />}
          label={t("showRestaurants", { count: restaurantCount })}
        />
      )}
    </div>
  );
}
