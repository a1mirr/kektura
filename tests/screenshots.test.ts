import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { SCREENSHOT_SIZE, SCREENSHOTS, SCREENSHOTS_BUDGET_BYTES, screenshotPath } from "@/lib/screenshots";
import { DEMO_EMAIL, DEMO_WALK, demoSql, pageProblems, pngSize, SIZE } from "../scripts/lib/screenshots.mjs";
import { main, Problem } from "../scripts/screenshots.mjs";
import { messageFiles } from "./message-files";

const publicDir = new URL("../public/", import.meta.url);
const folder = new URL("screenshots/", publicDir);
const read = (name: string) => fs.readFileSync(new URL(`${name}.png`, folder));

describe("spec 0038: the pictures", () => {
  it("AC-1: there is one picture for each screen of the gallery, at the path the page uses, and nothing else in the folder", () => {
    expect(SCREENSHOTS).toEqual(["dashboard", "map", "route"]);
    for (const name of SCREENSHOTS) expect(fs.existsSync(new URL(`.${screenshotPath(name)}`, publicDir)), name).toBe(true);
    expect(fs.readdirSync(folder).sort()).toEqual(SCREENSHOTS.map((name) => `${name}.png`).sort());
  });

  it.each(SCREENSHOTS)("AC-4, AC-9: %s is a PNG of exactly the size the page gives it", (name) => {
    expect(pngSize(read(name))).toEqual(SCREENSHOT_SIZE);
  });

  it("AC-9: the script and the page agree on the size, a phone's width at a device scale of 2", () => {
    expect({ width: SIZE.width, height: SIZE.height }).toEqual(SCREENSHOT_SIZE);
    expect(SIZE.scale).toBe(2);
    expect(SIZE.width / SIZE.scale).toBe(390);
  });

  it("AC-9: all the pictures together stay under the budget", () => {
    const total = SCREENSHOTS.reduce((sum, name) => sum + read(name).length, 0);
    expect(total, `${total} bytes, the budget is ${SCREENSHOTS_BUDGET_BYTES}`).toBeLessThanOrEqual(SCREENSHOTS_BUDGET_BYTES);
    expect(SCREENSHOTS_BUDGET_BYTES).toBeLessThanOrEqual(3_000_000);
  });

  it("AC-9: a file that is not a PNG is refused by the size check", () => {
    expect(() => pngSize(Buffer.from("not a picture at all, just text of some length"))).toThrow(/not a PNG/);
  });
});

describe("spec 0038: the texts", () => {
  const trees = Object.entries(messageFiles) as [string, { home: { screenshots: Record<string, string> } }][];

  it.each(trees)("AC-1, AC-2: %s has a heading, a note and an alt text and a caption for every screen", (_, tree) => {
    const keys = Object.keys(tree.home.screenshots).sort();
    expect(keys).toEqual(["heading", "note", ...SCREENSHOTS.flatMap((name) => [`${name}Alt`, `${name}Caption`])].sort());
    for (const [key, text] of Object.entries(tree.home.screenshots)) expect(text.trim().length, key).toBeGreaterThan(key === "heading" ? 5 : 20);
  });

  it.each(trees)("AC-3: %s says nothing of friends: that feature is behind a flag (spec 0024) and is not in the pictures", (_, tree) => {
    const all = Object.values(tree.home.screenshots).join(" ");
    expect(all).not.toMatch(/friend|barát|друз|freund/i);
  });

  it.each(trees)("AC-2: %s tells that the pictures are in English", (locale, tree) => {
    const note = tree.home.screenshots.note;
    expect(note, locale).toMatch(/English|angol|английск|englisch/i);
  });
});

describe("spec 0038: the demo dataset", () => {
  it("AC-10: the demo account is a made-up address of the test server", () => {
    expect(DEMO_EMAIL).toMatch(/^[a-z]+@kektura\.test$/);
  });

  it("AC-10: the SQL only touches the demo account's rows, and gives it the same stamps every time", () => {
    const sql = demoSql();
    expect(demoSql()).toBe(sql);
    const statements = sql.split("\n");
    expect(statements.length).toBeGreaterThan(5);
    for (const statement of statements) {
      expect(statement, statement).toContain(`(select id from auth.users where email = '${DEMO_EMAIL}')`);
      expect(statement, statement).toMatch(/^(delete from public\.user_(extra_)?stamps where user_id = |insert into public\.user_(extra_)?stamps )/);
    }
    expect(statements.slice(0, 2).every((s) => s.startsWith("delete from"))).toBe(true);
    expect(sql).toContain("retired_on is null");
  });

  it("AC-10: the walk is the first three stages, the start of the fourth and two extra stamps, each on a past day", () => {
    expect(DEMO_WALK.stages.map((s: { upToStage: number }) => s.upToStage)).toEqual([1, 2, 3]);
    expect(DEMO_WALK.partialStage.stage).toBe(4);
    expect(DEMO_WALK.extras).toHaveLength(2);
    const days = [...DEMO_WALK.stages, DEMO_WALK.partialStage, ...DEMO_WALK.extras].map((s: { day: string }) => s.day);
    for (const day of days) expect(day).toMatch(/^2026-\d\d-\d\d$/);
  });

  it("AC-10: an address with a quote cannot break out of the SQL", () => {
    expect(demoSql("o'neil@kektura.test")).toContain("'o''neil@kektura.test'");
  });
});

describe("spec 0038: the checks before a picture is taken", () => {
  const banner = "Test server: local data and a dummy login. Not production.";
  const errors = ["Something went wrong", "Sign-in failed, please try again."];

  it("AC-11: a clean page has no problems", () => {
    expect(pageProblems({ text: "My progress\nStamps 27 / 161", alerts: 0, banner, errors })).toEqual([]);
  });

  it("AC-11: an email address on the page is a problem, and the message does not repeat the address", () => {
    const problems = pageProblems({ text: "Signed in as someone@example.com", banner, errors });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/email address/);
    expect(problems[0]).not.toContain("someone");
  });

  it("AC-11: the test server's banner, an error message and an alert are problems", () => {
    expect(pageProblems({ text: `${banner} My progress`, banner, errors })).toEqual(["the page shows the test server banner"]);
    expect(pageProblems({ text: "Something went wrong", banner, errors })).toEqual([`the page shows an error: "Something went wrong"`]);
    expect(pageProblems({ text: "My progress", alerts: 2, banner, errors })).toEqual(["the page shows 2 alert messages"]);
    expect(pageProblems({ text: "My progress", alerts: 1, banner, errors })).toEqual(["the page shows 1 alert message"]);
  });

  it("AC-11: every problem is reported, not only the first", () => {
    expect(pageProblems({ text: `a@b.co ${banner} Something went wrong`, alerts: 1, banner, errors })).toHaveLength(4);
  });
});

describe("spec 0038: a stopped run writes nothing", () => {
  const png = (width: number, height: number) => {
    const buffer = Buffer.alloc(33);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
  };
  const tempFolder = () => pathToFileURL(fs.mkdtempSync(path.join(os.tmpdir(), "screenshots-")) + path.sep);

  it("AC-11: when a screen cannot be taken the folder keeps its old pictures", async () => {
    const out = tempFolder();
    fs.writeFileSync(new URL("dashboard.png", out), "old");
    const take = async () => {
      throw new Problem("map: the page shows an email address (***@example.com).");
    };
    await expect(main({ take, out })).rejects.toThrow(/email address/);
    expect(fs.readdirSync(out)).toEqual(["dashboard.png"]);
    expect(fs.readFileSync(new URL("dashboard.png", out), "utf8")).toBe("old");
  });

  it("AC-10: when every screen is taken the files are written under the names of the screens", async () => {
    const out = tempFolder();
    const take = async () => new Map(SCREENSHOTS.map((name) => [name, png(1, 1)]));
    await main({ take, out });
    expect(fs.readdirSync(out).sort()).toEqual(SCREENSHOTS.map((name) => `${name}.png`).sort());
  });
});
