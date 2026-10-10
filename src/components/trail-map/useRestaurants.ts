import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { restaurantsData, type Restaurant } from "@/lib/map-data";
import type { MapHandleRef } from "./types";

// The ref lets the map's load callback seed its source when the data arrived first.
export function useRestaurants(mapRef: MapHandleRef, enabled: boolean) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const restaurantsRef = useRef<Restaurant[]>([]);

  useEffect(() => {
    if (!enabled) {
      restaurantsRef.current = [];
      const { map, ready } = mapRef.current;
      if (ready && map) (map.getSource("restaurants") as GeoJSONSource | undefined)?.setData(restaurantsData([]));
      return;
    }
    let cancelled = false;
    fetch("/data/restaurants.json")
      .then((r) => r.json() as Promise<Restaurant[]>)
      .then((items) => {
        if (cancelled) return;
        restaurantsRef.current = items;
        setRestaurants(items);
        const { map, ready } = mapRef.current;
        if (ready && map) {
          (map.getSource("restaurants") as GeoJSONSource).setData(restaurantsData(items));
        }
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, [mapRef, enabled]);

  return { restaurants: enabled ? restaurants : [], restaurantsRef };
}
