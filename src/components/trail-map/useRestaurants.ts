import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { restaurantsData, type Restaurant } from "@/lib/map-data";
import type { MapHandleRef } from "./types";

// Restaurants are static data (spec 0003 AC-14): load once, push into the map when it is ready. The
// ref lets the map's load callback seed its source when the data arrived first.
export function useRestaurants(mapRef: MapHandleRef) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const restaurantsRef = useRef<Restaurant[]>([]);

  useEffect(() => {
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
  }, [mapRef]);

  return { restaurants, restaurantsRef };
}
