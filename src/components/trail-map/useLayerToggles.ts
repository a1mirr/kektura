import { useEffect, useState } from "react";
import { EXTRAS_LAYER, RESTAURANTS_LAYER, STAMPS_LAYER } from "@/lib/map-layers";
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

// Remember a layer's toggle and apply it to the map layer (once the map exists).
function useRememberedLayer(mapRef: MapHandleRef, storageKey: string, layerId: string | null, on: boolean) {
  useEffect(() => {
    store(storageKey, on);
    const { map, ready } = mapRef.current;
    if (layerId && ready && map?.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
    }
  }, [mapRef, storageKey, layerId, on]);
}

// Spec 0003 AC-10: walked stretches and official stamps are on by default, extra stamps and
// restaurants off; each choice persists in localStorage. "Walked stretches" has no layer of its own
// (it changes what the lines show), so the map code redraws on it.
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

  useRememberedLayer(mapRef, STORAGE_KEY_DONE, null, showDone);
  useRememberedLayer(mapRef, STORAGE_KEY_STAMPS, STAMPS_LAYER, showStamps);
  useRememberedLayer(mapRef, STORAGE_KEY_EXTRAS, EXTRAS_LAYER, showExtras);
  useRememberedLayer(mapRef, STORAGE_KEY_RESTAURANTS, RESTAURANTS_LAYER, showRestaurants);

  return {
    values: { showDone, showStamps, showExtras, showRestaurants },
    set: {
      showDone: setShowDone,
      showStamps: setShowStamps,
      showExtras: setShowExtras,
      showRestaurants: setShowRestaurants,
    },
    latest, // the toggles as of the last render, for the map's load callback
  };
}
