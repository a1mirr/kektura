// How fresh the trail data is (spec 0004 AC-17): the date of the MTSZ files the last regeneration was built from, written by
// scripts/build-data.mjs into public/data/okt-meta.json. The About page and the dashboard's map say it (spec 0015 AC-9, spec 0003 AC-28).
import meta from "../../public/data/okt-meta.json";

export const TRAIL_DATA_DATE: string = meta.mtszFileDate; // YYYY-MM-DD
