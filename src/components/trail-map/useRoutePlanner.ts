import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import type { MapPoint } from "@/lib/map-data";
import { segmentLines, sliceRoute } from "@/lib/route-geometry";
import { hopOrder, routeStats, type Hop } from "@/lib/route-stats";
import type { MapHandleRef, MapInputs } from "./types";

export function useRoutePlanner(mapRef: MapHandleRef, latest: RefObject<MapInputs>, points: MapPoint[]) {
  const [hops, setHops] = useState<Hop[]>([]);
  const [routeFrom, setRouteFrom] = useState<string | null>(null);
  const [routeTo, setRouteTo] = useState<string | null>(null);
  const pairRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/okt-hops.json")
      .then((r) => r.json() as Promise<Hop[]>)
      .then((items) => {
        if (!cancelled) setHops(items);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSegment = useCallback(() => {
    const { map, ready, route } = mapRef.current;
    if (!ready || !map || !route) return;
    const src = map.getSource("segment") as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(segmentLines(route.showingDetail && route.detail ? route.detail : route.overview, pairRef.current));
  }, [mapRef]);

  useEffect(() => {
    const kmOf = (key: string | null) =>
      key === null ? undefined : latest.current.points.find((p) => p.placeKey === key)?.km;
    const a = kmOf(routeFrom);
    const b = kmOf(routeTo);
    pairRef.current = a !== undefined && b !== undefined && a !== b ? [Math.min(a, b), Math.max(a, b)] : null;
    refreshSegment();
    const { map, ready, route } = mapRef.current;
    if (pairRef.current && map && route && ready) {
      const coords = sliceRoute(route.overview, pairRef.current[0], pairRef.current[1]);
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 70, maxZoom: 13 },
      );
    }
  }, [routeFrom, routeTo, refreshSegment, mapRef, latest]);

  const order = useMemo(() => hopOrder(hops), [hops]);
  const nameOf = (key: string | null) => (key ? (points.find((p) => p.placeKey === key)?.name ?? null) : null);
  const stats = useMemo(
    () => (routeFrom && routeTo ? routeStats(hops, order, routeFrom, routeTo) : null),
    [hops, order, routeFrom, routeTo],
  );
  const clear = useCallback(() => {
    setRouteFrom(null);
    setRouteTo(null);
  }, []);

  return {
    routeFrom,
    routeTo,
    setRouteFrom,
    setRouteTo,
    fromName: nameOf(routeFrom),
    toName: nameOf(routeTo),
    stats,
    clear,
    refreshSegment,
  };
}
