// Stamps that no longer exist (scripts/data/okt-retired-stamps.json, spec 0004): kept as rows of `checkpoints` with a
// `retired_on` date, so users' stamps on them survive every regeneration of the seed.
import fs from "node:fs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const orNull = (v) => (v === undefined || v === null ? "null" : q(v));
const numOrNull = (v) => (v === undefined || v === null ? "null::numeric" : `${Number(v)}::numeric`);

export function readRetiredStamps(file = "scripts/data/okt-retired-stamps.json") {
  return JSON.parse(fs.readFileSync(file, "utf8")).stamps;
}

// A retired row sits outside the trail order: its seq is above every current row's, it has no number in its stage
// (stage_seq null) and the km and stage of the place it followed (`after_place_key`); its place_key is its own code.
export function retiredStampsSql(entries) {
  if (!entries.length) return "";
  const values = entries
    .map(
      (e, i) =>
        `(${i + 1}, ${q(e.code)}, ${q(e.name)}, ${q(e.after_place_key)}, ${q(e.retired_on)}, ${orNull(e.replaced_by)}, ${numOrNull(e.lat)}, ${numOrNull(e.lng)}, ${(e.assumed ?? []).includes("position")})`,
    )
    .join(",\n    ");
  return `-- Retired stamps (scripts/data/okt-retired-stamps.json): rows that are kept, never deleted.
insert into public.checkpoints (seq, code, place_key, stage, stage_seq, name, lat, lng, km_from_start, retired_on, replaced_by, after_place_key, position_approximate)
select (select max(seq) from public.checkpoints where retired_on is null) + r.n, r.code, r.code, a.stage, null, r.name, r.lat, r.lng, a.km,
  r.retired_on::date, r.replaced_by, r.after_place_key, r.approximate
from (values
    ${values}
) as r(n, code, name, after_place_key, retired_on, replaced_by, lat, lng, approximate)
join lateral (
  select max(stage) as stage, max(km_from_start) as km from public.checkpoints where place_key = r.after_place_key and retired_on is null
) a on true
on conflict (code) do update set
  seq = excluded.seq, place_key = excluded.place_key, stage = excluded.stage, stage_seq = null, name = excluded.name, lat = excluded.lat,
  lng = excluded.lng, km_from_start = excluded.km_from_start, retired_on = excluded.retired_on, replaced_by = excluded.replaced_by,
  after_place_key = excluded.after_place_key, position_approximate = excluded.position_approximate;
`;
}
