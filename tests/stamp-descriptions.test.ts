import fs from "node:fs";
import { describe, expect, it } from "vitest";
import translations from "../src/content/stamp-descriptions.json";

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = (s: string) => s.replace(/''/g, "'");
const STR = String.raw`'((?:[^']|'')*)'`;

const places = [
  ...read("supabase/seed.sql").matchAll(new RegExp(String.raw`^ {2}\(\d+, ${STR}, ${STR}, \d+, \d+, ${STR}, (?:null|${STR}),`, "gm")),
].map((m) => ({ code: sql(m[1]), original: m[4] === undefined ? null : sql(m[4]) }));
const extras = [
  ...read("supabase/seed_extra.sql").matchAll(new RegExp(String.raw`^ {2}\(${STR}, ${STR}, (?:null|${STR}),`, "gm")),
].map((m) => ({ code: sql(m[1]), original: m[3] === undefined ? null : sql(m[3]) }));
const stamps = [...places, ...extras];
const table = translations as Record<string, { en?: string; ru?: string; de?: string }>;

// A description that is only a street address ("József Attila u. 5.") reads the same in every language.
const addressOnly = (s: string) => /^\S+(?: \S+)* (?:u\.|út|utca) \d+\.?$/.test(s);

// OKK marker codes such as (EM147INF), (KD012IND) and (OKTPH_21_1): letters, then a digit, no spaces
const markers = (s: string) => s.match(/\b[A-Z][A-Z0-9_]*\d[A-Z0-9_]*\b/g) ?? [];

describe("spec 0033: translated stamp descriptions", () => {
  it("the seeds are parsed completely (the checks below aren't vacuous)", () => {
    expect(places.length).toBe((read("supabase/seed.sql").match(/^ {2}\(/gm) ?? []).length);
    expect(extras.length).toBe((read("supabase/seed_extra.sql").match(/^ {2}\(/gm) ?? []).length);
    expect(places.length).toBeGreaterThan(200);
    expect(extras.length).toBeGreaterThan(50);
    expect(stamps.filter((s) => s.original).length).toBeGreaterThan(280);
  });

  it("AC-3: every stamp code of the seeds has an en, a ru and a de translation", () => {
    const missing = stamps
      .filter((s) => s.original && !(table[s.code]?.en?.trim() && table[s.code]?.ru?.trim() && table[s.code]?.de?.trim()))
      .map((s) => s.code);
    expect(missing).toEqual([]);
  });

  it("AC-3: no translation belongs to a code that is not in the seeds", () => {
    const codes = new Set(stamps.map((s) => s.code));
    expect(Object.keys(table).filter((code) => !codes.has(code))).toEqual([]);
  });

  it("AC-4: a translation is a translation, not a copy of the Hungarian text, and ru is in Cyrillic", () => {
    for (const s of stamps) {
      if (!s.original || addressOnly(s.original)) continue;
      const t = table[s.code];
      expect(t.en, `${s.code} en`).not.toBe(s.original);
      expect(t.ru, `${s.code} ru`).not.toBe(s.original);
      expect(t.de, `${s.code} de`).not.toBe(s.original);
      expect(t.ru, `${s.code} ru`).toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("AC-4: a translation keeps the marker codes of the original, in the same order", () => {
    for (const s of stamps) {
      if (!s.original) continue;
      expect(markers(table[s.code].en!), `${s.code} en`).toEqual(markers(s.original));
      expect(markers(table[s.code].ru!), `${s.code} ru`).toEqual(markers(s.original));
      expect(markers(table[s.code].de!), `${s.code} de`).toEqual(markers(s.original));
    }
  });

  it("AC-4: a place description still ends with its own code, as in the original", () => {
    for (const p of places) {
      const code = /\(OKTPH_[A-Z0-9_]+\)\s*$/.exec(p.original ?? "")?.[0];
      expect(code, p.code).toBeTruthy();
      expect(table[p.code].en!.endsWith(code!), `${p.code} en`).toBe(true);
      expect(table[p.code].ru!.endsWith(code!), `${p.code} ru`).toBe(true);
      expect(table[p.code].de!.endsWith(code!), `${p.code} de`).toBe(true);
    }
  });

  it("AC-5: the seed generator neither reads nor writes the translations, so regenerating the seeds leaves them alone", () => {
    const generator = fs.readFileSync(new URL("../scripts/build-data.mjs", import.meta.url), "utf8");
    expect(generator).not.toMatch(/stamp-descriptions/);
    expect(fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8")).not.toMatch(/stamp-descriptions/);
  });
});
