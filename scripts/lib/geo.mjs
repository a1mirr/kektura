import fs from "node:fs";

const R = 6371.0088;
const rad = Math.PI / 180;

export const attr = (src, a) => Number(src.match(new RegExp(`${a}="([^"]+)"`))[1]);

export function haversine(a, b) {
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Equirectangular approximation: plenty accurate for finding the nearest vertex of a track.
export function flatMeters(lng, lat, p) {
  const dx = (p[0] - lng) * Math.cos(lat * rad);
  const dy = p[1] - lat;
  return Math.sqrt(dx * dx + dy * dy) * 111320;
}

export function readTrack(path) {
  const xml = fs.readFileSync(path, "utf8");
  const points = [...xml.matchAll(/<trkpt\b([^>]*)>/g)].map((m) => [attr(m[1], "lon"), attr(m[1], "lat")]);
  const km = [0];
  for (let i = 1; i < points.length; i++) km.push(km[i - 1] + haversine(points[i - 1], points[i]));
  return { points, km };
}

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
