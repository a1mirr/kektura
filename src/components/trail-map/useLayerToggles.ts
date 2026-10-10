import { useEffect, useState } from "react";
import { EXTRAS_LAYER, MOVED_RING_LAYER, RESTAURANTS_LAYER, STAMPS_LAYER } from "@/lib/map-layers";
import {
  readStored,
  store,
  STORAGE_KEY_DONE,
  STORAGE_KEY_EXTRAS,
  STORAGE_KEY_RESTAURANTS,
  STORAGE_KEY_STAMPS,
} from "@/lib/map-storage";
import type { MapHandleRef } from "./types";
import { useLatest } from "./useLatest";

function useRememberedLayer(mapRef: MapHandleRef, storageKey: string, layerIds: string[], on: boolean) {
  const key = layerIds.join(",");
  useEffect(() => {
    store(storageKey, on);
    const { map, ready } = mapRef.current;
    if (!ready || !map) return;
    for (const layerId of key ? key.split(",") : []) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
    }
  }, [mapRef, storageKey, key, on]);
}

// "Walked stretches" has no layer of its own (it changes what the lines show), so the map code redraws on it.
export function useLayerToggles(mapRef: MapHandleRef) {
  const [showDone, setShowDone] = useState(() => readStored(STORAGE_KEY_DONE, true));
  const [showStamps, setShowStamps] = useState(() => readStored(STORAGE_KEY_STAMPS, true));
  const [showExtras, setShowExtras] = useState(() => readStored(STORAGE_KEY_EXTRAS));
  const [showRestaurants, setShowRestaurants] = useState(() => readStored(STORAGE_KEY_RESTAURANTS));
  const latest = useLatest({
    showDone,
    showStamps,
    showExtras,
    showRestaurants,
  });

  useRememberedLayer(mapRef, STORAGE_KEY_DONE, [], showDone);
  useRememberedLayer(mapRef, STORAGE_KEY_STAMPS, [STAMPS_LAYER, MOVED_RING_LAYER], showStamps);
  useRememberedLayer(mapRef, STORAGE_KEY_EXTRAS, [EXTRAS_LAYER], showExtras);
  useRememberedLayer(mapRef, STORAGE_KEY_RESTAURANTS, [RESTAURANTS_LAYER], showRestaurants);

  return {
    values: { showDone, showStamps, showExtras, showRestaurants },
    set: {
      showDone: setShowDone,
      showStamps: setShowStamps,
      showExtras: setShowExtras,
      showRestaurants: setShowRestaurants,
    },
    latest,
  };
}
