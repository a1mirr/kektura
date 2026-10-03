// specs/README.md rules: the index lists every spec with its real status, and specs are written in English.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../specs/", import.meta.url);
const specFiles = fs.readdirSync(dir).filter((name) => /^\d{4}-.+\.md$/.test(name));
const read = (name: string) => fs.readFileSync(new URL(name, dir), "utf8");

describe("specs/README.md", () => {
  const readme = read("README.md");
  const indexed = new Map(
    [...readme.matchAll(/^\| \[(\d{4})\]\(([^)]+)\) \|.*\| (\w+) \|\r?$/gm)].map((m) => [m[2], { number: m[1], status: m[3] }]),
  );

  it("lists every spec once, and nothing else", () => {
    expect([...indexed.keys()].sort()).toEqual([...specFiles].sort());
  });

  it("gives each spec the status written in its own file", () => {
    for (const name of specFiles) {
      const own = /^Status: (\w+)/m.exec(read(name))?.[1];
      expect(own, `${name} has a "Status:" line`).toMatch(/^(Draft|Accepted|Done)$/);
      expect(indexed.get(name)?.status, name).toBe(own);
      expect(indexed.get(name)?.number, name).toBe(name.slice(0, 4));
    }
  });

  it("says specs are written in English", () => {
    expect(readme).toMatch(/Specs are always written in English/);
    expect(fs.readFileSync(new URL("../CLAUDE.md", import.meta.url), "utf8")).toMatch(/Specs are always written in English/);
  });

  it("has English-only specs (Cyrillic only where a line quotes the app's `ru` texts)", () => {
    const cyrillic = /[Ѐ-ӿ]/;
    for (const name of [...specFiles, "README.md", "_template.md"]) {
      const offending = read(name)
        .split(/\r?\n/)
        .filter((line) => cyrillic.test(line) && !line.includes("`ru`"));
      expect(offending, name).toEqual([]);
    }
  });
});
