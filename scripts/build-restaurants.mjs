// Restaurants layer data: scraped marker list from an etteremhet.hu search results page
// (the page embeds `var markerData = [...]` for its own map) + distance to the OKT track.
//
// Usage: node scripts/build-restaurants.mjs <results.html> <full-route.gpx>
// Writes: public/data/restaurants.json
import fs from "node:fs";
import { haversine, nearestVertex, readTrack } from "./lib/geo.mjs";

const [htmlPath, routePath] = process.argv.slice(2);
if (!htmlPath || !routePath) {
  console.error("usage: node scripts/build-restaurants.mjs <results.html> <full-route.gpx>");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/var markerData = (\[.*\]);/);
if (!m) throw new Error("markerData not found - the page layout changed");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const items = JSON.parse(m[1]).map((d) => {
  const h = d.infowindow ?? "";
  const full = decode((h.match(/<h3>.*?>([^<]+)<\/a><\/h3>/s) ?? [])[1] ?? "");
  const href = (h.match(/href="([^"?]+)/) ?? [])[1];
  if (!full || !href) throw new Error("cannot parse marker: " + JSON.stringify(d).slice(0, 120));
  const city = full.match(/\(([^)]+)\)\s*$/)?.[1] ?? "";
  return {
    name: full.replace(/\s*\([^)]+\)\s*$/, ""),
    city,
    url: "https://www.etteremhet.hu" + href,
    lat: d.lat,
    lng: d.lng,
  };
});

const { points: route, km } = readTrack(routePath);

for (const r of items) {
  const { index, distance } = nearestVertex(route, (p) => haversine([r.lng, r.lat], p));
  r.distKm = Math.round(distance * 10) / 10;
  r.km = Math.round(km[index] * 10) / 10;
}
const MAX_DIST_KM = 5;
const nearby = items.filter((r) => r.distKm <= MAX_DIST_KM).sort((a, b) => a.km - b.km);
fs.mkdirSync("public/data", { recursive: true });
fs.writeFileSync("public/data/restaurants.json", JSON.stringify(nearby));
console.log(`public/data/restaurants.json: ${nearby.length} of ${items.length} restaurants within ${MAX_DIST_KM} km`);
