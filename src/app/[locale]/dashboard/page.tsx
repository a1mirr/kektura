import { Fragment } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadDashboardData } from "@/lib/dashboard-data";
import { flagOn } from "@/lib/feature-flags-server";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlaces,
  buildRetired,
  buildStages,
  countDone,
  progressSummary,
  retiredVisibleKeys,
  stageStampKeys,
  stampedPlaceKeys,
  waivedPlaceKeys,
  walkedRanges,
  findStageForKm,
  type Checkpoint,
} from "@/lib/progress";
import { buildBulkItems, extraItemId, placeItemId } from "@/lib/bulk-dates";
import { dayBefore, maxStampDate } from "@/lib/stamp-date";
import { buildMapPoints } from "@/lib/map-data";
import { hasToleranceNote, requiredNote } from "@/lib/new-stamps";
import { isRecentlyMoved, movedNote, recentlyMovedVariant, todayIso } from "@/lib/stamp-moves";
import { TRAIL_DATA_DATE } from "@/lib/trail-meta";
import BulkCheckbox from "@/components/BulkCheckbox";
import { BulkMessage, BulkToolbar } from "@/components/BulkDateBar";
import BulkDatesProvider from "@/components/BulkDatesProvider";
import BulkStageButton from "@/components/BulkStageButton";
import LocateButton from "@/components/LocateButton";
import MovedNote from "@/components/MovedNote";
import PageShell from "@/components/PageShell";
import RequiredFrom from "@/components/RequiredFrom";
import RetiredRow from "@/components/RetiredRow";
import RetiredToggle from "@/components/RetiredToggle";
import RetiredStampControl from "@/components/RetiredStampControl";
import ExtraStampButton from "@/components/ExtraStampButton";
import StageControls from "@/components/StageControls";
import StageSection from "@/components/StageSection";
import StageStampButton from "@/components/StageStampButton";
import StampButton from "@/components/StampButton";
import StampDescriptions from "@/components/StampDescriptions";
import TrailMapLoader from "@/components/TrailMapLoader";
import { localizedDescription } from "@/lib/stamp-description";
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

  // Reference data comes from a shared server cache; only the user's own stamps hit the database (spec 0002 AC-15, AC-16).
  const [showRestaurants, { checkpoints, extras: extraList, stamps, extraStamps }] = await Promise.all([
    flagOn("restaurants"),
    loadDashboardData(supabase),
  ]);
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
  const waived = waivedPlaceKeys(placeList, stampedPlaces);
  // Retired stamps (spec 0001 AC-22 to AC-26) are no places: they never reach the count, the km, the stages' totals or the map.
  const retiredList = buildRetired(checkpoints);
  const stampedRetired = stampedPlaceKeys(retiredList, stamps);
  const listedRetired = retiredVisibleKeys(retiredList, placeList, stampedPlaces, stampedRetired);
  const retiredReplacedBy = new Map(retiredList.flatMap((r) => (r.replacedBy ? [[r.replacedBy, r] as const] : [])));
  const doneRanges = walkedRanges(placeList, stampedPlaces, waived);
  const summary = progressSummary(placeList, doneRanges);

  const extraListWithStage = extraList.map((e) => ({
    ...e,
    stage: findStageForKm(Number(e.km_from_start), stages, placeKm),
  }));


  // The rows that "Set dates" can choose, stamped or not, in the order the page lists them (spec 0016 AC-14, AC-15).
  const bulkItems = buildBulkItems({
    stages: stages.map((st) => ({
      stage: st.stage,
      places: st.places,
      retired: retiredList.filter((r) => r.stage === st.stage),
    })),
    isStamped: (key) => stampedPlaces.has(key) || stampedRetired.has(key),
    extras: extraList,
    isExtraStamped: (id) => extraDone.has(id),
  });

  const requiredFrom = new Map(placeList.map((p) => [p.key, p.requiredFrom]));
  const dateText = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" });
  // A stamp the MTSZ moved in the last 180 days says so, in its row and in its popup (spec 0001 AC-29, spec 0003 AC-26): the data's own
  // description of where it is now, no more.
  const today = todayIso();
  const movedText = {
    on: (date: string) => t("movedOn", { date }),
    now: (description: string) => t("movedNow", { description }),
    check: t("movedCheck"),
  };
  const movedNoteOf = (c: Checkpoint) =>
    isRecentlyMoved(c.moved_on, today) ? movedNote(c.moved_on!, localizedDescription(c.code, c.description, locale), movedText, dateText) : undefined;
  const mapPoints = buildMapPoints(
    checkpoints,
    placeKm,
    stampedPlaces,
    (key) =>
      requiredNote(
        requiredFrom.get(key) ?? null,
        waived.has(key),
        { requiredFrom: (date) => t("requiredFrom", { date }), notRequired: t("notRequired") },
        dateText,
      ),
    movedNoteOf,
  );

  const cards = [
    { label: t("stamps"), value: `${stampedPlaces.size} / ${placeList.length}` },
    { label: t("percent"), value: `${summary.percent}%` },
    { label: t("km"), value: format.number(summary.doneKm) },
    { label: t("remaining"), value: format.number(summary.remainingKm) },
  ];

  return (
    <PageShell
      stretch
      header={
        <header>
          <h1 className="text-2xl font-bold text-blue-700">{t("title")}</h1>
        </header>
      }
      aside={
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
            {cards.map((c) => (
              <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
                <dt className="text-sm text-stone-500">{c.label}</dt>
                <dd className="text-2xl font-semibold">{c.value}</dd>
              </div>
            ))}
          </dl>

          {mapPoints.length > 0 && (
            // From 1024 px the map's block stays in view while the stage list scrolls (spec 0001 AC-28). A sticky box is a
            // stacking context, so it has a z-index: the fullscreen map inside it must cover the list's controls (spec 0003 AC-11).
            <div
              data-sticky-map
              className="lg:sticky lg:top-4 lg:z-10 lg:-m-1 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:p-1"
            >
              <section className="rounded-lg bg-white p-4 shadow-sm">
                <h2 className="mb-2 font-semibold">{t("map")}</h2>
                <TrailMapLoader points={mapPoints} extras={mapExtras} doneRanges={doneRanges} withRestaurants={showRestaurants} />
                <p className="mt-2 text-sm text-stone-500">{t("mapLegend")}</p>
                <p className="mt-1 text-sm text-stone-500">{t("trailData", { date: dateText(TRAIL_DATA_DATE) })}</p>
              </section>
            </div>
          )}
        </>
      }
    >
      <BulkDatesProvider items={bulkItems} max={maxDate}>
      <BulkMessage />
      {/* One box for the stage list and the extra stamps: the toolbar sticks to the top of the page for all of it (spec 0016 AC-14). */}
      <div>
        <h2 className="mb-2 font-semibold">{t("checkpoints")}</h2>
        {placeList.length === 0 ? (
          <p className="text-stone-500">{t("empty")}</p>
        ) : (
          <>
            <p className="text-sm text-stone-500">{t("stageHint")}</p>
            {retiredList.length > 0 && (
              <div className="mt-2">
                <RetiredToggle />
              </div>
            )}
            <BulkToolbar>
              <StageControls />
            </BulkToolbar>
            <div className="space-y-3">
            {stages.map((stage) => {
              const { stage: n, meta, places: list } = stage;
              const keys = stageStampKeys(stage);
              // A place the user was not missing (spec 0001 AC-17) counts as done for the stage's progress (AC-20); the stage's
              // button follows the stamps alone, so "Stamp stage" still marks a waived place.
              const done = countDone(list, stampedPlaces, waived);
              const stageExtras = extraListWithStage.filter((e) => e.stage === n);
              const stageRetired = retiredList.filter((r) => r.stage === n);
              const retiredCollected = stageRetired.filter((r) => stampedRetired.has(r.key)).length;
              const placeKeys = new Set(list.map((p) => p.key));
              const retiredRow = (r: (typeof retiredList)[number]) => {
                const until = dayBefore(r.retiredOn);
                const replacement = r.replacedBy ? list.find((p) => p.key === r.replacedBy) : undefined;
                const [before, after] = t("retiredReplacedBy", { place: "\u2063" }).split("\u2063");
                return (
                  <RetiredRow key={r.key} id={`place-${r.key}`} listed={listedRetired.has(r.key)}>
                    <BulkCheckbox id={placeItemId(r.key)} name={r.name} />
                    <div className="min-w-0 flex-1 basis-40">
                      <div>
                        <span className="mr-2 inline-block min-w-10 text-stone-500" aria-hidden>
                          –
                        </span>
                        {r.name}
                        <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-medium text-stone-700">{t("retiredBadge")}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600 [overflow-wrap:anywhere]">
                        {t("retiredNote", { date: dateText(until) })}
                        {replacement && (
                          <>
                            {" "}
                            {before}
                            <a href={`#place-${replacement.key}`} className="text-blue-700 underline">
                              {replacement.name}
                            </a>
                            {after}
                          </>
                        )}
                        {r.approximate && ` ${t("retiredApprox")}`}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
                      <RetiredStampControl
                        placeKey={r.key}
                        name={r.name}
                        stamped={stampedRetired.has(r.key)}
                        date={stampedRetired.get(r.key)}
                        latest={until}
                        latestText={dateText(until)}
                      />
                    </div>
                  </RetiredRow>
                );
              };
              return (
                <StageSection
                  key={n}
                  stage={n}
                  title={t("stageTitle", { n })}
                  route={meta ? `${meta.start} → ${meta.end}` : ""}
                  kmText={meta ? t("kmValue", { km: format.number(meta.km) }) : ""}
                  done={done}
                  total={list.length}
                  mark={retiredCollected > 0 ? t("retiredMark", { count: retiredCollected }) : undefined}
                  actions={
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      {stageExtras.length > 0 && (
                        <a href={`#extra-${stageExtras[0].id}`} className="text-xs text-blue-600 hover:underline">
                          {t("goExtras", { count: stageExtras.length })}
                        </a>
                      )}
                      <BulkStageButton stage={n} />
                      <StageStampButton
                        stampKeys={keys.stamp}
                        unstampKeys={keys.unstamp}
                        done={list.every((p) => stampedPlaces.has(p.key))}
                      />
                    </div>
                  }
                >
                  {list.map((p) => (
                    <Fragment key={p.key}>
                    <li
                      id={`place-${p.key}`}
                      data-stage={p.stage}
                      className="flex scroll-mt-24 lg:scroll-mt-44 flex-wrap items-start justify-between gap-x-2 gap-y-1 px-4 py-3 lg:scroll-mt-44"
                    >
                      <BulkCheckbox id={placeItemId(p.key)} name={p.name} />
                      <div className="min-w-0 flex-1 basis-40">
                        <div>
                          <span className="mr-2 inline-block min-w-10 text-stone-500 tabular-nums">{p.label}</span>
                          {p.name}
                          <span className="ml-2 text-sm text-stone-500">{t("kmValue", { km: format.number(p.km) })}</span>
                        </div>
                        {p.requiredFrom && (
                          <RequiredFrom requiredFrom={p.requiredFrom} waived={waived.has(p.key)} tolerance={hasToleranceNote(p)} />
                        )}
                        {(() => {
                          const moved = recentlyMovedVariant(p.variants, today);
                          return moved && <MovedNote>{movedNoteOf(moved)!}</MovedNote>;
                        })()}
                        {retiredReplacedBy.has(p.key) && (
                          <p className="mt-1 text-xs text-stone-600 [overflow-wrap:anywhere]">
                            {t("replacesRetired", {
                              name: retiredReplacedBy.get(p.key)!.name,
                              date: dateText(dayBefore(retiredReplacedBy.get(p.key)!.retiredOn)),
                            })}
                          </p>
                        )}
                        <StampDescriptions descriptions={p.variants.map((v) => localizedDescription(v.code, v.description, locale))} />
                      </div>
                      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
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
                    {stageRetired.filter((r) => r.afterKey === p.key).map(retiredRow)}
                    </Fragment>
                  ))}
                  {stageRetired.filter((r) => !r.afterKey || !placeKeys.has(r.afterKey)).map(retiredRow)}
                  {retiredCollected > 0 && (
                    <li className="px-4 py-2 text-sm text-stone-600">{t("retiredCollected", { count: retiredCollected })}</li>
                  )}
                </StageSection>
              );
            })}
            </div>
          </>
        )}

      {extraListWithStage.length > 0 && (
        <section id="extra-stamps" className="mt-8 scroll-mt-24 lg:scroll-mt-44">
          <h2 className="mb-1 font-semibold">
            {t("extraStamps")}{" "}
            <span className="text-sm font-normal text-stone-500">
              {extraDone.size} / {extraListWithStage.length}
            </span>
          </h2>
          <p className="mb-2 text-sm text-stone-500">{t("extraNote")}</p>
          <ul className="divide-y rounded-lg bg-white shadow-sm">
            {extraListWithStage.map((e) => (
              <li id={`extra-${e.id}`} key={e.id} className="flex scroll-mt-24 lg:scroll-mt-44 flex-wrap items-start justify-between gap-x-2 gap-y-1 px-4 py-3 lg:scroll-mt-44">
                <BulkCheckbox id={extraItemId(e.id)} name={e.name} />
                <div className="min-w-0 flex-1 basis-40">
                  <div>
                    {e.name}
                    <span className="ml-2 text-sm text-stone-500">
                      {t("kmValue", { km: format.number(Number(e.km_from_start)) })}
                      {e.stage !== null && ` · ${t("stageTitle", { n: e.stage })}`}
                      {e.off_trail_m > 100 && ` · ${t("offTrail", { m: format.number(e.off_trail_m) })}`}
                    </span>
                  </div>
                  <StampDescriptions descriptions={[localizedDescription(e.code, e.description, locale)]} />
                </div>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
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
      </div>
      </BulkDatesProvider>
    </PageShell>
  );
}
