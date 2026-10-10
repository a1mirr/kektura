import type { Map as MapLibreMap } from "maplibre-gl";
import { DETAIL_ZOOM } from "@/lib/map-layers";
import type { Route } from "@/lib/route-geometry";
import type { RouteState } from "./types";

// The file is loaded on first need; if that fails the overview stays and the next zoom change tries again.
export function watchDetailRoute(
  m: MapLibreMap,
  route: RouteState,
  isCancelled: () => boolean,
  refreshRoute: () => void,
) {
  let loading = false;
  m.on("zoomend", async () => {
    if (m.getZoom() >= DETAIL_ZOOM && !route.detail && !loading) {
      loading = true;
      try {
        const r = await fetch("/data/okt-route-detail.json");
        if (r.ok) route.detail = (await r.json()) as Route;
      } catch {
      } finally {
        loading = false;
      }
    }
    if (isCancelled()) return;
    // Re-read the zoom: the user may have zoomed back out while the file was loading.
    const wantDetail = m.getZoom() >= DETAIL_ZOOM && route.detail !== null;
    if (wantDetail === route.showingDetail) return;
    route.showingDetail = wantDetail;
    refreshRoute();
  });
}
