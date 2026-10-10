import { getFormatter, getTranslations } from "next-intl/server";
import { WHO, type Comparison, type StageState } from "@/lib/compare";
import { WHO_COLOR, WHO_LINE_STYLE, type ComparePoint } from "@/lib/compare-map";
import CompareMapLoader from "./CompareMapLoader";
import CompareSwatch from "./CompareSwatch";
import { TRAIL_DATA_DATE } from "@/lib/trail-meta";

export default async function CompareSection({ comparison, points }: { comparison: Comparison; points: ComparePoint[] }) {
  const t = await getTranslations("compare");
  const tDash = await getTranslations("dashboard");
  const format = await getFormatter();
  const stateStyle: Record<StageState, string> = {
    both: "bg-green-100 text-green-900",
    me: "bg-blue-100 text-blue-900",
    them: "bg-orange-100 text-orange-900",
    neither: "bg-stone-100 text-stone-700",
    partly: "bg-amber-100 text-amber-900",
  };

  return (
    <section aria-labelledby="compare-title" className="space-y-4">
      <h2 id="compare-title" className="font-semibold">
        {t("title")}
      </h2>

      <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
        {WHO.map((who) => (
          <div key={who} data-who={who} className="min-w-0 rounded-lg bg-white p-3 shadow-sm sm:p-4">
            <dt className="flex items-center gap-2 text-sm text-stone-500">
              <CompareSwatch style={WHO_LINE_STYLE[who]} color={WHO_COLOR[who]} />
              {t(`who_${who}`)}
            </dt>
            <dd className="text-xl font-semibold sm:text-2xl">{tDash("kmValue", { km: format.number(comparison.km[who]) })}</dd>
            <dd className="text-sm text-stone-600">{t("stamps", { count: comparison.places[who] })}</dd>
          </div>
        ))}
      </dl>

      <CompareMapLoader points={points} ranges={comparison.ranges} />
      <p className="text-sm text-stone-500">
        {tDash("trailData", { date: format.dateTime(new Date(`${TRAIL_DATA_DATE}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" }) })}
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("stagesTitle")}</h3>
        <ul className="divide-y rounded-lg bg-white shadow-sm">
          {comparison.stages.map((s) => (
            <li key={s.stage}>
              <a
                href={`#stage-${s.stage}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 hover:bg-stone-50 active:bg-stone-100"
              >
                <span className="font-medium">{tDash("stageTitle", { n: s.stage })}</span>
                <span className="text-sm text-stone-600">{t("stageCounts", { me: s.me, them: s.them, total: s.total })}</span>
                <span className={`rounded px-2 py-0.5 text-sm ${stateStyle[s.state]}`}>{t(`stage_${s.state}`)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
