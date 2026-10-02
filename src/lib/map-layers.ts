// Colours, zoom threshold and the MapLibre layer definitions of the trail map (spec 0003).
import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

export const DONE = "#2563eb";
export const TODO = "#a8a29e";
export const TODO_LINE = "#44403c"; // darker than the dots' grey so the dashes stand out on the map
export const EXTRA = "#d97706";
export const RESTAURANT = "#7c3aed";
export const SEGMENT = "#f59e0b";

// From this zoom on the ~3 m route replaces the ~30 m overview (spec 0003 AC-9).
export const DETAIL_ZOOM = 9;

// GeoJSON sources, in the order they are added.
export const SOURCE_IDS = ["todo", "done", "segment", "dots", "extras", "restaurants"] as const;

// The layers a toggle shows or hides.
export const STAMPS_LAYER = "dots";
export const EXTRAS_LAYER = "extras";
export const RESTAURANTS_LAYER = "restaurants";

export type InitialVisibility = {
  stamps: boolean;
  extras: boolean;
  restaurants: boolean;
};

const visibility = (on: boolean) => (on ? "visible" : "none");
const dotRadius: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 7];

// Bottom to top. White casings keep the lines readable over busy map tiles; the highlight for "route
// between two stamps" sits above the walked line and below the points.
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
