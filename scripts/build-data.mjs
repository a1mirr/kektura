// Builds DB seed + map geometry from the official MTSZ GPX files (kektura.hu):
//   okt_bh_<date>.gpx        - stamping points (waypoints)
//   okt_teljes_bh_<date>.gpx - full route (single track)
//
// Usage: node scripts/build-data.mjs <stamps.gpx> <full-route.gpx>
// Optional 3rd arg: heyjoe.hu okt_pecsetek.gpx (extra, non-official stamps).
// Writes: supabase/seed.sql, public/data/okt-route.json, public/data/okt-route-detail.json,
//         public/data/okt-hops.json and, with the 3rd arg, supabase/seed_extra.sql
import fs from "node:fs";
import { attr, flatMeters, nearestVertex, readTrack } from "./lib/geo.mjs";
import { readRetiredStamps, retiredStampsSql } from "./lib/retired-stamps.mjs";
import { readStampDates, stampDatesSql } from "./lib/stamp-dates.mjs";

const [stampsPath, routePath] = process.argv.slice(2);
if (!stampsPath || !routePath) {
  console.error("usage: node scripts/build-data.mjs <stamps.gpx> <full-route.gpx>");
  process.exit(1);
}

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
const tag = (src, t) => {
  const m = src.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
  return m ? decode(m[1].trim()) : null;
};
// --- route -----------------------------------------------------------------
const { points: raw, km } = readTrack(routePath);
const totalKm = km[km.length - 1];

// Distance along the track and distance from it for a point (stamp / extra stamp).
const snap = (item) => {
  const { index, distance } = nearestVertex(raw, (p) => flatMeters(item.lng, item.lat, p));
  return { km: km[index], offTrackM: distance };
};
console.log(`track points: ${raw.length}, length: ${totalKm.toFixed(1)} km`);

// Douglas-Peucker on plain lon/lat degrees (fine at this latitude for display purposes).
function simplify(points, tol) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i];
      let t = len2 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.map((_, i) => i).filter((i) => keep[i]);
}

function writeRoute(file, tolDeg) {
  const idx = simplify(raw, tolDeg);
  // [lng, lat, km] with km rounded to 0.01 so the map can cut the line by progress.
  const pts = idx.map((i) => [+raw[i][0].toFixed(5), +raw[i][1].toFixed(5), +km[i].toFixed(2)]);
  fs.mkdirSync("public/data", { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ points: pts }));
  console.log(`${file}: ${pts.length} points, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
writeRoute("public/data/okt-route.json", 0.0003); // ~30 m, whole-trail overview
writeRoute("public/data/okt-route-detail.json", 0.00003); // ~3 m, zoomed-in view

// --- stamping points -------------------------------------------------------
const stampsXml = fs.readFileSync(stampsPath, "utf8");
const waypoints = [...stampsXml.matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g)].map((m) => {
  const desc = tag(m[2], "desc") ?? "";
  const code = desc.match(/\((OKTPH_[0-9A-Za-z_]+|OKTPH_\d+_DDKPH_\d+_\d)\)\s*$/)?.[1] ?? null;
  return {
    lat: attr(m[1], "lat"),
    lng: attr(m[1], "lon"),
    ele: Number(tag(m[2], "ele")),
    name: tag(m[2], "name"),
    desc,
    code,
  };
});

// Snap each point to the nearest track vertex to get its distance from Írott-kő.
for (const w of waypoints) Object.assign(w, snap(w));
waypoints.sort((a, b) => a.km - b.km || a.code?.localeCompare(b.code ?? "") || 0);

const missing = waypoints.filter((w) => !w.code);
const far = waypoints.filter((w) => w.offTrackM > 500);
console.log(`waypoints: ${waypoints.length}, without code: ${missing.length}, >500 m from track: ${far.length}`);
far.forEach((w) => console.log(`  far: ${w.code} ${w.name} ${w.offTrackM.toFixed(0)} m`));
if (missing.length) throw new Error("some waypoints have no OKTPH code: " + missing.map((m) => m.name).join(", "));

// Alternative stamps at one place (…_1, …_2) share a key; must match supabase/migrations/0003_place_key.sql.
const placeKey = (code) =>
  code.replace(/^(OKTPH_\d+(?:_[BC])?(?:_DDKPH_\d+)?)(?:_\d+)?$/, "$1");
console.log(`places: ${new Set(waypoints.map((w) => placeKey(w.code))).size}`);

// Stage numbers (official 27 sections, MTSZ table): "<stage>.<n>" labels. A stamp belongs to the
// stage it ends (plus Írott-kő and Nagymaros, the stage starts that follow no hop).
const stagesFile = JSON.parse(fs.readFileSync("scripts/data/okt-stages.json", "utf8"));
const placeNames = new Map(); // place_key -> name
for (const w of waypoints) if (!placeNames.has(placeKey(w.code))) placeNames.set(placeKey(w.code), w.name);
const keyByName = new Map();
for (const [key, name] of placeNames) {
  if (keyByName.has(name)) throw new Error("two places share the name " + name);
  keyByName.set(name, key);
}
const stageOf = new Map(); // place_key -> { stage, n }
for (const st of stagesFile.stages) {
  st.places.forEach((name, i) => {
    const key = keyByName.get(name);
    if (!key) throw new Error(`stage ${st.stage}: no stamping place named "${name}"`);
    if (stageOf.has(key)) throw new Error("place assigned twice: " + name);
    stageOf.set(key, { stage: st.stage, n: i + 1 });
  });
}
const unassigned = [...placeNames.keys()].filter((k) => !stageOf.has(k));
if (unassigned.length) throw new Error("places without a stage: " + unassigned.join(", "));
console.log(`stages: ${stagesFile.stages.length}, places with a stage: ${stageOf.size}`);

// Hops between neighbouring stamping places (MTSZ table): length, ascent/descent walking
// west->east, time forward/back in minutes. Used by the map's "route between two stamps" mode.
// The Visegrád -> Nagymaros ferry crossing has no table row: distance from the track, no times.
// A place sits at its furthest-along variant: the MTSZ table lengths measure to it (e.g. OKTPH_05 ->
// OKTPH_06 is 12.4 km = to the second variant of 06, not the first).
const placeKm = new Map(); // place_key -> km along the track
for (const w of waypoints) placeKm.set(placeKey(w.code), Math.max(placeKm.get(placeKey(w.code)) ?? 0, w.km));
const hopList = [];
const keyOf = (name) => {
  const k = keyByName.get(name);
  if (!k) throw new Error("hops: no place named " + name);
  return k;
};
stagesFile.stages.forEach((st, si) => {
  const prev = stagesFile.stages[si - 1];
  if (prev && prev.end !== st.start) {
    const a = keyOf(prev.end);
    const b = keyOf(st.start);
    hopList.push({ a, b, km: Math.round((placeKm.get(b) - placeKm.get(a)) * 10) / 10, up: 0, down: 0, tf: null, tb: null, ferry: true });
  }
  for (const h of st.hops) hopList.push({ a: keyOf(h.from), b: keyOf(h.to), km: h.km, up: h.up, down: h.down, tf: h.tf, tb: h.tb });
});
hopList.forEach((h, i) => {
  if (i && hopList[i - 1].b !== h.a) throw new Error("hop chain broken at " + i);
});
if (new Set([hopList[0].a, ...hopList.map((h) => h.b)]).size !== placeNames.size) {
  throw new Error("hops do not cover all places");
}
fs.writeFileSync("public/data/okt-hops.json", JSON.stringify(hopList));
console.log(`public/data/okt-hops.json: ${hopList.length} hops (${hopList.filter((h) => h.ferry).length} ferry)`);

// The MTSZ's dates for new stamps: every code must be one of the seed's, or the date would silently go nowhere.
const stampDates = readStampDates();
const unknownDates = stampDates.filter((e) => !waypoints.some((w) => w.code === e.code));
if (unknownDates.length) throw new Error("okt-stamp-dates.json has codes the stamps file lacks: " + unknownDates.map((e) => e.code).join(", "));

// Retired stamps (spec 0004 AC-14): kept as rows, so what they point at must exist and their code must not be a current stamp's.
const retired = readRetiredStamps();
const currentKeys = new Set(waypoints.map((w) => placeKey(w.code)));
for (const r of retired) {
  if (waypoints.some((w) => w.code === r.code)) throw new Error(`okt-retired-stamps.json: ${r.code} is a current stamp's code`);
  for (const key of [r.after_place_key, r.replaced_by].filter(Boolean)) {
    if (!currentKeys.has(key)) throw new Error(`okt-retired-stamps.json: ${r.code} points at ${key}, which is not a place`);
  }
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
// Temp table of the codes a seed file contains, so it can drop rows the source no longer has.
const codesTable = (codes) =>
  `create temporary table seed_codes on commit drop as\n  select unnest(array[${codes.map(q).join(", ")}]) as code;`;
const rows = waypoints.map(
  (w, i) =>
    `  (${i + 1}, ${q(w.code)}, ${q(placeKey(w.code))}, ${stageOf.get(placeKey(w.code)).stage}, ${stageOf.get(placeKey(w.code)).n}, ${q(w.name)}, ${q(w.desc)}, ${w.lat.toFixed(6)}, ${w.lng.toFixed(6)}, ${Math.round(w.ele)}, ${w.km.toFixed(1)})`,
);
const sql = `-- Generated by scripts/build-data.mjs from the official MTSZ GPX (kektura.hu). Do not edit by hand.
-- Re-run the script after MTSZ publishes a new file.
begin;

insert into public.checkpoints (seq, code, place_key, stage, stage_seq, name, description, lat, lng, elevation_m, km_from_start) values
${rows.join(",\n")}
on conflict (code) do update set
  seq = excluded.seq, place_key = excluded.place_key, stage = excluded.stage, stage_seq = excluded.stage_seq, name = excluded.name, description = excluded.description,
  lat = excluded.lat, lng = excluded.lng, elevation_m = excluded.elevation_m,
  km_from_start = excluded.km_from_start;

${retiredStampsSql(retired)}
-- Rows this file no longer has (old placeholders without a code, codes MTSZ dropped, e.g. a single
-- stamp split into _1/_2 variants): users' stamps move to the remaining variants of the same place,
-- then the rows go. A place that is gone entirely takes its stamps with it. A retired stamp's row is never one of them:
-- its code is in the list, so a stamp that was retired keeps every user's stamp on it (spec 0004 AC-14).
${codesTable([...waypoints.map((w) => w.code), ...retired.map((r) => r.code)])}

insert into public.user_stamps (user_id, checkpoint_id, stamped_on)
select s.user_id, keep.id, s.stamped_on
from public.user_stamps s
join public.checkpoints old on old.id = s.checkpoint_id
join public.checkpoints keep on keep.place_key = old.place_key and keep.code in (select code from seed_codes)
where old.code is null or old.code not in (select code from seed_codes)
on conflict (user_id, checkpoint_id) do nothing;

delete from public.checkpoints where code is null or code not in (select code from seed_codes);

${stampDatesSql(stampDates)}
commit;
`;
fs.writeFileSync("supabase/seed.sql", sql);
console.log(`supabase/seed.sql: ${waypoints.length} rows`);

// --- extra (non-official) stamps -------------------------------------------
// Optional 3rd arg: heyjoe.hu "okt_pecsetek.gpx" (community list: castles, museums, other
// hiking movements' stamps near the trail). Everything that is not within 60 m of an
// official point becomes an extra stamp.
const extraPath = process.argv[4];
if (extraPath) {
  const extras = [...fs.readFileSync(extraPath, "utf8").matchAll(/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/g)]
    .map((m) => ({
      lat: attr(m[1], "lat"),
      lng: attr(m[1], "lon"),
      name: tag(m[2], "name"),
      desc: tag(m[2], "desc") ?? "",
    }))
    .filter((e) => e.name && !/^Régi pecsételőhelyek/.test(e.name)) // pseudo-point (photo collection)
    .filter((e) => Math.min(...waypoints.map((o) => flatMeters(e.lng, e.lat, [o.lng, o.lat]))) > 60);

  for (const e of extras) {
    Object.assign(e, snap(e));
    e.offTrackM = Math.round(e.offTrackM);
    e.code = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}:${e.name}`;
  }
  extras.sort((a, b) => a.km - b.km);
  const xrows = extras.map(
    (e) =>
      `  (${q(e.code)}, ${q(e.name)}, ${q(e.desc)}, ${e.lat.toFixed(6)}, ${e.lng.toFixed(6)}, ${e.km.toFixed(1)}, ${e.offTrackM})`,
  );
  fs.writeFileSync(
    "supabase/seed_extra.sql",
    `-- Generated by scripts/build-data.mjs from heyjoe.hu okt_pecsetek.gpx (community data). Do not edit by hand.
begin;

insert into public.extra_stamps (code, name, description, lat, lng, km_from_start, off_trail_m) values
${xrows.join(",\n")}
on conflict (code) do update set
  name = excluded.name, description = excluded.description, lat = excluded.lat, lng = excluded.lng,
  km_from_start = excluded.km_from_start, off_trail_m = excluded.off_trail_m;

-- Stamps the list no longer has. The code includes the coordinates, so a moved stamp comes back
-- under a new code: users' stamps follow it by name, then the old row goes.
${codesTable(extras.map((e) => e.code))}

insert into public.user_extra_stamps (user_id, extra_id, stamped_on)
select s.user_id, keep.id, s.stamped_on
from public.user_extra_stamps s
join public.extra_stamps old on old.id = s.extra_id
join public.extra_stamps keep on keep.name = old.name and keep.code in (select code from seed_codes)
where old.code not in (select code from seed_codes)
on conflict (user_id, extra_id) do nothing;

delete from public.extra_stamps where code not in (select code from seed_codes);

commit;
`,
  );
  console.log(`supabase/seed_extra.sql: ${extras.length} rows`);
}
