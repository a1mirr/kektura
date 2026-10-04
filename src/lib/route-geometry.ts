// Cutting the trail polyline by distance: walked / not-walked lines and the route-planner highlight.
// See spec 0003.
import type { FeatureCollection, LineString } from "geojson";
import type { KmRange } from "@/lib/progress";

// public/data/okt-route*.json: [lng, lat, km along the trail], sorted by km.
export type Route = { points: [number, number, number][] };

export const emptyLines: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] };

// First index of `pts` (sorted by km) at or after `km`, or just after it when `strict`.
export function kmIndex(pts: Route["points"], km: number, strict = false) {
  let lo = 0;
  let hi = pts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (strict ? pts[mid][2] > km : pts[mid][2] >= km) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// The line from `from` to `to` km, with both ends interpolated between the neighbouring vertices.
export function sliceRoute(route: Route, from: number, to: number): [number, number][] {
  const pts = route.points;
  const at = (km: number): [number, number] => {
    const i = Math.min(kmIndex(pts, km), pts.length - 1);
    if (i === 0) return [pts[0][0], pts[0][1]];
    const p = pts[i - 1];
    const q = pts[i];
    const t = q[2] === p[2] ? 0 : Math.min(1, (km - p[2]) / (q[2] - p[2]));
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const inside = pts
    .slice(kmIndex(pts, from, true), kmIndex(pts, to))
    .map((p) => [p[0], p[1]] as [number, number]);
  return [at(from), ...inside, at(to)];
}

const lines = (route: Route, ranges: KmRange[]): FeatureCollection<LineString> => ({
  type: "FeatureCollection",
  features: ranges.map(([from, to]) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: sliceRoute(route, from, to) },
  })),
});

// Cut the route into walked (`ranges`) and not-walked (everything else) lines.
export function splitRoute(route: Route, ranges: KmRange[]) {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  const total = route.points[route.points.length - 1][2];
  const gaps: KmRange[] = [];
  let cursor = 0;
  for (const [from, to] of sorted) {
    if (from > cursor) gaps.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < total) gaps.push([cursor, total]);
  return { done: sorted.length ? lines(route, sorted) : emptyLines, todo: lines(route, gaps) };
}

// The single highlighted stretch of the route planner (empty without a pair).
export function segmentLines(route: Route, pair: KmRange | null): FeatureCollection<LineString> {
  return pair ? lines(route, [pair]) : emptyLines;
}
