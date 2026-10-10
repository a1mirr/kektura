import { useFormatter, useTranslations } from "next-intl";
import { fmtTime, type RouteStats } from "@/lib/route-stats";

export default function RoutePanel({
  fullscreen,
  fromName,
  toName,
  hasFrom,
  hasTo,
  stats,
  onClear,
}: {
  fullscreen: boolean;
  fromName: string | null;
  toName: string | null;
  hasFrom: boolean;
  hasTo: boolean;
  stats: RouteStats | null;
  onClear: () => void;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  return (
    <div
      className={`${fullscreen ? "" : "mt-2 "}flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm`}
    >
      <span className="font-medium">
        {fromName ?? "…"} → {toName ?? "…"}
      </span>
      {stats ? (
        <>
          <span>{t("routeKm", { km: format.number(stats.km) })}</span>
          <span>↑ {t("routeUp", { m: format.number(stats.up) })}</span>
          <span>↓ {t("routeDown", { m: format.number(stats.down) })}</span>
          <span>
            ⏱{" "}
            {stats.minutes === 0
              ? t("routeFerryOnly")
              : t(stats.ferry ? "routeTimeFerry" : "routeTime", {
                  time: fmtTime(stats.minutes),
                })}
          </span>
        </>
      ) : (
        <span className="text-stone-500">
          {hasFrom && hasTo ? t("routeNoData") : hasFrom ? t("routePickTo") : t("routePickFrom")}
        </span>
      )}
      <button type="button" onClick={onClear} className="ml-auto text-blue-700 hover:underline">
        {t("routeClear")}
      </button>
      {stats && <span className="w-full text-xs text-stone-500">{t("routeNote")}</span>}
    </div>
  );
}
