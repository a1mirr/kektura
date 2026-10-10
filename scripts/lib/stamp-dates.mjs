import fs from "node:fs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function readStampDates(file = "scripts/data/okt-stamp-dates.json") {
  return JSON.parse(fs.readFileSync(file, "utf8")).stamps;
}

export function stampDatesSql(entries) {
  const sorted = [...entries].sort((a, b) => a.code.localeCompare(b.code));
  const codes = sorted.map((e) => q(e.code)).join(", ");
  const values = sorted.map((e) => `(${q(e.code)}, ${q(e.required_from)})`).join(", ");
  return `-- Dates from which a new stamp is required (scripts/data/okt-stamp-dates.json).
update public.checkpoints set required_from = null where required_from is not null and code <> all (array[${codes}]);
update public.checkpoints c set required_from = d.required_from::date
from (values ${values}) as d(code, required_from)
where c.code = d.code and c.required_from is distinct from d.required_from::date;
`;
}
