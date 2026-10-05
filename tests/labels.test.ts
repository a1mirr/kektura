// Spec 0004 AC-13: the number a place is shown with ("19.6") shifts when a stamp is added before it, so nothing may
// store it, link to it or use it as a key. Source scan: a label is only ever displayed.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPlaces, type Checkpoint } from "@/lib/progress";

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : [];
  });
}

describe("spec 0004: place labels are display only", () => {
  it("AC-13: no source file uses a place's label as a key, id, link, anchor or stored value", () => {
    const misuse: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!/\b(p|place|v)\.label\b/.test(line)) return;
          if (/\bkey=|\bid=|href|#\$\{|Storage|setItem|searchParams|router|fetch\(|data-/.test(line.replace(/className="[^"]*"/g, ""))) {
            misuse.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(misuse).toEqual([]);
  });

  it("AC-13: a place's key can never be mistaken for its label", () => {
    const rows = ["OKTPH_01", "OKTPH_02_1", "OKTPH_03_B"].map(
      (code, i) =>
        ({ id: i + 1, seq: i + 1, stage: 1, stage_seq: i + 1, code, place_key: code.replace(/_\d+$/, ""), name: code, description: null, lat: 47, lng: 16, km_from_start: i, required_from: null }) satisfies Checkpoint,
    );
    for (const p of buildPlaces(rows)) {
      expect(p.key).not.toMatch(/^\d+\.\d+$/);
      expect(p.label).toMatch(/^\d+\.\d+$/);
    }
  });
});
