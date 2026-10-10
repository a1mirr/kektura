import { useEffect, type RefObject } from "react";
import type { Restaurant } from "@/lib/map-data";
import type { Route } from "@/lib/route-geometry";
import { addTrailLayers } from "./addTrailLayers";
import { createTrailMap } from "./createMap";
import { listenForFocus } from "./listenForFocus";
import { attachRestaurantPopups } from "./restaurantPopups";
import { attachStampPopups } from "./stampPopups";
import type { LayerToggles, MapContext, MapHandleRef, MapInputs, RouteState } from "./types";
import { watchDetailRoute } from "./watchDetailRoute";

// The map lives in `mapRef` (not in React state), so later data changes update it in place.
export function useMapInstance({
  container,
  mapRef,
  latest,
  toggles,
  restaurants,
  ctx,
  refreshRoute,
}: {
  container: RefObject<HTMLDivElement | null>;
  mapRef: MapHandleRef;
  latest: RefObject<MapInputs>;
  toggles: RefObject<LayerToggles>;
  restaurants: RefObject<Restaurant[]>;
  ctx: RefObject<MapContext>;
  refreshRoute: () => void;
}) {
  useEffect(() => {
    if (!container.current) return;
    const h = mapRef.current; // one object for the map's whole life
    let cancelled = false;
    let stopListeningForFocus: (() => void) | undefined;

    (async () => {
      const [maplibregl, overview] = await Promise.all([
        import("maplibre-gl"),
        fetch("/data/okt-route.json").then((r) => r.json() as Promise<Route>),
      ]);
      const element = container.current;
      if (cancelled || !element) return;

      const m = createTrailMap(maplibregl, element, overview, ctx.current.t("mapAttribution"));
      const route: RouteState = {
        overview,
        detail: null,
        showingDetail: false,
      };
      h.map = m;
      h.route = route;

      m.on("load", () => {
        if (cancelled) return;
        addTrailLayers(m, overview, latest.current, toggles.current, restaurants.current);
        h.ready = true;
        watchDetailRoute(m, route, () => cancelled, refreshRoute);
        attachStampPopups(m, maplibregl, latest, ctx);
        attachRestaurantPopups(m, maplibregl, ctx);
        stopListeningForFocus = listenForFocus(m, maplibregl, element, ctx);
      });
    })();

    return () => {
      cancelled = true;
      h.ready = false;
      stopListeningForFocus?.();
      h.map?.remove();
      h.map = null;
      h.route = null;
    };
  }, [container, mapRef, latest, toggles, restaurants, ctx, refreshRoute]);
}
