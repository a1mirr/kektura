// How fresh the trail data is (spec 0004 AC-17): the date of the MTSZ files a regeneration used, written next to the other
// generated data so the site can say it (spec 0015 AC-9, spec 0003 AC-28).
import path from "node:path";

const isRealDate = (iso) => {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
};

// The day in a file's name (`okt_bh_20260924.gpx`, `okt_bh_2026-09-24.gpx`) as YYYY-MM-DD. Throws when there is none: a regeneration
// must say which MTSZ file it is from.
export function fileDate(file) {
  const m = path.basename(file).match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  if (!m || !isRealDate(iso)) {
    throw new Error(`no date (YYYYMMDD) in the name of ${path.basename(file)}: keep the MTSZ's own file names`);
  }
  return iso;
}

// The data is as fresh as the older of the two files it was built from.
export const trailDataDate = (...files) => files.map(fileDate).sort()[0];

export const trailMetaJson = (mtszFileDate) => JSON.stringify({ mtszFileDate }) + "\n";
