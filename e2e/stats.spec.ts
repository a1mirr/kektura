import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type en from "../messages/en.json";
import { routing } from "../src/i18n/routing";
import { expectNoSidewaysScroll, openAccountMenu, seedStatsWalk, signInAsNewUser, stampPlacesOn, stampStagesOn, stat } from "./helpers";

const messages = (locale: string): typeof en => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"));

// Recharts has no layout in jsdom, so the chart is checked here, in a browser.

const bars = (page: Page) => page.locator("[data-month]");
const bar = (page: Page, name: RegExp | string) => page.getByRole("button", { name });
const tooltip = (page: Page) => page.locator("[data-chart-tooltip]");
const frame = (page: Page) => page.locator("[data-month-chart]");

// Waits for the chart to be drawn and hydrated (the bars exist only after the client has measured the chart).
async function openStats(page: Page, path = "/en/stats") {
  await page.goto(path);
  await expect(bars(page).first()).toBeAttached();
}

const walkedMonths = [
  { name: "December 2025", text: "December 2025\n1 stamp\n0 km\nStage 1" },
  { name: "January 2026", text: "January 2026\n2 stamps\n8.1 km\nStage 1" },
  { name: "February 2026", text: "February 2026\nNo stamps this month" },
  { name: "March 2026", text: "March 2026\n1 extra stamp\nStage 1" },
  { name: "April 2026", text: "April 2026\n1 stamp\n9.7 km\nStage 1" },
  { name: "May 2026", text: "May 2026\n1 stamp\n20.6 km\nStage 1" },
];

test.describe("spec 0037: the stats page", () => {
  test("AC-1: a signed-out visitor is sent to the landing page", async ({ page }) => {
    await page.goto("/en/stats");
    await expect(page).toHaveURL(/\/en$/);
  });

  test("AC-1, AC-2, AC-3: title, heading and the four figures; the account menu leads here; a new user gets a note, not a chart", async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await (await openAccountMenu(page)).getByRole("link", { name: "My stats", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/stats$/);
    await expect(page).toHaveTitle("My stats");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My stats");
    await expect(stat(page, "Stamps")).toHaveText("0 / 161");
    await expect(stat(page, "Kilometres")).toHaveText("0");
    await expect(stat(page, "Remaining, km")).not.toHaveText("0");
    await expect(stat(page, "Completed stages")).toHaveText("0 / 27");
    await expect(page.getByRole("heading", { name: "Stamps per month" })).toBeVisible();
    await expect(page.getByText("No stamps yet.")).toBeVisible();
    await expect(frame(page)).toHaveCount(0);
  });

  test("AC-3, AC-7: the figures are the dashboard's, and the months' km add up to its walked km", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    await page.goto("/en/dashboard");
    const dashboard = {
      stamps: await stat(page, "Stamps").innerText(),
      km: await stat(page, "Kilometres").innerText(),
      remaining: await stat(page, "Remaining, km").innerText(),
    };
    expect(dashboard).toMatchObject({ stamps: "5 / 161", km: "38.4" });

    await openStats(page);
    await expect(stat(page, "Stamps")).toHaveText(dashboard.stamps);
    await expect(stat(page, "Kilometres")).toHaveText(dashboard.km);
    await expect(stat(page, "Remaining, km")).toHaveText(dashboard.remaining);

    let sum = 0;
    for (const { name } of walkedMonths) {
      await bar(page, new RegExp(`^${name}:`)).hover();
      await expect(tooltip(page)).toContainText(name);
      sum += Number(/([\d.]+) km/.exec(await tooltip(page).innerText())?.[1] ?? 0);
    }
    expect(Math.round(sum * 10) / 10).toBe(38.4);
  });

  test("AC-3: completed stages are counted as the dashboard counts them", async ({ page }) => {
    const email = await signInAsNewUser(page);
    stampStagesOn(email, 6, "2026-06-01");
    await openStats(page);
    await expect(stat(page, "Completed stages")).toHaveText("6 / 27");
    await bars(page).first().hover();
    await expect(tooltip(page)).toContainText("Stages 1-6");
  });

  test("AC-4, AC-5, AC-6, AC-7, AC-11, AC-13: every month has a bar, and a hover tells its stamps, km and stages", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    await openStats(page);

    await expect(bars(page)).toHaveCount(6);
    await expect(page.getByRole("group", { name: "Stamps per month" }).getByRole("button")).toHaveCount(6);
    await expect(tooltip(page)).toHaveCount(0);
    for (const { name, text } of walkedMonths) {
      await bar(page, new RegExp(`^${name}:`)).hover();
      await expect.poll(() => tooltip(page).innerText(), { message: name }).toBe(text);
    }
    await bar(page, /^May 2026:/).click();
    await expect(tooltip(page)).toContainText("May 2026");
    await page.mouse.move(0, 0);
    await expect(tooltip(page)).toHaveCount(0);

    // a bar's height is its month's stamps: January (2) is twice December (1); an empty month has a faint mark instead of a bar
    const barHeight = async (name: string) =>
      (await bar(page, new RegExp(`^${name}:`)).locator("rect[fill='#2563eb']").boundingBox())!.height;
    expect((await barHeight("January 2026")) / (await barHeight("December 2025"))).toBeCloseTo(2, 1);
    const empty = bar(page, /^February 2026:/);
    await expect(empty.locator("rect[fill='#2563eb']")).toHaveCount(0);
    await expect(empty.locator("rect[fill='#a8a29e']")).toHaveCount(1);
    expect((await empty.locator("rect[fill='#a8a29e']").boundingBox())!.height).toBeGreaterThan(0);
  });

  test("AC-9, AC-14: the axis names every month, with the year under January and under the first bar", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    await openStats(page);
    expect(await page.locator("[data-tick=month]").allTextContents()).toEqual(["Dec", "Jan", "Feb", "Mar", "Apr", "May"]);
    expect(await page.locator("[data-tick=year]").allTextContents()).toEqual(["2025", "2026"]);
    const dec = await page.locator("[data-tick=month]").first().boundingBox();
    const year = await page.locator("[data-tick=year]").first().boundingBox();
    expect(year!.y).toBeGreaterThan(dec!.y);
    expect(Math.abs(year!.x + year!.width / 2 - (dec!.x + dec!.width / 2))).toBeLessThan(3);
  });

  test("AC-12: with the keyboard: Tab reaches the newest month, the arrows move between months, Escape closes, Enter toggles", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    await openStats(page);
    await expect(async () => {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-month"))).toBe(true);
    }).toPass();
    await expect(page.locator("[data-month='2026-05']")).toBeFocused();
    await expect(tooltip(page)).toContainText("May 2026");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("[data-month='2026-04']")).toBeFocused();
    await expect(tooltip(page)).toContainText("April 2026");
    await page.keyboard.press("Home");
    await expect(tooltip(page)).toContainText("December 2025");
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("[data-month='2025-12']")).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.locator("[data-month='2026-05']")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(tooltip(page)).toHaveCount(0);
    await expect(page.locator("[data-month='2026-05']")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tooltip(page)).toContainText("May 2026");
    await page.keyboard.press("Space");
    await expect(tooltip(page)).toHaveCount(0);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-month"))).toBe(false);
  });

  test("AC-15: every bar is a button whose name is the tooltip's sentence", async ({ page }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    await openStats(page);
    await expect(bar(page, "January 2026: 2 stamps, 8.1 km, Stage 1")).toBeVisible();
    await expect(bar(page, "February 2026: No stamps this month")).toBeVisible();
    await expect(bar(page, "March 2026: 1 extra stamp, Stage 1")).toBeVisible();
    await expect(page.getByRole("group", { name: "Stamps per month" })).toBeVisible();
  });

  test("AC-10: a long walk scrolls inside the chart's own frame, not the page, at 320 and 375 px, and names every month", async ({ page }) => {
    const email = await signInAsNewUser(page);
    stampPlacesOn(email, { OKTPH_01_DDKPH_01: "2025-01-05", OKTPH_02: "2026-02-10" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await openStats(page);
    await expect(page.locator("[data-tick=month]")).toHaveCount(14);
    expect(await frame(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await openStats(page);
      await expectNoSidewaysScroll(page, `sideways scroll at ${width} px on /en/stats`);
      const f = await frame(page).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, left: el.scrollLeft }));
      expect(f.scroll, `the frame scrolls at ${width} px`).toBeGreaterThan(f.client);
      expect(f.left).toBeGreaterThan(0);
      const newest = (await bars(page).last().boundingBox())!;
      const box = (await frame(page).boundingBox())!;
      expect(newest.x + newest.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(await page.locator("[data-tick=month]").allTextContents()).toHaveLength(14);
      for (const label of await page.locator("[data-tick=month]").allTextContents()) expect(label.trim()).not.toBe("");
      await frame(page).evaluate((el) => (el.scrollLeft = 0));
      await expect(bar(page, /^January 2025:/)).toBeInViewport();
    }
  });

  test("AC-13, AC-14: in Russian: the month, the plurals and the words come from the messages", async ({ page }) => {
    const email = await signInAsNewUser(page);
    stampPlacesOn(email, { OKTPH_01_DDKPH_01: "2026-05-01", OKTPH_02: "2026-05-02", OKTPH_03: "2026-05-03", OKTPH_04: "2026-05-04", OKTPH_05: "2026-05-05" });
    stampPlacesOn(email, { OKTPH_06: "2026-06-01", OKTPH_07: "2026-06-02" });
    await openStats(page, "/ru/stats");
    const month = (day: string) => new Intl.DateTimeFormat("ru", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day));
    await bars(page).first().hover();
    const may = (await tooltip(page).innerText()).split("\n");
    expect(may[0]).toBe(month("2026-05-01"));
    expect(may[1]).toBe("5 печатей");
    expect(may[2]).toMatch(/ км$/);
    expect(may[3]).toBe("Этап 1");
    await bars(page).last().hover();
    const june = (await tooltip(page).innerText()).split("\n");
    expect(june[0]).toBe(month("2026-06-01"));
    expect(june[1]).toBe("2 печати");
  });

  for (const locale of routing.locales) {
    test(`AC-2, AC-14: the title, the heading and the figures are in ${locale}`, async ({ page }) => {
      const m = messages(locale);
      await signInAsNewUser(page);
      await page.goto(`/${locale}/dashboard`);
      await expect((await openAccountMenu(page)).getByRole("link", { name: m.accountMenu.stats, exact: true })).toHaveAttribute("href", `/${locale}/stats`);
      await page.goto(`/${locale}/stats`);
      await expect(page).toHaveTitle(m.stats.title);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(m.stats.title);
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(m.stats.perMonth);
      await expect(page.locator("dl dt")).toHaveText([m.dashboard.stamps, m.dashboard.km, m.dashboard.remaining, m.stats.stages]);
      await expect(page.getByText(m.stats.empty)).toBeVisible();
    });
  }

  for (const locale of routing.locales) {
    test(`AC-9, AC-14: the axis and the tooltip write the month the way ${locale} does`, async ({ page }) => {
      const email = await signInAsNewUser(page);
      stampPlacesOn(email, { OKTPH_01_DDKPH_01: "2026-05-10" });
      await openStats(page, `/${locale}/stats`);
      const written = (options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date("2026-05-01T00:00:00Z"));
      await expect(page.locator("[data-tick=month]")).toHaveText(written({ month: "short" }));
      await expect(page.locator("[data-tick=year]")).toHaveText(written({ year: "numeric" }));
      await bars(page).first().hover();
      await expect(tooltip(page)).toContainText(written({ month: "long", year: "numeric" }));
    });
  }

  test("AC-16: the page shows the user's own stamps only", async ({ page, browser }) => {
    const email = await signInAsNewUser(page);
    seedStatsWalk(email);
    const other = await (await browser.newContext()).newPage();
    await signInAsNewUser(other);
    await other.goto("/en/stats");
    await expect(stat(other, "Stamps")).toHaveText("0 / 161");
    await expect(other.getByText("No stamps yet.")).toBeVisible();
    await other.context().close();
  });
});
