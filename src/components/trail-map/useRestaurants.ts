import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { restaurantsData, type Restaurant } from "@/lib/map-data";
import type { MapHandleRef } from "./types";

// Restaurants are static data (spec 0003 AC-14): load once, push into the map when it is ready. The
// ref lets the map's load callback seed its source when the data arrived first. With the `restaurants` flag off
// (spec 0003 AC-21) nothing is fetched and the layer stays empty.
export function useRestaurants(mapRef: MapHandleRef, enabled: boolean) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const restaurantsRef = useRef<Restaurant[]>([]);

  useEffect(() => {
    if (!enabled) {
      // Switched off while the page is open: the layer is emptied now, not at the next full load.
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
        // the layer simply stays unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [mapRef, enabled]);

  return { restaurants: enabled ? restaurants : [], restaurantsRef };
}
