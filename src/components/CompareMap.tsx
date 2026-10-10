"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import type { ComparisonRanges } from "@/lib/compare";
import { revealInList } from "@/lib/map-reveal";
import { COMPARE_VIEWS, compareDots, compareHoverText, compareLines, WHO_COLOR, WHO_LINE_STYLE, type ComparePoint, type CompareView } from "@/lib/compare-map";
import { COMPARE_DOTS_LAYER, compareLayers, DONE, TODO_LINE } from "@/lib/map-layers";
import type { Route } from "@/lib/route-geometry";
import CompareSwatch from "./CompareSwatch";
import { createTrailMap } from "./trail-map/createMap";
import type { MapHandle } from "./trail-map/types";
import { useLatest } from "./trail-map/useLatest";
import { watchDetailRoute } from "./trail-map/watchDetailRoute";

export default function CompareMap({ points, ranges }: { points: ComparePoint[]; ranges: ComparisonRanges }) {
  const t = useTranslations("compare");
  const tDash = useTranslations("dashboard");
  const attribution = useLatest(tDash("mapAttribution"));
  const container = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle>({ map: null, ready: false, route: null });
  const [view, setView] = useState<CompareView>("both");
  const latest = useLatest({ points, ranges, view });

  const draw = useCallback(() => {
    const { map, ready, route } = handle.current;
    if (!ready || !map || !route) return;
    const { points, ranges, view } = latest.current;
    const geometry = route.showingDetail && route.detail ? route.detail : route.overview;
    (map.getSource("compare-lines") as GeoJSONSource).setData(compareLines(geometry, ranges, view));
    (map.getSource("compare-dots") as GeoJSONSource).setData(compareDots(points, view));
  }, [latest]);

  const translate = useLatest(t);

  useEffect(() => {
    if (!container.current) return;
    const h = handle.current;
    let cancelled = false;
    (async () => {
      const [maplibregl, overview] = await Promise.all([
        import("maplibre-gl"),
        fetch("/data/okt-route.json").then((r) => r.json() as Promise<Route>),
      ]);
      const element = container.current;
      if (cancelled || !element) return;
      const m: MapLibreMap = createTrailMap(maplibregl, element, overview, attribution.current);
      h.map = m;
      h.route = { overview, detail: null, showingDetail: false };
      m.on("load", () => {
        if (cancelled) return;
        m.addSource("compare-lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addSource("compare-dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        for (const layer of compareLayers()) m.addLayer(layer);
        h.ready = true;
        watchDetailRoute(m, h.route!, () => cancelled, draw);
        const hover: Popup = new maplibregl.Popup({ closeButton: false, offset: 8 });
        m.on("mouseenter", COMPARE_DOTS_LAYER, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f?.geometry.type === "Point") {
            hover
              .setLngLat(f.geometry.coordinates as [number, number])
              .setText(compareHoverText(f.properties, translate.current(`who_${String(f.properties?.who) as "both"}`)))
              .addTo(m);
          }
        });
        m.on("click", COMPARE_DOTS_LAYER, (e) => {
          const key = e.features?.[0]?.properties?.key;
          if (key !== undefined) revealInList("place", String(key));
        });
        m.on("mouseleave", COMPARE_DOTS_LAYER, () => {
          m.getCanvas().style.cursor = "";
          hover.remove();
        });
        draw();
      });
    })();
    return () => {
      cancelled = true;
      h.ready = false;
      h.map?.remove();
      h.map = null;
      h.route = null;
    };
  }, [draw, attribution, translate]);

  useEffect(draw, [draw, view, points, ranges]);

  const legend =
    view === "both"
      ? (["both", "me", "them", "neither"] as const).map((who) => ({ key: who, style: WHO_LINE_STYLE[who], color: WHO_COLOR[who], label: t(`who_${who}`) }))
      : [
          { key: "walked", style: "solid" as const, color: DONE, label: t("walked") },
          { key: "todo", style: "todo" as const, color: TODO_LINE, label: t("notWalked") },
        ];

  return (
    <div className="space-y-2">
      <div role="group" aria-label={t("viewLabel")} className="flex flex-wrap gap-2">
        {COMPARE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`min-h-11 min-w-11 rounded px-4 py-2 text-sm font-medium ${view === v ? "bg-blue-700 text-white" : "bg-stone-200 text-stone-900 hover:bg-stone-300 active:bg-stone-400"}`}
          >
            {t(`view_${v}`)}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t("mapLabel")}>
        <div ref={container} className="h-80 w-full rounded-lg sm:h-96" />
      </div>
      <ul aria-label={t("legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {legend.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <CompareSwatch style={item.style} color={item.color} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
