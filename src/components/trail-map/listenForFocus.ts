import type { RefObject } from "react";
import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { FOCUS_EVENT, type FocusDetail } from "@/lib/map-focus";
import type { MapContext, MapLibre } from "./types";

// List -> map (spec 0003 AC-13): the 📍 button in a list row flies the map to that stamp (zoom >= 12),
// labels it and brings the map into view; for an extra stamp the extra-stamps layer is switched on.
// Returns the function that stops listening.
export function listenForFocus(
  m: MapLibreMap,
  maplibregl: MapLibre,
  mapElement: HTMLElement,
  ctx: RefObject<MapContext>,
) {
  const selected: Popup = new maplibregl.Popup({
    offset: 10,
    closeOnClick: false,
  });
  const onFocus = (ev: Event) => {
    const d = (ev as CustomEvent<FocusDetail>).detail;
    if (d.kind === "extra") ctx.current.showExtras();
    mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
    m.flyTo({ center: [d.lng, d.lat], zoom: Math.max(m.getZoom(), 12) });
    selected.setLngLat([d.lng, d.lat]).setText(d.name).addTo(m);
  };
  window.addEventListener(FOCUS_EVENT, onFocus);
  return () => window.removeEventListener(FOCUS_EVENT, onFocus);
}
