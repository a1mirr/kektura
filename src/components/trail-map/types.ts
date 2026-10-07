import type { RefObject } from "react";
import type { useTranslations } from "next-intl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapExtra, MapPoint } from "@/lib/map-data";
import type { KmRange } from "@/lib/progress";
import type { Route } from "@/lib/route-geometry";

export type MapLibre = typeof import("maplibre-gl");

export type Translator = ReturnType<typeof useTranslations<"dashboard">>;

// The trail geometry the map shows: the overview, and the detailed one once it has loaded (0003 AC-9).
export type RouteState = {
  overview: Route;
  detail: Route | null;
  showingDetail: boolean;
};

// The live map, created once after mount. `ready` is true once its sources and layers exist. Mutated
// outside React's render so a stamp being toggled never rebuilds the map (0003 AC-16).
export type MapHandle = {
  map: MapLibreMap | null;
  ready: boolean;
  route: RouteState | null;
};
export type MapHandleRef = RefObject<MapHandle>;

// What the dashboard hands the map.
export type MapInputs = {
  points: MapPoint[];
  extras: MapExtra[];
  doneRanges: KmRange[];
};

// The four layer toggles (0003 AC-10).
export type LayerToggles = {
  showDone: boolean;
  showStamps: boolean;
  showExtras: boolean;
  showRestaurants: boolean;
};

// What the popups and the list -> map listener need from the React side. Held in a ref that is
// refreshed after every render, so map event handlers always see the current values.
export type MapContext = {
  t: Translator;
  refreshPage: () => void; // router.refresh(): a session that expired sends the page to sign-in
  reportHref: (code: string) => string; // the feedback form for a stamp (spec 0003 AC-27): only its code is in the address
  routeFrom: string | null;
  routeTo: string | null;
  setRouteFrom: (key: string | null) => void;
  setRouteTo: (key: string | null) => void;
  showInList: (kind: string, key: string) => void;
  showExtras: () => void;
};
