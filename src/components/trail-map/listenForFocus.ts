import type { RefObject } from "react";
import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { centeredScrollTop, FOCUS_EVENT, fullyInView, type FocusDetail } from "@/lib/map-focus";
import type { MapContext, MapLibre } from "./types";

// The dashboard's sticky block scrolls inside itself, so a map half hidden by it is not in view either; when the
// block is in the window and sticking, scrolling the block alone brings the map back (scrolling the page to a sticky
// element moves nothing it sits in, and the page would only jump).
function bringIntoView(map: HTMLElement) {
  const block = map.closest<HTMLElement>("[data-sticky-map]");
  const rect = map.getBoundingClientRect();
  const blockRect = block?.getBoundingClientRect();
  if (fullyInView(rect, window.innerHeight, blockRect)) return;
  if (block && blockRect && getComputedStyle(block).position === "sticky" && fullyInView(blockRect, window.innerHeight)) {
    block.scrollTo({ top: centeredScrollTop(rect, blockRect, block.scrollTop), behavior: "smooth" });
    return;
  }
  map.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function listenForFocus(
  m: MapLibreMap,
  maplibregl: MapLibre,
  mapElement: HTMLElement,
  ctx: RefObject<MapContext>,
) {
  // No focus after opening: focusing the label would scroll the page to it, and for a map inside the sticky block that
  // jumps the page to wherever the block would be without sticking.
  const selected: Popup = new maplibregl.Popup({
    offset: 10,
    closeOnClick: false,
    focusAfterOpen: false,
  });
  const onFocus = (ev: Event) => {
    const d = (ev as CustomEvent<FocusDetail>).detail;
    if (d.kind === "extra") ctx.current.showExtras();
    bringIntoView(mapElement);
    m.flyTo({ center: [d.lng, d.lat], zoom: Math.max(m.getZoom(), 12) });
    selected.setLngLat([d.lng, d.lat]).setText(d.name).addTo(m);
  };
  window.addEventListener(FOCUS_EVENT, onFocus);
  return () => window.removeEventListener(FOCUS_EVENT, onFocus);
}
