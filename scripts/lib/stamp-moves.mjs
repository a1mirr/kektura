// A current stamp whose coordinates changed by more than 100 m between two MTSZ files has a `moved_on` day, the
// address of the publication that gives it, and `build-data.mjs` refuses to run without one. The row keeps its code
// and id: only where it is changes.
import fs from "node:fs";
import { flatMeters } from "./geo.mjs";

// A smaller change of the coordinates is the MTSZ correcting a point, not a stamp in a new place: it just replaces them.
export const MOVE_THRESHOLD_M = 100;

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const isRealDate = (s) => {
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`).getTime() : NaN;
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

export function readStampMoves(file = "scripts/data/okt-stamp-dates.json") {
  return JSON.parse(fs.readFileSync(file, "utf8")).moves ?? [];
}

export function moveProblems(moves, codes, today) {
  const known = new Set(codes);
  const seen = new Set();
  const problems = [];
  for (const e of moves) {
    if (!known.has(e.code)) problems.push(`${e.code}: not a code of the stamps file`);
    if (seen.has(e.code)) problems.push(`${e.code}: listed twice`);
    seen.add(e.code);
    if (!isRealDate(e.moved_on ?? "")) problems.push(`${e.code}: moved_on ${e.moved_on} is not a calendar day (YYYY-MM-DD)`);
    else if (e.moved_on > today) problems.push(`${e.code}: moved_on ${e.moved_on} is in the future`);
    if (!/^https:\/\/www\.(kektura\.hu|mtsz\.org)\//.test(e.source ?? "")) problems.push(`${e.code}: source is not an https://www.kektura.hu/ or https://www.mtsz.org/ address`);
  }
  return problems;
}

export function seedCoordinates(seedSql) {
  const rows = seedSql.matchAll(/^ {2}\(\d+, '([^']+)', '[^']+', \d+, \d+, '(?:[^']|'')*', '(?:[^']|'')*', (-?[\d.]+), (-?[\d.]+),/gm);
  return new Map([...rows].map((m) => [m[1], { lat: Number(m[2]), lng: Number(m[3]) }]));
}

// A code that is new, or gone, is not a move.
export function unexplainedMoves(previous, current, moves, thresholdM = MOVE_THRESHOLD_M) {
  const explained = new Set(moves.map((e) => e.code));
  const found = [];
  for (const [code, now] of current) {
    const before = previous.get(code);
    if (!before || explained.has(code)) continue;
    const meters = flatMeters(before.lng, before.lat, [now.lng, now.lat]);
    if (meters > thresholdM) found.push({ code, meters: Math.round(meters) });
  }
  return found;
}

export function stampMovesSql(moves) {
  const sorted = [...moves].sort((a, b) => a.code.localeCompare(b.code));
  const clear =
    sorted.length === 0
      ? "update public.checkpoints set moved_on = null where moved_on is not null;"
      : `update public.checkpoints set moved_on = null where moved_on is not null and code <> all (array[${sorted.map((e) => q(e.code)).join(", ")}]);`;
  const set =
    sorted.length === 0
      ? ""
      : `\nupdate public.checkpoints c set moved_on = d.moved_on::date
from (values ${sorted.map((e) => `(${q(e.code)}, ${q(e.moved_on)})`).join(", ")}) as d(code, moved_on)
where c.code = d.code and c.moved_on is distinct from d.moved_on::date;`;
  return `-- Days a stamp moved (the moves of scripts/data/okt-stamp-dates.json).\n${clear}${set}\n`;
}
