// MapLibre's inline worker breaks under Turbopack ("Worker failed to load"), so the
// worker files are served as static assets and wired up with setWorkerUrl().
// Runs before dev/build so public/maplibre always matches the installed version.
import fs from "node:fs";

const src = "node_modules/maplibre-gl/dist";
const dest = "public/maplibre";
fs.mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  fs.copyFileSync(`${src}/${f}`, `${dest}/${f}`);
}
