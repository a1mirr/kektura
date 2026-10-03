import { useEffect, type RefObject } from "react";
import type { Restaurant } from "@/lib/map-data";
import type { Route } from "@/lib/route-geometry";
import { addTrailLayers } from "./addTrailLayers";
import { listenForFocus } from "./listenForFocus";
import { attachRestaurantPopups } from "./restaurantPopups";
import { attachStampPopups } from "./stampPopups";
import type { LayerToggles, MapContext, MapHandleRef, MapInputs, RouteState } from "./types";
import { watchDetailRoute } from "./watchDetailRoute";

// Creates the MapLibre map once (spec 0003 AC-9): OpenStreetMap tiles, the trail overview fitted to the
// view, then on load the layers, the zoom-dependent geometry, the popups and the list -> map listener.
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

      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const bounds = new maplibregl.LngLatBounds();
      overview.points.forEach((p) => bounds.extend([p[0], p[1]]));

      const m = new maplibregl.Map({
        container: element,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: ctx.current.t("mapAttribution"),
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        bounds,
        fitBoundsOptions: { padding: 30 },
      });
      const route: RouteState = {
        overview,
        detail: null,
        showingDetail: false,
      };
      h.map = m;
      h.route = route;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }));

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
