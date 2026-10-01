"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { FOCUS_EVENT, type FocusDetail } from "@/lib/map-focus";
import type { KmRange } from "@/lib/progress";
import { emptyLines, segmentLines, sliceRoute, splitRoute, type Route } from "@/lib/route-geometry";
import { fmtTime, hopOrder, routeStats, type Hop } from "@/lib/route-stats";
import { setStageOpen } from "@/lib/stage-events";
import { setExtraStamped, setPlacesStamped } from "@/app/[locale]/dashboard/actions";

export type MapPoint = {
  placeKey: string;
  name: string;
  lat: number;
  lng: number;
  km: number;
  stamped: boolean;
};

export type MapExtra = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  stamped: boolean;
};

type Restaurant = {
  name: string;
  city: string;
  url: string;
  lat: number;
  lng: number;
  distKm: number; // straight line to the nearest point of the trail
};

const DONE = "#2563eb";
const TODO = "#a8a29e";
const TODO_LINE = "#44403c"; // darker than the dots' grey so the dashes stand out on the map
const EXTRA = "#d97706";
const DETAIL_ZOOM = 9;
const RESTAURANT = "#7c3aed";
const STORAGE_KEY = "kektura:showExtras";
const STORAGE_KEY_RESTAURANTS = "kektura:showRestaurants";
const STORAGE_KEY_DONE = "kektura:showDone";
const STORAGE_KEY_STAMPS = "kektura:showStamps";

const pointFeatures = (
  items: { lat: number; lng: number; name: string; stamped: boolean; kind: string; key: string }[],
): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: items.map(
    (p): Feature<Point> => ({
      type: "Feature",
      properties: { name: p.name, stamped: p.stamped, kind: p.kind, key: p.key },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    }),
  ),
});

const placesData = (points: MapPoint[]) =>
  pointFeatures(points.map((p) => ({ ...p, kind: "place", key: p.placeKey })));
const extrasData = (extras: MapExtra[]) =>
  pointFeatures(extras.map((e) => ({ ...e, kind: "extra", key: String(e.id) })));

// Scroll the matching list row into view and flash it.
function revealInList(kind: string, key: string) {
  const el = document.getElementById(`${kind}-${key}`);
  if (!el) return;
  // Rows of a collapsed stage are hidden: open the stage first, then scroll once it has laid out.
  const stage = el.dataset.stage;
  if (stage) setStageOpen(Number(stage), true);
  setTimeout(() => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("flash");
  }, stage ? 80 : 0);
}

function readStored(key: string, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function store(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // storage unavailable: the toggle just isn't remembered
  }
}

const restaurantsData = (items: Restaurant[]): FeatureCollection<Point> => ({
  type: "FeatureCollection",
  features: items.map(
    (r): Feature<Point> => ({
      type: "Feature",
      properties: { name: r.name, city: r.city, url: r.url, distKm: r.distKm },
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    }),
  ),
});

type MenuAction = {
  label: string;
  run: (button: HTMLButtonElement, showError: (message: string) => void) => void;
};

// Popup content is built with DOM nodes (never innerHTML) so names can't inject markup.
function buildMenu(title: string, subtitle: string | null, actions: MenuAction[]) {
  const box = document.createElement("div");
  box.style.minWidth = "200px";
  const heading = document.createElement("strong");
  heading.textContent = title;
  box.append(heading);
  if (subtitle) {
    const sub = document.createElement("div");
    sub.textContent = subtitle;
    sub.style.cssText = "font-size:12px;color:#78716c;margin-bottom:4px";
    box.append(sub);
  }
  const error = document.createElement("div");
  error.setAttribute("role", "alert");
  error.style.cssText = "font-size:12px;color:#dc2626;padding-top:4px";
  error.hidden = true;
  const showError = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.style.cssText =
      "display:block;width:100%;text-align:left;padding:6px 0;background:none;border:0;border-top:1px solid #e7e5e4;cursor:pointer;color:#1d4ed8;font:inherit";
    button.addEventListener("click", () => {
      error.hidden = true;
      action.run(button, showError);
    });
    box.append(button);
  }
  box.append(error);
  return box;
}

function Toggle({
  checked,
  onChange,
  swatch,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  swatch: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {swatch}
      {label}
    </label>
  );
}

export default function TrailMap({
  points,
  extras = [],
  doneRanges,
}: {
  points: MapPoint[];
  extras?: MapExtra[];
  doneRanges: KmRange[];
}) {
  const t = useTranslations("dashboard");
  const container = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const routeRef = useRef<{ overview: Route; detail: Route | null; showingDetail: boolean } | null>(null);
  const latest = useRef({ points, extras, doneRanges });
  const [showDone, setShowDone] = useState(() => readStored(STORAGE_KEY_DONE, true));
  const showDoneRef = useRef(showDone);
  const [showStamps, setShowStamps] = useState(() => readStored(STORAGE_KEY_STAMPS, true));
  const showStampsRef = useRef(showStamps);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  const [showExtras, setShowExtras] = useState(() => readStored(STORAGE_KEY));
  const showExtrasRef = useRef(showExtras);
  const [showRestaurants, setShowRestaurants] = useState(() => readStored(STORAGE_KEY_RESTAURANTS));
  const showRestaurantsRef = useRef(showRestaurants);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const restaurantsRef = useRef<Restaurant[]>([]);
  const format = useFormatter();
  const [hops, setHops] = useState<Hop[]>([]);
  const [routeFrom, setRouteFrom] = useState<string | null>(null);
  const [routeTo, setRouteTo] = useState<string | null>(null);
  const routeFromRef = useRef<string | null>(null);
  const routeToRef = useRef<string | null>(null);
  const pairRef = useRef<[number, number] | null>(null);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Highlight the stretch between the two chosen stamps.
  const refreshSegment = useCallback(() => {
    const m = mapRef.current;
    const route = routeRef.current;
    if (!readyRef.current || !m || !route) return;
    const src = m.getSource("segment") as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(segmentLines(route.showingDetail && route.detail ? route.detail : route.overview, pairRef.current));
  }, []);

  // Redraw the walked / not-walked lines. With "walked" switched off the whole trail is grey.
  const refreshRoute = useCallback(() => {
    const m = mapRef.current;
    const route = routeRef.current;
    if (!readyRef.current || !m || !route) return;
    const ranges = showDoneRef.current ? latest.current.doneRanges : [];
    const { done, todo } = splitRoute(
      route.showingDetail && route.detail ? route.detail : route.overview,
      ranges,
    );
    (m.getSource("done") as GeoJSONSource).setData(done);
    (m.getSource("todo") as GeoJSONSource).setData(todo);
    refreshSegment();
  }, [refreshSegment]);

  useEffect(() => {
    showDoneRef.current = showDone;
    store(STORAGE_KEY_DONE, showDone);
    refreshRoute();
  }, [showDone, refreshRoute]);

  // Official stamps layer visibility (+ remember the choice).
  useEffect(() => {
    showStampsRef.current = showStamps;
    store(STORAGE_KEY_STAMPS, showStamps);
    const m = mapRef.current;
    if (readyRef.current && m?.getLayer("dots")) {
      m.setLayoutProperty("dots", "visibility", showStamps ? "visible" : "none");
    }
  }, [showStamps]);

  // Fullscreen: native Fullscreen API where available, CSS overlay everywhere (Esc exits).
  useEffect(() => {
    fullscreenRef.current = fullscreen;
    document.body.style.overflow = fullscreen ? "hidden" : "";
    if (fullscreen) {
      wrapper.current?.requestFullscreen?.().catch(() => {
        // not allowed / unsupported: the CSS overlay is enough
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenRef.current) setFullscreen(false);
    };
    if (fullscreen) {
      window.addEventListener("keydown", onKey);
      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
    const timers = [50, 350].map((ms) => setTimeout(() => mapRef.current?.resize(), ms));
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  // Extras layer visibility (+ remember the choice).
  useEffect(() => {
    showExtrasRef.current = showExtras;
    store(STORAGE_KEY, showExtras);
    const m = mapRef.current;
    if (readyRef.current && m?.getLayer("extras")) {
      m.setLayoutProperty("extras", "visibility", showExtras ? "visible" : "none");
    }
  }, [showExtras]);

  // Restaurants layer visibility (+ remember the choice).
  useEffect(() => {
    showRestaurantsRef.current = showRestaurants;
    store(STORAGE_KEY_RESTAURANTS, showRestaurants);
    const m = mapRef.current;
    if (readyRef.current && m?.getLayer("restaurants")) {
      m.setLayoutProperty("restaurants", "visibility", showRestaurants ? "visible" : "none");
    }
  }, [showRestaurants]);

  // Restaurants are static data: load once, push into the map when it is ready.
  useEffect(() => {
    let cancelled = false;
    fetch("/data/restaurants.json")
      .then((r) => r.json() as Promise<Restaurant[]>)
      .then((items) => {
        if (cancelled) return;
        restaurantsRef.current = items;
        setRestaurants(items);
        const m = mapRef.current;
        if (readyRef.current && m) {
          (m.getSource("restaurants") as GeoJSONSource).setData(restaurantsData(items));
        }
      })
      .catch(() => {
        // the layer simply stays unavailable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hops (distance / ascent / descent / time between neighbouring stamps) for the route mode.
  useEffect(() => {
    let cancelled = false;
    fetch("/data/okt-hops.json")
      .then((r) => r.json() as Promise<Hop[]>)
      .then((items) => {
        if (!cancelled) setHops(items);
      })
      .catch(() => {
        // route stats just stay unavailable (the highlight still works)
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chosen stamps -> highlighted stretch on the map (+ zoom to it).
  useEffect(() => {
    routeFromRef.current = routeFrom;
    routeToRef.current = routeTo;
    const kmOf = (key: string | null) =>
      key === null ? undefined : latest.current.points.find((p) => p.placeKey === key)?.km;
    const a = kmOf(routeFrom);
    const b = kmOf(routeTo);
    pairRef.current = a !== undefined && b !== undefined && a !== b ? [Math.min(a, b), Math.max(a, b)] : null;
    refreshSegment();
    const m = mapRef.current;
    const route = routeRef.current;
    if (pairRef.current && m && route && readyRef.current) {
      const coords = sliceRoute(route.overview, pairRef.current[0], pairRef.current[1]);
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 70, maxZoom: 13 },
      );
    }
  }, [routeFrom, routeTo, refreshSegment]);

  const order = useMemo(() => hopOrder(hops), [hops]);

  const nameOf = useCallback(
    (key: string | null) => (key ? points.find((p) => p.placeKey === key)?.name ?? null : null),
    [points],
  );
  const stats = useMemo(
    () => (routeFrom && routeTo ? routeStats(hops, order, routeFrom, routeTo) : null),
    [hops, order, routeFrom, routeTo],
  );

  const showInList = useCallback((kind: string, key: string) => {
    // In fullscreen the list is behind the map: leave fullscreen first, then scroll.
    if (fullscreenRef.current) {
      setFullscreen(false);
      setTimeout(() => revealInList(kind, key), 450);
    } else {
      revealInList(kind, key);
    }
  }, []);

  // Push fresh data into the existing map (keeps zoom/position when a stamp is toggled).
  useEffect(() => {
    latest.current = { points, extras, doneRanges };
    const m = mapRef.current;
    if (!readyRef.current || !m) return;
    (m.getSource("dots") as GeoJSONSource).setData(placesData(points));
    (m.getSource("extras") as GeoJSONSource).setData(extrasData(extras));
    refreshRoute();
  }, [points, extras, doneRanges, refreshRoute]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let onFocus: ((e: Event) => void) | undefined;

    (async () => {
      const [maplibregl, overview] = await Promise.all([
        import("maplibre-gl"),
        fetch("/data/okt-route.json").then((r) => r.json() as Promise<Route>),
      ]);
      if (cancelled || !container.current) return;

      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const bounds = new maplibregl.LngLatBounds();
      overview.points.forEach((p) => bounds.extend([p[0], p[1]]));

      const m = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: tRef.current("mapAttribution"),
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        bounds,
        fitBoundsOptions: { padding: 30 },
      });
      mapRef.current = m;
      const route = { overview, detail: null as Route | null, showingDetail: false };
      routeRef.current = route;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }));

      m.on("load", () => {
        if (cancelled) return;
        const { points: pts, extras: exs, doneRanges: ranges } = latest.current;
        const { done, todo } = splitRoute(overview, showDoneRef.current ? ranges : []);
        m.addSource("todo", { type: "geojson", data: todo });
        m.addSource("done", { type: "geojson", data: done });
        m.addSource("segment", { type: "geojson", data: emptyLines });
        m.addSource("dots", { type: "geojson", data: placesData(pts) });
        m.addSource("extras", { type: "geojson", data: extrasData(exs) });
        m.addSource("restaurants", { type: "geojson", data: restaurantsData(restaurantsRef.current) });
        // White casings keep both lines readable over busy map tiles.
        m.addLayer({
          id: "todo-casing",
          type: "line",
          source: "todo",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 },
        });
        m.addLayer({
          id: "done-casing",
          type: "line",
          source: "done",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
        });
        m.addLayer({
          id: "todo",
          type: "line",
          source: "todo",
          layout: { "line-join": "round" },
          paint: { "line-color": TODO_LINE, "line-width": 3.5, "line-dasharray": [2, 1.5] },
        });
        m.addLayer({
          id: "done",
          type: "line",
          source: "done",
          layout: { "line-join": "round" },
          paint: { "line-color": DONE, "line-width": 4.5 },
        });
        // Highlight for "route between two stamps": above the walked line, below the points.
        m.addLayer({
          id: "segment-casing",
          type: "line",
          source: "segment",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 0.9 },
        });
        m.addLayer({
          id: "segment",
          type: "line",
          source: "segment",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#f59e0b", "line-width": 6 },
        });
        m.addLayer({
          id: "restaurants",
          type: "circle",
          source: "restaurants",
          layout: { visibility: showRestaurantsRef.current ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 7],
            "circle-color": RESTAURANT,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        m.addLayer({
          id: "extras",
          type: "circle",
          source: "extras",
          layout: { visibility: showExtrasRef.current ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 7],
            "circle-color": ["case", ["get", "stamped"], EXTRA, "#ffffff"],
            "circle-stroke-color": EXTRA,
            "circle-stroke-width": 1.5,
          },
        });
        m.addLayer({
          id: "dots",
          type: "circle",
          source: "dots",
          layout: { visibility: showStampsRef.current ? "visible" : "none" },
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 7],
            "circle-color": ["case", ["get", "stamped"], DONE, "#ffffff"],
            "circle-stroke-color": ["case", ["get", "stamped"], DONE, TODO],
            "circle-stroke-width": 1.5,
          },
        });
        readyRef.current = true;

        // Swap in the detailed geometry once the user zooms in (the file is loaded on first need).
        let loading = false;
        m.on("zoomend", async () => {
          if (m.getZoom() >= DETAIL_ZOOM && !route.detail && !loading) {
            loading = true;
            try {
              const r = await fetch("/data/okt-route-detail.json");
              if (r.ok) route.detail = (await r.json()) as Route;
            } catch {
              // stay on the overview geometry; the next zoom change tries again
            } finally {
              loading = false;
            }
          }
          if (cancelled) return;
          // Re-read the zoom: the user may have zoomed back out while the file was loading.
          const wantDetail = m.getZoom() >= DETAIL_ZOOM && route.detail !== null;
          if (wantDetail === route.showingDetail) return;
          route.showingDetail = wantDetail;
          refreshRoute();
        });

        // Hover: name tooltip. Click: jump to the row in the list.
        const hover: Popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
        m.on("mouseenter", ["dots", "extras"], (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f?.geometry.type === "Point") {
            hover
              .setLngLat(f.geometry.coordinates as [number, number])
              .setText(String(f.properties?.name))
              .addTo(m);
          }
        });
        m.on("mouseleave", ["dots", "extras"], () => {
          m.getCanvas().style.cursor = "";
          hover.remove();
        });
        const menu: Popup = new maplibregl.Popup({ offset: 12, closeOnClick: true, maxWidth: "280px" });
        m.on("click", ["dots", "extras"], (e) => {
          const f = e.features?.[0];
          if (f?.geometry.type !== "Point") return;
          hover.remove();
          const tr = tRef.current;
          const kind = String(f.properties?.kind);
          const key = String(f.properties?.key);
          const name = String(f.properties?.name);
          const done = (
            button: HTMLButtonElement,
            showError: (message: string) => void,
            task: Promise<ActionResult>,
          ) => {
            button.disabled = true;
            task
              .catch((): ActionResult => ({ ok: false, reason: "failed" })) // network error
              .then((result) => {
                if (result.ok) menu.remove();
                else if (result.reason === "unauthorized") {
                  menu.remove();
                  routerRef.current.refresh(); // session expired: the page redirects to sign-in
                } else {
                  button.disabled = false;
                  showError(tr("actionFailed"));
                }
              });
          };
          const actions: MenuAction[] = [];
          let subtitle: string | null = null;
          if (kind === "place") {
            const point = latest.current.points.find((p) => p.placeKey === key);
            const stamped = point?.stamped ?? false;
            if (point) subtitle = tr("kmFromStart", { km: point.km.toFixed(1) });
            actions.push(
              {
                label: tr("routeFromHere"),
                run: () => {
                  setRouteFrom(key);
                  if (routeToRef.current === key) setRouteTo(null);
                  menu.remove();
                },
              },
              {
                label: tr("routeToHere"),
                run: () => {
                  setRouteTo(key);
                  if (routeFromRef.current === key) setRouteFrom(null);
                  menu.remove();
                },
              },
              {
                label: stamped ? tr("unmarkStamped") : tr("markStamped"),
                run: (button, showError) => done(button, showError, setPlacesStamped([key], !stamped)),
              },
            );
          } else {
            const stamped = latest.current.extras.find((x) => String(x.id) === key)?.stamped ?? false;
            actions.push({
              label: stamped ? tr("unmarkStamped") : tr("markStamped"),
              run: (button, showError) => done(button, showError, setExtraStamped(Number(key), !stamped)),
            });
          }
          actions.push({
            label: tr("showInList"),
            run: () => {
              menu.remove();
              showInList(kind, key);
            },
          });
          menu
            .setLngLat(f.geometry.coordinates as [number, number])
            .setDOMContent(buildMenu(name, subtitle, actions))
            .addTo(m);
        });

        // Restaurants: hover = name + distance, click = pinned popup with a link to the site.
        const rHover: Popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
        const rPinned: Popup = new maplibregl.Popup({ offset: 10, closeOnClick: true, maxWidth: "260px" });
        m.on("mouseenter", "restaurants", (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f?.geometry.type === "Point") {
            const dist = tRef.current("restaurantDist", { km: String(f.properties?.distKm) });
            rHover
              .setLngLat(f.geometry.coordinates as [number, number])
              .setText(f.properties?.name + " · " + dist)
              .addTo(m);
          }
        });
        m.on("mouseleave", "restaurants", () => {
          m.getCanvas().style.cursor = "";
          rHover.remove();
        });
        m.on("click", "restaurants", (e) => {
          const f = e.features?.[0];
          if (f?.geometry.type !== "Point") return;
          rHover.remove();
          const box = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = f.properties?.name + " (" + f.properties?.city + ")";
          const dist = document.createElement("div");
          dist.textContent = tRef.current("restaurantDist", { km: String(f.properties?.distKm) });
          const link = document.createElement("a");
          const url = String(f.properties?.url);
          if (url.startsWith("https://")) link.href = url; // never emit a javascript: link
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = tRef.current("openRestaurantSite");
          link.style.color = RESTAURANT;
          box.append(title, dist, link);
          rPinned.setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(box).addTo(m);
        });

        // List -> map: fly to the stamp and show its name.
        const selected: Popup = new maplibregl.Popup({ offset: 10, closeOnClick: false });
        onFocus = (ev) => {
          const d = (ev as CustomEvent<FocusDetail>).detail;
          if (d.kind === "extra") setShowExtras(true);
          container.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          m.flyTo({ center: [d.lng, d.lat], zoom: Math.max(m.getZoom(), 12) });
          selected.setLngLat([d.lng, d.lat]).setText(d.name).addTo(m);
        };
        window.addEventListener(FOCUS_EVENT, onFocus);
      });
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (onFocus) window.removeEventListener(FOCUS_EVENT, onFocus);
      mapRef.current?.remove();
      mapRef.current = null;
      routeRef.current = null;
    };
  }, [refreshRoute, showInList]);

  return (
    <div
      ref={wrapper}
      className={fullscreen ? "fixed inset-0 z-50 flex flex-col gap-2 bg-white p-3" : undefined}
    >
      <div className={fullscreen ? "relative min-h-0 flex-1" : "relative"}>
        <div ref={container} className={fullscreen ? "h-full w-full rounded-lg" : "h-96 w-full rounded-lg"} />
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? t("exitFullscreen") : t("fullscreen")}
          aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")}
          className="absolute left-2 top-2 z-10 rounded bg-white px-2 py-1 text-sm shadow hover:bg-stone-100"
        >
          {fullscreen ? "✕" : "⛶"}
        </button>
      </div>
      {(routeFrom || routeTo) && (
        <div
          className={`${fullscreen ? "" : "mt-2 "}flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm`}
        >
          <span className="font-medium">
            {nameOf(routeFrom) ?? "…"} → {nameOf(routeTo) ?? "…"}
          </span>
          {stats ? (
            <>
              <span>{t("routeKm", { km: format.number(stats.km) })}</span>
              <span>↑ {t("routeUp", { m: format.number(stats.up) })}</span>
              <span>↓ {t("routeDown", { m: format.number(stats.down) })}</span>
              <span>
                ⏱{" "}
                {stats.minutes === 0
                  ? t("routeFerryOnly")
                  : t(stats.ferry ? "routeTimeFerry" : "routeTime", { time: fmtTime(stats.minutes) })}
              </span>
            </>
          ) : (
            <span className="text-stone-500">
              {routeFrom && routeTo ? t("routeNoData") : routeFrom ? t("routePickTo") : t("routePickFrom")}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setRouteFrom(null);
              setRouteTo(null);
            }}
            className="ml-auto text-blue-700 hover:underline"
          >
            {t("routeClear")}
          </button>
          {stats && <span className="w-full text-xs text-stone-500">{t("routeNote")}</span>}
        </div>
      )}
      <div className={fullscreen ? "flex flex-wrap gap-x-6 gap-y-1" : "mt-2 flex flex-wrap gap-x-6 gap-y-1"}>
        <Toggle
          checked={showDone}
          onChange={setShowDone}
          swatch={<span className="inline-block h-1 w-4 rounded" style={{ backgroundColor: DONE }} />}
          label={t("showWalked")}
        />
        <Toggle
          checked={showStamps}
          onChange={setShowStamps}
          swatch={
            <span
              className="inline-block h-3 w-3 rounded-full border-2"
              style={{ borderColor: DONE }}
            />
          }
          label={t("showStamps")}
        />
        {extras.length > 0 && (
          <Toggle
            checked={showExtras}
            onChange={setShowExtras}
            swatch={
              <span
                className="inline-block h-3 w-3 rounded-full border-2"
                style={{ borderColor: EXTRA }}
              />
            }
            label={t("showExtras", { count: extras.length })}
          />
        )}
        {restaurants.length > 0 && (
          <Toggle
            checked={showRestaurants}
            onChange={setShowRestaurants}
            swatch={
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: RESTAURANT }}
              />
            }
            label={t("showRestaurants", { count: restaurants.length })}
          />
        )}
      </div>
    </div>
  );
}
