// Spec 0036 AC-1, AC-2: one layout component sets the width, the side padding and the vertical rhythm of a page, and one CSS
// variable holds the width, so the header strip, the pages and the footer cannot disagree.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");

function files(dir: string, match: RegExp): string[] {
  return fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return files(rel, match);
    return match.test(entry.name) ? [rel] : [];
  });
}

// Every file that draws a page: the routes, the localized error boundary and the root 404 page.
const pageFiles = [
  ...files("src/app/[locale]", /^page\.tsx$/),
  "src/app/[locale]/error.tsx",
  "src/app/not-found.tsx",
];

describe("spec 0036: the page shell", () => {
  it("AC-2: finds the pages it is meant to guard (a moved folder cannot make the checks below vacuous)", () => {
    expect(pageFiles.length).toBeGreaterThanOrEqual(12);
    expect(pageFiles).toContain("src/app/[locale]/dashboard/page.tsx");
    expect(pageFiles).toContain("src/app/[locale]/(pages)/friends/[id]/page.tsx");
  });

  it.each(pageFiles)("AC-2: %s draws its page with PageShell and has no container of its own", (file) => {
    const source = read(file);
    expect(source).toMatch(/import PageShell from ["']@\/components\/PageShell["']/);
    expect(source).toMatch(/<PageShell[\s>]/);
    expect(source).not.toMatch(/<main\b/);
    expect(source).not.toMatch(/\bmx-auto\b/);
    expect(source).not.toMatch(/\bmax-w-(?:xs|sm|md|lg|xl|[2-7]xl|screen|\[|\()/);
  });

  it("AC-2: the width is one value in a CSS variable, 64 rem, and the shell, the logo strip and the footer all take it", () => {
    expect(read("src/app/globals.css")).toMatch(/--page-width:\s*64rem;/);
    const shell = read("src/components/PageShell.tsx");
    expect(shell).toContain("max-w-(--page-width)");
    for (const file of ["src/components/SiteLogo.tsx", "src/components/Footer.tsx"]) {
      expect(read(file), file).toContain('import { pageWidth } from "./PageShell"');
      expect(read(file), file).toContain("${pageWidth}");
      expect(read(file), file).not.toMatch(/\bmax-w-/);
    }
    // the page width is spelled out once: no other file carries 64rem or max-w-5xl
    const others = files("src", /\.(tsx?|css)$/).filter((file) => !/\.test\./.test(file) && file !== "src/app/globals.css");
    expect(others.filter((file) => /64rem|max-w-5xl/.test(read(file)))).toEqual([]);
  });

  it("AC-2: the side padding is 16 px up to 640 px and 24 px above", () => {
    expect(read("src/components/PageShell.tsx")).toContain('"mx-auto w-full max-w-(--page-width) px-4 sm:px-6"');
  });
});
