// What the comparison map draws (spec 0003 AC-18 to AC-20): the trail cut into lines and the places turned into
// points for the view the reader picked. Pure functions; the layers are in map-layers.ts.
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { complementRanges, type ComparisonRanges, type Who } from "./compare";
import { DONE, TODO_LINE } from "./map-layers";
import type { KmRange } from "./progress";
import { sliceRoute, type Route } from "./route-geometry";

// "both": the four states of the comparison; "mine" and "theirs": one person's own map as their dashboard draws it.
export type CompareView = "both" | "mine" | "theirs";
export const COMPARE_VIEWS: readonly CompareView[] = ["both", "mine", "theirs"];

// How a line is drawn. The four states differ in more than colour (spec 0003 AC-18): solid, dashed, dotted, faint.
export type LineStyle = "solid" | "dashed" | "dotted" | "faint" | "todo";

// Colours of the states. Me is the blue of the owner's own walked line; the others are told apart by line style
// and point outline as well.
export const WHO_COLOR: Record<Who, string> = { both: "#15803d", me: DONE, them: "#c2410c", neither: "#a8a29e" };
export const WHO_LINE_STYLE: Record<Who, LineStyle> = { both: "solid", me: "dashed", them: "dotted", neither: "faint" };

type LinePart = { ranges: KmRange[]; style: LineStyle; color: string };

const lineFeatures = (route: Route, parts: LinePart[]): FeatureCollection<LineString> => ({
  type: "FeatureCollection",
  features: parts.flatMap(({ ranges, style, color }) =>
    ranges.map(
      ([from, to]): Feature<LineString> => ({
        type: "Feature",
        properties: { style, color },
        geometry: { type: "LineString", coordinates: sliceRoute(route, from, to) },
      }),
    ),
  ),
});

// The whole trail for a view: every stretch in one of the styles, nothing left out.
export function compareLines(route: Route, ranges: ComparisonRanges, view: CompareView): FeatureCollection<LineString> {
  const total = route.points[route.points.length - 1][2];
  if (view === "both") {
    return lineFeatures(
      route,
      (["both", "me", "them", "neither"] as const).map((who) => ({
        ranges: who === "neither" ? complementRanges([...ranges.both, ...ranges.me, ...ranges.them], 0, total) : ranges[who],
        style: WHO_LINE_STYLE[who],
        color: WHO_COLOR[who],
      })),
    );
  }
  const walked = view === "mine" ? ranges.mine : ranges.theirs;
  return lineFeatures(route, [
    { ranges: walked, style: "solid", color: DONE },
    { ranges: complementRanges(walked, 0, total), style: "todo", color: TODO_LINE },
  ]);
}

export type ComparePoint = { placeKey: string; name: string; lat: number; lng: number; who: Who };

// A place stamped in the picked view is filled, a place that is not is hollow (the dashboard's dots).
export function compareDots(points: ComparePoint[], view: CompareView): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((p): Feature<Point> => {
      const stamped = view === "both" ? p.who !== "neither" : view === "mine" ? p.who === "both" || p.who === "me" : p.who === "both" || p.who === "them";
      const color = view === "both" ? WHO_COLOR[p.who] : DONE;
      return {
        type: "Feature",
        properties: { name: p.name, who: p.who, fill: stamped ? color : "#ffffff", stroke: stamped ? color : "#a8a29e" },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      };
    }),
  };
}
