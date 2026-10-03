import type { RefObject } from "react";
import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { buildRestaurantPopup } from "@/lib/map-popups";
import type { MapContext, MapLibre } from "./types";

// Restaurants (spec 0003 AC-14): hover shows name and distance, a click pins a popup with a link to
// the restaurant's page.
export function attachRestaurantPopups(m: MapLibreMap, maplibregl: MapLibre, ctx: RefObject<MapContext>) {
  const hover: Popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
  const pinned: Popup = new maplibregl.Popup({
    offset: 10,
    closeOnClick: true,
    maxWidth: "260px",
  });
  m.on("mouseenter", "restaurants", (e) => {
    m.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (f?.geometry.type === "Point") {
      const dist = ctx.current.t("restaurantDist", {
        km: String(f.properties?.distKm),
      });
      hover
        .setLngLat(f.geometry.coordinates as [number, number])
        .setText(f.properties?.name + " · " + dist)
        .addTo(m);
    }
  });
  m.on("mouseleave", "restaurants", () => {
    m.getCanvas().style.cursor = "";
    hover.remove();
  });
  m.on("click", "restaurants", (e) => {
    const f = e.features?.[0];
    if (f?.geometry.type !== "Point") return;
    hover.remove();
    const { t } = ctx.current;
    const box = buildRestaurantPopup({
      name: String(f.properties?.name),
      city: String(f.properties?.city),
      url: String(f.properties?.url),
      distance: t("restaurantDist", { km: String(f.properties?.distKm) }),
      linkLabel: t("openRestaurantSite"),
    });
    pinned
      .setLngLat(f.geometry.coordinates as [number, number])
      .setDOMContent(box)
      .addTo(m);
  });
}
