import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

export const DONE = "#2563eb";
export const TODO = "#a8a29e";
export const TODO_LINE = "#44403c"; // darker than the dots' grey so the dashes stand out on the map
export const EXTRA = "#d97706";
export const RESTAURANT = "#7c3aed";
export const SEGMENT = "#f59e0b";
export const MOVED = "#b45309";

// From this zoom on the ~3 m route replaces the ~30 m overview.
export const DETAIL_ZOOM = 9;

export const SOURCE_IDS = ["todo", "done", "segment", "dots", "extras", "restaurants"] as const;

export const STAMPS_LAYER = "dots";
export const MOVED_RING_LAYER = "moved-ring"; // follows the stamps' toggle
export const EXTRAS_LAYER = "extras";
export const RESTAURANTS_LAYER = "restaurants";

export type InitialVisibility = {
  stamps: boolean;
  extras: boolean;
  restaurants: boolean;
};

const visibility = (on: boolean) => (on ? "visible" : "none");
const dotRadius: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 7];
// An empty circle a few pixels wider than the dot, so it reads as a ring at every zoom and is a shape, not a colour.
const ringRadius: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 6, 7, 12, 12];
const ringPaint = {
  "circle-radius": ringRadius,
  "circle-color": "#ffffff",
  "circle-opacity": 0,
  "circle-stroke-color": MOVED,
  "circle-stroke-width": 2.5,
} as const;

// White casings keep the lines readable over busy map tiles.
export function trailLayers(initial: InitialVisibility): LayerSpecification[] {
  return [
    {
      id: "todo-casing",
      type: "line",
      source: "todo",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 },
    },
    {
      id: "done-casing",
      type: "line",
      source: "done",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
    },
    {
      id: "todo",
      type: "line",
      source: "todo",
      layout: { "line-join": "round" },
      paint: {
        "line-color": TODO_LINE,
        "line-width": 3.5,
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "done",
      type: "line",
      source: "done",
      layout: { "line-join": "round" },
      paint: { "line-color": DONE, "line-width": 4.5 },
    },
    {
      id: "segment-casing",
      type: "line",
      source: "segment",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 0.9 },
    },
    {
      id: "segment",
      type: "line",
      source: "segment",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": SEGMENT, "line-width": 6 },
    },
    {
      id: RESTAURANTS_LAYER,
      type: "circle",
      source: "restaurants",
      layout: { visibility: visibility(initial.restaurants) },
      paint: {
        "circle-radius": dotRadius,
        "circle-color": RESTAURANT,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: EXTRAS_LAYER,
      type: "circle",
      source: "extras",
      layout: { visibility: visibility(initial.extras) },
      paint: {
        "circle-radius": dotRadius,
        "circle-color": ["case", ["get", "stamped"], EXTRA, "#ffffff"],
        "circle-stroke-color": EXTRA,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: MOVED_RING_LAYER,
      type: "circle",
      source: "dots",
      filter: ["==", ["get", "moved"], true],
      layout: { visibility: visibility(initial.stamps) },
      paint: ringPaint,
    },
    {
      id: STAMPS_LAYER,
      type: "circle",
      source: "dots",
      layout: { visibility: visibility(initial.stamps) },
      paint: {
        "circle-radius": dotRadius,
        "circle-color": ["case", ["get", "stamped"], DONE, "#ffffff"],
        "circle-stroke-color": ["case", ["get", "stamped"], DONE, TODO],
        "circle-stroke-width": 1.5,
      },
    },
  ];
}

// Dashes can't depend on a feature, so there is one layer per line style.
export const COMPARE_SOURCE_IDS = ["compare-lines", "compare-dots"] as const;
export const COMPARE_DOTS_LAYER = "compare-dots";
export const COMPARE_MOVED_RING_LAYER = "compare-moved-ring";

const ofStyle = (style: string): ExpressionSpecification => ["==", ["get", "style"], style];
const byColor: ExpressionSpecification = ["get", "color"];

export function compareLayers(): LayerSpecification[] {
  const line = (id: string, style: string, paint: Record<string, unknown>, cap?: "round"): LayerSpecification =>
    ({
      id,
      type: "line",
      source: "compare-lines",
      filter: ofStyle(style),
      layout: { "line-join": "round", ...(cap ? { "line-cap": cap } : {}) },
      paint: { "line-color": byColor, ...paint },
    }) as LayerSpecification;
  return [
    {
      id: "compare-casing",
      type: "line",
      source: "compare-lines",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
    },
    line("compare-faint", "faint", { "line-width": 2.5 }),
    line("compare-todo", "todo", { "line-width": 3.5, "line-dasharray": [2, 1.5] }),
    line("compare-dotted", "dotted", { "line-width": 4.5, "line-dasharray": [0.1, 1.6] }, "round"),
    line("compare-dashed", "dashed", { "line-width": 4.5, "line-dasharray": [3, 1.8] }),
    line("compare-solid", "solid", { "line-width": 4.5 }),
    {
      id: COMPARE_MOVED_RING_LAYER,
      type: "circle",
      source: "compare-dots",
      filter: ["==", ["get", "moved"], true],
      paint: ringPaint,
    },
    {
      id: COMPARE_DOTS_LAYER,
      type: "circle",
      source: "compare-dots",
      paint: {
        "circle-radius": dotRadius,
        "circle-color": ["get", "fill"],
        "circle-stroke-color": ["get", "stroke"],
        "circle-stroke-width": 1.5,
      },
    },
  ];
}
