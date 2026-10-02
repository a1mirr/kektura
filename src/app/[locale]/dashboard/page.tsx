import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlaces,
  buildStages,
  placeKeyOf,
  progressSummary,
  stageStampKeys,
  stampedPlaceKeys,
  walkedRanges,
  findStageForKm,
} from "@/lib/progress";
import { maxStampDate } from "@/lib/stamp-date";
import LocateButton from "@/components/LocateButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import ExtraStampButton from "@/components/ExtraStampButton";
import StageControls from "@/components/StageControls";
import StageSection from "@/components/StageSection";
import StageStampButton from "@/components/StageStampButton";
import StampButton from "@/components/StampButton";
import TrailMapLoader from "@/components/TrailMapLoader";
import stagesData from "../../../../scripts/data/okt-stages.json";

export default async function Dashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const maxDate = maxStampDate(); // the latest stamp date the server accepts: the date fields' `max`

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/", locale });

  // Reference data comes from a shared server cache; only the user's own stamps hit the database (spec 0009).
  const { checkpoints, extras: extraList, stamps, extraStamps } = await loadDashboardData(supabase);
  const extraDone = new Map(extraStamps.map((s) => [s.extra_id, s.stamped_on]));
  const mapExtras = extraList.map((e) => ({
    id: e.id,
    name: e.name,
    lat: e.lat,
    lng: e.lng,
    stamped: extraDone.has(e.id),
  }));

  const placeList = buildPlaces(checkpoints);
  const placeKm = new Map(placeList.map((p) => [p.key, p.km]));
  const stages = buildStages(placeList, stagesData.stages);
  const stampedPlaces = stampedPlaceKeys(placeList, stamps);
  const doneRanges = walkedRanges(placeList, stampedPlaces);
  const summary = progressSummary(placeList, doneRanges);

  const extraListWithStage = extraList.map((e) => ({
    ...e,
    stage: findStageForKm(Number(e.km_from_start), stages, placeKm),
  }));


  const mapPoints = checkpoints
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => {
      const key = placeKeyOf(c);
      return {
        placeKey: key,
        name: c.name,
        lat: Number(c.lat),
        lng: Number(c.lng),
        km: placeKm.get(key)!,
        stamped: stampedPlaces.has(key),
      };
    });

  const cards = [
    { label: t("stamps"), value: `${stampedPlaces.size} / ${placeList.length}` },
    { label: t("percent"), value: `${summary.percent}%` },
    { label: t("km"), value: format.number(summary.doneKm) },
    { label: t("remaining"), value: format.number(summary.remainingKm) },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Link href="/account" className="text-sm text-stone-600 hover:underline">
            {t("account")}
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
            <dt className="text-sm text-stone-500">{c.label}</dt>
            <dd className="text-2xl font-semibold">{c.value}</dd>
          </div>
        ))}
      </dl>

      {mapPoints.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">{t("map")}</h2>
          <TrailMapLoader points={mapPoints} extras={mapExtras} doneRanges={doneRanges} />
          <p className="mt-2 text-sm text-stone-500">{t("mapLegend")}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">{t("checkpoints")}</h2>
        {placeList.length === 0 ? (
          <p className="text-stone-500">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-500">{t("stageHint")}</p>
              <StageControls />
            </div>
            {stages.map((stage) => {
              const { stage: n, meta, places: list } = stage;
              const keys = stageStampKeys(stage);
              const done = list.filter((p) => stampedPlaces.has(p.key)).length;
              const stageExtras = extraListWithStage.filter((e) => e.stage === n);
              return (
                <StageSection
                  key={n}
                  stage={n}
                  title={t("stageTitle", { n })}
                  route={meta ? `${meta.start} → ${meta.end}` : ""}
                  kmText={meta ? t("kmValue", { km: format.number(meta.km) }) : ""}
                  done={done}
                  total={list.length}
                  actions={
                    <div className="flex items-center gap-3">
                      {stageExtras.length > 0 && (
                        <a href={`#extra-${stageExtras[0].id}`} className="text-xs text-blue-600 hover:underline">
                          {t("goExtras", { count: stageExtras.length })}
                        </a>
                      )}
                      <StageStampButton
                        stampKeys={keys.stamp}
                        unstampKeys={keys.unstamp}
                        done={done === list.length}
                      />
                    </div>
                  }
                >
                  {list.map((p) => (
                    <li
                      id={`place-${p.key}`}
                      data-stage={p.stage}
                      key={p.key}
                      className="flex scroll-mt-24 items-start justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div>
                          <span className="mr-2 inline-block min-w-10 text-stone-400 tabular-nums">{p.label}</span>
                          {p.name}
                          <span className="ml-2 text-sm text-stone-500">{t("kmValue", { km: format.number(p.km) })}</span>
                        </div>
                        {p.variants.map((v) => (
                          <div key={v.id} className="truncate text-xs text-stone-500">
                            {v.description}
                          </div>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <LocateButton
                          kind="place"
                          keyId={p.key}
                          name={p.name}
                          lat={Number(p.variants[0].lat)}
                          lng={Number(p.variants[0].lng)}
                        />
                        <StampButton
                          placeKey={p.key}
                          stamped={stampedPlaces.has(p.key)}
                          date={stampedPlaces.get(p.key)}
                          maxDate={maxDate}
                        />
                      </div>
                    </li>
                  ))}
                </StageSection>
              );
            })}
          </div>
        )}
      </section>

      {extraListWithStage.length > 0 && (
        <section id="extra-stamps" className="scroll-mt-8">
          <h2 className="mb-1 font-semibold">
            {t("extraStamps")}{" "}
            <span className="text-sm font-normal text-stone-500">
              {extraDone.size} / {extraListWithStage.length}
            </span>
          </h2>
          <p className="mb-2 text-sm text-stone-500">{t("extraNote")}</p>
          <ul className="divide-y rounded-lg bg-white shadow-sm">
            {extraListWithStage.map((e) => (
              <li id={`extra-${e.id}`} key={e.id} className="flex scroll-mt-24 items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div>
                    {e.name}
                    <span className="ml-2 text-sm text-stone-500">
                      {t("kmValue", { km: format.number(Number(e.km_from_start)) })}
                      {e.stage !== null && ` · ${t("stageTitle", { n: e.stage })}`}
                      {e.off_trail_m > 100 && ` · ${t("offTrail", { m: format.number(e.off_trail_m) })}`}
                    </span>
                  </div>
                  <div className="truncate text-xs text-stone-500">{e.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <LocateButton kind="extra" keyId={String(e.id)} name={e.name} lat={e.lat} lng={e.lng} />
                  <ExtraStampButton
                    extraId={e.id}
                    stamped={extraDone.has(e.id)}
                    date={extraDone.get(e.id)}
                    maxDate={maxDate}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
