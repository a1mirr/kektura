"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { KmRange } from "@/lib/progress";
import { revealInList } from "@/lib/map-reveal";
import type { MapExtra, MapPoint } from "@/lib/map-data";
import LayerToggles from "./trail-map/LayerToggles";
import RoutePanel from "./trail-map/RoutePanel";
import type { MapContext, MapHandle } from "./trail-map/types";
import { useFullscreen } from "./trail-map/useFullscreen";
import { useLatest } from "./trail-map/useLatest";
import { useLayerToggles } from "./trail-map/useLayerToggles";
import { useMapData } from "./trail-map/useMapData";
import { useMapInstance } from "./trail-map/useMapInstance";
import { useRestaurants } from "./trail-map/useRestaurants";
import { useRoutePlanner } from "./trail-map/useRoutePlanner";

export type { MapExtra, MapPoint };

// The dashboard's trail map and route planner (spec 0003), composed from the pieces in
// `./trail-map` (spec 0003 AC-17): the map itself lives outside React state, the hooks keep it in step.
export default function TrailMap({
  points,
  extras = [],
  doneRanges,
}: {
  points: MapPoint[];
  extras?: MapExtra[];
  doneRanges: KmRange[];
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle>({ map: null, ready: false, route: null });
  const inputs = { points, extras, doneRanges };
  const latest = useLatest(inputs);

  const toggles = useLayerToggles(mapRef);
  const fullscreen = useFullscreen(wrapper, mapRef);
  const { restaurants, restaurantsRef } = useRestaurants(mapRef);
  const planner = useRoutePlanner(mapRef, latest, points);
  const refreshRoute = useMapData(mapRef, latest, inputs, toggles.values.showDone, planner.refreshSegment);

  // "Show in list": in fullscreen the list is behind the map, so leave fullscreen first, then scroll.
  const { exit, isFullscreen } = fullscreen;
  const showInList = useCallback(
    (kind: string, key: string) => {
      if (isFullscreen()) {
        exit();
        setTimeout(() => revealInList(kind, key), 450);
      } else {
        revealInList(kind, key);
      }
    },
    [exit, isFullscreen],
  );

  const ctx = useLatest<MapContext>({
    t,
    refreshPage: () => router.refresh(),
    routeFrom: planner.routeFrom,
    routeTo: planner.routeTo,
    setRouteFrom: planner.setRouteFrom,
    setRouteTo: planner.setRouteTo,
    showInList,
    showExtras: () => toggles.set.showExtras(true),
  });
  useMapInstance({
    container,
    mapRef,
    latest,
    toggles: toggles.latest,
    restaurants: restaurantsRef,
    ctx,
    refreshRoute,
  });

  const fs = fullscreen.fullscreen;
  return (
    <div ref={wrapper} className={fs ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-3" : undefined}>
      <div className={fs ? "relative min-h-0 flex-1" : "relative"}>
        <div ref={container} className={fs ? "h-full w-full rounded-lg" : "h-96 w-full rounded-lg"} />
        <button
          type="button"
          onClick={fullscreen.toggle}
          title={fs ? t("exitFullscreen") : t("fullscreen")}
          aria-label={fs ? t("exitFullscreen") : t("fullscreen")}
          className="absolute left-2 top-2 z-10 rounded bg-white px-2 py-1 text-sm shadow hover:bg-stone-100"
        >
          {fs ? "✕" : "⛶"}
        </button>
      </div>
      {(planner.routeFrom || planner.routeTo) && (
        <RoutePanel
          fullscreen={fs}
          fromName={planner.fromName}
          toName={planner.toName}
          hasFrom={!!planner.routeFrom}
          hasTo={!!planner.routeTo}
          stats={planner.stats}
          onClear={planner.clear}
        />
      )}
      <LayerToggles
        fullscreen={fs}
        toggles={toggles.values}
        onChange={toggles.set}
        extraCount={extras.length}
        restaurantCount={restaurants.length}
      />
    </div>
  );
}
