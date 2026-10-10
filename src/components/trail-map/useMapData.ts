import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { extrasData, placesData } from "@/lib/map-data";
import { splitRoute } from "@/lib/route-geometry";
import type { MapHandleRef, MapInputs } from "./types";

export function useMapData(
  mapRef: MapHandleRef,
  latest: RefObject<MapInputs>,
  inputs: MapInputs,
  showDone: boolean,
  refreshSegment: () => void,
) {
  const { points, extras, doneRanges } = inputs;
  const showDoneRef = useRef(showDone);

  const refreshRoute = useCallback(() => {
    const { map, ready, route } = mapRef.current;
    if (!ready || !map || !route) return;
    const ranges = showDoneRef.current ? latest.current.doneRanges : [];
    const { done, todo } = splitRoute(route.showingDetail && route.detail ? route.detail : route.overview, ranges);
    (map.getSource("done") as GeoJSONSource).setData(done);
    (map.getSource("todo") as GeoJSONSource).setData(todo);
    refreshSegment();
  }, [mapRef, latest, refreshSegment]);

  useEffect(() => {
    showDoneRef.current = showDone;
    refreshRoute();
  }, [showDone, refreshRoute]);

  useEffect(() => {
    const { map, ready } = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("dots") as GeoJSONSource).setData(placesData(points));
    (map.getSource("extras") as GeoJSONSource).setData(extrasData(extras));
    refreshRoute();
  }, [points, extras, doneRanges, refreshRoute, mapRef]);

  return refreshRoute;
}
