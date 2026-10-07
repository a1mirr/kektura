// Spec 0014 AC-19: the site logo is one component, drawn by the locale layout and the 404 page, never by a page.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import de from "../messages/de.json";
import hu from "../messages/hu.json";
import ru from "../messages/ru.json";

const root = new URL("../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}

describe("spec 0014: the site logo", () => {
  it("AC-19: the locale layout and the 404 page render it, in their own language", () => {
    expect(read("src/app/[locale]/layout.tsx")).toContain("<SiteLogo locale={locale}>");
    expect(read("src/app/not-found.tsx")).toContain("<SiteLogo locale={locale} />");
  });

  it("AC-19: no other file draws it, so a new page gets it without remembering", () => {
    const users = sourceFiles("src").filter((file) => read(file).includes("SiteLogo") && file !== "src/components/SiteLogo.tsx");
    expect(users.sort()).toEqual(["src/app/[locale]/layout.tsx", "src/app/not-found.tsx"]);
  });

  it("AC-19: the mark is one local SVG with no reference to another host", () => {
    const svg = read("public/logo.svg");
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/); // only the SVG namespace
    expect(svg).not.toMatch(/<(script|image|use)\b|href=|url\(/);
    expect(read("src/components/SiteLogo.tsx")).toContain('src="/logo.svg"');
  });

  it("AC-19: the mark is decorative: the name next to it is its text", () => {
    const component = read("src/components/SiteLogo.tsx");
    expect(component).toContain('alt=""');
    expect(component).toContain('t("name")');
  });

  it.each(Object.entries({ en, ru, hu, de }))("AC-19: %s names the site and the link, and the name is part of the link's name", (_, messages) => {
    expect(messages.app.home).toContain(messages.app.name);
  });

  it.each(Object.entries({ en, ru, hu, de }))("AC-19: %s has no 'back to the tracker' text left on the About and friends pages", (_, messages) => {
    expect(Object.keys(messages.about)).not.toContain("back");
    expect(Object.keys(messages.friends)).not.toContain("back");
  });
});
