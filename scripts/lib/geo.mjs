// Geometry helpers shared by the data-build scripts (build-data.mjs, build-restaurants.mjs).
import fs from "node:fs";

const R = 6371.0088;
const rad = Math.PI / 180;

// Numeric attribute of a GPX tag, e.g. attr('lat="47.1" lon="16.2"', "lat") -> 47.1
export const attr = (src, a) => Number(src.match(new RegExp(`${a}="([^"]+)"`))[1]);

// Great-circle distance in km between two [lon, lat] points.
export function haversine(a, b) {
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distance in metres from (lng, lat) to point `p` ([lon, lat]), equirectangular approximation:
// plenty accurate for finding the nearest vertex of a track.
export function flatMeters(lng, lat, p) {
  const dx = (p[0] - lng) * Math.cos(lat * rad);
  const dy = p[1] - lat;
  return Math.sqrt(dx * dx + dy * dy) * 111320;
}

// Reads the <trkpt> list of a GPX file: `points` are [lon, lat], `km[i]` is the distance along the
// track up to point i.
export function readTrack(path) {
  const xml = fs.readFileSync(path, "utf8");
  const points = [...xml.matchAll(/<trkpt\b([^>]*)>/g)].map((m) => [attr(m[1], "lon"), attr(m[1], "lat")]);
  const km = [0];
  for (let i = 1; i < points.length; i++) km.push(km[i - 1] + haversine(points[i - 1], points[i]));
  return { points, km };
}

// Index of the track vertex minimising `distanceTo(point)`, plus that distance.
export function nearestVertex(points, distanceTo) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < points.length; i++) {
    const d = distanceTo(points[i]);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { index, distance: best };
}
