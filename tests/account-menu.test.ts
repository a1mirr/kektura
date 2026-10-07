// Spec 0014 AC-20, AC-27: the header strip with the language switcher and the account menu is drawn once, by the locale
// layout, and no page has links of its own to the menu's pages in its header.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}

describe("spec 0014: the header strip", () => {
  it("AC-20: the locale layout puts the controls into the logo's strip, inside the translation provider the switcher needs", () => {
    const layout = read("src/app/[locale]/layout.tsx");
    expect(layout).toMatch(/<NextIntlClientProvider>\s*<SiteLogo locale=\{locale\}>\s*<HeaderControls \/>\s*<\/SiteLogo>/);
  });

  it("AC-20: the 404 page, which has no session and no language provider, draws the logo alone", () => {
    const notFound = read("src/app/not-found.tsx");
    expect(notFound).toContain("<SiteLogo locale={locale} />");
    expect(notFound).not.toMatch(/HeaderControls|AccountMenu|LocaleSwitcher/);
  });

  it("AC-20: only the strip draws the language switcher and the menu: no page has a switcher or a menu of its own", () => {
    const users = (name: string) => sourceFiles("src").filter((file) => read(file).includes(`<${name}`)).sort();
    expect(users("LocaleSwitcher")).toEqual(["src/components/HeaderControls.tsx"]);
    expect(users("AccountMenu")).toEqual(["src/components/HeaderControls.tsx"]);
    expect(users("HeaderControls")).toEqual(["src/app/[locale]/layout.tsx"]);
  });

  it("AC-20: the dashboard, stats, settings and Friends pages have no links of their own to the menu's pages", () => {
    for (const file of ["dashboard/page.tsx", "stats/page.tsx", "account/page.tsx", "(pages)/friends/page.tsx"]) {
      expect(read(`src/app/[locale]/${file}`), file).not.toMatch(/href="\/(stats|account|friends)"/);
    }
  });

  it("AC-14: a friend's page keeps exactly one link in its title row, back to the Friends list, and no other link row", () => {
    const source = read("src/app/[locale]/(pages)/friends/[id]/page.tsx");
    const start = source.indexOf("<header");
    const title = source.slice(start, source.indexOf("</header>", start));
    expect(start).toBeGreaterThan(-1);
    expect(title).toContain("<h1");
    const links = [...title.matchAll(/<(?:Link|a)\b[^>]*>/g)].map((match) => match[0]);
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href="/friends"');
    // and the page links to none of the other pages of the menu
    expect(source).not.toMatch(/href="\/(stats|account)"/);
  });

  it("AC-27: the controls read the session with getUser (never getClaims) and the friends flag per request, and only for a signed-in visitor", () => {
    const source = read("src/components/HeaderControls.tsx").replace(/^\s*\/\/.*$/gm, ""); // the code, not its comments
    expect(source).toContain("auth.getUser()");
    expect(source).not.toContain("getClaims");
    expect(source).toContain('flagOn("friends")');
    expect(source).toMatch(/user \? await flagOn\("friends"\) : false/);
    expect(source).not.toMatch(/service/i);
  });
});
