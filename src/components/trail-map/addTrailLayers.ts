import type { Map as MapLibreMap } from "maplibre-gl";
import { extrasData, placesData, restaurantsData, type Restaurant } from "@/lib/map-data";
import { trailLayers } from "@/lib/map-layers";
import { emptyLines, splitRoute, type Route } from "@/lib/route-geometry";
import type { LayerToggles, MapInputs } from "./types";

export function addTrailLayers(
  m: MapLibreMap,
  overview: Route,
  { points, extras, doneRanges }: MapInputs,
  toggles: LayerToggles,
  restaurants: Restaurant[],
) {
  const { done, todo } = splitRoute(overview, toggles.showDone ? doneRanges : []);
  m.addSource("todo", { type: "geojson", data: todo });
  m.addSource("done", { type: "geojson", data: done });
  m.addSource("segment", { type: "geojson", data: emptyLines });
  m.addSource("dots", { type: "geojson", data: placesData(points) });
  m.addSource("extras", { type: "geojson", data: extrasData(extras) });
  m.addSource("restaurants", {
    type: "geojson",
    data: restaurantsData(restaurants),
  });
  const initial = {
    stamps: toggles.showStamps,
    extras: toggles.showExtras,
    restaurants: toggles.showRestaurants,
  };
  for (const layer of trailLayers(initial)) m.addLayer(layer);
}
