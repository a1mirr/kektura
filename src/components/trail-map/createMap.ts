import type { Map as MapLibreMap } from "maplibre-gl";
import type { Route } from "@/lib/route-geometry";
import type { MapLibre } from "./types";

export function createTrailMap(maplibregl: MapLibre, element: HTMLElement, overview: Route, attribution: string): MapLibreMap {
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
          attribution,
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
    bounds,
    fitBoundsOptions: { padding: 30 },
  });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  return m;
}
